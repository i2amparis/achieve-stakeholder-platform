<?php

namespace Drupal\achieve_core\Import;

use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Entity\ContentEntityInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;

/**
 * Loads the import model (drupal/import/model.json, written by `npm run import`)
 * into Drupal, idempotently.
 *
 * - Records are matched by natural keys: slugs and codes for terms, URL for webinars,
 *   file name for infographics, and the output's source key (deliverable code or
 *   normalised title). A changed title is followed through the record's link.
 * - Only fields the sheet owns are written. Existing outputs keep their slug and their
 *   published status; nothing is ever deleted (records no longer in the sheet are flagged).
 * - A second run with the same model changes nothing.
 */
final class ContentImporter {

  private bool $dryRun = FALSE;
  private array $changes = [];
  private array $unchanged = [];
  private array $flags = [];
  private int $tempId = -1;
  /** In a dry run, what would have been created ("bundle:key" → temporary id). */
  private array $wouldCreate = [];

  public function __construct(
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly TimeInterface $time,
  ) {}

  /**
   * @return array{changes: array, unchanged: array, flags: array}
   */
  public function import(array $model, bool $dryRun = FALSE): array {
    if (($model['version'] ?? NULL) !== 1) {
      throw new \RuntimeException('Unsupported model version. Run `npm run import` with the current code.');
    }
    $this->dryRun = $dryRun;
    $this->changes = $this->unchanged = $this->flags = $this->wouldCreate = [];
    $t = $model['taxonomies'];

    // --- Taxonomies -------------------------------------------------------------
    $actors = [];
    foreach ($t['actors'] as $a) {
      $actors[$a['slug']] = $this->term('actor', 'field_slug', $a['slug'], ['name' => $a['name'], 'weight' => $a['sort'], 'field_is_hub' => (int) $a['is_hub']]);
    }
    foreach ($t['actors'] as $a) {
      $this->term('actor', 'field_slug', $a['slug'], ['field_shown_in' => array_values(array_map(fn($s) => $actors[$s], $a['shown_in']))]);
    }
    $principles = [];
    foreach ($t['principles'] as $p) {
      $principles[$p['code']] = $this->term('principle', 'field_code', $p['code'], ['name' => $p['name'], 'weight' => $p['sort'], 'field_slug' => $p['slug'], 'field_short_name' => $p['short_name']]);
    }
    $dimensions = [];
    foreach ($t['dimensions'] as $d) {
      $dimensions[$d['slug']] = $this->term('dimension', 'field_slug', $d['slug'], ['name' => $d['name'], 'weight' => $d['sort'], 'field_principle' => [$principles[$d['principle']]]]);
    }
    $regions = [];
    foreach ($t['regions'] as $r) {
      $regions[$r['slug']] = $this->term('region', 'field_slug', $r['slug'], ['name' => $r['name'], 'weight' => $r['sort']]);
    }
    $types = [];
    foreach ($t['output_types'] as $o) {
      $types[$o['name']] = $this->term('output_type', 'field_slug', $o['slug'], ['name' => $o['name'], 'weight' => $o['sort']]);
    }
    $partners = [];
    foreach ($t['partners'] as $p) {
      // The full name is editorial (added in Drupal); on creation it starts as the acronym.
      $partners[$p['code']] = $this->term('partner', 'field_code', $p['code'], ['weight' => $p['sort']], ['name' => $p['code']]);
    }

    // --- Webinars and infographics ---------------------------------------------
    $webinars = [];
    foreach ($model['webinars'] as $url) {
      $webinars[$url] = $this->upsert('node', 'webinar', 'field_url', $url, [], ['title' => $url, 'field_url' => ['uri' => $url], 'status' => 1, 'uid' => 1]);
    }
    $visuals = [];
    foreach ($model['visuals'] as $v) {
      $visuals[$v['filename']] = $this->upsert('media', 'infographic', 'field_filename', $v['filename'],
        ['field_alt_text' => $v['alt_text'], 'field_confirmed' => (int) $v['confirmed']],
        ['name' => $v['filename'], 'status' => 1, 'uid' => 1]);
    }

    // --- Outputs ----------------------------------------------------------------
    $storage = $this->entityTypeManager->getStorage('node');
    $modelKeys = array_column($model['outputs'], 'source_key');
    $outputIds = [];
    foreach ($model['outputs'] as $o) {
      $want = [
        'title' => $o['title'],
        'field_kind' => $o['kind'],
        'field_code' => $o['code'],
        'field_status' => $o['status'],
        'field_date' => $o['date'],
        'field_work_package' => $o['work_package'],
        'field_authors' => $o['authors'],
        'field_teaser' => $o['teaser'],
        'field_abstract' => $o['abstract'] === NULL ? NULL : ['value' => $o['abstract'], 'format' => 'basic_html'],
        'field_link' => $o['link'] === NULL ? NULL : ['uri' => $o['link']],
        'field_pid_type' => $o['pid_type'],
        'field_citation' => $o['citation'],
        'field_publisher' => $o['publisher'],
        'field_issn' => $o['issn'],
        'field_book_rid' => $o['book_rid'],
        'field_book_title' => $o['book_title'],
        'field_open_access' => $o['open_access'] === NULL ? NULL : ($o['open_access'] ? 'yes' : 'no'),
        'field_peer_reviewed' => $o['peer_reviewed'] === NULL ? NULL : ($o['peer_reviewed'] ? 'yes' : 'no'),
        'field_confirmed' => (int) $o['confirmed'],
        'field_unconfirmed_fields' => $o['unconfirmed_fields'],
        'field_source_sheet' => $o['source_sheet'],
        'field_output_type' => $o['output_type'] === NULL ? [] : [$types[$o['output_type']] ?? NULL],
        'field_lead_partner' => $o['lead_partner'] === NULL ? [] : [$partners[$o['lead_partner']] ?? NULL],
        'field_contributors' => array_map(fn($c) => $partners[$c] ?? NULL, $o['contributors']),
        'field_actors' => array_map(fn($s) => $actors[$s] ?? NULL, $o['actors']),
        'field_principles' => array_map(fn($c) => $principles[$c] ?? NULL, $o['principles']),
        'field_dimensions' => array_map(fn($s) => $dimensions[$s] ?? NULL, $o['dimensions']),
        'field_regions' => array_map(fn($s) => $regions[$s] ?? NULL, $o['regions']),
        'field_webinar' => $o['webinar'] === NULL ? [] : [$webinars[$o['webinar']] ?? NULL],
        'field_visuals' => array_map(fn($f) => $visuals[$f] ?? NULL, $o['visuals']),
      ];
      $messages = array_map(fn($m) => ['actor' => $actors[$m['actor']] ?? NULL, 'message' => $m['message']], $o['actor_messages']);

      $node = $this->findOne('node', 'output', 'field_source_key', $o['source_key']);
      $renamed = FALSE;
      if (!$node && $o['link']) {
        // Title corrected in the sheet: same link, and the old key is no longer in the sheet.
        foreach ($storage->loadByProperties(['type' => 'output', 'field_link' => $o['link']]) as $candidate) {
          $old = $candidate->get('field_source_key')->value;
          if ($old && !in_array($old, $modelKeys, TRUE)) {
            $this->flags[] = "Matched \"{$o['title']}\" to the existing \"{$candidate->label()}\" by its link (title changed in the sheet).";
            $candidate->set('field_source_key', $o['source_key']);
            $node = $candidate;
            $renamed = TRUE;
            break;
          }
        }
      }

      if (!$node) {
        $node = $storage->create(['type' => 'output', 'status' => 1, 'uid' => 1, 'field_source_key' => $o['source_key'], 'field_slug' => $this->freeSlug($o['slug'], $o['date'])]);
        foreach ($want as $field => $value) {
          $this->setValue($node, $field, $value);
        }
        $this->setMessages($node, $messages);
        $this->setFormats($node, $o['formats'], $types);
        $node->set('field_imported_at', $this->time->getRequestTime());
        $outputIds[$o['source_key']] = $this->save($node, 'create', 'output', $o['source_key'], []);
        continue;
      }

      $changed = $renamed ? ['field_source_key'] : [];
      foreach ($want as $field => $value) {
        if (!$this->same($node, $field, $value)) {
          $this->setValue($node, $field, $value);
          $changed[] = $field;
        }
      }
      $replacedMessages = [];
      if ($this->currentMessages($node) !== $messages) {
        $replacedMessages = $this->setMessages($node, $messages);
        $changed[] = 'field_actor_messages';
      }
      if ($this->setFormats($node, $o['formats'], $types)) {
        $changed[] = 'field_formats';
      }
      $outputIds[$o['source_key']] = (int) $node->id();
      if (!$changed) {
        $this->unchanged['output'] = ($this->unchanged['output'] ?? 0) + 1;
        continue;
      }
      $node->set('field_imported_at', $this->time->getRequestTime());
      $node->setNewRevision(TRUE);
      $node->setRevisionLogMessage('Content-sheet import');
      $this->save($node, 'update', 'output', $o['source_key'], $changed);
      // Old key-message paragraphs go only after the output was saved with the new ones.
      if (!$this->dryRun) {
        foreach ($replacedMessages as $p) {
          $p->delete();
        }
      }
    }

    // --- Typed relations (ensured; relations added by editors are kept) ------------
    foreach ($model['outputs'] as $o) {
      foreach ($o['relations'] as $r) {
        $from = $outputIds[$o['source_key']] ?? NULL;
        $to = $outputIds[$r['to']] ?? NULL;
        if (!$from || !$to || $from < 0 || $to < 0) {
          continue;
        }
        $node = $storage->load($from);
        $existing = NULL;
        foreach ($node->get('field_relations')->referencedEntities() as $p) {
          if ((int) $p->get('field_related_output')->target_id === $to && $p->get('field_relation_type')->value === $r['type']) {
            $existing = $p;
          }
        }
        if ($existing && $existing->get('field_note')->value === $r['note']) {
          continue;
        }
        $this->changes[] = [$existing ? 'update' : 'create', 'relation', "{$o['source_key']} {$r['type']} {$r['to']}", ['field_note']];
        if ($this->dryRun) {
          continue;
        }
        if ($existing) {
          $existing->set('field_note', $r['note'])->save();
          continue;
        }
        $p = $this->entityTypeManager->getStorage('paragraph')->create(['type' => 'relation', 'field_related_output' => $to, 'field_relation_type' => $r['type'], 'field_note' => $r['note']]);
        $node->get('field_relations')->appendItem($p);
        $node->save();
      }
    }

    // --- Records in Drupal that are no longer in the sheet -----------------------
    $ids = $storage->getQuery()->accessCheck(FALSE)->condition('type', 'output')->exists('field_source_sheet')->execute();
    foreach ($storage->loadMultiple($ids) as $node) {
      $key = $node->get('field_source_key')->value;
      if ($key && !in_array($key, $modelKeys, TRUE)) {
        $this->flags[] = "\"{$node->label()}\" ({$node->get('field_slug')->value}) is no longer in the sheet. Not deleted: unpublish it in Drupal if it should go.";
      }
    }

    return ['changes' => $this->changes, 'unchanged' => $this->unchanged, 'flags' => $this->flags];
  }

  /**
   * Upsert a taxonomy term by a key field. $onCreate values are set only on creation.
   */
  private function term(string $vid, string $keyField, string $key, array $values, array $onCreate = []): int {
    return $this->upsert('taxonomy_term', $vid, $keyField, $key, $values, $onCreate + ['vid' => $vid, 'name' => $values['name'] ?? $key]);
  }

  /**
   * Upsert an entity of a bundle by a key field; returns its id (negative in a dry run).
   */
  private function upsert(string $type, string $bundle, string $keyField, string $key, array $values, array $onCreate): int {
    $entity = $this->findOne($type, $bundle, $keyField, $key);
    if (!$entity && isset($this->wouldCreate["$bundle:$key"])) {
      return $this->wouldCreate["$bundle:$key"];
    }
    if (!$entity) {
      $bundleKey = $this->entityTypeManager->getDefinition($type)->getKey('bundle');
      $entity = $this->entityTypeManager->getStorage($type)->create($onCreate + [$bundleKey => $bundle]);
      $entity->set($keyField, $keyField === 'field_url' ? ['uri' => $key] : $key);
      foreach ($values as $field => $value) {
        $this->setValue($entity, $field, $value);
      }
      $id = $this->save($entity, 'create', $bundle, $key, []);
      if ($this->dryRun) {
        $this->wouldCreate["$bundle:$key"] = $id;
      }
      return $id;
    }
    $changed = [];
    foreach ($values as $field => $value) {
      if (!$this->same($entity, $field, $value)) {
        $this->setValue($entity, $field, $value);
        $changed[] = $field;
      }
    }
    if (!$changed) {
      $this->unchanged[$bundle] = ($this->unchanged[$bundle] ?? 0) + 1;
      return (int) $entity->id();
    }
    return $this->save($entity, 'update', $bundle, $key, $changed);
  }

  private function findOne(string $type, string $bundle, string $keyField, string $key): ?ContentEntityInterface {
    $bundleKey = $this->entityTypeManager->getDefinition($type)->getKey('bundle');
    $property = $keyField === 'field_url' ? 'field_url.uri' : $keyField;
    $ids = $this->entityTypeManager->getStorage($type)->getQuery()->accessCheck(FALSE)->condition($bundleKey, $bundle)->condition($property, $key)->range(0, 1)->execute();
    return $ids ? $this->entityTypeManager->getStorage($type)->load(reset($ids)) : NULL;
  }

  private function save(ContentEntityInterface $entity, string $action, string $bundle, string $key, array $fields): int {
    $this->changes[] = [$action, $bundle, $key, $fields];
    if ($this->dryRun) {
      return $entity->isNew() ? $this->tempId-- : (int) $entity->id();
    }
    $entity->save();
    return (int) $entity->id();
  }

  /**
   * The value of a field in a comparable form.
   */
  private function current(ContentEntityInterface $entity, string $field): mixed {
    $items = $entity->get($field);
    if ($items->isEmpty()) {
      return NULL;
    }
    $type = $items->getFieldDefinition()->getType();
    if ($type === 'entity_reference') {
      return array_map(fn($i) => (int) $i['target_id'], $items->getValue());
    }
    if ($field === 'field_unconfirmed_fields') {
      return array_column($items->getValue(), 'value');
    }
    return match ($type) {
      'link' => ['uri' => $items->uri],
      'text_long' => ['value' => $items->value, 'format' => $items->format],
      'boolean' => (int) $items->value,
      default => $items->value,
    };
  }

  /**
   * Compare a field with a wanted value. Lists drop unknown (NULL) entries and an empty
   * list means "no value"; plain values compare as text, because Drupal returns some
   * numbers (weights, booleans) as strings.
   */
  private function same(ContentEntityInterface $entity, string $field, mixed $value): bool {
    $current = $this->current($entity, $field);
    if (is_array($value) && array_is_list($value)) {
      $value = array_values(array_filter($value, fn($v) => $v !== NULL));
      if ($value === []) {
        $value = NULL;
      }
    }
    if ($value === '') {
      $value = NULL;
    }
    if (!is_array($current) && !is_array($value)) {
      return ($current === NULL) === ($value === NULL) && (string) $current === (string) $value;
    }
    return $current == $value && json_encode($current) === json_encode($value);
  }

  private function setValue(ContentEntityInterface $entity, string $field, mixed $value): void {
    if (is_array($value) && array_is_list($value)) {
      $value = array_values(array_filter($value, fn($v) => $v !== NULL));
      if ($entity->get($field)->getFieldDefinition()->getType() === 'entity_reference') {
        $value = array_map(fn($id) => ['target_id' => $id], $value);
      }
    }
    $entity->set($field, $value);
  }

  private function currentMessages(ContentEntityInterface $node): array {
    return array_map(fn($p) => ['actor' => (int) $p->get('field_actor')->target_id, 'message' => $p->get('field_message')->value], $node->get('field_actor_messages')->referencedEntities());
  }

  /**
   * Replace the key messages; returns the old paragraphs, to delete after saving.
   */
  private function setMessages(ContentEntityInterface $node, array $messages): array {
    $old = $node->get('field_actor_messages')->referencedEntities();
    $storage = $this->entityTypeManager->getStorage('paragraph');
    $node->set('field_actor_messages', array_map(fn($m) => $storage->create(['type' => 'actor_message', 'field_actor' => $m['actor'], 'field_message' => $m['message']]), $messages));
    return $old;
  }

  /**
   * Formats: rows with a source key belong to the import; rows added by editors are kept.
   * Returns whether anything changed.
   */
  private function setFormats(ContentEntityInterface $node, array $formats, array $types): bool {
    $storage = $this->entityTypeManager->getStorage('paragraph');
    $current = $node->get('field_formats')->referencedEntities();
    $byKey = [];
    foreach ($current as $p) {
      if ($k = $p->get('field_source_key')->value) {
        $byKey[$k] = $p;
      }
    }
    $changed = FALSE;
    $keep = [];
    foreach ($formats as $f) {
      $values = [
        'field_output_type' => $f['output_type'] === NULL ? NULL : ($types[$f['output_type']] ?? NULL),
        'field_format_title' => $f['title'],
        'field_link' => $f['link'] === NULL ? NULL : ['uri' => $f['link']],
        'field_pid_type' => $f['pid_type'],
        'field_publisher' => $f['publisher'],
        'field_date' => $f['date'],
      ];
      $p = $byKey[$f['source_key']] ?? NULL;
      if (!$p) {
        $p = $storage->create(['type' => 'format', 'field_source_key' => $f['source_key']] + $values);
        $changed = TRUE;
      }
      else {
        foreach ($values as $field => $value) {
          $have = $field === 'field_output_type' ? ($p->get($field)->target_id === NULL ? NULL : (int) $p->get($field)->target_id) : ($field === 'field_link' ? ($p->get($field)->isEmpty() ? NULL : ['uri' => $p->get($field)->uri]) : $p->get($field)->value);
          if ($have !== $value) {
            $p->set($field, $value);
            $changed = TRUE;
          }
        }
      }
      $keep[] = $p;
    }
    $editorRows = array_filter($current, fn($p) => !$p->get('field_source_key')->value);
    $removed = array_filter($current, fn($p) => $p->get('field_source_key')->value && !in_array($p, $keep, TRUE));
    if ($removed) {
      $changed = TRUE;
    }
    if ($changed) {
      $node->set('field_formats', array_merge($keep, array_values($editorRows)));
    }
    return $changed;
  }

  /**
   * A slug not used by another output: on a clash, add the year, then a number.
   */
  private function freeSlug(string $slug, ?string $date): string {
    $taken = fn(string $s) => (bool) $this->entityTypeManager->getStorage('node')->getQuery()->accessCheck(FALSE)->condition('type', 'output')->condition('field_slug', $s)->range(0, 1)->execute();
    $candidate = $slug;
    if ($taken($candidate) && $date) {
      $candidate = $slug . '-' . substr($date, 0, 4);
    }
    for ($n = 2; $taken($candidate); $n++) {
      $candidate = "$slug-$n";
    }
    return $candidate;
  }

}

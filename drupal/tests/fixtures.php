<?php

/**
 * Test fixtures for tests/drupal.test.ts (run inside DDEV):
 *   drush php:script tests/fixtures.php -- create <tag>    → prints JSON with ids
 *   drush php:script tests/fixtures.php -- delete <tag>    → removes everything with the tag
 */

use Drupal\node\Entity\Node;
use Drupal\taxonomy\Entity\Term;
use Drupal\user\Entity\User;

[$action, $tag] = $extra + [NULL, NULL];
if (!$tag || !preg_match('/^__test[a-z0-9]+$/', $tag)) {
  throw new \InvalidArgumentException('Usage: create|delete __test<id>');
}
$etm = \Drupal::entityTypeManager();

if ($action === 'create') {
  $actor = Term::create(['vid' => 'actor', 'name' => "$tag actor", 'field_slug' => "$tag-actor"]);
  $actor->save();
  $prompt = Node::create(['type' => 'feedback_prompt', 'title' => 'Lorem ipsum?', 'field_key' => "$tag-prompt", 'field_stream' => 'comment', 'field_placement' => 'output_published', 'status' => 1, 'uid' => 1]);
  $prompt->save();
  $output = fn(string $state, int $status) => Node::create([
    'type' => 'output', 'title' => "$tag $state", 'field_slug' => "$tag-$state", 'field_kind' => 'publication', 'field_status' => 'published',
    'field_actors' => [$actor->id()], 'field_teaser' => 'Lorem ipsum (test fixture).', 'field_confirmed' => 0,
    'field_unconfirmed_fields' => ['teaser'], 'field_source_key' => "$tag-$state", 'field_source_sheet' => 'test', 'status' => $status, 'uid' => 1,
  ]);
  $published = $output('published', 1);
  $published->save();
  $draft = $output('draft', 0);
  $draft->save();
  $editor = User::create(['name' => "$tag-editor", 'mail' => "$tag-editor@example.com", 'status' => 1, 'roles' => ['editor']]);
  $editor->save();
  echo json_encode([
    'actor' => (int) $actor->id(), 'prompt' => (int) $prompt->id(),
    'published' => ['id' => (int) $published->id(), 'uuid' => $published->uuid()],
    'draft' => ['id' => (int) $draft->id(), 'uuid' => $draft->uuid()],
    'editor' => (int) $editor->id(),
  ]), "\n";
}
elseif ($action === 'delete') {
  $del = function (string $type, string $field, string $op = 'STARTS_WITH') use ($etm, $tag) {
    $ids = $etm->getStorage($type)->getQuery()->accessCheck(FALSE)->condition($field, $tag, $op)->execute();
    if ($ids) {
      $etm->getStorage($type)->delete($etm->getStorage($type)->loadMultiple($ids));
    }
    return count($ids);
  };
  $n = $del('feedback_response', 'message') + $del('feedback_response', 'page_path', 'CONTAINS') + $del('community_signup', 'email')
    + $del('node', 'title') + $del('taxonomy_term', 'name') + $del('user', 'name');
  echo json_encode(['deleted' => $n]), "\n";
}

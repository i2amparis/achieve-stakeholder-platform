<?php

/**
 * Access probe for tests/drupal.test.ts: what an editor and an anonymous visitor
 * may do, checked through Drupal's own access API.
 *   drush php:script tests/probe.php -- <tag> <published-id> <draft-id> <editor-uid>
 */

use Drupal\node\Entity\Node;
use Drupal\user\Entity\User;

[$tag, $pid, $did, $uid] = $extra;
$editor = User::load($uid);
$anon = User::getAnonymousUser();
$published = Node::load($pid);
$draft = Node::load($did);
$etm = \Drupal::entityTypeManager();

$response = $etm->getStorage('feedback_response')->create([
  'stream' => 'comment', 'message' => "$tag probe", 'followup_email' => "$tag@example.com",
  'followup_consent_at' => time(), 'consent_text_version' => 'test', 'followup_requested' => TRUE,
]);
$response->save();
$signup = $etm->getStorage('community_signup')->create(['email' => "$tag-probe@example.com", 'consent_at' => time()]);
$signup->save();
$fa = fn($entity, string $field, string $op, $account) => $entity->get($field)->access($op, $account);

echo json_encode([
  'editor_sees_internal_fields' => $fa($published, 'field_confirmed', 'view', $editor) && $fa($published, 'field_source_key', 'view', $editor),
  'anonymous_sees_internal_fields' => $fa($published, 'field_confirmed', 'view', $anon) || $fa($published, 'field_unconfirmed_fields', 'view', $anon) || $fa($published, 'field_source_key', 'view', $anon),
  'editor_edits_confirmed' => $fa($published, 'field_confirmed', 'edit', $editor),
  'editor_edits_import_keys' => $fa($published, 'field_source_key', 'edit', $editor) || $fa($published, 'field_unconfirmed_fields', 'edit', $editor),
  'editor_edits_output' => $published->access('update', $editor),
  'editor_deletes_published' => $published->access('delete', $editor),
  'editor_deletes_draft' => $draft->access('delete', $editor),
  'anonymous_sees_draft' => $draft->access('view', $anon),
  'anonymous_sees_author' => $fa($published, 'uid', 'view', $anon),
  'editor_edits_taxonomy' => \Drupal\taxonomy\Entity\Term::load($published->get('field_actors')->target_id)->access('update', $editor),
  'editor_views_feedback' => $response->access('view', $editor),
  'editor_sees_contact_fields' => $fa($response, 'followup_email', 'view', $editor) || $fa($response, 'followup_consent_at', 'view', $editor),
  'editor_sees_followup_flag' => $fa($response, 'followup_requested', 'view', $editor),
  'editor_edits_triage' => $response->access('update', $editor) && $fa($response, 'triage_status', 'edit', $editor) && $fa($response, 'triage_note', 'edit', $editor),
  'editor_edits_message' => $fa($response, 'message', 'edit', $editor),
  'editor_deletes_feedback' => $response->access('delete', $editor),
  'editor_creates_feedback' => $etm->getAccessControlHandler('feedback_response')->createAccess(NULL, $editor),
  'editor_views_signups' => $signup->access('view', $editor),
  'anonymous_views_feedback' => $response->access('view', $anon),
]), "\n";

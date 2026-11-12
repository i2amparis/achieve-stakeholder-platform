<?php

namespace Drupal\achieve_feedback\Entity;

use Drupal\achieve_feedback\FeedbackAccessControlHandler;
use Drupal\achieve_feedback\FeedbackListBuilder;
use Drupal\achieve_feedback\Form\TriageForm;
use Drupal\Core\Entity\Attribute\ContentEntityType;
use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\ContentEntityDeleteForm;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Entity\Routing\AdminHtmlRouteProvider;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\StringTranslation\TranslatableMarkup;

/**
 * A feedback response from the website. Anonymous unless the respondent opted
 * in to follow-up. No IP address or user agent is stored, and no revisions.
 */
#[ContentEntityType(
  id: 'feedback_response',
  label: new TranslatableMarkup('Feedback response'),
  label_collection: new TranslatableMarkup('Feedback responses'),
  label_singular: new TranslatableMarkup('feedback response'),
  label_plural: new TranslatableMarkup('feedback responses'),
  entity_keys: ['id' => 'id', 'uuid' => 'uuid'],
  handlers: [
    'access' => FeedbackAccessControlHandler::class,
    'list_builder' => FeedbackListBuilder::class,
    'form' => ['edit' => TriageForm::class, 'delete' => ContentEntityDeleteForm::class],
    'route_provider' => ['html' => AdminHtmlRouteProvider::class],
  ],
  links: [
    'canonical' => '/admin/content/feedback/{feedback_response}',
    'edit-form' => '/admin/content/feedback/{feedback_response}/edit',
    'delete-form' => '/admin/content/feedback/{feedback_response}/delete',
    'collection' => '/admin/content/feedback',
  ],
  admin_permission: 'administer achieve feedback',
  collection_permission: 'triage achieve feedback',
  base_table: 'achieve_feedback_response',
  internal: TRUE,
)]
final class FeedbackResponse extends ContentEntityBase {

  /** Contact fields: personal data, administrators only. */
  public const CONTACT_FIELDS = ['followup_email', 'followup_consent_at', 'consent_text_version'];

  /** The only fields triagers may change. */
  public const TRIAGE_FIELDS = ['triage_status', 'triage_note'];

  public const STREAMS = ['comment' => 'Comment on our work', 'suggest_research' => 'Suggest research', 'share_challenge' => 'Share a challenge'];
  public const USEFULNESS = ['very_useful' => 'Very useful', 'somewhat' => 'Somewhat', 'not_really' => 'Not really'];

  public static function baseFieldDefinitions(EntityTypeInterface $entity_type): array {
    $fields = parent::baseFieldDefinitions($entity_type);
    $ref = fn(string $label, string $type, array $bundles = []) => BaseFieldDefinition::create('entity_reference')
      ->setLabel($label)->setSetting('target_type', $type)
      ->setSetting('handler_settings', $bundles ? ['target_bundles' => array_combine($bundles, $bundles)] : [])
      ->setDisplayOptions('view', ['type' => 'entity_reference_label', 'label' => 'inline', 'settings' => ['link' => TRUE]]);
    $text = fn(string $label, int $max = 255) => BaseFieldDefinition::create('string')->setLabel($label)->setSetting('max_length', $max)
      ->setDisplayOptions('view', ['type' => 'string', 'label' => 'inline']);

    $fields['created'] = BaseFieldDefinition::create('created')->setLabel('Received')
      ->setDisplayOptions('view', ['type' => 'timestamp', 'label' => 'inline']);
    $fields['prompt'] = $ref('Prompt', 'node', ['feedback_prompt']);
    $fields['stream'] = BaseFieldDefinition::create('list_string')->setLabel('Stream')->setRequired(TRUE)
      ->setSetting('allowed_values', self::STREAMS)->setDisplayOptions('view', ['type' => 'list_default', 'label' => 'inline']);
    $fields['message'] = BaseFieldDefinition::create('string_long')->setLabel('Message')
      ->setDisplayOptions('view', ['type' => 'basic_string', 'label' => 'above']);
    $fields['usefulness'] = BaseFieldDefinition::create('list_string')->setLabel('How useful')
      ->setSetting('allowed_values', self::USEFULNESS)->setDisplayOptions('view', ['type' => 'list_default', 'label' => 'inline']);
    $fields['page_path'] = $text('Page', 500);
    $fields['context_output'] = $ref('Output', 'node', ['output']);
    $fields['context_actor'] = $ref('Actor', 'taxonomy_term', ['actor']);
    $fields['context_principle'] = $ref('Principle', 'taxonomy_term', ['principle']);
    $fields['context_dimension'] = $ref('Dimension', 'taxonomy_term', ['dimension']);
    $fields['context_roadmap'] = $ref('Roadmap', 'node', ['roadmap']);
    $fields['context_recommendation'] = $ref('Recommendation', 'paragraph', ['recommendation']);
    $fields['context_filters'] = BaseFieldDefinition::create('string_long')->setLabel('Library filters (JSON)')
      ->setDisplayOptions('view', ['type' => 'basic_string', 'label' => 'inline']);
    $fields['respondent_actor_type'] = $text('Works in', 64);
    $fields['respondent_region'] = $text('Region', 64);
    $fields['respondent_country'] = $text('Country', 100);
    $fields['followup_requested'] = BaseFieldDefinition::create('boolean')->setLabel('Wants a follow-up')->setDefaultValue(FALSE)
      ->setDisplayOptions('view', ['type' => 'boolean', 'label' => 'inline']);
    $fields['followup_email'] = BaseFieldDefinition::create('email')->setLabel('Follow-up email')
      ->setDisplayOptions('view', ['type' => 'basic_string', 'label' => 'inline']);
    $fields['followup_consent_at'] = BaseFieldDefinition::create('timestamp')->setLabel('Follow-up consent given')
      ->setDisplayOptions('view', ['type' => 'timestamp', 'label' => 'inline']);
    $fields['consent_text_version'] = $text('Consent wording version', 64);
    $fields['triage_status'] = BaseFieldDefinition::create('list_string')->setLabel('Triage status')->setDefaultValue('new')
      ->setSetting('allowed_values', ['new' => 'New', 'read' => 'Read', 'routed' => 'Routed', 'closed' => 'Closed'])
      ->setDisplayOptions('view', ['type' => 'list_default', 'label' => 'inline'])
      ->setDisplayOptions('form', ['type' => 'options_select', 'weight' => 0]);
    $fields['triage_note'] = BaseFieldDefinition::create('string_long')->setLabel('Triage note')
      ->setDisplayOptions('view', ['type' => 'basic_string', 'label' => 'above'])
      ->setDisplayOptions('form', ['type' => 'string_textarea', 'weight' => 1]);
    return $fields;
  }

  public function label(): string {
    $stream = self::STREAMS[$this->get('stream')->value] ?? 'Feedback';
    return $stream . ' #' . $this->id();
  }

}

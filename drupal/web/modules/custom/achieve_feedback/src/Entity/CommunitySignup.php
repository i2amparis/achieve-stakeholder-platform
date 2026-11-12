<?php

namespace Drupal\achieve_feedback\Entity;

use Drupal\achieve_feedback\FeedbackAccessControlHandler;
use Drupal\achieve_feedback\SignupListBuilder;
use Drupal\Core\Entity\Attribute\ContentEntityType;
use Drupal\Core\Entity\ContentEntityBase;
use Drupal\Core\Entity\ContentEntityDeleteForm;
use Drupal\Core\Entity\EntityTypeInterface;
use Drupal\Core\Entity\Routing\AdminHtmlRouteProvider;
use Drupal\Core\Field\BaseFieldDefinition;
use Drupal\Core\StringTranslation\TranslatableMarkup;

/**
 * A stakeholder-community sign-up. Stored separately from feedback responses
 * and never linked to them. Administrators only.
 */
#[ContentEntityType(
  id: 'community_signup',
  label: new TranslatableMarkup('Community sign-up'),
  label_collection: new TranslatableMarkup('Community sign-ups'),
  entity_keys: ['id' => 'id', 'uuid' => 'uuid', 'label' => 'email'],
  handlers: [
    'access' => FeedbackAccessControlHandler::class,
    'list_builder' => SignupListBuilder::class,
    'form' => ['delete' => ContentEntityDeleteForm::class],
    'route_provider' => ['html' => AdminHtmlRouteProvider::class],
  ],
  links: [
    'canonical' => '/admin/content/community/{community_signup}',
    'delete-form' => '/admin/content/community/{community_signup}/delete',
    'collection' => '/admin/content/community',
  ],
  admin_permission: 'administer achieve feedback',
  base_table: 'achieve_community_signup',
  internal: TRUE,
)]
final class CommunitySignup extends ContentEntityBase {

  public static function baseFieldDefinitions(EntityTypeInterface $entity_type): array {
    $fields = parent::baseFieldDefinitions($entity_type);
    $fields['created'] = BaseFieldDefinition::create('created')->setLabel('Signed up')
      ->setDisplayOptions('view', ['type' => 'timestamp', 'label' => 'inline']);
    $fields['email'] = BaseFieldDefinition::create('email')->setLabel('Email')->setRequired(TRUE)
      ->setDisplayOptions('view', ['type' => 'basic_string', 'label' => 'inline']);
    $fields['consent_at'] = BaseFieldDefinition::create('timestamp')->setLabel('Consent given')->setRequired(TRUE)
      ->setDisplayOptions('view', ['type' => 'timestamp', 'label' => 'inline']);
    $fields['consent_text_version'] = BaseFieldDefinition::create('string')->setLabel('Consent wording version')->setSetting('max_length', 64)
      ->setDisplayOptions('view', ['type' => 'string', 'label' => 'inline']);
    $fields['locale'] = BaseFieldDefinition::create('string')->setLabel('Language')->setSetting('max_length', 8)
      ->setDisplayOptions('view', ['type' => 'string', 'label' => 'inline']);
    $fields['unsubscribed_at'] = BaseFieldDefinition::create('timestamp')->setLabel('Unsubscribed')
      ->setDisplayOptions('view', ['type' => 'timestamp', 'label' => 'inline']);
    return $fields;
  }

}

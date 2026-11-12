<?php

namespace Drupal\achieve_feedback;

use Drupal\achieve_feedback\Entity\FeedbackResponse;
use Drupal\Core\Access\AccessResult;
use Drupal\Core\Entity\EntityAccessControlHandler;
use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Field\FieldDefinitionInterface;
use Drupal\Core\Field\FieldItemListInterface;
use Drupal\Core\Session\AccountInterface;

/**
 * Access to feedback responses and community sign-ups.
 *
 * - Nobody creates them through Drupal: they arrive through the submit endpoint.
 * - Feedback responses: triagers (editors) view them and change only the triage
 *   fields; contact fields and deletion are for administrators.
 * - Community sign-ups: administrators only.
 */
final class FeedbackAccessControlHandler extends EntityAccessControlHandler {

  protected function checkAccess(EntityInterface $entity, $operation, AccountInterface $account) {
    if ($account->hasPermission('administer achieve feedback')) {
      return AccessResult::allowed()->cachePerPermissions();
    }
    if ($entity->getEntityTypeId() === 'feedback_response' && in_array($operation, ['view', 'update'], TRUE)) {
      return AccessResult::allowedIfHasPermission($account, 'triage achieve feedback');
    }
    return AccessResult::forbidden()->cachePerPermissions();
  }

  protected function checkCreateAccess(AccountInterface $account, array $context, $entity_bundle = NULL) {
    return AccessResult::forbidden('Feedback arrives only through the website.');
  }

  protected function checkFieldAccess($operation, FieldDefinitionInterface $field_definition, AccountInterface $account, ?FieldItemListInterface $items = NULL) {
    if ($field_definition->getTargetEntityTypeId() !== 'feedback_response' || $account->hasPermission('administer achieve feedback')) {
      return parent::checkFieldAccess($operation, $field_definition, $account, $items);
    }
    $name = $field_definition->getName();
    if (in_array($name, FeedbackResponse::CONTACT_FIELDS, TRUE)) {
      return AccessResult::forbidden('Contact details are for administrators only.')->cachePerPermissions();
    }
    if ($operation === 'edit') {
      return in_array($name, FeedbackResponse::TRIAGE_FIELDS, TRUE)
        ? AccessResult::allowedIfHasPermission($account, 'triage achieve feedback')
        : AccessResult::forbidden()->cachePerPermissions();
    }
    return AccessResult::allowed()->cachePerPermissions();
  }

}

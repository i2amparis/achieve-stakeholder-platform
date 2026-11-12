<?php

namespace Drupal\achieve_feedback;

use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityListBuilder;

/**
 * Admin list of community sign-ups (administrators only).
 */
final class SignupListBuilder extends EntityListBuilder {

  protected $limit = 100;

  public function buildHeader() {
    return ['email' => $this->t('Email'), 'created' => $this->t('Signed up'), 'unsubscribed' => $this->t('Unsubscribed')] + parent::buildHeader();
  }

  public function buildRow(EntityInterface $entity) {
    $date = \Drupal::service('date.formatter');
    return [
      'email' => $entity->get('email')->value,
      'created' => $date->format((int) $entity->get('created')->value, 'short'),
      'unsubscribed' => $entity->get('unsubscribed_at')->value ? $date->format((int) $entity->get('unsubscribed_at')->value, 'short') : '',
    ] + parent::buildRow($entity);
  }

}

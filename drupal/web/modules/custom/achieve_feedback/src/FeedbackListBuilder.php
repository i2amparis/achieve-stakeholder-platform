<?php

namespace Drupal\achieve_feedback;

use Drupal\Core\Entity\EntityInterface;
use Drupal\Core\Entity\EntityListBuilder;
use Drupal\Component\Utility\Unicode;

/**
 * Admin list of feedback responses, newest first. Shows no contact details.
 */
final class FeedbackListBuilder extends EntityListBuilder {

  protected $limit = 50;

  protected function getEntityIds() {
    return $this->getStorage()->getQuery()->accessCheck(TRUE)->sort('created', 'DESC')->pager($this->limit)->execute();
  }

  public function buildHeader() {
    return ['created' => $this->t('Received'), 'stream' => $this->t('Stream'), 'message' => $this->t('Message'), 'page' => $this->t('Page'), 'followup' => $this->t('Follow-up'), 'triage' => $this->t('Status')] + parent::buildHeader();
  }

  public function buildRow(EntityInterface $entity) {
    /** @var \Drupal\achieve_feedback\Entity\FeedbackResponse $entity */
    $message = (string) $entity->get('message')->value;
    $usefulness = $entity->get('usefulness')->value;
    return [
      'created' => \Drupal::service('date.formatter')->format((int) $entity->get('created')->value, 'short'),
      'stream' => $entity->get('stream')->value,
      'message' => $message !== '' ? Unicode::truncate($message, 80, TRUE, TRUE) : ($usefulness ? "($usefulness)" : ''),
      'page' => $entity->get('page_path')->value,
      'followup' => $entity->get('followup_requested')->value ? $this->t('Yes') : '',
      'triage' => $entity->get('triage_status')->value,
    ] + parent::buildRow($entity);
  }

}

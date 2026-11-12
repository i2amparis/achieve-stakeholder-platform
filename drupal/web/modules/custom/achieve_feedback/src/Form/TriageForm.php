<?php

namespace Drupal\achieve_feedback\Form;

use Drupal\Core\Entity\ContentEntityForm;
use Drupal\Core\Form\FormStateInterface;

/**
 * Edit form for feedback responses: only the triage status and note.
 */
final class TriageForm extends ContentEntityForm {

  public function save(array $form, FormStateInterface $form_state) {
    $result = parent::save($form, $form_state);
    $this->messenger()->addStatus($this->t('Triage saved.'));
    $form_state->setRedirectUrl($this->entity->toUrl('collection'));
    return $result;
  }

}

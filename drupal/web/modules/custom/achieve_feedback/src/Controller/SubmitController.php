<?php

namespace Drupal\achieve_feedback\Controller;

use Drupal\achieve_feedback\Entity\FeedbackResponse;
use Drupal\Core\Controller\ControllerBase;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;

/**
 * Receives feedback and sign-ups from the SvelteKit server (never from browsers:
 * the shared secret is checked by SecretAccessCheck). Applies the same rules as
 * the website forms, so a bad request cannot store anything they would refuse.
 */
final class SubmitController extends ControllerBase {

  private const MAX_MESSAGE = 5000;
  private const ACTOR_TYPES = ['business', 'cities', 'regulators', 'carbon-markets', 'ccis', 'research-civil-society'];
  private const REGIONS = ['europe', 'latin-america', 'elsewhere'];

  public function response(Request $request): JsonResponse {
    $d = json_decode($request->getContent(), TRUE);
    if (!is_array($d)) {
      return $this->error('Invalid JSON.');
    }
    $str = fn(string $k, int $max) => isset($d[$k]) && is_string($d[$k]) && trim($d[$k]) !== '' ? mb_substr(trim($d[$k]), 0, $max) : NULL;

    $stream = $d['stream'] ?? NULL;
    if (!is_string($stream) || !isset(FeedbackResponse::STREAMS[$stream])) {
      return $this->error('Unknown stream.');
    }
    $message = $str('message', self::MAX_MESSAGE + 1);
    if ($message !== NULL && mb_strlen($message) > self::MAX_MESSAGE) {
      return $this->error('Message too long.');
    }
    $usefulness = $d['usefulness'] ?? NULL;
    if ($usefulness !== NULL && !isset(FeedbackResponse::USEFULNESS[$usefulness])) {
      return $this->error('Unknown usefulness value.');
    }
    if ($message === NULL && $usefulness === NULL) {
      return $this->error('A message or a usefulness rating is required.');
    }

    // An email only together with its consent; the flag editors see must match.
    $email = $str('followup_email', 254);
    $consentAt = $this->timestamp($d['followup_consent_at'] ?? NULL);
    $requested = !empty($d['followup_requested']);
    if ($email !== NULL && (!filter_var($email, FILTER_VALIDATE_EMAIL) || $consentAt === NULL)) {
      return $this->error('A follow-up email needs a valid address and a consent time.');
    }
    if ($requested !== ($email !== NULL)) {
      return $this->error('The follow-up flag must match the email.');
    }

    $refs = [
      'prompt' => ['node', 'feedback_prompt'],
      'context_output' => ['node', 'output'],
      'context_roadmap' => ['node', 'roadmap'],
      'context_actor' => ['taxonomy_term', 'actor'],
      'context_principle' => ['taxonomy_term', 'principle'],
      'context_dimension' => ['taxonomy_term', 'dimension'],
      'context_recommendation' => ['paragraph', 'recommendation'],
    ];
    $values = [
      'stream' => $stream,
      'message' => $message,
      'usefulness' => $usefulness,
      'page_path' => $str('page_path', 500),
      'context_filters' => isset($d['context_filters']) && is_array($d['context_filters']) ? json_encode($d['context_filters'], JSON_UNESCAPED_UNICODE) : NULL,
      'respondent_actor_type' => in_array($d['respondent_actor_type'] ?? NULL, self::ACTOR_TYPES, TRUE) ? $d['respondent_actor_type'] : NULL,
      'respondent_region' => in_array($d['respondent_region'] ?? NULL, self::REGIONS, TRUE) ? $d['respondent_region'] : NULL,
      'respondent_country' => $str('respondent_country', 100),
      'followup_email' => $email,
      'followup_consent_at' => $email !== NULL ? $consentAt : NULL,
      'consent_text_version' => $email !== NULL ? $str('consent_text_version', 64) : NULL,
      'followup_requested' => $requested,
    ];
    foreach ($refs as $field => [$type, $bundle]) {
      if (!isset($d[$field]) || $d[$field] === NULL || $d[$field] === '') {
        continue;
      }
      $target = is_scalar($d[$field]) ? $this->entityTypeManager()->getStorage($type)->load($d[$field]) : NULL;
      if (!$target || $target->bundle() !== $bundle) {
        return $this->error("Unknown $field.");
      }
      $values[$field] = $target->id();
    }

    $this->entityTypeManager()->getStorage('feedback_response')->create($values)->save();
    return new JsonResponse(['ok' => TRUE], 201);
  }

  public function signup(Request $request): JsonResponse {
    $d = json_decode($request->getContent(), TRUE);
    if (!is_array($d)) {
      return $this->error('Invalid JSON.');
    }
    $email = is_string($d['email'] ?? NULL) ? trim($d['email']) : '';
    $consentAt = $this->timestamp($d['consent_at'] ?? NULL);
    if (!filter_var($email, FILTER_VALIDATE_EMAIL) || $consentAt === NULL) {
      return $this->error('A valid email and a consent time are required.');
    }
    $this->entityTypeManager()->getStorage('community_signup')->create([
      'email' => mb_substr($email, 0, 254),
      'consent_at' => $consentAt,
      'consent_text_version' => is_string($d['consent_text_version'] ?? NULL) ? mb_substr($d['consent_text_version'], 0, 64) : NULL,
      'locale' => is_string($d['locale'] ?? NULL) ? mb_substr($d['locale'], 0, 8) : NULL,
    ])->save();
    return new JsonResponse(['ok' => TRUE], 201);
  }

  private function timestamp(mixed $v): ?int {
    if (!is_string($v) || $v === '') {
      return NULL;
    }
    $t = strtotime($v);
    return $t === FALSE ? NULL : $t;
  }

  private function error(string $message): JsonResponse {
    return new JsonResponse(['error' => $message], 400);
  }

}

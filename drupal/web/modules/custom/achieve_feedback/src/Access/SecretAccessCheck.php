<?php

namespace Drupal\achieve_feedback\Access;

use Drupal\Core\Access\AccessResult;
use Drupal\Core\Site\Settings;
use Symfony\Component\HttpFoundation\Request;

/**
 * Allows the submit endpoints only with the shared secret (X-Achieve-Secret).
 *
 * The secret is set in settings.local.php ($settings['achieve_feedback_secret'])
 * and in the SvelteKit app's environment; it is never in git or config.
 */
final class SecretAccessCheck {

  public function access(Request $request): AccessResult {
    $secret = (string) Settings::get('achieve_feedback_secret', '');
    $given = (string) $request->headers->get('X-Achieve-Secret', '');
    return AccessResult::allowedIf($secret !== '' && strlen($secret) >= 32 && hash_equals($secret, $given))->setCacheMaxAge(0);
  }

}

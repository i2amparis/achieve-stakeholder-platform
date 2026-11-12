<?php

namespace Drupal\achieve_core\EventSubscriber;

use Symfony\Component\EventDispatcher\EventSubscriberInterface;
use Symfony\Component\HttpKernel\Event\ResponseEvent;
use Symfony\Component\HttpKernel\KernelEvents;

/**
 * Drupal is only the backend: the public website is the SvelteKit site. Keep every
 * Drupal response (admin, API, Drupal's own node pages) out of search engines.
 */
final class NoIndexSubscriber implements EventSubscriberInterface {

  public static function getSubscribedEvents(): array {
    return [KernelEvents::RESPONSE => ['onResponse', -100]];
  }

  public function onResponse(ResponseEvent $event): void {
    $event->getResponse()->headers->set('X-Robots-Tag', 'noindex, nofollow');
  }

}

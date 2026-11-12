<?php

namespace Drupal\achieve_core\Drush\Commands;

use Drupal\achieve_core\Import\ContentImporter;
use Drupal\achieve_core\Import\ProjectCopySeeder;
use Drupal\Component\Datetime\TimeInterface;
use Drupal\Core\Entity\EntityTypeManagerInterface;
use Drush\Attributes as CLI;
use Drush\Commands\AutowireTrait;
use Drush\Commands\DrushCommands;

/**
 * Content import and seeding for the ACHIEVE platform.
 */
final class AchieveCommands extends DrushCommands {

  use AutowireTrait;

  public function __construct(
    private readonly EntityTypeManagerInterface $entityTypeManager,
    private readonly TimeInterface $time,
  ) {
    parent::__construct();
  }

  /**
   * Load the content model (written by `npm run import`) into Drupal. Idempotent.
   */
  #[CLI\Command(name: 'achieve:import')]
  #[CLI\Argument(name: 'path', description: 'Model file (if omitted: import/model.json next to web/)')]
  #[CLI\Option(name: 'dry-run', description: 'Show what would change; write nothing.')]
  #[CLI\Usage(name: 'drush achieve:import', description: 'Import drupal/import/model.json.')]
  public function import(?string $path = NULL, array $options = ['dry-run' => FALSE]): int {
    $path ??= DRUPAL_ROOT . '/../import/model.json';
    if (!is_readable($path)) {
      $this->logger()->error("Model file not found: $path. Run `npm run import` first.");
      return self::EXIT_FAILURE;
    }
    $model = json_decode(file_get_contents($path), TRUE, 512, JSON_THROW_ON_ERROR);
    $result = (new ContentImporter($this->entityTypeManager, $this->time))->import($model, (bool) $options['dry-run']);

    $count = fn(string $action) => array_count_values(array_map(fn($c) => $c[1], array_filter($result['changes'], fn($c) => $c[0] === $action)));
    $fmt = fn(array $c) => $c ? implode(', ', array_map(fn($k, $v) => "$k $v", array_keys($c), $c)) : 'none';
    $this->output()->writeln(($options['dry-run'] ? 'DRY RUN (nothing written). ' : '') . "Model: {$model['source']} (sha256 " . substr($model['sha256'], 0, 12) . ')');
    $this->output()->writeln('Created:   ' . $fmt($count('create')));
    $this->output()->writeln('Updated:   ' . $fmt($count('update')));
    $this->output()->writeln('Unchanged: ' . array_sum($result['unchanged']));
    foreach ($result['changes'] as [$action, $bundle, $key, $fields]) {
      if ($action === 'update') {
        $this->output()->writeln("  update $bundle $key: " . implode(', ', $fields));
      }
    }
    foreach ($result['flags'] as $flag) {
      $this->logger()->warning($flag);
    }
    return self::EXIT_SUCCESS;
  }

  /**
   * Seed project copy that is not in the sheet (prompts, roadmaps, hub copy). Fills gaps only.
   */
  #[CLI\Command(name: 'achieve:seed')]
  public function seed(): int {
    $result = (new ProjectCopySeeder($this->entityTypeManager))->seed();
    $this->output()->writeln('Created: ' . ($result['created'] ? implode(', ', $result['created']) : 'none'));
    $this->output()->writeln('Filled:  ' . ($result['filled'] ? implode(', ', $result['filled']) : 'none'));
    return self::EXIT_SUCCESS;
  }

}

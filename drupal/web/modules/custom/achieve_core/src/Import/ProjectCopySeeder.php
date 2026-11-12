<?php

namespace Drupal\achieve_core\Import;

use Drupal\Core\Entity\EntityTypeManagerInterface;

/**
 * Seeds project copy that is not in the content sheet: feedback prompts (draft wording
 * from docs/content-model.md), the five roadmap records ("in preparation") and hub
 * descriptions and intros from the platform screens.
 *
 * Idempotent and non-destructive: creates missing records and fills empty fields only,
 * never overwriting what editors changed.
 */
final class ProjectCopySeeder {

  /** Draft wording; task leads still to confirm. The node title is the question. */
  private const PROMPTS = [
    ['output_published', 'output_published', 'comment', 'Is this useful for your work? What is missing?', 1],
    ['output_upcoming', 'output_upcoming', 'suggest_research', 'What should this report answer for you?', 1],
    ['actor_hub', 'actor_hub', 'share_challenge', 'What is the biggest integrity challenge your organisation faces right now?', 1],
    ['principle_page', 'principle_page', 'share_challenge', 'Which part of this principle is hardest to apply in practice?', 1],
    ['roadmap_recommendation', 'roadmap_recommendation', 'comment', 'Could your organisation act on this, and by when?', 0],
    ['library', 'library', 'suggest_research', "Didn't find what you need? Suggest a topic.", 1],
    ['home', 'home', 'all', 'Tell us what works, what is missing, and where integrity is hardest in practice.', 1],
    ['have_your_say', 'have_your_say', 'all', 'What would you like to do?', 1],
  ];

  /** Short public descriptions of the hubs (home tiles), from the platform screens. */
  private const HUB_DESCRIPTIONS = [
    'business' => 'ESG compliance and corporate climate targets',
    'cities' => 'Local climate action plans and their implementation',
    'regulators' => 'EU, UNFCCC, and national rules that support voluntary action',
    'carbon-markets' => 'How carbon credits are used, and the integrity concerns',
    'ccis' => 'COP-announced initiatives such as the One Planet City Challenge',
  ];

  /** Hub intros from the same design. Hubs without one show their description. */
  private const HUB_INTROS = [
    'cities' => "<p>When is a city's climate pledge credible? We look at targets that add up, emissions data that can be checked, fair sharing of costs and benefits, and the careful use of carbon offsets.</p>",
  ];

  public function __construct(private readonly EntityTypeManagerInterface $entityTypeManager) {}

  /**
   * @return array{created: string[], filled: string[]}
   */
  public function seed(): array {
    $created = $filled = [];
    $nodes = $this->entityTypeManager->getStorage('node');
    $terms = $this->entityTypeManager->getStorage('taxonomy_term');

    foreach (self::PROMPTS as [$key, $placement, $stream, $question, $status]) {
      if (!$nodes->loadByProperties(['type' => 'feedback_prompt', 'field_key' => $key])) {
        $nodes->create(['type' => 'feedback_prompt', 'title' => $question, 'field_key' => $key, 'field_placement' => $placement, 'field_stream' => $stream, 'status' => $status, 'uid' => 1])->save();
        $created[] = "feedback prompt $key";
      }
    }

    $d46 = $nodes->loadByProperties(['type' => 'output', 'field_code' => 'D4.6']);
    $d46 = $d46 ? reset($d46) : NULL;
    foreach ($terms->loadByProperties(['vid' => 'actor', 'field_is_hub' => 1]) as $actor) {
      $slug = $actor->get('field_slug')->value;
      $roadmap = $nodes->loadByProperties(['type' => 'roadmap', 'field_actor' => $actor->id()]);
      if (!$roadmap) {
        $nodes->create(['type' => 'roadmap', 'title' => 'Roadmap for ' . $actor->label(), 'field_actor' => $actor->id(), 'field_roadmap_status' => 'in_preparation', 'field_deliverable' => $d46?->id(), 'status' => 1, 'uid' => 1])->save();
        $created[] = "roadmap $slug";
      }
      else {
        $roadmap = reset($roadmap);
        if ($d46 && $roadmap->get('field_deliverable')->isEmpty()) {
          $roadmap->set('field_deliverable', $d46->id())->save();
          $filled[] = "roadmap $slug: deliverable";
        }
      }
      $changed = FALSE;
      if (isset(self::HUB_DESCRIPTIONS[$slug]) && trim((string) $actor->getDescription()) === '') {
        $actor->set('description', ['value' => self::HUB_DESCRIPTIONS[$slug], 'format' => 'plain_text']);
        $filled[] = "actor $slug: description";
        $changed = TRUE;
      }
      if (isset(self::HUB_INTROS[$slug]) && $actor->get('field_intro')->isEmpty()) {
        $actor->set('field_intro', ['value' => self::HUB_INTROS[$slug], 'format' => 'basic_html']);
        $filled[] = "actor $slug: intro";
        $changed = TRUE;
      }
      if ($changed) {
        $actor->save();
      }
    }
    return ['created' => $created, 'filled' => $filled];
  }

}

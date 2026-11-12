// The import model as a JSON file for Drupal's `drush achieve:import`.
// Deterministic (no timestamps), so the same sheet always gives the same file and
// content changes show up as readable diffs.

import type { ImportModel } from './transform.ts';

export const MODEL_VERSION = 1;

export function toModelFile(model: ImportModel, source: { source: string; sha256: string }): string {
	const file = {
		version: MODEL_VERSION,
		source: source.source,
		sha256: source.sha256,
		taxonomies: model.taxonomies,
		webinars: model.webinars,
		visuals: model.visuals,
		outputs: model.outputs
	};
	return JSON.stringify(file, null, '\t') + '\n';
}

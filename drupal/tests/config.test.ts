// Static checks on the exported Drupal config (drupal/config/sync). No running site needed.
// They guard what must stay true in the public repository and the public API.

import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';

const SYNC = resolve(import.meta.dirname, '../config/sync');
const files = readdirSync(SYNC).filter((f) => f.endsWith('.yml'));
const yml = (name: string) => parse(readFileSync(resolve(SYNC, `${name}.yml`), 'utf8'));
const fieldNames = files.filter((f) => f.startsWith('field.storage.')).map((f) => f.split('.')[3]);

describe('Drupal config', () => {
	it('has no cost, EU-portal or Grant Agreement fields (public repo)', () => {
		// whole name parts only, so that e.g. "feedback" does not match "fee"
		const forbidden = /(^|_)(costs?|fees?|charges?|charged|prices?|apc|portal|grant_agreement|ga|ga_description|ker|key_results?|dissemination|cde_content)(_|$)/i;
		expect(fieldNames.filter((f) => forbidden.test(f))).toEqual([]);
	});

	it('keeps JSON:API read-only', () => {
		expect(yml('jsonapi.settings').read_only).toBe(true);
	});

	it('gives anonymous visitors read access only', () => {
		expect(yml('user.role.anonymous').permissions.sort()).toEqual(['access content', 'view media']);
	});

	it('gives editors no taxonomy, page, prompt or user administration', () => {
		const perms: string[] = yml('user.role.editor').permissions;
		expect(perms.filter((p) => /taxonomy|vocabulary|terms in|page content|feedback_prompt content|administer|users|roles/.test(p))).toEqual([]);
		expect(perms).toContain('triage achieve feedback');
		expect(perms).not.toContain('administer achieve feedback');
	});

	it('keeps tag fields multi-value and ordered by delta (no checkbox widgets)', () => {
		for (const f of ['field_actors', 'field_principles', 'field_dimensions', 'field_regions']) {
			expect(yml(`field.storage.node.${f}`).cardinality, f).toBe(-1);
			expect(yml('core.entity_form_display.node.output.default').content[f].type, f).toBe('entity_reference_autocomplete');
		}
	});

	it('has Spanish and Brazilian Portuguese, not European Portuguese', () => {
		expect(files).toContain('language.entity.es.yml');
		expect(files).toContain('language.entity.pt-br.yml');
		expect(files).not.toContain('language.entity.pt-pt.yml');
	});

	it('keeps database settings out of the tracked settings.php', () => {
		// The installer writes $databases into settings.php when it can; on a server that would
		// override settings.local.php (and put credentials in a tracked file).
		const php = readFileSync(resolve(import.meta.dirname, '../web/sites/default/settings.php'), 'utf8');
		const code = php.split('\n').filter((l) => !/^\s*(#|\*|\/\/|\/\*)/.test(l)).join('\n');
		expect(code).not.toMatch(/\$databases\s*\[/);
		expect(code).toMatch(/include \$app_root \. '\/' \. \$site_path \. '\/settings\.local\.php';\s*}\s*$/);
	});
});

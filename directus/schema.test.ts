// Static checks on the committed schema snapshot and the permission spec.
// No running Directus needed.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { FEEDBACK_DATA, INTERNAL_OUTPUT_FIELDS, PERSONAL_FEEDBACK_FIELDS, POLICIES, publicPermissions } from './setup/permissions.ts';

const snapshot = parse(readFileSync(resolve(import.meta.dirname, 'snapshot.yaml'), 'utf8'));
const fields: { collection: string; field: string }[] = snapshot.fields;
const collections: { collection: string; meta: any }[] = snapshot.collections;
const relations: { collection: string; field: string; meta: any }[] = snapshot.relations;

describe('schema snapshot', () => {
	it('has no cost, EU-portal or Grant Agreement fields (public repo)', () => {
		// whole name parts only, so that e.g. "feedback" does not match "fee"
		const forbidden = /(^|_)(costs?|fees?|charges?|charged|prices?|apc|portal|grant_agreement|ga|ga_description|ker|key_results?|dissemination|cde_content)(_|$)/i;
		expect(fields.filter((f) => forbidden.test(f.field)).map((f) => `${f.collection}.${f.field}`)).toEqual([]);
	});

	it('keeps tag order on every ordered junction', () => {
		for (const j of ['outputs_actors', 'outputs_principles', 'outputs_dimensions', 'outputs_regions', 'outputs_contributors', 'outputs_visuals', 'roadmaps_outputs']) {
			const rel = relations.find((r) => r.collection === j && r.meta?.one_field);
			expect(rel?.meta.sort_field, j).toBe('sort');
		}
	});

	it('does not log activity or revisions for feedback data', () => {
		for (const c of FEEDBACK_DATA) expect(collections.find((x) => x.collection === c)?.meta.accountability, c).toBeNull();
	});

	it('models Finance through actor fields, not code', () => {
		expect(fields.some((f) => f.collection === 'actors' && f.field === 'is_hub')).toBe(true);
		expect(relations.some((r) => r.collection === 'actors_shown_in' && r.field === 'related_actors_id')).toBe(true);
	});

	it('gives every content collection with public text a translations table', () => {
		for (const c of ['actors', 'principles', 'dimensions', 'outputs', 'visuals', 'feedback_prompts', 'roadmaps', 'pages']) {
			expect(collections.some((x) => x.collection === `${c}_translations`), c).toBe(true);
		}
	});
});

describe('permission spec', () => {
	it('gives the public no access to feedback data', () => {
		expect(publicPermissions.filter((p) => FEEDBACK_DATA.includes(p.collection))).toEqual([]);
	});

	it('gives the public read access only', () => {
		expect(new Set(publicPermissions.map((p) => p.action))).toEqual(new Set(['read']));
	});

	it('never exposes internal output fields publicly', () => {
		const outputs = publicPermissions.find((p) => p.collection === 'outputs')!;
		expect(outputs.fields).not.toContain('*');
		for (const f of INTERNAL_OUTPUT_FIELDS) expect(outputs.fields).not.toContain(f);
	});

	it('limits public outputs to published items', () => {
		expect(publicPermissions.find((p) => p.collection === 'outputs')!.permissions).toEqual({ workflow_state: { _eq: 'published' } });
	});

	it('lets editors read feedback responses, but no policy read contact details or sign-ups', () => {
		const reads = POLICIES.flatMap((p) => p.permissions.filter((x) => FEEDBACK_DATA.includes(x.collection) && x.action === 'read').map((x) => ({ policy: p.name, ...x })));
		expect(reads.map((r) => `${r.policy}:${r.collection}`)).toEqual(['Editor:feedback_responses']);
		expect(reads[0].fields).not.toContain('*');
		for (const f of PERSONAL_FEEDBACK_FIELDS) expect(reads[0].fields).not.toContain(f);
	});

	it('keeps static pages, feedback prompts and taxonomies admin-only for people', () => {
		const writes = POLICIES.filter((p) => p.app_access).flatMap((p) => p.permissions.filter((x) => x.action !== 'read'));
		const adminOnly = ['pages', 'pages_translations', 'feedback_prompts', 'feedback_prompts_translations', 'languages', 'actors', 'actors_shown_in', 'principles', 'dimensions', 'regions', 'output_types', 'partners'];
		expect(writes.filter((w) => adminOnly.includes(w.collection)).map((w) => `${w.collection}:${w.action}`)).toEqual([]);
	});

	it('only references collections that exist in the snapshot', () => {
		const known = new Set([...collections.map((c) => c.collection), 'directus_files', 'directus_folders']);
		const all = [...publicPermissions, ...POLICIES.flatMap((p) => p.permissions)];
		expect([...new Set(all.map((p) => p.collection))].filter((c) => !known.has(c))).toEqual([]);
	});
});

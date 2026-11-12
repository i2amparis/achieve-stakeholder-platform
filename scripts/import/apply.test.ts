// Integration test: the import is idempotent and updates records instead of duplicating them.
// Runs against the local Directus with the import token; skipped when either is missing.
// Every test restores the sheet's state afterwards.

import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';
import { Directus, DIRECTUS_URL, loadDotEnv, qs } from '../../directus/setup/lib/client.ts';
import { apply } from './apply.ts';
import { readWorkbook } from './read.ts';
import { transform, type ImportModel } from './transform.ts';

loadDotEnv();
const reachable = await fetch(`${DIRECTUS_URL}/server/ping`).then((r) => r.ok).catch(() => false);
const token = process.env.DIRECTUS_IMPORT_TOKEN;

describe.skipIf(!reachable || !token)('import into Directus', () => {
	const d = new Directus(token);
	let model: ImportModel;
	const copy = () => structuredClone(model);
	/** Outputs that came from the sheet (other test suites may add temporary ones). */
	const importedCount = async () => Number((await d.get<any[]>('/items/outputs' + qs({ filter: { source_sheet: { _nnull: true } }, aggregate: { count: '*' } })))[0].count);
	const output = (slug: string, fields = '*') => d.get<any[]>('/items/outputs' + qs({ filter: { slug: { _eq: slug } }, fields, deep: { actors: { _sort: ['sort'] } } })).then((r) => r[0]);

	beforeAll(async () => {
		model = transform(await readWorkbook(resolve(import.meta.dirname, '../../data/achieve-cde-content.xlsx')));
		await apply(model, d); // bring Directus to the sheet's state
	});

	it('writes nothing when run again with the same sheet', async () => {
		const r = await apply(model, d);
		expect(r.changes).toEqual([]);
		expect(await importedCount()).toBe(model.outputs.length);
	});

	it('updates a corrected record instead of creating a new one', async () => {
		const m = copy();
		m.outputs.find((o) => o.slug === 'd2-2')!.teaser = 'Lorem ipsum: corrected teaser (test).';
		const r = await apply(m, d);
		expect(r.changes).toEqual([{ collection: 'outputs', key: 'd2.2', action: 'update', fields: ['teaser'] }]);
		expect(await importedCount()).toBe(model.outputs.length);
		expect((await output('d2-2', 'teaser')).teaser).toBe('Lorem ipsum: corrected teaser (test).');
		await apply(model, d);
		expect((await output('d2-2', 'teaser')).teaser).toBe(model.outputs.find((o) => o.slug === 'd2-2')!.teaser);
	});

	it('rewrites tags in their new order, without duplicate links', async () => {
		const m = copy();
		const o = m.outputs.find((x) => x.slug === 'd2-2')!;
		o.actors = [...o.actors].reverse();
		await apply(m, d);
		const row = await output('d2-2', 'actors.actors_id.slug,actors.sort');
		expect(row.actors.map((a: any) => a.actors_id.slug)).toEqual(o.actors);
		expect(row.actors.map((a: any) => a.sort)).toEqual(o.actors.map((_, i) => i + 1));
		await apply(model, d);
		const back = await output('d2-2', 'actors.actors_id.slug');
		expect(back.actors.map((a: any) => a.actors_id.slug)).toEqual(model.outputs.find((x) => x.slug === 'd2-2')!.actors);
	});

	it('follows a corrected title through the link, keeping the record and its slug', async () => {
		const m = copy();
		const o = m.outputs.find((x) => x.slug === 'bridging-levels')!;
		const id = (await output('bridging-levels', 'id')).id;
		o.title = 'Bridging Levels (corrected title, test)';
		o.source_key = 'bridging-levels-corrected-title-test';
		const r = await apply(m, d);
		expect(r.flags.some((f) => /Matched to the existing record/.test(f.message))).toBe(true);
		const after = await output('bridging-levels', 'id,title');
		expect(after).toEqual({ id, title: o.title });
		expect(await importedCount()).toBe(model.outputs.length);
		await apply(model, d);
		expect((await output('bridging-levels', 'title')).title).toBe(model.outputs.find((x) => x.slug === 'bridging-levels')!.title);
	});

	it('writes nothing in a dry run', async () => {
		const m = copy();
		m.outputs[0].teaser = 'Lorem ipsum: dry run (test).';
		const r = await apply(m, d, { dryRun: true });
		expect(r.changes.length).toBe(1);
		expect((await apply(model, d)).changes).toEqual([]);
	});
});

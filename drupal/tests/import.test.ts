// Integration tests of `drush achieve:import` against the local DDEV site: idempotent,
// updates instead of duplicating, follows corrected titles, never deletes.
// Each test imports a modified copy of drupal/import/model.json, then restores the original.

import { spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const URL = process.env.DRUPAL_URL ?? 'http://achieve-cms.ddev.site:8580';
const DRUPAL_DIR = resolve(import.meta.dirname, '..');
const MODEL = resolve(DRUPAL_DIR, 'import/model.json');
const reachable = await fetch(`${URL}/jsonapi`).then((r) => r.ok).catch(() => false);

/** Run achieve:import on a model (the committed one by default); returns all output. */
function runImport(model?: object, ...flags: string[]): string {
	const args = ['drush', 'achieve:import', ...flags];
	let tmp: string | undefined;
	if (model) {
		const name = `__test${randomBytes(3).toString('hex')}.json`;
		tmp = resolve(DRUPAL_DIR, 'import', name);
		writeFileSync(tmp, JSON.stringify(model));
		spawnSync('ddev', ['mutagen', 'sync'], { cwd: DRUPAL_DIR });
		args.push(`/var/www/html/import/${name}`);
	}
	const r = spawnSync('ddev', args, { cwd: DRUPAL_DIR, encoding: 'utf8' });
	if (tmp) rmSync(tmp, { force: true });
	if (r.status !== 0) throw new Error(`achieve:import failed: ${r.stderr}`);
	return `${r.stdout}\n${r.stderr}`;
}
const line = (out: string, label: string) => out.split('\n').find((l) => l.startsWith(label))?.slice(label.length).trim();
const output = async (slug: string, include = '') =>
	(await (await fetch(`${URL}/jsonapi/node/output?filter[field_slug]=${slug}${include ? `&include=${include}` : ''}`)).json()) as any;
const publicCount = async () => (await (await fetch(`${URL}/jsonapi/node/output?page[limit]=50`)).json()).data.length;

describe.skipIf(!reachable)('drush achieve:import', () => {
	let model: any;
	const copy = () => structuredClone(model);
	const d22 = (m: any) => m.outputs.find((o: any) => o.slug === 'd2-2');

	beforeAll(() => {
		model = JSON.parse(readFileSync(MODEL, 'utf8'));
		runImport(); // bring Drupal to the sheet's state
	});
	afterAll(() => {
		if (model) runImport();
	});

	it('changes nothing when run again with the same model', () => {
		const out = runImport();
		expect(line(out, 'Created:')).toBe('none');
		expect(line(out, 'Updated:')).toBe('none');
	});

	it('updates a corrected record instead of creating a new one', async () => {
		const m = copy();
		d22(m).teaser = 'Lorem ipsum: corrected teaser (test).';
		const out = runImport(m);
		expect(line(out, 'Created:')).toBe('none');
		expect(out).toContain('update output d2.2: field_teaser');
		expect((await output('d2-2')).data[0].attributes.field_teaser).toBe('Lorem ipsum: corrected teaser (test).');
		expect(await publicCount()).toBe(model.outputs.length);
		runImport();
		expect((await output('d2-2')).data[0].attributes.field_teaser).toBe(d22(model).teaser);
	});

	it('saves tags in their new order', async () => {
		const m = copy();
		d22(m).actors = [...d22(m).actors].reverse();
		runImport(m);
		const slugs = async () => {
			const r = await output('d2-2', 'field_actors');
			return r.data[0].relationships.field_actors.data.map((t: any) => r.included.find((i: any) => i.id === t.id).attributes.field_slug);
		};
		expect(await slugs()).toEqual(d22(m).actors);
		runImport();
		expect(await slugs()).toEqual(d22(model).actors);
	});

	it('follows a corrected title through the link, keeping the record and its slug', async () => {
		const m = copy();
		const o = m.outputs.find((x: any) => x.slug === 'bridging-levels');
		const before = (await output('bridging-levels')).data[0].id;
		o.title = 'Bridging Levels (corrected title, test)';
		o.source_key = 'bridging-levels-corrected-title-test';
		const out = runImport(m);
		expect(out).toMatch(/Matched .* by its link/);
		expect(line(out, 'Created:')).toBe('none');
		const after = (await output('bridging-levels')).data[0];
		expect(after.id).toBe(before);
		expect(after.attributes.title).toBe(o.title);
		runImport();
		expect((await output('bridging-levels')).data[0].attributes.title).toBe(model.outputs.find((x: any) => x.slug === 'bridging-levels').title);
	});

	it('flags an output that left the sheet, without deleting it', async () => {
		const m = copy();
		m.outputs = m.outputs.filter((o: any) => o.slug !== 'ms9');
		const out = runImport(m);
		expect(out).toMatch(/no longer in the sheet/);
		expect((await output('ms9')).data).toHaveLength(1);
	});

	it('writes nothing in a dry run', async () => {
		const m = copy();
		d22(m).teaser = 'Lorem ipsum: dry run (test).';
		const out = runImport(m, '--dry-run');
		expect(out).toContain('DRY RUN');
		expect(out).toContain('update output d2.2: field_teaser');
		expect((await output('d2-2')).data[0].attributes.field_teaser).toBe(d22(model).teaser);
	});
});

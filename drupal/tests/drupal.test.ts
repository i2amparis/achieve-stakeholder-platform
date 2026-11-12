// Integration tests of the Drupal backend against the local DDEV site:
// the public JSON:API, the feedback endpoint, and editor/anonymous access rules.
// Needs `ddev start` (in drupal/) and DRUPAL_FEEDBACK_SECRET in the repo's .env.
// Fixtures are created with tests/fixtures.php and removed afterwards.

import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadDotEnv } from '../../scripts/lib/env.ts';

loadDotEnv();
const URL = process.env.DRUPAL_URL ?? 'http://achieve-cms.ddev.site:8580';
const SECRET = process.env.DRUPAL_FEEDBACK_SECRET ?? '';
const DRUPAL_DIR = resolve(import.meta.dirname, '..');
const reachable = await fetch(`${URL}/jsonapi`).then((r) => r.ok).catch(() => false);

/** Run a Drush PHP script in DDEV and parse the JSON on its last output line. */
function drush(script: string, ...args: (string | number)[]): any {
	const out = execFileSync('ddev', ['drush', 'php:script', script, '--', ...args.map(String)], { cwd: DRUPAL_DIR, encoding: 'utf8' });
	return JSON.parse(out.trim().split('\n').pop()!);
}
const api = (path: string, init?: RequestInit) => fetch(URL + path, { ...init, headers: { Accept: 'application/vnd.api+json', ...init?.headers } });
const submit = (path: 'feedback' | 'signup', body: unknown, secret = SECRET) =>
	fetch(`${URL}/api/achieve/${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Achieve-Secret': secret }, body: JSON.stringify(body) });

describe.skipIf(!reachable || !SECRET)('Drupal backend', () => {
	const tag = `__test${randomBytes(3).toString('hex')}`;
	let fx: { actor: number; prompt: number; published: { id: number; uuid: string }; draft: { id: number; uuid: string }; editor: number };

	beforeAll(() => {
		fx = drush('tests/fixtures.php', 'create', tag);
	});
	afterAll(() => {
		if (fx) drush('tests/fixtures.php', 'delete', tag);
	});

	describe('public JSON:API', () => {
		it('lists published outputs only', async () => {
			const r = await api(`/jsonapi/node/output?filter[t][condition][path]=field_slug&filter[t][condition][operator]=STARTS_WITH&filter[t][condition][value]=${tag}`);
			const slugs = (await r.json()).data.map((n: any) => n.attributes.field_slug);
			expect(slugs).toEqual([`${tag}-published`]);
		});

		it('does not show a draft by id', async () => {
			expect([403, 404]).toContain((await api(`/jsonapi/node/output/${fx.draft.uuid}`)).status);
		});

		it('never returns internal fields or the author', async () => {
			const { data } = await (await api(`/jsonapi/node/output/${fx.published.uuid}`)).json();
			for (const f of ['field_confirmed', 'field_unconfirmed_fields', 'field_source_key', 'field_source_sheet', 'field_imported_at']) expect(data.attributes).not.toHaveProperty(f);
			expect(data.relationships).not.toHaveProperty('uid');
			expect(data.relationships).not.toHaveProperty('revision_uid');
			expect(data.attributes.field_teaser).toBe('Lorem ipsum (test fixture).');
		});

		it('refuses filtering on internal fields', async () => {
			expect((await api(`/jsonapi/node/output?filter[field_source_key]=${tag}-draft`)).status).toBeGreaterThanOrEqual(400);
		});

		it('is read-only', async () => {
			const r = await api('/jsonapi/node/output', { method: 'POST', headers: { 'Content-Type': 'application/vnd.api+json' }, body: JSON.stringify({ data: { type: 'node--output', attributes: { title: 'x' } } }) });
			expect(r.status).toBe(405);
		});

		it('exposes no feedback data and no users', async () => {
			const { links } = await (await api('/jsonapi')).json();
			expect(Object.keys(links).filter((k) => /feedback_response|community_signup/.test(k))).toEqual([]);
			expect((await (await api('/jsonapi/user/user')).json()).data).toEqual([]);
		});
	});

	describe('feedback endpoint', () => {
		const base = () => ({ stream: 'comment', message: `${tag} Lorem ipsum`, prompt: fx.prompt, context_output: fx.published.id, page_path: `/library/${tag}-published`, followup_requested: false });

		it('refuses requests without the right secret', async () => {
			expect((await submit('feedback', base(), '')).status).toBe(403);
			expect((await submit('feedback', base(), 'x'.repeat(64))).status).toBe(403);
		});

		it('stores a valid response', async () => {
			expect((await submit('feedback', base())).status).toBe(201);
		});

		it('accepts a rating alone, but not an empty answer or unknown values', async () => {
			expect((await submit('feedback', { ...base(), message: undefined, usefulness: 'somewhat' })).status).toBe(201);
			expect((await submit('feedback', { ...base(), message: '  ' })).status).toBe(400);
			expect((await submit('feedback', { ...base(), usefulness: 'brilliant' })).status).toBe(400);
			expect((await submit('feedback', { ...base(), stream: 'other' })).status).toBe(400);
		});

		it('takes an email only with its consent time, and the flag must match', async () => {
			const now = new Date().toISOString();
			expect((await submit('feedback', { ...base(), followup_email: `${tag}@example.com`, followup_requested: true })).status).toBe(400);
			expect((await submit('feedback', { ...base(), followup_email: `${tag}@example.com`, followup_consent_at: now })).status).toBe(400);
			expect((await submit('feedback', { ...base(), followup_requested: true })).status).toBe(400);
			expect((await submit('feedback', { ...base(), followup_email: `${tag}@example.com`, followup_consent_at: now, followup_requested: true, consent_text_version: 'test' })).status).toBe(201);
		});

		it('rejects context that does not exist or has the wrong type', async () => {
			expect((await submit('feedback', { ...base(), context_output: 999999 })).status).toBe(400);
			expect((await submit('feedback', { ...base(), context_output: fx.prompt })).status).toBe(400);
		});

		it('stores community sign-ups only with consent', async () => {
			expect((await submit('signup', { email: `${tag}-a@example.com` })).status).toBe(400);
			expect((await submit('signup', { email: `${tag}-b@example.com`, consent_at: new Date().toISOString(), consent_text_version: 'test', locale: 'en' })).status).toBe(201);
		});
	});

	describe('access rules (Drupal access API)', () => {
		let p: Record<string, boolean>;
		beforeAll(() => {
			p = drush('tests/probe.php', tag, fx.published.id, fx.draft.id, fx.editor);
		});

		it('hides internal output fields from anonymous visitors, not from editors', () => {
			expect(p.editor_sees_internal_fields).toBe(true);
			expect(p.anonymous_sees_internal_fields).toBe(false);
		});

		it('lets editors edit outputs and the confirmed toggle, but not import keys or taxonomies', () => {
			expect(p.editor_edits_output).toBe(true);
			expect(p.editor_edits_confirmed).toBe(true);
			expect(p.editor_edits_import_keys).toBe(false);
			expect(p.editor_edits_taxonomy).toBe(false);
		});

		it('lets editors delete drafts only', () => {
			expect(p.editor_deletes_draft).toBe(true);
			expect(p.editor_deletes_published).toBe(false);
		});

		it('keeps drafts and authorship from anonymous visitors', () => {
			expect(p.anonymous_sees_draft).toBe(false);
			expect(p.anonymous_sees_author).toBe(false);
		});

		it('lets editors triage feedback without seeing contact details', () => {
			expect(p.editor_views_feedback).toBe(true);
			expect(p.editor_sees_followup_flag).toBe(true);
			expect(p.editor_sees_contact_fields).toBe(false);
			expect(p.editor_edits_triage).toBe(true);
			expect(p.editor_edits_message).toBe(false);
			expect(p.editor_deletes_feedback).toBe(false);
			expect(p.editor_creates_feedback).toBe(false);
		});

		it('keeps community sign-ups and all feedback from editors and visitors as specified', () => {
			expect(p.editor_views_signups).toBe(false);
			expect(p.anonymous_views_feedback).toBe(false);
		});
	});
});

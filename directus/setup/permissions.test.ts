// Integration test of the access model against the local Directus.
// Needs `docker compose up` and `npm run setup`. Skipped when Directus is not reachable.
// Creates temporary fixtures (prefixed __test) and removes them afterwards.

import { randomBytes } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Directus, DirectusError, DIRECTUS_URL, loadDotEnv, qs } from './lib/client.ts';
import { INTERNAL_OUTPUT_FIELDS, PERSONAL_FEEDBACK_FIELDS } from './permissions.ts';

const reachable = await fetch(`${DIRECTUS_URL}/server/ping`).then((r) => r.ok).catch(() => false);
loadDotEnv();

/** Resolve to the HTTP status of a request (200 for success). */
async function status(p: Promise<unknown>): Promise<number> {
	try {
		await p;
		return 200;
	} catch (e) {
		if (e instanceof DirectusError) return e.status;
		throw e;
	}
}

describe.skipIf(!reachable)('Directus access model', () => {
	const tag = `__test${randomBytes(3).toString('hex')}`;
	const anon = new Directus();
	let admin: Directus;
	let writer: Directus;
	let editor: Directus;
	const ids = { actor: 0, published: 0, draft: 0, prompt: 0, page: 0, users: [] as string[] };

	async function personWithRole(roleName: string): Promise<Directus> {
		const [role] = await admin.get<any[]>('/roles' + qs({ filter: { name: { _eq: roleName } } }));
		const email = `${tag}-${roleName.replace(/\W/g, '').toLowerCase()}@example.com`;
		const password = randomBytes(12).toString('hex');
		const user = await admin.post('/users', { email, password, role: role.id, status: 'active' });
		ids.users.push(user.id);
		const { access_token } = await anon.post('/auth/login', { email, password });
		return new Directus(access_token);
	}

	beforeAll(async () => {
		admin = await Directus.admin();
		writer = new Directus(process.env.DIRECTUS_FEEDBACK_TOKEN);
		ids.actor = (await admin.post('/items/actors', { slug: `${tag}-actor`, name: `${tag} actor` })).id;
		const output = (state: string) => ({
			title: `${tag} ${state}`, slug: `${tag}-${state}`, source_key: `${tag}-${state}`, kind: 'publication', status: 'published',
			workflow_state: state, confirmed: false, unconfirmed_fields: ['teaser'], teaser: 'Lorem ipsum (test fixture).',
			actors: { create: [{ actors_id: ids.actor, sort: 1 }] }
		});
		ids.published = (await admin.post('/items/outputs', output('published'))).id;
		ids.draft = (await admin.post('/items/outputs', output('draft'))).id;
		ids.prompt = (await admin.post('/items/feedback_prompts', { key: `${tag}-prompt`, question: 'Lorem ipsum?', stream: 'comment', placement: 'output_published', status: 'active' })).id;
		ids.page = (await admin.post('/items/pages', { slug: `${tag}-page`, title: 'Lorem ipsum', workflow_state: 'draft' })).id;
		editor = await personWithRole('Editor');
	});

	afterAll(async () => {
		if (!admin) return;
		const fb = await admin.get<any[]>('/items/feedback_responses' + qs({ filter: { message: { _starts_with: tag } }, fields: 'id' }));
		if (fb.length) await admin.delete('/items/feedback_responses', fb.map((r) => r.id));
		const su = await admin.get<any[]>('/items/community_signups' + qs({ filter: { email: { _starts_with: tag } }, fields: 'id' }));
		if (su.length) await admin.delete('/items/community_signups', su.map((r) => r.id));
		await admin.delete('/items/outputs', [ids.published, ids.draft].filter(Boolean));
		if (ids.prompt) await admin.delete(`/items/feedback_prompts/${ids.prompt}`);
		if (ids.page) await admin.delete(`/items/pages/${ids.page}`);
		if (ids.actor) await admin.delete(`/items/actors/${ids.actor}`);
		if (ids.users.length) await admin.delete('/users', ids.users);
	});

	const feedback = (extra: Record<string, unknown> = {}) => ({ stream: 'comment', message: `${tag} Lorem ipsum`, prompt: ids.prompt, context_output: ids.published, page_path: `/library/${tag}-published`, ...extra });

	describe('public (no login)', () => {
		it('lists published outputs only', async () => {
			const rows = await anon.get<any[]>('/items/outputs' + qs({ filter: { slug: { _starts_with: tag } }, fields: 'slug' }));
			expect(rows.map((r) => r.slug)).toEqual([`${tag}-published`]);
		});

		it('cannot open a draft output by id', async () => {
			expect(await status(anon.get(`/items/outputs/${ids.draft}`))).toBe(403);
		});

		it('never receives internal output fields', async () => {
			const row = await anon.get(`/items/outputs/${ids.published}?fields=*`);
			for (const f of INTERNAL_OUTPUT_FIELDS) expect(row).not.toHaveProperty(f);
			expect(await status(anon.get(`/items/outputs/${ids.published}?fields=confirmed`))).toBe(403);
			expect(await status(anon.get(`/items/outputs/${ids.published}?fields=source_key`))).toBe(403);
		});

		it('sees tag rows of published outputs only, in order', async () => {
			const rows = await anon.get<any[]>('/items/outputs_actors' + qs({ filter: { actors_id: { _eq: ids.actor } }, fields: 'outputs_id,sort' }));
			expect(rows).toEqual([{ outputs_id: ids.published, sort: 1 }]);
		});

		it('has no access to feedback data', async () => {
			expect(await status(anon.get('/items/feedback_responses'))).toBe(403);
			expect(await status(anon.post('/items/feedback_responses', feedback()))).toBe(403);
			expect(await status(anon.get('/items/community_signups'))).toBe(403);
			expect(await status(anon.post('/items/community_signups', { email: `${tag}@example.com`, consent_at: new Date().toISOString() }))).toBe(403);
		});

		it('cannot change content', async () => {
			expect(await status(anon.patch(`/items/outputs/${ids.published}`, { title: 'x' }))).toBe(403);
		});
	});

	describe('website service (feedback writer)', () => {
		it.skipIf(!process.env.DIRECTUS_FEEDBACK_TOKEN)('can store a response but not read any back', async () => {
			expect(await status(writer.post('/items/feedback_responses', feedback()))).toBe(200);
			expect(await status(writer.get('/items/feedback_responses'))).toBe(403);
		});

		it.skipIf(!process.env.DIRECTUS_FEEDBACK_TOKEN)('cannot set triage fields', async () => {
			expect(await status(writer.post('/items/feedback_responses', feedback({ triage_status: 'closed' })))).toBe(403);
		});

		it.skipIf(!process.env.DIRECTUS_FEEDBACK_TOKEN)('rejects an email without a consent time', async () => {
			const now = new Date().toISOString();
			expect(await status(writer.post('/items/feedback_responses', feedback({ followup_email: `${tag}@example.com`, followup_requested: true })))).toBe(400);
			expect(await status(writer.post('/items/feedback_responses', feedback({ followup_email: `${tag}@example.com`, followup_consent_at: now, followup_requested: true })))).toBe(200);
		});

		it.skipIf(!process.env.DIRECTUS_FEEDBACK_TOKEN)('keeps the follow-up flag in step with the email', async () => {
			const now = new Date().toISOString();
			expect(await status(writer.post('/items/feedback_responses', feedback({ followup_email: `${tag}@example.com`, followup_consent_at: now })))).toBe(400);
			expect(await status(writer.post('/items/feedback_responses', feedback({ followup_requested: true })))).toBe(400);
		});

		it.skipIf(!process.env.DIRECTUS_FEEDBACK_TOKEN)('rejects an unknown stream', async () => {
			expect(await status(writer.post('/items/feedback_responses', feedback({ stream: 'other' })))).toBe(400);
		});

		it.skipIf(!process.env.DIRECTUS_FEEDBACK_TOKEN)('stores community sign-ups only with consent', async () => {
			expect(await status(writer.post('/items/community_signups', { email: `${tag}-a@example.com` }))).toBe(400);
			expect(await status(writer.post('/items/community_signups', { email: `${tag}-b@example.com`, consent_at: new Date().toISOString(), consent_text_version: 'test' }))).toBe(200);
			expect(await status(writer.get('/items/community_signups'))).toBe(403);
		});
	});

	describe('editor (partners)', () => {
		it('sees drafts', async () => {
			expect(await status(editor.get(`/items/outputs/${ids.draft}`))).toBe(200);
		});

		it('reads and triages feedback, without contact details', async () => {
			const rows = await editor.get<any[]>('/items/feedback_responses' + qs({ filter: { message: { _starts_with: tag } }, fields: '*' }));
			expect(rows.length).toBeGreaterThan(0);
			for (const f of PERSONAL_FEEDBACK_FIELDS) expect(rows[0]).not.toHaveProperty(f);
			expect(rows.some((r) => r.followup_requested === true)).toBe(true);
			expect(await status(editor.get('/items/feedback_responses?fields=followup_email'))).toBe(403);
			expect(await status(editor.patch(`/items/feedback_responses/${rows[0].id}`, { triage_status: 'read', triage_note: 'Lorem ipsum' }))).toBe(200);
			expect(await status(editor.patch(`/items/feedback_responses/${rows[0].id}`, { message: 'x' }))).toBe(403);
			expect(await status(editor.delete(`/items/feedback_responses/${rows[0].id}`))).toBe(403);
		});

		it('has no access to community sign-ups', async () => {
			expect(await status(editor.get('/items/community_signups'))).toBe(403);
		});

		it('cannot edit static pages or feedback prompts (admin only)', async () => {
			expect(await status(editor.patch(`/items/pages/${ids.page}`, { title: 'x' }))).toBe(403);
			expect(await status(editor.post('/items/pages', { slug: `${tag}-x`, title: 'x' }))).toBe(403);
			expect(await status(editor.patch(`/items/feedback_prompts/${ids.prompt}`, { question: 'x' }))).toBe(403);
		});

		it('can edit content and the confirmed toggle, but not import-owned fields', async () => {
			expect(await status(editor.patch(`/items/outputs/${ids.draft}`, { teaser: 'Lorem ipsum, edited.', confirmed: true }))).toBe(200);
			expect(await status(editor.patch(`/items/outputs/${ids.draft}`, { source_key: 'x' }))).toBe(403);
			expect(await status(editor.patch(`/items/outputs/${ids.draft}`, { unconfirmed_fields: [] }))).toBe(403);
		});

		it('cannot change taxonomies', async () => {
			expect(await status(editor.patch(`/items/actors/${ids.actor}`, { name: 'x' }))).toBe(403);
			expect(await status(editor.post('/items/actors', { slug: `${tag}-x`, name: 'x' }))).toBe(403);
		});

		it('can delete drafts only', async () => {
			expect(await status(editor.delete(`/items/outputs/${ids.published}`))).toBe(403);
		});
	});


	describe('no activity log for feedback data', () => {
		it('records no activity for feedback responses', async () => {
			const rows = await admin.get<any[]>('/activity' + qs({ filter: { collection: { _eq: 'feedback_responses' } }, limit: 1 }));
			expect(rows).toEqual([]);
		});
	});
});

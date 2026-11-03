// Seed project-defined content that is not in the content sheet:
// feedback prompts (draft wording from docs/content-model.md), the five roadmap
// records ("in preparation") and hub intros from the platform screens.
// Idempotent and non-destructive: creates missing records and fills empty fields
// only; never overwrites what editors have changed in Directus.
//
//   npm run seed        (needs DIRECTUS_IMPORT_TOKEN; run after npm run import)

import { Directus, loadDotEnv, qs } from '../../directus/setup/lib/client.ts';

loadDotEnv();
const token = process.env.DIRECTUS_IMPORT_TOKEN;
if (!token) throw new Error('DIRECTUS_IMPORT_TOKEN is not set. Run `npm run setup` first.');
const d = new Directus(token);

/** Draft wording from docs/content-model.md, "Where each feedback prompt sits". Task leads still to confirm. */
const PROMPTS = [
	{ key: 'output_published', placement: 'output_published', stream: 'comment', question: 'Is this useful for your work? What is missing?' },
	{ key: 'output_upcoming', placement: 'output_upcoming', stream: 'suggest_research', question: 'What should this report answer for you?' },
	{ key: 'actor_hub', placement: 'actor_hub', stream: 'share_challenge', question: 'What is the biggest integrity challenge your organisation faces right now?' },
	{ key: 'principle_page', placement: 'principle_page', stream: 'share_challenge', question: 'Which part of this principle is hardest to apply in practice?' },
	{ key: 'roadmap_recommendation', placement: 'roadmap_recommendation', stream: 'comment', question: 'Could your organisation act on this, and by when?', status: 'inactive' },
	{ key: 'library', placement: 'library', stream: 'suggest_research', question: "Didn't find what you need? Suggest a topic." },
	{ key: 'home', placement: 'home', stream: 'all', question: 'Tell us what works, what is missing, and where integrity is hardest in practice.' },
	{ key: 'have_your_say', placement: 'have_your_say', stream: 'all', question: 'What would you like to do?' }
];

/** Short public descriptions of the hubs, from the "ACHIEVE platform screens" design (home tiles). */
const HUB_DESCRIPTIONS: Record<string, string> = {
	business: 'ESG compliance and corporate climate targets',
	cities: 'Local climate action plans and their implementation',
	regulators: 'EU, UNFCCC, and national rules that support voluntary action',
	'carbon-markets': 'How carbon credits are used, and the integrity concerns',
	ccis: 'COP-announced initiatives such as the One Planet City Challenge'
};

/** Hub intros from the same design. Hubs without one show their description. */
const HUB_INTROS: Record<string, string> = {
	cities: "<p>When is a city's climate pledge credible? We look at targets that add up, emissions data that can be checked, fair sharing of costs and benefits, and the careful use of carbon offsets.</p>"
};

const created: string[] = [];
const filled: string[] = [];

// --- feedback prompts -------------------------------------------------------
const prompts = await d.get<any[]>('/items/feedback_prompts' + qs({ limit: -1, fields: 'id,key' }));
for (const p of PROMPTS) {
	if (prompts.some((x) => x.key === p.key)) continue;
	await d.post('/items/feedback_prompts', { status: 'active', ...p });
	created.push(`feedback prompt ${p.key}`);
}

// --- roadmaps (one per hub actor) ---------------------------------------------
const actors = await d.get<any[]>('/items/actors' + qs({ limit: -1, fields: 'id,slug,is_hub,intro' }));
const [d46] = await d.get<any[]>('/items/outputs' + qs({ filter: { code: { _eq: 'D4.6' } }, fields: 'id' }));
const roadmaps = await d.get<any[]>('/items/roadmaps' + qs({ limit: -1, fields: 'id,actor,deliverable' }));
for (const a of actors.filter((x) => x.is_hub)) {
	const r = roadmaps.find((x) => x.actor === a.id);
	if (!r) {
		await d.post('/items/roadmaps', { actor: a.id, status: 'in_preparation', workflow_state: 'published', deliverable: d46?.id ?? null });
		created.push(`roadmap ${a.slug}`);
	} else if (!r.deliverable && d46) {
		await d.patch(`/items/roadmaps/${r.id}`, { deliverable: d46.id });
		filled.push(`roadmap ${a.slug}: deliverable`);
	}
}

// --- hub descriptions and intros --------------------------------------------
const actorRows = await d.get<any[]>('/items/actors' + qs({ limit: -1, fields: 'id,slug,description' }));
for (const [slug, description] of Object.entries(HUB_DESCRIPTIONS)) {
	const a = actorRows.find((x) => x.slug === slug);
	if (a && !a.description) {
		await d.patch(`/items/actors/${a.id}`, { description });
		filled.push(`actor ${slug}: description`);
	}
}

for (const [slug, intro] of Object.entries(HUB_INTROS)) {
	const a = actors.find((x) => x.slug === slug);
	if (a && !a.intro) {
		await d.patch(`/items/actors/${a.id}`, { intro });
		filled.push(`actor ${slug}: intro`);
	}
}

console.log(`seed: created ${created.length}${created.length ? ` (${created.join(', ')})` : ''}; filled ${filled.length}${filled.length ? ` (${filled.join(', ')})` : ''}`);

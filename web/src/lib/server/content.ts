// Content from Directus, shaped for the pages. Public reads only.
// Translations: English is on the main record; for other locales the matching
// *_translations row overrides a field when it is filled in.

import { error } from '@sveltejs/kit';
import { fold, type Card } from '#lib/library/filters.ts';
import { DEFAULT_LOCALE, type Locale } from '#lib/i18n/locales.ts';
import { qs, read } from './directus.ts';
import { safeHtml } from './html.ts';

type Row = Record<string, any>;

export interface Actor { id: number; slug: string; name: string; isHub: boolean; description: string | null; intro: string | null; shownIn: string[] }
export interface Principle { id: number; code: string; slug: string; name: string; shortName: string; dimensions: { slug: string; name: string }[] }
export interface Term { id: number; slug: string; name: string }
export interface Taxonomies {
	actors: Actor[];
	hubs: Actor[];
	principles: Principle[];
	dimensions: (Term & { principle: string })[];
	regions: Term[];
	types: Term[];
}

const sorted = (rows: Row[] | undefined, key: string) => [...(rows ?? [])].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0)).map((r) => r[key]).filter(Boolean);
const stripTags = (s: string | null) => (s ?? '').replace(/<[^>]+>/g, ' ');

/** Pick a translated field when the locale has one. */
function tr(row: Row, field: string, locale: Locale): any {
	if (locale === DEFAULT_LOCALE) return row[field];
	const t = (row.translations as Row[] | undefined)?.find((x) => x.languages_code === locale);
	return t?.[field] || row[field];
}
const trFields = (locale: Locale, fields: string[]) => (locale === DEFAULT_LOCALE ? [] : ['translations.languages_code', ...fields.map((f) => `translations.${f}`)]);

export async function getTaxonomies(locale: Locale = DEFAULT_LOCALE): Promise<Taxonomies> {
	const [actors, principles, dimensions, regions, types] = await Promise.all([
		read<Row[]>('/items/actors' + qs({ limit: -1, sort: 'sort', fields: ['id', 'slug', 'name', 'is_hub', 'description', 'intro', 'shown_in.related_actors_id.slug', ...trFields(locale, ['name', 'description', 'intro'])].join(',') })),
		read<Row[]>('/items/principles' + qs({ limit: -1, sort: 'sort', fields: ['id', 'code', 'slug', 'name', 'short_name', 'dimensions.slug', 'dimensions.name', 'dimensions.sort', ...trFields(locale, ['name', 'short_name'])].join(',') })),
		read<Row[]>('/items/dimensions' + qs({ limit: -1, sort: 'sort', fields: 'id,slug,name,principle.code' })),
		read<Row[]>('/items/regions' + qs({ limit: -1, sort: 'sort', fields: 'id,slug,name' })),
		read<Row[]>('/items/output_types' + qs({ limit: -1, sort: 'sort', fields: 'id,slug,name' }))
	]);
	const all: Actor[] = actors.map((a) => ({
		id: a.id, slug: a.slug, name: tr(a, 'name', locale), isHub: a.is_hub, description: tr(a, 'description', locale), intro: safeHtml(tr(a, 'intro', locale)),
		shownIn: (a.shown_in ?? []).map((s: Row) => s.related_actors_id?.slug).filter(Boolean)
	}));
	return {
		actors: all,
		hubs: all.filter((a) => a.isHub),
		principles: principles.map((p) => ({
			id: p.id, code: p.code, slug: p.slug, name: tr(p, 'name', locale), shortName: tr(p, 'short_name', locale) ?? p.name,
			dimensions: [...(p.dimensions ?? [])].sort((a: Row, b: Row) => a.sort - b.sort).map((d: Row) => ({ slug: d.slug, name: d.name }))
		})),
		dimensions: dimensions.map((d) => ({ id: d.id, slug: d.slug, name: d.name, principle: d.principle?.code })),
		regions: regions.map((r) => ({ id: r.id, slug: r.slug, name: r.name })),
		types: types.map((t) => ({ id: t.id, slug: t.slug, name: t.name }))
	};
}

const CARD_FIELDS = [
	'id', 'slug', 'code', 'kind', 'title', 'teaser', 'abstract', 'authors', 'status', 'date', 'output_type.slug', 'output_type.name', 'formats.output_type.slug',
	'actors.actors_id.slug', 'actors.sort', 'principles.principles_id.code', 'principles.sort', 'dimensions.dimensions_id.slug', 'dimensions.sort', 'regions.regions_id.slug', 'regions.sort'
];
const TAG_DEEP = Object.fromEntries(['actors', 'principles', 'dimensions', 'regions'].map((k) => [k, { _limit: -1 }]));

function toCard(o: Row, locale: Locale): Card {
	const title = tr(o, 'title', locale);
	const teaser = tr(o, 'teaser', locale);
	const actors = sorted(o.actors, 'actors_id').map((a: Row) => a.slug);
	return {
		id: o.id, slug: o.slug, code: o.code, kind: o.kind, title, teaser, status: o.status, date: o.date,
		types: [o.output_type?.slug, ...(o.formats ?? []).map((f: Row) => f.output_type?.slug)].filter(Boolean),
		typeName: o.output_type?.name ?? null,
		actors,
		principles: sorted(o.principles, 'principles_id').map((p: Row) => p.code),
		dimensions: sorted(o.dimensions, 'dimensions_id').map((d: Row) => d.slug),
		regions: sorted(o.regions, 'regions_id').map((r: Row) => r.slug),
		searchText: fold([o.code, title, teaser, stripTags(tr(o, 'abstract', locale)), o.authors].filter(Boolean).join(' '))
	};
}

/** Every published output as a card. */
export async function getCards(locale: Locale = DEFAULT_LOCALE): Promise<Card[]> {
	const rows = await read<Row[]>('/items/outputs' + qs({ limit: -1, fields: [...CARD_FIELDS, ...trFields(locale, ['title', 'teaser', 'abstract'])].join(','), deep: TAG_DEEP }));
	return rows.map((o) => toCard(o, locale));
}

export interface OutputDetail {
	card: Card;
	abstract: string | null;
	link: string | null;
	pidType: 'doi' | 'url' | null;
	citation: string | null;
	publisher: string | null;
	authors: string | null;
	openAccess: boolean | null;
	peerReviewed: boolean | null;
	workPackage: string | null;
	lead: { code: string; name: string | null } | null;
	contributors: string[];
	messages: { actor: string; message: string }[];
	visuals: { filename: string; altText: string | null; html: string | null; fileId: string | null }[];
	formats: { title: string; type: string | null; link: string | null }[];
	relations: { slug: string; title: string; type: string; note: string | null; direction: 'out' | 'in' }[];
	webinar: { url: string; title: string | null } | null;
}

export async function getOutput(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<OutputDetail> {
	const fields = [
		...CARD_FIELDS, 'link', 'pid_type', 'citation', 'publisher', 'open_access', 'peer_reviewed', 'work_package', 'lead_partner.code', 'lead_partner.name',
		'contributors.partners_id.code', 'contributors.sort', 'actor_messages.actor.slug', 'actor_messages.message', 'actor_messages.sort',
		'visuals.sort', 'visuals.visuals_id.filename', 'visuals.visuals_id.alt_text', 'visuals.visuals_id.html_text', 'visuals.visuals_id.file',
		'formats.title', 'formats.link', 'formats.output_type.name', 'relations.relation_type', 'relations.note', 'relations.related_output.slug', 'relations.related_output.title',
		'webinar.url', 'webinar.title', ...trFields(locale, ['title', 'teaser', 'abstract'])
	];
	const [o] = await read<Row[]>('/items/outputs' + qs({ filter: { slug: { _eq: slug } }, fields: fields.join(','), deep: { ...TAG_DEEP, actor_messages: { _limit: -1 }, visuals: { _limit: -1 } }, limit: 1 }));
	if (!o) error(404, 'Output not found');
	const inbound = await read<Row[]>('/items/output_relations' + qs({ filter: { related_output: { _eq: o.id } }, fields: 'relation_type,note,output.slug,output.title' }));
	return {
		card: toCard(o, locale),
		abstract: safeHtml(tr(o, 'abstract', locale)),
		link: o.link, pidType: o.pid_type, citation: o.citation, publisher: o.publisher, authors: o.authors,
		openAccess: o.open_access, peerReviewed: o.peer_reviewed, workPackage: o.work_package,
		lead: o.lead_partner ? { code: o.lead_partner.code, name: o.lead_partner.name } : null,
		contributors: sorted(o.contributors, 'partners_id').map((p: Row) => p.code),
		messages: [...(o.actor_messages ?? [])].sort((a: Row, b: Row) => a.sort - b.sort).map((m: Row) => ({ actor: m.actor?.slug, message: m.message })),
		visuals: sorted(o.visuals, 'visuals_id').map((v: Row) => ({ filename: v.filename, altText: v.alt_text, html: safeHtml(v.html_text), fileId: v.file })),
		formats: (o.formats ?? []).map((f: Row) => ({ title: f.title, type: f.output_type?.name ?? null, link: f.link })),
		relations: [
			...(o.relations ?? []).filter((r: Row) => r.related_output).map((r: Row) => ({ slug: r.related_output.slug, title: r.related_output.title, type: r.relation_type, note: r.note, direction: 'out' as const })),
			...inbound.filter((r) => r.output).map((r) => ({ slug: r.output.slug, title: r.output.title, type: r.relation_type, note: r.note, direction: 'in' as const }))
		],
		webinar: o.webinar ? { url: o.webinar.url, title: o.webinar.title } : null
	};
}

/** Key messages for one actor, across all outputs. */
export async function getActorMessages(actorSlug: string): Promise<{ output: number; message: string }[]> {
	const rows = await read<Row[]>('/items/output_actor_messages' + qs({ limit: -1, filter: { actor: { slug: { _eq: actorSlug } } }, fields: 'message,output,sort' }));
	return rows.map((r) => ({ output: r.output, message: r.message }));
}

export async function getRoadmap(actorSlug: string): Promise<{ status: string; due: string | null } | null> {
	const [r] = await read<Row[]>('/items/roadmaps' + qs({ filter: { actor: { slug: { _eq: actorSlug } } }, fields: 'status,deliverable.date', limit: 1 }));
	return r ? { status: r.status, due: r.deliverable?.date ?? null } : null;
}

export interface Prompt { id: number; key: string; question: string; stream: string }

export async function getPrompt(key: string, locale: Locale = DEFAULT_LOCALE): Promise<Prompt | null> {
	const [p] = await read<Row[]>('/items/feedback_prompts' + qs({ filter: { key: { _eq: key } }, fields: ['id', 'key', 'question', 'stream', 'open_until', ...trFields(locale, ['question'])].join(','), limit: 1 }));
	if (!p || (p.open_until && p.open_until < new Date().toISOString().slice(0, 10))) return null;
	return { id: p.id, key: p.key, question: tr(p, 'question', locale), stream: p.stream };
}

export async function getPage(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<{ title: string; body: string | null } | null> {
	const [p] = await read<Row[]>('/items/pages' + qs({ filter: { slug: { _eq: slug } }, fields: ['title', 'body', ...trFields(locale, ['title', 'body'])].join(','), limit: 1 }));
	return p ? { title: tr(p, 'title', locale), body: safeHtml(tr(p, 'body', locale)) } : null;
}

// Content from Drupal (public JSON:API), shaped for the pages.
// Translations: English is the source; for other locales Drupal serves the translation
// under a language prefix (/es/jsonapi/…) and falls back to English where none exists.
// Ids are Drupal's own (node and term ids), as the feedback endpoint expects.

import { error } from '@sveltejs/kit';
import { fold, type Card } from '#lib/library/filters.ts';
import { DEFAULT_LOCALE, type Locale } from '#lib/i18n/locales.ts';
import { q, read, relIds, type Resource } from './drupal.ts';
import { safeHtml } from './html.ts';

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

/** Drupal's language prefix for a site locale ('' for English). */
const prefix = (locale: Locale) => (locale === DEFAULT_LOCALE ? '' : `/${locale}`);
const text = (v: any): string | null => (v == null ? null : typeof v === 'object' ? (v.value ?? null) : String(v)) || null;
const stripTags = (s: string | null) => (s ?? '').replace(/<[^>]+>/g, ' ');
const sorted = (rows: Resource[]) => [...rows].sort((a, b) => (a.attributes.weight ?? 0) - (b.attributes.weight ?? 0));

// ---------------------------------------------------------------------------
// Taxonomies
// ---------------------------------------------------------------------------

interface TaxIndex extends Taxonomies {
	/** uuid → slug/code, to resolve relationships */
	slugOf: Map<string, string>;
	tidOf: Map<string, number>;
}

async function taxonomyIndex(locale: Locale): Promise<TaxIndex> {
	const p = prefix(locale);
	const terms = (vid: string) => read(`/taxonomy_term/${vid}${q({ 'page[limit]': 50, sort: 'weight' })}`, p).then((d) => sorted(d.data));
	const [actors, principles, dimensions, regions, types] = await Promise.all(['actor', 'principle', 'dimension', 'region', 'output_type'].map(terms));
	const slugOf = new Map<string, string>();
	const tidOf = new Map<string, number>();
	for (const t of [...actors, ...dimensions, ...regions, ...types]) slugOf.set(t.id, t.attributes.field_slug);
	for (const t of principles) slugOf.set(t.id, t.attributes.field_code);
	for (const t of [...actors, ...principles, ...dimensions, ...regions, ...types]) tidOf.set(t.id, t.attributes.drupal_internal__tid);

	const all: Actor[] = actors.map((a) => ({
		id: a.attributes.drupal_internal__tid,
		slug: a.attributes.field_slug,
		name: a.attributes.name,
		isHub: !!a.attributes.field_is_hub,
		description: text(a.attributes.description),
		intro: safeHtml(text(a.attributes.field_intro)),
		shownIn: relIds(a, 'field_shown_in').map((id) => slugOf.get(id)!).filter(Boolean)
	}));
	const dims = dimensions.map((d) => ({
		id: d.attributes.drupal_internal__tid,
		slug: d.attributes.field_slug,
		name: d.attributes.name,
		principle: slugOf.get(relIds(d, 'field_principle')[0]) ?? ''
	}));
	const term = (t: Resource): Term => ({ id: t.attributes.drupal_internal__tid, slug: t.attributes.field_slug, name: t.attributes.name });
	return {
		slugOf,
		tidOf,
		actors: all,
		hubs: all.filter((a) => a.isHub),
		principles: principles.map((pr) => ({
			id: pr.attributes.drupal_internal__tid,
			code: pr.attributes.field_code,
			slug: pr.attributes.field_slug,
			name: pr.attributes.name,
			shortName: pr.attributes.field_short_name ?? pr.attributes.name,
			dimensions: dims.filter((d) => d.principle === pr.attributes.field_code).map((d) => ({ slug: d.slug, name: d.name }))
		})),
		dimensions: dims,
		regions: regions.map(term),
		types: types.map(term)
	};
}

export async function getTaxonomies(locale: Locale = DEFAULT_LOCALE): Promise<Taxonomies> {
	const { slugOf, tidOf, ...tax } = await taxonomyIndex(locale);
	return tax;
}

// ---------------------------------------------------------------------------
// Outputs
// ---------------------------------------------------------------------------

const CARD_FIELDS = [
	'drupal_internal__nid', 'title', 'field_slug', 'field_code', 'field_kind', 'field_teaser', 'field_abstract', 'field_authors', 'field_status', 'field_date',
	'field_output_type', 'field_formats', 'field_relations', 'field_actors', 'field_principles', 'field_dimensions', 'field_regions'
].join(',');

/** All published outputs, with their formats and relations (one cached request set). */
async function outputsDoc(locale: Locale) {
	return read(
		`/node/output${q({ 'page[limit]': 50, include: 'field_formats,field_relations', 'fields[node--output]': CARD_FIELDS, 'fields[paragraph--format]': 'field_output_type', 'fields[paragraph--relation]': 'field_related_output,field_relation_type,field_note' })}`,
		prefix(locale)
	);
}

function toCard(o: Resource, tax: TaxIndex, included: Map<string, Resource>): Card {
	const slugs = (field: string) => relIds(o, field).map((id) => tax.slugOf.get(id)).filter((s): s is string => !!s);
	const typeName = (id: string | undefined) => (id ? tax.types.find((t) => tax.slugOf.get(id) === t.slug)?.name ?? null : null);
	const typeSlug = relIds(o, 'field_output_type')[0];
	const a = o.attributes;
	return {
		id: a.drupal_internal__nid,
		slug: a.field_slug,
		code: a.field_code ?? null,
		kind: a.field_kind,
		title: a.title,
		teaser: a.field_teaser ?? null,
		status: a.field_status,
		date: a.field_date ?? null,
		types: [
			tax.slugOf.get(typeSlug ?? ''),
			...relIds(o, 'field_formats').map((pid) => tax.slugOf.get(relIds(included.get(pid) ?? ({ relationships: {} } as Resource), 'field_output_type')[0] ?? ''))
		].filter((s): s is string => !!s),
		typeName: typeName(typeSlug),
		actors: slugs('field_actors'),
		principles: slugs('field_principles'),
		dimensions: slugs('field_dimensions'),
		regions: slugs('field_regions'),
		searchText: fold([a.field_code, a.title, a.field_teaser, stripTags(text(a.field_abstract)), a.field_authors].filter(Boolean).join(' '))
	};
}

/** Every published output as a card. */
export async function getCards(locale: Locale = DEFAULT_LOCALE): Promise<Card[]> {
	const [tax, doc] = await Promise.all([taxonomyIndex(locale), outputsDoc(locale)]);
	const included = new Map(doc.included.map((r) => [r.id, r]));
	return doc.data.map((o) => toCard(o, tax, included));
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
	const p = prefix(locale);
	const [tax, all, doc] = await Promise.all([
		taxonomyIndex(locale),
		outputsDoc(locale),
		read(
			`/node/output${q({ 'filter[field_slug]': slug, include: 'field_lead_partner,field_contributors,field_actor_messages,field_visuals,field_formats,field_formats.field_output_type,field_relations,field_webinar' })}`,
			p
		)
	]);
	const o = doc.data[0];
	if (!o) error(404, 'Output not found');
	// The detail query's included resources are complete; the list's are trimmed, so the detail wins.
	const inc = new Map([...all.included, ...doc.included].map((r) => [r.id, r]));
	const allIncluded = new Map(all.included.map((r) => [r.id, r]));
	const byUuid = new Map(all.data.map((n) => [n.id, n]));
	const a = o.attributes;
	const yesNo = (v: string | null) => (v === 'yes' ? true : v === 'no' ? false : null);
	const partner = (id: string) => inc.get(id)?.attributes;

	const lead = relIds(o, 'field_lead_partner').map(partner).find(Boolean);
	const webinar = relIds(o, 'field_webinar').map((id) => inc.get(id)?.attributes).find(Boolean);

	// Typed relations: from this output, and from others pointing at it.
	const relationsOf = (n: Resource) => relIds(n, 'field_relations').map((pid) => allIncluded.get(pid) ?? inc.get(pid)).filter((r): r is Resource => !!r);
	const out = relationsOf(o).map((r) => ({ r, other: byUuid.get(relIds(r, 'field_related_output')[0]) }));
	const incoming = all.data.flatMap((n) => relationsOf(n).filter((r) => relIds(r, 'field_related_output')[0] === o.id).map((r) => ({ r, other: n })));

	return {
		card: toCard(o, tax, inc),
		abstract: safeHtml(text(a.field_abstract)),
		link: a.field_link?.uri ?? null,
		pidType: a.field_pid_type ?? null,
		citation: a.field_citation ?? null,
		publisher: a.field_publisher ?? null,
		authors: a.field_authors ?? null,
		openAccess: yesNo(a.field_open_access ?? null),
		peerReviewed: yesNo(a.field_peer_reviewed ?? null),
		workPackage: a.field_work_package ?? null,
		// The full partner name is optional in Drupal; it starts as the acronym.
		lead: lead ? { code: lead.field_code, name: lead.name && lead.name !== lead.field_code ? lead.name : null } : null,
		contributors: relIds(o, 'field_contributors').map((id) => partner(id)?.field_code).filter(Boolean),
		messages: relIds(o, 'field_actor_messages')
			.map((id) => inc.get(id))
			.filter((m): m is Resource => !!m)
			.map((m) => ({ actor: tax.slugOf.get(relIds(m, 'field_actor')[0]) ?? '', message: m.attributes.field_message })),
		visuals: relIds(o, 'field_visuals')
			.map((id) => inc.get(id))
			.filter((m): m is Resource => !!m)
			.map((m) => ({ filename: m.attributes.field_filename, altText: m.attributes.field_alt_text ?? null, html: safeHtml(text(m.attributes.field_html_text)), fileId: null })),
		formats: relIds(o, 'field_formats')
			.map((id) => inc.get(id))
			.filter((f): f is Resource => !!f)
			.map((f) => ({ title: f.attributes.field_format_title ?? '', type: inc.get(relIds(f, 'field_output_type')[0])?.attributes.name ?? null, link: f.attributes.field_link?.uri ?? null })),
		relations: [
			...out.filter((x) => x.other).map(({ r, other }) => ({ slug: other!.attributes.field_slug, title: other!.attributes.title, type: r.attributes.field_relation_type, note: r.attributes.field_note ?? null, direction: 'out' as const })),
			...incoming.map(({ r, other }) => ({ slug: other.attributes.field_slug, title: other.attributes.title, type: r.attributes.field_relation_type, note: r.attributes.field_note ?? null, direction: 'in' as const }))
		],
		// The import names webinars after their URL until an editor gives them a title.
		webinar: webinar ? { url: webinar.field_url?.uri, title: webinar.title && webinar.title !== webinar.field_url?.uri ? webinar.title : null } : null
	};
}

// ---------------------------------------------------------------------------
// Hubs, prompts, pages
// ---------------------------------------------------------------------------

/** Key messages for one actor, across all published outputs (output = node id). */
export async function getActorMessages(actorSlug: string, locale: Locale = DEFAULT_LOCALE): Promise<{ output: number; message: string }[]> {
	const tax = await taxonomyIndex(locale);
	const actor = [...tax.slugOf].find(([, s]) => s === actorSlug)?.[0];
	if (!actor) return [];
	const doc = await read(`/paragraph/actor_message${q({ 'filter[field_actor.id]': actor, 'page[limit]': 50, 'fields[paragraph--actor_message]': 'field_message,parent_id,parent_type' })}`, prefix(locale));
	return doc.data.filter((m) => m.attributes.parent_type === 'node').map((m) => ({ output: Number(m.attributes.parent_id), message: m.attributes.field_message }));
}

export async function getRoadmap(actorSlug: string, locale: Locale = DEFAULT_LOCALE): Promise<{ status: string; due: string | null } | null> {
	const tax = await taxonomyIndex(locale);
	const actor = [...tax.slugOf].find(([, s]) => s === actorSlug)?.[0];
	if (!actor) return null;
	const doc = await read(`/node/roadmap${q({ 'filter[field_actor.id]': actor, include: 'field_deliverable', 'fields[node--roadmap]': 'field_roadmap_status,field_deliverable', 'fields[node--output]': 'field_date' })}`, prefix(locale));
	const r = doc.data[0];
	if (!r) return null;
	const d = doc.included.find((i) => i.id === relIds(r, 'field_deliverable')[0]);
	return { status: r.attributes.field_roadmap_status, due: d?.attributes.field_date ?? null };
}

export interface Prompt { id: number; key: string; question: string; stream: string }

/** A published feedback prompt by key (unpublished prompts are switched off). */
export async function getPrompt(key: string, locale: Locale = DEFAULT_LOCALE): Promise<Prompt | null> {
	const doc = await read(`/node/feedback_prompt${q({ 'filter[field_key]': key })}`, prefix(locale));
	const p = doc.data[0];
	if (!p || (p.attributes.field_open_until && p.attributes.field_open_until < new Date().toISOString().slice(0, 10))) return null;
	return { id: p.attributes.drupal_internal__nid, key: p.attributes.field_key, question: p.attributes.title, stream: p.attributes.field_stream };
}

export async function getPage(slug: string, locale: Locale = DEFAULT_LOCALE): Promise<{ title: string; body: string | null } | null> {
	const doc = await read(`/node/page${q({ 'filter[field_slug]': slug })}`, prefix(locale));
	const p = doc.data[0];
	return p ? { title: p.attributes.title, body: safeHtml(text(p.attributes.field_body)) } : null;
}

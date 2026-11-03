// Library filtering: pure functions shared by /library, the actor hubs and the
// principle pages (which are preset library queries). Every view is a URL:
//   /library?actor=cities&principle=p2&dimension=just-transition&q=offsets&sort=old
// Within one facet, values are alternatives (OR); different facets combine (AND).

export interface Card {
	id: number;
	slug: string;
	code: string | null;
	kind: 'deliverable' | 'milestone' | 'publication';
	title: string;
	teaser: string | null;
	status: 'published' | 'upcoming';
	/** YYYY-MM-DD */
	date: string | null;
	/** Output type slug, plus the types of its other formats. */
	types: string[];
	typeName: string | null;
	/** Ordered, most relevant first. */
	actors: string[];
	principles: string[];
	dimensions: string[];
	regions: string[];
	/** Lower-cased, accent-free text for search. */
	searchText: string;
}

export const FACETS = ['actor', 'principle', 'dimension', 'type', 'region', 'year', 'status'] as const;
export type Facet = (typeof FACETS)[number];
export const SORTS = ['new', 'old', 'title'] as const;
export type Sort = (typeof SORTS)[number];

export type Filters = Record<Facet, string[]> & { q: string; sort: Sort };

export const emptyFilters = (): Filters => ({ actor: [], principle: [], dimension: [], type: [], region: [], year: [], status: [], q: '', sort: 'new' });

/** Normalise text for matching: lower case, no accents. */
export const fold = (s: string) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();

const year = (c: Card) => (c.date ? c.date.slice(0, 4) : '');

/** The values a card has for a facet. */
export function valuesOf(c: Card, facet: Facet): string[] {
	switch (facet) {
		case 'actor': return c.actors;
		case 'principle': return c.principles;
		case 'dimension': return c.dimensions;
		case 'type': return c.types;
		case 'region': return c.regions;
		case 'year': return c.date ? [year(c)] : [];
		case 'status': return [c.status];
	}
}

/**
 * Read filters from a URL. Values not in `allowed` (when given) are dropped, so a
 * stale or mistyped link shows a sensible view instead of an empty one.
 */
export function parseFilters(params: URLSearchParams, allowed?: Partial<Record<Facet, Iterable<string>>>): Filters {
	const f = emptyFilters();
	for (const facet of FACETS) {
		const ok = allowed?.[facet] ? new Set(allowed[facet]) : null;
		const vals = params.getAll(facet).flatMap((v) => v.split(',')).map((v) => v.trim().toLowerCase()).filter(Boolean);
		f[facet] = [...new Set(vals)].filter((v) => !ok || ok.has(v));
	}
	f.q = (params.get('q') ?? '').trim().slice(0, 200);
	const sort = params.get('sort');
	f.sort = (SORTS as readonly string[]).includes(sort ?? '') ? (sort as Sort) : 'new';
	return f;
}

/** Filters → query string (stable order, defaults omitted). Leading "?" included, or "" when empty. */
export function toQuery(f: Filters): string {
	const p = new URLSearchParams();
	for (const facet of FACETS) for (const v of f[facet]) p.append(facet, v);
	if (f.q) p.set('q', f.q);
	if (f.sort !== 'new') p.set('sort', f.sort);
	const s = p.toString();
	return s ? `?${s}` : '';
}

/** A copy of the filters with one value switched on or off. */
export function toggle(f: Filters, facet: Facet, value: string): Filters {
	const next: Filters = { ...f, [facet]: f[facet].includes(value) ? f[facet].filter((v) => v !== value) : [...f[facet], value] };
	return next;
}

/** A copy without any value for these facets. */
export function clear(f: Filters, ...facets: Facet[]): Filters {
	const next = { ...f };
	for (const facet of facets) next[facet] = [];
	return next;
}

export const isActive = (f: Filters) => FACETS.some((x) => f[x].length > 0) || f.q !== '';

function matchesQuery(c: Card, q: string): boolean {
	const words = fold(q).split(/\s+/).filter(Boolean);
	return words.every((w) => c.searchText.includes(w));
}

/** Cards matching the filters. `except` ignores one facet (for that facet's own counts). */
export function applyFilters(cards: Card[], f: Filters, except?: Facet): Card[] {
	return cards.filter((c) => {
		for (const facet of FACETS) {
			if (facet === except || !f[facet].length) continue;
			const have = valuesOf(c, facet);
			if (!f[facet].some((v) => have.includes(v))) return false;
		}
		return !f.q || matchesQuery(c, f.q);
	});
}

/**
 * Count per value of a facet, given all the other active filters. Selecting a value
 * in this facet adds alternatives, so the facet's own selection is ignored.
 */
export function facetCounts(cards: Card[], f: Filters, facet: Facet): Map<string, number> {
	const counts = new Map<string, number>();
	for (const c of applyFilters(cards, f, facet)) for (const v of new Set(valuesOf(c, facet))) counts.set(v, (counts.get(v) ?? 0) + 1);
	return counts;
}

export function sortCards(cards: Card[], sort: Sort): Card[] {
	const byDate = (a: Card, b: Card) => (a.date ?? '').localeCompare(b.date ?? '') || a.title.localeCompare(b.title);
	const out = [...cards];
	if (sort === 'title') return out.sort((a, b) => a.title.localeCompare(b.title, 'en', { sensitivity: 'base' }));
	if (sort === 'old') return out.sort(byDate);
	return out.sort((a, b) => byDate(b, a));
}

/**
 * Options for a facet's chips: values with items, plus any selected value (so it can
 * always be switched off), in the given order. Chips with no items are hidden, not greyed.
 */
export function chipOptions(cards: Card[], f: Filters, facet: Facet, order: string[]): { value: string; count: number; selected: boolean }[] {
	const counts = facetCounts(cards, f, facet);
	return order
		.map((value) => ({ value, count: counts.get(value) ?? 0, selected: f[facet].includes(value) }))
		.filter((o) => o.count > 0 || o.selected);
}

/**
 * Hub ordering (docs/content-model.md): outputs where the hub's actor is the first
 * actor are featured, newest first; the rest follow, newest first.
 */
export function hubOrder(cards: Card[], actor: string): Card[] {
	const newest = sortCards(cards, 'new');
	return [...newest.filter((c) => c.actors[0] === actor), ...newest.filter((c) => c.actors[0] !== actor)];
}

/**
 * Related items (docs/content-model.md): explicit links first, then outputs sharing
 * the first actor and at least one principle, newest first.
 */
export function related(card: Card, cards: Card[], explicit: number[], limit = 4): Card[] {
	const out = explicit.map((id) => cards.find((c) => c.id === id)).filter((c): c is Card => !!c);
	const rest = sortCards(
		cards.filter((c) => c.id !== card.id && !explicit.includes(c.id) && c.actors[0] === card.actors[0] && c.principles.some((p) => card.principles.includes(p))),
		'new'
	);
	return [...out, ...rest].slice(0, limit);
}

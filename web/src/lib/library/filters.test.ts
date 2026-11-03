import { describe, expect, it } from 'vitest';
import {
	applyFilters, chipOptions, emptyFilters, facetCounts, fold, hubOrder, isActive, parseFilters, related, sortCards, toggle, toQuery, type Card
} from './filters.ts';

const card = (id: number, over: Partial<Card>): Card => ({
	id, slug: `c${id}`, code: null, kind: 'publication', title: `Lorem ${id}`, teaser: null, status: 'published', date: '2025-01-01',
	types: ['report'], typeName: 'Report', actors: ['cities'], principles: ['p1'], dimensions: [], regions: ['global'], searchText: fold(`lorem ${id}`), ...over
});

const cards: Card[] = [
	card(1, { actors: ['cities', 'business'], principles: ['p1', 'p2'], dimensions: ['just-transition'], date: '2026-06-01' }),
	card(2, { actors: ['business', 'cities'], principles: ['p3'], date: '2025-12-01', types: ['journal-article', 'policy-brief'] }),
	card(3, { actors: ['ccis', 'business', 'finance'], principles: ['p1'], status: 'upcoming', date: '2027-04-01', searchText: fold('Carbon offsets in São Paulo') }),
	card(4, { actors: ['cities'], principles: ['p2'], regions: ['latin-america'], date: '2024-10-01' })
];
const ids = (cs: Card[]) => cs.map((c) => c.id);

describe('URL parsing and building', () => {
	it('reads repeated and comma-separated values, and drops unknown ones', () => {
		const f = parseFilters(new URLSearchParams('actor=cities&actor=ccis&principle=p2,P4&principle=p9&sort=old'), { actor: ['cities', 'ccis'], principle: ['p1', 'p2', 'p3', 'p4'] });
		expect(f.actor).toEqual(['cities', 'ccis']);
		expect(f.principle).toEqual(['p2', 'p4']);
		expect(f.sort).toBe('old');
	});

	it('falls back to newest first for an unknown sort', () => {
		expect(parseFilters(new URLSearchParams('sort=random')).sort).toBe('new');
	});

	it('round-trips to a shareable URL, as in CLAUDE.md', () => {
		const f = parseFilters(new URLSearchParams('actor=cities&principle=p2'));
		expect(toQuery(f)).toBe('?actor=cities&principle=p2');
		expect(toQuery(parseFilters(new URLSearchParams(toQuery(f).slice(1))))).toBe(toQuery(f));
	});

	it('omits defaults, and is empty with no filters', () => {
		expect(toQuery(emptyFilters())).toBe('');
		expect(isActive(emptyFilters())).toBe(false);
	});

	it('toggles a value on and off without touching the others', () => {
		const f = parseFilters(new URLSearchParams('actor=cities'));
		expect(toQuery(toggle(f, 'principle', 'p2'))).toBe('?actor=cities&principle=p2');
		expect(toQuery(toggle(toggle(f, 'principle', 'p2'), 'principle', 'p2'))).toBe('?actor=cities');
		expect(f.principle).toEqual([]);
	});
});

describe('filtering', () => {
	it('combines facets with AND and values within a facet with OR', () => {
		const f = { ...emptyFilters(), actor: ['cities'], principle: ['p2', 'p3'] };
		expect(ids(applyFilters(cards, f))).toEqual([1, 2, 4]);
		expect(ids(applyFilters(cards, { ...f, region: ['latin-america'] }))).toEqual([4]);
	});

	it('matches an output by any of its formats', () => {
		expect(ids(applyFilters(cards, { ...emptyFilters(), type: ['policy-brief'] }))).toEqual([2]);
	});

	it('filters by year and status', () => {
		expect(ids(applyFilters(cards, { ...emptyFilters(), year: ['2025'] }))).toEqual([2]);
		expect(ids(applyFilters(cards, { ...emptyFilters(), status: ['upcoming'] }))).toEqual([3]);
	});

	it('searches every word, ignoring case and accents', () => {
		expect(ids(applyFilters(cards, { ...emptyFilters(), q: 'sao OFFSETS' }))).toEqual([3]);
		expect(ids(applyFilters(cards, { ...emptyFilters(), q: 'offsets nowhere' }))).toEqual([]);
	});

	it('lists Finance items on a hub through their hub tags', () => {
		const hub = applyFilters(cards, { ...emptyFilters(), actor: ['business'] });
		expect(ids(hub)).toContain(3);
		expect(ids(applyFilters(hub, { ...emptyFilters(), actor: ['finance'] }))).toEqual([3]);
	});
});

describe('counts and chips', () => {
	it('counts a facet ignoring its own selection, but respecting the others', () => {
		const f = { ...emptyFilters(), actor: ['cities'], principle: ['p2'] };
		const counts = facetCounts(cards, f, 'principle');
		expect(Object.fromEntries(counts)).toEqual({ p1: 1, p2: 2, p3: 1 });
	});

	it('hides chips with no items but keeps selected ones', () => {
		const f = { ...emptyFilters(), actor: ['ccis'], principle: ['p3'] };
		const chips = chipOptions(cards, f, 'principle', ['p1', 'p2', 'p3', 'p4']);
		expect(chips).toEqual([
			{ value: 'p1', count: 1, selected: false },
			{ value: 'p3', count: 0, selected: true }
		]);
	});
});

describe('ordering', () => {
	it('sorts newest first, oldest first and by title', () => {
		expect(ids(sortCards(cards, 'new'))).toEqual([3, 1, 2, 4]);
		expect(ids(sortCards(cards, 'old'))).toEqual([4, 2, 1, 3]);
		expect(ids(sortCards([card(9, { title: 'beta' }), card(8, { title: 'Alpha' })], 'title'))).toEqual([8, 9]);
	});

	it("features a hub's own items (first actor) before the rest", () => {
		expect(ids(hubOrder(cards, 'cities'))).toEqual([1, 4, 3, 2]);
	});

	it('puts explicit relations first, then items sharing the first actor and a principle', () => {
		expect(ids(related(cards[0], cards, [3]))).toEqual([3, 4]);
	});
});

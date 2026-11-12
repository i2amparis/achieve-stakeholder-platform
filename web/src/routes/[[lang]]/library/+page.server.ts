import { principleLabel } from '#lib/format.ts';
import { href } from '#lib/i18n/locales.ts';
import { applyFilters, chipOptions, clear, isActive, parseFilters, sortCards, toggle, toQuery, type Facet, type Filters } from '#lib/library/filters.ts';
import { getCards, getPrompt, getTaxonomies, type Taxonomies } from '#lib/server/content.ts';
import { feedbackAction } from '#lib/server/feedback.ts';
import { localeFromParam } from '#lib/i18n/locales.ts';
import type { Actions, PageServerLoad } from './$types';

const FACET_LABELS: Record<Facet, string> = {
	actor: 'Actor group', principle: 'Integrity principle', dimension: 'Dimension', type: 'Output type', region: 'Region', year: 'Year', status: 'Status'
};

function allowed(tax: Taxonomies, years: string[]) {
	return {
		actor: tax.actors.map((a) => a.slug),
		principle: tax.principles.map((p) => p.code),
		dimension: tax.dimensions.map((d) => d.slug),
		type: tax.types.map((t) => t.slug),
		region: tax.regions.map((r) => r.slug),
		year: years,
		status: ['published', 'upcoming']
	};
}

export const load: PageServerLoad = async ({ url, parent }) => {
	const { locale } = await parent();
	const [tax, cards, prompt] = await Promise.all([getTaxonomies(locale), getCards(locale), getPrompt('library', locale)]);
	const years = [...new Set(cards.map((c) => c.date?.slice(0, 4)).filter((y): y is string => !!y))].sort().reverse();
	const f = parseFilters(url.searchParams, allowed(tax, years));

	const labels: Record<Facet, Record<string, string>> = {
		actor: Object.fromEntries(tax.actors.map((a) => [a.slug, a.name])),
		principle: Object.fromEntries(tax.principles.map((p) => [p.code, principleLabel(p)])),
		dimension: Object.fromEntries(tax.dimensions.map((d) => [d.slug, d.name.charAt(0).toUpperCase() + d.name.slice(1)])),
		type: Object.fromEntries(tax.types.map((t) => [t.slug, t.name])),
		region: Object.fromEntries(tax.regions.map((r) => [r.slug, r.name])),
		year: Object.fromEntries(years.map((y) => [y, y])),
		status: { published: 'Published', upcoming: 'Coming soon' }
	};
	// Dimensions follow the chosen principles, as on the hubs.
	const dimOrder = tax.dimensions.filter((d) => !f.principle.length || f.principle.includes(d.principle)).map((d) => d.slug);
	const order: Record<Facet, string[]> = {
		actor: tax.actors.map((a) => a.slug),
		principle: tax.principles.map((p) => p.code),
		dimension: [...dimOrder, ...f.dimension.filter((d) => !dimOrder.includes(d))],
		type: tax.types.map((t) => t.slug),
		region: tax.regions.map((r) => r.slug),
		year: years,
		status: ['published', 'upcoming']
	};
	const facets = (Object.keys(FACET_LABELS) as Facet[]).map((facet) => ({
		facet,
		label: FACET_LABELS[facet],
		options: chipOptions(cards, f, facet, order[facet]).map((o) => ({ ...o, label: labels[facet][o.value] ?? o.value }))
	}));
	const results = sortCards(applyFilters(cards, f), f.sort);
	const base = href('/library', locale);
	const active = (Object.keys(FACET_LABELS) as Facet[]).flatMap((facet) =>
		f[facet].map((value) => ({ facet, value, label: labels[facet][value] ?? value, href: base + toQuery(toggle(f, facet, value)) }))
	);
	return {
		filters: f,
		query: toQuery(f),
		facets,
		active,
		clearHref: base + toQuery({ ...clear(f, 'actor', 'principle', 'dimension', 'type', 'region', 'year', 'status'), q: '' }),
		anyActive: isActive(f),
		results,
		total: cards.length,
		prompt,
		principleNames: Object.fromEntries(tax.principles.map((p) => [p.code, p.shortName])),
		actorNames: labels.actor
	};
};

export const actions: Actions = {
	suggest: async (event) => {
		const locale = localeFromParam(event.params.lang) ?? 'en';
		const [tax, prompt] = await Promise.all([getTaxonomies(locale), getPrompt('library', locale)]);
		// The page sends its own query string; it is re-parsed and validated here.
		const data = await event.request.clone().formData();
		const query = String(data.get('view') ?? '').replace(/^\?/, '');
		const f: Filters = parseFilters(new URLSearchParams(query), allowed(tax, []));
		const context = Object.fromEntries(Object.entries(f).filter(([k, v]) => (Array.isArray(v) ? v.length : k === 'q' && v)));
		return feedbackAction(event, 'suggest', { prompt: prompt?.id ?? null, page_path: href('/library', locale) + toQuery(f), context_filters: Object.keys(context).length ? context : null }, 'suggest_research');
	}
};

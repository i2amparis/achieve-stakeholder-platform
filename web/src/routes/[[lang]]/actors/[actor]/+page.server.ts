import { error } from '@sveltejs/kit';
import { HUB_FEATURED } from '#lib/config.ts';
import { principleLabel } from '#lib/format.ts';
import { href, localeFromParam } from '#lib/i18n/locales.ts';
import { applyFilters, chipOptions, emptyFilters, hubOrder, parseFilters, sortCards, toQuery, type Filters } from '#lib/library/filters.ts';
import { getActorMessages, getCards, getPrompt, getRoadmap, getTaxonomies } from '#lib/server/content.ts';
import { feedbackAction } from '#lib/server/feedback.ts';
import type { Actions, PageServerLoad } from './$types';

// A hub is a preset library query: actor = this hub. Its own filters (principle,
// dimension and sub-actors such as Finance) are URL parameters, so every view can be shared.
export const load: PageServerLoad = async ({ params, url, parent }) => {
	const { locale } = await parent();
	const [tax, cards] = await Promise.all([getTaxonomies(locale), getCards(locale)]);
	const actor = tax.actors.find((a) => a.slug === params.actor);
	if (!actor || !actor.isHub) error(404, 'Actor hub not found');

	const [messages, roadmap, prompt] = await Promise.all([getActorMessages(actor.slug), getRoadmap(actor.slug), getPrompt('actor_hub', locale)]);
	const mine = cards.filter((c) => c.actors.includes(actor.slug));
	const published = mine.filter((c) => c.status === 'published');
	const upcoming = sortCards(mine.filter((c) => c.status === 'upcoming'), 'old');

	// Actors without a hub that are shown here as a filter chip (Finance on Business and CCIs).
	const subActors = tax.actors.filter((a) => !a.isHub && a.shownIn.includes(actor.slug));
	const f = parseFilters(url.searchParams, {
		principle: tax.principles.map((p) => p.code),
		dimension: tax.dimensions.map((d) => d.slug),
		actor: subActors.map((a) => a.slug)
	});
	const view: Filters = { ...emptyFilters(), principle: f.principle.slice(0, 1), dimension: f.dimension.slice(0, 1), actor: f.actor };
	const viewHref = (next: Partial<Filters>) => href(`/actors/${actor.slug}`, locale) + toQuery({ ...view, ...next }) + '#outputs';

	// Picking a principle resets the dimension, so principle counts ignore the dimension.
	const principleChips = chipOptions(published, { ...view, principle: [], dimension: [] }, 'principle', tax.principles.map((p) => p.code)).map((o) => {
		const p = tax.principles.find((x) => x.code === o.value)!;
		return { ...o, label: principleLabel(p), selected: view.principle[0] === o.value, href: viewHref({ principle: [o.value], dimension: [] }) };
	});
	const selected = tax.principles.find((p) => p.code === view.principle[0]);
	const dimensionChips = selected
		? chipOptions(published, { ...view, dimension: [] }, 'dimension', selected.dimensions.map((d) => d.slug)).map((o) => ({
				...o,
				label: selected.dimensions.find((d) => d.slug === o.value)!.name,
				selected: view.dimension[0] === o.value,
				href: viewHref({ dimension: view.dimension[0] === o.value ? [] : [o.value] })
			}))
		: [];
	const subChips = subActors.map((a) => {
		const on = view.actor.includes(a.slug);
		const count = applyFilters(published, { ...view, actor: [a.slug] }).length;
		return { value: a.slug, label: a.name, count, selected: on, href: viewHref({ actor: on ? [] : [a.slug] }) };
	}).filter((c) => c.count > 0 || c.selected);

	const shown = hubOrder(applyFilters(published, view), actor.slug);
	const all = url.searchParams.get('all') === '1';

	// Key messages for this actor, grouped by the first principle of their output.
	const byId = new Map(cards.map((c) => [c.id, c]));
	const groups = tax.principles
		.map((p) => ({
			code: p.code,
			label: principleLabel(p),
			items: sortCards(messages.map((m) => byId.get(m.output)).filter((c): c is NonNullable<typeof c> => !!c && c.principles[0] === p.code), 'new').map((c) => ({
				text: messages.find((m) => m.output === c.id)!.message,
				source: [c.code, c.title].filter(Boolean).join(' '),
				slug: c.slug
			}))
		}))
		.filter((g) => g.items.length);

	return {
		actor,
		counts: { published: published.length, coming: upcoming.length },
		roadmap,
		groups,
		prompt,
		principleChips,
		dimensionChips,
		subChips,
		allHref: viewHref({}),
		view,
		results: all ? shown : shown.slice(0, HUB_FEATURED),
		resultCount: shown.length,
		showingAll: all || shown.length <= HUB_FEATURED,
		seeAllHref: href(`/actors/${actor.slug}`, locale) + (toQuery(view) ? `${toQuery(view)}&all=1` : '?all=1') + '#outputs',
		seeLessHref: viewHref({}),
		libraryHref: href('/library', locale) + toQuery({ ...view, actor: [actor.slug, ...view.actor] }),
		upcoming,
		principleNames: Object.fromEntries(tax.principles.map((p) => [p.code, p.shortName])),
		actorNames: Object.fromEntries(tax.actors.map((a) => [a.slug, a.name])),
		selectedLabel: [selected ? principleLabel(selected) : null, dimensionChips.find((d) => d.selected)?.label, subChips.find((s) => s.selected)?.label].filter(Boolean).join(' · ')
	};
};

export const actions: Actions = {
	challenge: async (event) => {
		const locale = localeFromParam(event.params.lang) ?? 'en';
		const tax = await getTaxonomies(locale);
		const actor = tax.hubs.find((a) => a.slug === event.params.actor);
		if (!actor) error(404, 'Actor hub not found');
		const prompt = await getPrompt('actor_hub', locale);
		return feedbackAction(event, 'challenge', { prompt: prompt?.id ?? null, page_path: href(`/actors/${actor.slug}`, locale), context_actor: actor.id }, 'share_challenge');
	}
};

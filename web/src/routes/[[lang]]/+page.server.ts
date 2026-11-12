import { FEATURED_FINDING_SLUG } from '#lib/config.ts';
import { firstPercentage } from '#lib/format.ts';
import { sortCards } from '#lib/library/filters.ts';
import { getCards, getTaxonomies } from '#lib/server/content.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { locale } = await parent();
	const [tax, cards] = await Promise.all([getTaxonomies(locale), getCards(locale)]);
	const published = sortCards(cards.filter((c) => c.status === 'published'), 'new');
	const upcoming = sortCards(cards.filter((c) => c.status === 'upcoming'), 'old');
	const nextDate = upcoming[0]?.date ?? null;
	const featured = cards.find((c) => c.slug === FEATURED_FINDING_SLUG && c.teaser);
	return {
		hubs: tax.hubs.map((a) => ({
			...a,
			published: published.filter((c) => c.actors.includes(a.slug)).length,
			coming: upcoming.filter((c) => c.actors.includes(a.slug)).length
		})),
		principles: tax.principles,
		latest: published.slice(0, 3),
		next: upcoming.filter((c) => c.date === nextDate),
		total: cards.length,
		finding: featured ? { figure: firstPercentage(featured.teaser!), teaser: featured.teaser!, title: featured.title, slug: featured.slug, date: featured.date } : null,
		principleNames: Object.fromEntries(tax.principles.map((p) => [p.code, p.shortName])),
		actorNames: Object.fromEntries(tax.actors.map((a) => [a.slug, a.name]))
	};
};

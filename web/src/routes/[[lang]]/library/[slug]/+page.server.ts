import { KIND_LABEL, monthYear, principleLabel } from '#lib/format.ts';
import { href, localeFromParam } from '#lib/i18n/locales.ts';
import { related } from '#lib/library/filters.ts';
import { getCards, getOutput, getPrompt, getTaxonomies } from '#lib/server/content.ts';
import { feedbackAction } from '#lib/server/feedback.ts';
import { paragraphs } from '#lib/server/html.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent }) => {
	const { locale } = await parent();
	const [o, tax, cards] = await Promise.all([getOutput(params.slug, locale), getTaxonomies(locale), getCards(locale)]);
	const c = o.card;
	const prompt = await getPrompt(c.status === 'published' ? 'output_published' : 'output_upcoming', locale);
	const typeName = c.typeName ?? KIND_LABEL[c.kind];
	const what = c.kind === 'publication' ? typeName.toLowerCase() : 'report';

	// Citation: the sheet's full reference, or a reference built from the record for deliverables.
	const citation =
		o.citation ??
		(c.kind !== 'publication' && c.status === 'published'
			? `ACHIEVE project (${c.date?.slice(0, 4)}). ${KIND_LABEL[c.kind]} ${c.code} – ${c.title}. Horizon Europe grant agreement No 101137625.${o.link ? ` ${o.link}` : ''}`
			: null);

	const linkLabel = !o.link
		? null
		: o.pidType === 'doi'
			? `Read the ${what}`
			: /\.pdf($|\?)/i.test(o.link)
				? `Download ${what} (PDF)`
				: `Go to the ${what}`;

	const actorBySlug = new Map(tax.actors.map((a) => [a.slug, a]));
	const explicit = o.relations.map((r) => cards.find((x) => x.slug === r.slug)?.id).filter((id): id is number => !!id);
	const paras = paragraphs(o.abstract);

	return {
		c,
		eyebrow: c.kind === 'publication' ? typeName : `${KIND_LABEL[c.kind]} ${c.code}`,
		typeName,
		what,
		linkLabel,
		link: o.link,
		citation,
		facts: [
			['Status', c.status === 'published' ? 'Published' : `Coming ${monthYear(c.date, true)}`],
			['Date', monthYear(c.date, true)],
			['Type', [typeName, ...o.formats.map((f) => f.type)].filter(Boolean).join(' + ')],
			['Lead', o.lead ? (o.lead.name ? `${o.lead.name} (${o.lead.code})` : o.lead.code) : null],
			['Authors', o.authors],
			['Contributors', o.contributors.join(', ') || null],
			['Publisher', c.kind === 'publication' ? o.publisher : null],
			['Work package', o.workPackage],
			['Region', c.regions.map((r) => tax.regions.find((x) => x.slug === r)?.name).filter(Boolean).join(', ') || null],
			['Open access', o.openAccess === null ? null : o.openAccess ? 'Yes' : 'No'],
			['Peer-reviewed', o.peerReviewed === null ? null : o.peerReviewed ? 'Yes' : 'No']
		].filter((f): f is [string, string] => !!f[1]),
		actors: c.actors.map((s) => actorBySlug.get(s)).filter((a) => !!a).map((a) => ({ slug: a!.slug, name: a!.name, href: href(a!.isHub ? `/actors/${a!.slug}` : `/library?actor=${a!.slug}`, locale) })),
		principles: c.principles.map((code) => tax.principles.find((p) => p.code === code)!).filter(Boolean).map((p) => ({ code: p.code, label: principleLabel(p), href: href(`/library?principle=${p.code}`, locale) })),
		dimensions: c.dimensions.map((s) => tax.dimensions.find((d) => d.slug === s)?.name).filter(Boolean) as string[],
		messages: o.messages.map((m) => ({ ...m, name: actorBySlug.get(m.actor)?.name ?? m.actor })),
		visuals: o.visuals,
		formats: o.formats,
		relations: o.relations,
		webinar: o.webinar,
		abstractLead: paras.slice(0, 2).join(''),
		abstractMore: paras.slice(2).join(''),
		related: related(c, cards, explicit),
		prompt,
		principleNames: Object.fromEntries(tax.principles.map((p) => [p.code, p.shortName])),
		actorNames: Object.fromEntries(tax.actors.map((a) => [a.slug, a.name]))
	};
};

export const actions: Actions = {
	feedback: async (event) => {
		const locale = localeFromParam(event.params.lang) ?? 'en';
		const o = await getOutput(event.params.slug, locale);
		const upcoming = o.card.status === 'upcoming';
		const prompt = await getPrompt(upcoming ? 'output_upcoming' : 'output_published', locale);
		return feedbackAction(event, 'feedback', { prompt: prompt?.id ?? null, page_path: href(`/library/${o.card.slug}`, locale), context_output: o.card.id }, upcoming ? 'suggest_research' : 'comment');
	}
};

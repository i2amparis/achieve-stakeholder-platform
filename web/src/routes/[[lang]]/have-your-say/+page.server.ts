import { redirect } from '@sveltejs/kit';
import { STREAMS } from '#lib/feedback/form.ts';
import { href, localeFromParam } from '#lib/i18n/locales.ts';
import { sortCards } from '#lib/library/filters.ts';
import { getCards, getPrompt } from '#lib/server/content.ts';
import { feedbackAction } from '#lib/server/feedback.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, parent }) => {
	const { locale } = await parent();
	const [cards, prompt] = await Promise.all([getCards(locale), getPrompt('output_upcoming', locale)]);
	const s = url.searchParams.get('stream');
	const today = new Date().toISOString().slice(0, 10);
	return {
		stream: (STREAMS as readonly string[]).includes(s ?? '') ? s : 'share_challenge',
		// "Questions open now": the next upcoming outputs that ask for input
		open: prompt
			? sortCards(cards.filter((c) => c.status === 'upcoming' && (c.date ?? '') >= today), 'old').slice(0, 3).map((c) => ({ slug: c.slug, title: [c.code, c.title].filter(Boolean).join(' '), date: c.date }))
			: [],
		openQuestion: prompt?.question ?? null
	};
};

export const actions: Actions = {
	default: async (event) => {
		const locale = localeFromParam(event.params.lang) ?? 'en';
		const prompt = await getPrompt('have_your_say', locale);
		const result = await feedbackAction(event, 'say', { prompt: prompt?.id ?? null, page_path: href('/have-your-say', locale) });
		if ('sent' in result && result.sent) redirect(303, href('/have-your-say/thank-you', locale) + '?sent=1');
		return result;
	}
};

import { localeFromParam } from '#lib/i18n/locales.ts';
import { signupAction } from '#lib/server/feedback.ts';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => ({ sent: url.searchParams.get('sent') === '1' });

export const actions: Actions = {
	join: async (event) => signupAction(event, localeFromParam(event.params.lang) ?? 'en')
};

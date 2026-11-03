import { error } from '@sveltejs/kit';
import { localeFromParam } from '#lib/i18n/locales.ts';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ params }) => {
	const locale = localeFromParam(params.lang);
	if (!locale) error(404, 'Page not found');
	return { locale };
};

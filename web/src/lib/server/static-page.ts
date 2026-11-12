import { error } from '@sveltejs/kit';
import { getPage } from './content.ts';
import type { Locale } from '#lib/i18n/locales.ts';

/** Static pages (About, legal) come from Drupal pages (content type "page"); 404 until published. */
export async function loadStaticPage(slug: string, locale: Locale) {
	const page = await getPage(slug, locale);
	if (!page) error(404, 'Page not found');
	return { page };
}

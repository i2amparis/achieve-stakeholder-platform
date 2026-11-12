// Locale routing: English lives at the root (/library); other locales get a
// prefix (/es/library, /pt-br/library), matching Drupal's language prefixes. A locale is only served once it is enabled here, so a
// page is never shown with a lang attribute that does not match its text.

export const LOCALES = ['en', 'es', 'pt-br'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Locales the site serves. Add 'es' and 'pt-br' when their UI strings and content are ready. */
export const ENABLED_LOCALES: Locale[] = ['en'];

/** The locale of a route's optional [[lang]] segment, or null if it is not served. */
export function localeFromParam(lang: string | undefined): Locale | null {
	if (!lang) return DEFAULT_LOCALE;
	return lang !== DEFAULT_LOCALE && (ENABLED_LOCALES as string[]).includes(lang) ? (lang as Locale) : null;
}

/** A site path in the given locale: href('/library', 'es') → '/es/library'. */
export function href(path: string, locale: Locale = DEFAULT_LOCALE): string {
	if (locale === DEFAULT_LOCALE) return path;
	return `/${locale}${path === '/' ? '' : path}`;
}

/** The locale of a URL path, for the <html lang> attribute. */
export function localeOfPath(pathname: string): Locale {
	const first = pathname.split('/')[1];
	return (ENABLED_LOCALES as string[]).includes(first) && first !== DEFAULT_LOCALE ? (first as Locale) : DEFAULT_LOCALE;
}

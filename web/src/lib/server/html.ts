// Rich text from Drupal is rendered as HTML, so it is sanitised first:
// editors can format text, but not add scripts, styles or event handlers.

import sanitize from 'sanitize-html';

const OPTIONS: sanitize.IOptions = {
	allowedTags: ['p', 'br', 'strong', 'em', 'b', 'i', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'a', 'sup', 'sub', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'caption'],
	allowedAttributes: { a: ['href', 'title', 'hreflang'], th: ['scope'], td: ['colspan', 'rowspan'] },
	allowedSchemes: ['https', 'http', 'mailto'],
	transformTags: { b: 'strong', i: 'em' }
};

export const safeHtml = (html: string | null | undefined): string | null => (html ? sanitize(html, OPTIONS) || null : null);

/** Paragraphs of a rich-text field, for "show the first n, then expand". */
export function paragraphs(html: string | null): string[] {
	if (!html) return [];
	const parts = html.match(/<(p|ul|ol|h[2-4]|blockquote|table)[\s>][\s\S]*?<\/\1>/g);
	return parts?.length ? parts : [html];
}

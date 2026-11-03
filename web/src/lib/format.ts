// Display helpers shared by pages and components.

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2025-12-01" → "Dec 2025" (or "December 2025" with long = true). Dates in the sheet are month-precise. */
export function monthYear(date: string | null, long = false): string {
	if (!date) return '';
	const [y, m] = date.split('-').map(Number);
	const name = MONTHS[m - 1] ?? '';
	return `${long ? name : name.slice(0, 3)} ${y}`;
}

/** Card colour of a principle (first principle of an output). Design-system tokens. */
export const PRINCIPLE_COLOUR: Record<string, string> = {
	p1: 'var(--navy)',
	p2: 'var(--green-dark)',
	p3: 'var(--green)',
	p4: 'var(--sky)'
};
export const principleColour = (code: string | undefined) => (code && PRINCIPLE_COLOUR[code]) || 'var(--grey)';

/** "P2 Justice and equity" */
export const principleLabel = (p: { code: string; shortName: string }) => `${p.code.toUpperCase()} ${p.shortName}`;

export const KIND_LABEL = { deliverable: 'Deliverable', milestone: 'Milestone', publication: 'Publication' } as const;

/** "D2.2 · Report · Dec 2025" */
export function cardMeta(c: { code: string | null; typeName: string | null; date: string | null }): string {
	return [c.code, c.typeName, monthYear(c.date)].filter(Boolean).join(' · ');
}

/** The leading figure of a key message ("89%", "1,935"), shown large on output pages. */
export function leadFigure(text: string): string | null {
	const m = text.match(/^(?:only |about |around )?(\d[\d,.]*\s?%|\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)/i);
	return m ? m[1].replace(/\s/g, '') : null;
}

/** First percentage in a text, for highlight boxes ("…only 7% of companies…" → "7%"). */
export function firstPercentage(text: string): string | null {
	return text.match(/\d+(?:\.\d+)?%/)?.[0] ?? null;
}

/** Join names: "A, B and C". */
export function listJoin(items: string[]): string {
	return items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

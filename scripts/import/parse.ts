// Pure parsing helpers for content-sheet cells. No I/O.

/** Collapse runs of whitespace (including newlines and non-breaking spaces) into one space. */
export function clean(s: string): string {
	return s.replace(/[\s ]+/g, ' ').trim();
}

/** Empty, "-" and "Not applicable" placeholders mean "no value". */
export function blank(v: string | null | undefined): boolean {
	return v == null || /^(|-|–|n\/?a|not applicable)$/i.test(v.trim());
}

/** Split a multi-value cell on ";" (the sheet uses "; "), keeping order, dropping empties. */
export function splitMulti(v: string | null | undefined): string[] {
	if (blank(v)) return [];
	return v!.split(';').map(clean).filter((x) => x && !blank(x));
}

/** Normalise a title or label for matching: case, accents, quotes and punctuation are ignored. */
export function matchKey(s: string): string {
	return clean(s)
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/['’‘`´]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** "D2.2 - Integrity of carbon credits" → { code: "D2.2", title: "Integrity of carbon credits", kind }. */
export function splitCodeTitle(s: string): { code: string; title: string; kind: 'deliverable' | 'milestone' } | null {
	const m = clean(s).match(/^((D|MS)\s?\d+(?:\.\d+)?)\s*[-–—:]\s*(.+)$/i);
	if (!m) return null;
	const code = m[1].replace(/\s/g, '').toUpperCase();
	return { code, title: m[3], kind: code.startsWith('MS') ? 'milestone' : 'deliverable' };
}

/**
 * Partner acronym from a Lead/Contributor value: the leading acronym, without
 * anything after it ("WWF+3:20" → "WWF", "RU (Sander, Sebastian)" → "RU").
 */
export function partnerCode(v: string): { code: string; changed: boolean } | null {
	const t = clean(v);
	const m = t.match(/^[A-Za-z][A-Za-z0-9]*/);
	if (!m) return null;
	const code = m[0].toUpperCase();
	return { code, changed: code !== t };
}

/** Contributors are separated by commas (some partners also used ";"). */
export function splitContributors(v: string | null | undefined): string[] {
	if (blank(v)) return [];
	return v!.split(/[,;]/).map(clean).filter(Boolean);
}

const DOI_RE = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?(10\.\d{4,9}\/\S+)$/i;

/**
 * Normalise a PID/link. Bare DOIs become https://doi.org/… links.
 * Returns the inferred type and whether the sheet's declared type disagrees.
 */
export function parsePid(raw: string | null | undefined, declared?: string | null): { link: string; pid_type: 'doi' | 'url'; note?: string } | null {
	if (blank(raw)) return null;
	const v = clean(raw!);
	const doi = v.match(DOI_RE);
	const result: { link: string; pid_type: 'doi' | 'url'; note?: string } = doi
		? { link: `https://doi.org/${doi[1]}`, pid_type: 'doi' }
		: { link: v, pid_type: 'url' };
	if (doi && !/^https?:/i.test(v)) result.note = `bare DOI "${v}" normalised to ${result.link}`;
	const d = declared ? clean(declared).toLowerCase() : '';
	if (d && (d === 'doi' || d === 'url') && d !== result.pid_type) {
		result.note = `"Type of PID" says ${d.toUpperCase()}, but the value is ${result.pid_type === 'doi' ? 'a DOI' : 'not a DOI'}: ${v}`;
	}
	return result;
}

/** Yes/No → boolean; anything else → null. */
export function yesNo(v: string | null | undefined): boolean | null {
	if (blank(v)) return null;
	const t = v!.trim().toLowerCase();
	return t === 'yes' ? true : t === 'no' ? false : null;
}

/** Date or date-like value → "YYYY-MM-DD" (UTC). */
export function isoDate(v: unknown): string | null {
	if (v instanceof Date && !isNaN(v.getTime())) return v.toISOString().slice(0, 10);
	if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v.trim())) return v.trim().slice(0, 10);
	return null;
}

/**
 * "Actor: message" lines → ordered entries. Lines that don't start with a known
 * actor label are returned in `unparsed`.
 */
export function parseActorMessages(v: string | null | undefined, actorLabels: string[]): { entries: { actor: string; message: string }[]; unparsed: string[] } {
	const entries: { actor: string; message: string }[] = [];
	const unparsed: string[] = [];
	if (blank(v)) return { entries, unparsed };
	const labels = [...actorLabels].sort((a, b) => b.length - a.length);
	for (const line of v!.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)) {
		const label = labels.find((l) => line.toLowerCase().startsWith(l.toLowerCase() + ':'));
		if (label) entries.push({ actor: label, message: clean(line.slice(label.length + 1)) });
		else unparsed.push(line);
	}
	return { entries, unparsed };
}

/**
 * "file.pdf: text" entries (separated by blank lines or new lines starting with a
 * known file name) → map of file name → alt text.
 */
export function parseAltText(v: string | null | undefined, files: string[]): { alt: Map<string, string>; unmatched: string[] } {
	const alt = new Map<string, string>();
	const unmatched: string[] = [];
	if (blank(v) || !files.length) return { alt, unmatched: blank(v) ? [] : [clean(v!)] };
	const text = v!.replace(/\r\n/g, '\n');
	const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	const starts = files
		.map((f) => ({ f, i: text.search(new RegExp(`(^|\\n)\\s*${esc(f)}\\s*:`)) }))
		.filter((x) => x.i >= 0)
		.sort((a, b) => a.i - b.i);
	starts.forEach(({ f, i }, n) => {
		const end = n + 1 < starts.length ? starts[n + 1].i : text.length;
		const chunk = text.slice(i, end).trim();
		alt.set(f, clean(chunk.slice(chunk.indexOf(':') + 1)));
	});
	if (!starts.length) unmatched.push(clean(text));
	return { alt, unmatched };
}

/** Plain text with blank-line paragraphs → simple HTML. Single line breaks (PDF wrapping) become spaces. */
export function toHtml(v: string | null | undefined): string | null {
	if (blank(v)) return null;
	const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return v!
		.replace(/\r\n/g, '\n')
		.split(/\n\s*\n/)
		.map((p) => clean(p))
		.filter(Boolean)
		.map((p) => `<p>${esc(p)}</p>`)
		.join('\n');
}

const STOP = new Set(['a', 'an', 'the', 'and', 'or', 'of', 'for', 'to', 'in', 'on', 'with', 'by', 'towards', 'through', 'from', 'at']);

/** ASCII slug of any text. */
export function slugify(s: string): string {
	return clean(s)
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/['’‘`´]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '');
}

/** Deliverable/milestone slug: the code ("D2.2" → "d2-2"). */
export function codeSlug(code: string): string {
	return slugify(code.replace('.', '-'));
}

/**
 * Publication slug (CLAUDE.md): main title before the first ":" or " - ", lowercased
 * ASCII, no leading article, at most 6 words and 50 characters cut at a word boundary,
 * no trailing stop word.
 */
export function publicationSlug(title: string): string {
	const t = clean(title);
	let main = t.split(/\s*:\s+|\s+[-–—]\s+|\s*[-–—]\s+(?=[A-Z])/)[0];
	if (main.split(' ').length < 2) main = t;
	const words = slugify(main).split('-').filter(Boolean);
	while (words.length && ['a', 'an', 'the'].includes(words[0])) words.shift();
	const out: string[] = [];
	for (const w of words) {
		if (out.length >= 6 || [...out, w].join('-').length > 50) break;
		out.push(w);
	}
	while (out.length > 1 && STOP.has(out[out.length - 1])) out.pop();
	return out.join('-');
}

/** Row references in free text, e.g. "Second format: row 18" → [18]. */
export function rowRefs(v: string | null | undefined): number[] {
	if (blank(v)) return [];
	return [...v!.matchAll(/\brows?\s+(\d+)/gi)].map((m) => Number(m[1]));
}

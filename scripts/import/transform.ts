// Sheet rows → the records the import writes. Pure: no Directus, no file system.
// Every rule from CLAUDE.md ("Import rules") is applied here, and every
// deviation is reported as a flag rather than silently fixed.

import { ACTORS, COLUMNS, LANGUAGES, LINKS, MERGES, OUTPUT_TYPES, PARTNERS, PRINCIPLES, REGIONS, WORK_PACKAGES } from './config.ts';
import type { Cell, SheetRow, Workbook } from './read.ts';
import {
	blank, clean, codeSlug, isoDate, matchKey, parseActorMessages, parseAltText, parsePid, partnerCode, publicationSlug, rowRefs,
	slugify, splitCodeTitle, splitContributors, splitMulti, toHtml, yesNo
} from './parse.ts';

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

export interface FormatRecord {
	source_key: string;
	output_type: string | null;
	title: string;
	link: string | null;
	pid_type: 'doi' | 'url' | null;
	publisher: string | null;
	date: string | null;
}

export interface OutputRecord {
	source_key: string;
	source_sheet: string;
	sheetRow: number;
	kind: 'deliverable' | 'milestone' | 'publication';
	code: string | null;
	title: string;
	/** Slug for a new record; existing records keep theirs. */
	slug: string;
	status: 'published' | 'upcoming';
	date: string | null;
	work_package: string | null;
	output_type: string | null;
	lead_partner: string | null;
	contributors: string[];
	authors: string | null;
	teaser: string | null;
	abstract: string | null;
	link: string | null;
	pid_type: 'doi' | 'url' | null;
	citation: string | null;
	publisher: string | null;
	issn: string | null;
	book_rid: string | null;
	book_title: string | null;
	open_access: boolean | null;
	peer_reviewed: boolean | null;
	webinar: string | null;
	actors: string[];
	principles: string[];
	dimensions: string[];
	regions: string[];
	visuals: string[];
	actor_messages: { actor: string; message: string }[];
	formats: FormatRecord[];
	relations: { to: string; type: 'supersedes' | 'related'; note: string | null }[];
	unconfirmed_fields: string[];
	confirmed: boolean;
}

export interface VisualRecord {
	filename: string;
	alt_text: string | null;
	confirmed: boolean;
}

export interface Taxonomies {
	languages: typeof LANGUAGES;
	actors: { slug: string; name: string; is_hub: boolean; description: string | null; sort: number; shown_in: string[] }[];
	principles: { code: string; slug: string; name: string; short_name: string; sort: number }[];
	dimensions: { slug: string; name: string; principle: string; sort: number }[];
	regions: { slug: string; name: string; sort: number }[];
	output_types: { slug: string; name: string; sort: number }[];
	partners: { code: string; sort: number }[];
}

export type FlagKind = 'skipped' | 'normalised' | 'data' | 'relation' | 'accessibility' | 'column';
export interface Flag {
	kind: FlagKind;
	sheet?: string;
	row?: number;
	title?: string;
	message: string;
}

export interface ImportModel {
	taxonomies: Taxonomies;
	outputs: OutputRecord[];
	visuals: VisualRecord[];
	webinars: string[];
	flags: Flag[];
	/** Rows not imported as their own output, with the reason. */
	skipped: { sheet: string; row: number; title: string; reason: string }[];
}

// ---------------------------------------------------------------------------

const str = (c: Cell | undefined): string | null => {
	const v = c?.value;
	if (v == null) return null;
	if (v instanceof Date) return v.toISOString().slice(0, 10);
	return blank(v) ? null : v;
};

export function buildTaxonomies(wb: Workbook, flags: Flag[]): Taxonomies {
	const legendPrinciples = new Map(wb.legend.principles.map((p) => [p.label, p]));
	const principles = PRINCIPLES.map((p, i) => {
		const l = legendPrinciples.get(p.label);
		if (!l) flags.push({ kind: 'column', sheet: 'Tagging legend', message: `Principle ${p.label} is missing from the legend; using "${p.short_name}".` });
		return { code: p.code, slug: p.slug, name: l?.name ?? p.short_name, short_name: p.short_name, sort: i + 1 };
	});
	const dimensions: Taxonomies['dimensions'] = [];
	for (const p of PRINCIPLES) {
		const dims = legendPrinciples.get(p.label)?.dimensions ?? [];
		if (dims.length && dims.length !== 5) flags.push({ kind: 'data', sheet: 'Tagging legend', message: `${p.label} lists ${dims.length} dimensions, expected 5.` });
		dims.forEach((name) => dimensions.push({ slug: slugify(name), name, principle: p.code, sort: dimensions.length + 1 }));
	}
	return {
		languages: LANGUAGES,
		actors: ACTORS.map((a, i) => ({
			slug: a.slug, name: a.name, is_hub: a.is_hub, sort: i + 1, shown_in: a.shown_in ?? [],
			description: a.is_hub ? (wb.legend.actorDescriptions.get(a.label) ?? null) : null
		})),
		principles,
		dimensions,
		regions: REGIONS.map((r, i) => ({ slug: r.slug, name: r.name, sort: i + 1 })),
		output_types: OUTPUT_TYPES.map((name, i) => ({ slug: slugify(name), name, sort: i + 1 })),
		partners: PARTNERS.map((code, i) => ({ code, sort: i + 1 }))
	};
}

export function transform(wb: Workbook): ImportModel {
	const flags: Flag[] = wb.warnings.map((message) => ({ kind: 'column' as const, message }));
	const skipped: ImportModel['skipped'] = [];
	const taxonomies = buildTaxonomies(wb, flags);

	const actorByLabel = new Map(ACTORS.map((a) => [a.label.toLowerCase(), a]));
	const principleByLabel = new Map(PRINCIPLES.map((p) => [p.label.toLowerCase(), p]));
	const dimensionByKey = new Map(taxonomies.dimensions.map((d) => [matchKey(d.name), d]));
	const regionByLabel = new Map(REGIONS.map((r) => [r.label.toLowerCase(), r]));
	const typeByKey = new Map(OUTPUT_TYPES.map((t) => [t.toLowerCase(), t]));
	const hubLabels = ACTORS.map((a) => a.label);

	const outputs: OutputRecord[] = [];
	const visuals = new Map<string, VisualRecord & { altSeen: Set<string> }>();
	const webinars = new Set<string>();

	function rowFlags(row: SheetRow, title: string) {
		return (kind: FlagKind, message: string) => flags.push({ kind, sheet: row.sheet, row: row.row, title, message });
	}

	function common(row: SheetRow, title: string, spec: Record<string, { field?: string }>, base: Pick<OutputRecord, 'source_key' | 'kind' | 'code' | 'title' | 'slug'>): OutputRecord {
		const flag = rowFlags(row, title);
		const c = row.cells;

		// --- actors: hub actors in order, then sub-tags; Finance never first ---
		const actorLabels = [...splitMulti(str(c['Platform actors'])), ...splitMulti(str(c['Actor sub-tags']))];
		const actors: string[] = [];
		for (const label of actorLabels) {
			const a = actorByLabel.get(label.toLowerCase());
			if (!a) flag('data', `Unknown actor "${label}" (not imported).`);
			else if (actors.includes(a.slug)) flag('data', `Actor "${label}" is listed twice.`);
			else actors.push(a.slug);
		}
		const nonHubs = actors.filter((s) => !ACTORS.find((a) => a.slug === s)!.is_hub);
		const hubs = actors.filter((s) => !nonHubs.includes(s));
		if (nonHubs.length && actors[0] !== hubs[0]) flag('normalised', `${nonHubs.join(', ')} moved after the hub actors (a non-hub actor is never first).`);
		const orderedActors = [...hubs, ...nonHubs];
		for (const s of nonHubs) {
			const shownIn = ACTORS.find((a) => a.slug === s)!.shown_in ?? [];
			if (!shownIn.some((h) => hubs.includes(h))) flag('data', `Tagged ${s} but none of ${shownIn.join('/')}: it will not appear on any hub.`);
		}
		if (!hubs.length) flag('data', 'No hub actor: the item will not appear on any hub.');

		// --- principles and dimensions ---
		const principles: string[] = [];
		for (const label of splitMulti(str(c['Integrity principles']))) {
			const p = principleByLabel.get(label.toLowerCase());
			if (!p) flag('data', `Unknown principle "${label}" (not imported).`);
			else if (!principles.includes(p.code)) principles.push(p.code);
		}
		if (!principles.length) flag('data', 'No integrity principle.');
		const dimensions: string[] = [];
		for (const label of splitMulti(str(c['Key dimensions']))) {
			const d = dimensionByKey.get(matchKey(label));
			if (!d) flag('data', `Unknown dimension "${label}" (not imported).`);
			else if (!dimensions.includes(d.slug)) dimensions.push(d.slug);
		}
		for (const slug of dimensions) {
			const d = taxonomies.dimensions.find((x) => x.slug === slug)!;
			if (!principles.includes(d.principle)) flag('data', `Dimension "${d.name}" belongs to ${d.principle.toUpperCase()}, which is not tagged.`);
		}
		for (const p of principles) {
			if (!dimensions.some((s) => taxonomies.dimensions.find((x) => x.slug === s)!.principle === p)) flag('data', `${p.toUpperCase()} is tagged but none of its dimensions is.`);
		}

		// --- regions ---
		const regions: string[] = [];
		for (let label of splitMulti(str(c['Region focus']))) {
			if (/\(to confirm\)/i.test(label)) {
				label = clean(label.replace(/\(to confirm\)/i, ''));
				flag('data', `Region "${label}" is marked "(to confirm)".`);
			}
			const r = regionByLabel.get(label.toLowerCase());
			if (!r) flag('data', `Unknown region "${label}" (not imported).`);
			else if (!regions.includes(r.slug)) regions.push(r.slug);
		}

		// --- output type ---
		const typeLabel = str(c['Type'] ?? c['Publication type']);
		const output_type = typeLabel ? (typeByKey.get(clean(typeLabel).toLowerCase()) ?? null) : null;
		if (typeLabel && !output_type) flag('data', `Unknown output type "${typeLabel}" (not imported).`);

		// --- partners ---
		const lead = str(c['Lead']);
		let lead_partner: string | null = null;
		if (lead) {
			const p = partnerCode(lead);
			if (!p) flag('data', `Lead "${lead}" is not a partner code.`);
			else {
				if (p.changed) flag('normalised', `Lead "${clean(lead)}" → ${p.code}.`);
				if (!PARTNERS.includes(p.code)) flag('data', `Lead ${p.code} is not a known partner (not imported).`);
				else lead_partner = p.code;
			}
		}
		const contributors: string[] = [];
		for (const v of splitContributors(str(c['Contributor']))) {
			const p = partnerCode(v);
			if (!p || !PARTNERS.includes(p.code)) flag('data', `Contributor "${v}" is not a known partner (not imported).`);
			else {
				if (p.changed) flag('normalised', `Contributor "${v}" → ${p.code}.`);
				if (!contributors.includes(p.code)) contributors.push(p.code);
			}
		}

		// --- teaser, abstract, messages ---
		const teaser = str(c['Teaser']) ? clean(str(c['Teaser'])!) : null;
		if (!teaser) flag('data', 'No teaser.');
		else if (teaser.length > 200) flag('data', `Teaser is ${teaser.length} characters (limit 200).`);
		const { entries, unparsed } = parseActorMessages(str(c['Actor key messages']), hubLabels);
		for (const u of unparsed) flag('data', `Key-message line not in "Actor: message" form, not imported: "${u.slice(0, 80)}".`);
		const actor_messages = entries.map((e) => ({ actor: actorByLabel.get(e.actor.toLowerCase())!.slug, message: e.message }));
		for (const m of actor_messages) if (!orderedActors.includes(m.actor)) flag('data', `Key message for ${m.actor}, which is not a tagged actor.`);
		if (/^(completed|published)$/i.test(str(c['Status'])?.trim() ?? '')) {
			const missing = hubs.filter((h) => !actor_messages.some((m) => m.actor === h));
			if (missing.length && actor_messages.length) flag('data', `No key message for ${missing.join(', ')} (tagged actor${missing.length > 1 ? 's' : ''}).`);
			if (!actor_messages.length && !unparsed.length) flag('data', 'Published, but has no actor key messages.');
		}

		// --- visuals and alt text ---
		const files = splitMulti(str(c['Associated visual / data']));
		const { alt, unmatched } = parseAltText(str(c['Alt text']), files);
		for (const u of unmatched) flag('accessibility', `Alt text not matched to a visual file: "${u.slice(0, 80)}".`);
		const altDraft = !!c['Alt text']?.draft;
		for (const f of files) {
			const text = alt.get(f) ?? null;
			if (!text) flag('accessibility', `Visual ${f} has no alt text (required before publishing).`);
			const v = visuals.get(f) ?? { filename: f, alt_text: null, confirmed: true, altSeen: new Set<string>() };
			if (text) {
				v.altSeen.add(text);
				if (!v.alt_text) v.alt_text = text;
			}
			if (altDraft || !text) v.confirmed = false;
			visuals.set(f, v);
		}

		// --- webinar ---
		const webinar = str(c['Associated webinar']) ? clean(str(c['Associated webinar'])!) : null;
		if (webinar) webinars.add(webinar);

		// --- status, date, WP ---
		const rawStatus = str(c['Status']);
		let status: OutputRecord['status'] = 'upcoming';
		if (rawStatus) {
			if (/^(completed|published)$/i.test(rawStatus.trim())) status = 'published';
			else flag('data', `Unknown status "${rawStatus}": treated as Upcoming.`);
		} else if (row.sheet !== 'Deliverables & Milestones') flag('data', 'No status: treated as Upcoming.');
		const dateCell = c['Due Date'] ?? c['Timeline'];
		const date = isoDate(dateCell?.value);
		if (!date) flag('data', 'No date.');
		const wp = str(c['WP']);
		const work_package = wp && WORK_PACKAGES.includes(clean(wp).toUpperCase()) ? clean(wp).toUpperCase() : null;
		if (wp && !work_package) flag('data', `Unknown work package "${wp}".`);

		// --- unconfirmed (yellow) fields ---
		const unconfirmed = new Set<string>();
		for (const [col, cell] of Object.entries(c)) if (cell.draft && cell.value != null && spec[col]?.field) unconfirmed.add(spec[col].field!);

		return {
			...base,
			source_sheet: row.sheet,
			sheetRow: row.row,
			status,
			date,
			work_package,
			output_type,
			lead_partner,
			contributors,
			authors: str(c['Authors']) ? clean(str(c['Authors'])!) : null,
			teaser,
			abstract: toHtml(str(c['Abstract'])),
			link: null,
			pid_type: null,
			citation: str(c['Full reference']) ? clean(str(c['Full reference'])!) : null,
			publisher: str(c['Publisher']) ? clean(str(c['Publisher'])!) : null,
			issn: null,
			book_rid: null,
			book_title: null,
			open_access: null,
			peer_reviewed: null,
			webinar,
			actors: orderedActors,
			principles,
			dimensions,
			regions,
			visuals: files,
			actor_messages,
			formats: [],
			relations: [],
			unconfirmed_fields: [...unconfirmed].sort(),
			confirmed: unconfirmed.size === 0
		};
	}

	// --- Deliverables & Milestones ---
	const dmSheet = wb.deliverables;
	for (const need of ['CDE content', 'Dissemination Level']) {
		if (!dmSheet.columns.includes(need)) throw new Error(`"${dmSheet.name}" has no "${need}" column, so the public filter cannot be applied. Import stopped.`);
	}
	for (const row of dmSheet.rows) {
		const rawTitle = str(row.cells['Title']) ?? '';
		const cde = clean(str(row.cells['CDE content']) ?? '');
		const level = clean(str(row.cells['Dissemination Level']) ?? '');
		if (!/^yes$/i.test(cde) || !/^public$/i.test(level)) {
			skipped.push({ sheet: row.sheet, row: row.row, title: rawTitle, reason: `CDE content = ${cde || '(blank)'}, Dissemination Level = ${level || '(blank)'}` });
			continue;
		}
		const ct = splitCodeTitle(rawTitle);
		if (!ct) {
			flags.push({ kind: 'skipped', sheet: row.sheet, row: row.row, title: rawTitle, message: 'Title has no "D1.1 - " or "MS1 - " code: row skipped.' });
			skipped.push({ sheet: row.sheet, row: row.row, title: rawTitle, reason: 'no deliverable/milestone code in the title' });
			continue;
		}
		const out = common(row, rawTitle, COLUMNS.deliverables, { source_key: ct.code.toLowerCase(), kind: ct.kind, code: ct.code, title: ct.title, slug: codeSlug(ct.code) });
		const pid = parsePid(str(row.cells['Link / DOI']));
		if (pid) Object.assign(out, { link: pid.link, pid_type: pid.pid_type });
		if (pid?.note) flags.push({ kind: 'normalised', sheet: row.sheet, row: row.row, title: rawTitle, message: pid.note });
		if (out.status === 'published' && !out.link) flags.push({ kind: 'data', sheet: row.sheet, row: row.row, title: rawTitle, message: 'Published but has no link.' });
		outputs.push(out);
	}

	// --- Other publications ---
	const pubRows = wb.publications.rows.map((row) => ({ row, title: clean(str(row.cells['Title of the Scientific publication']) ?? '') }));
	const byKey = new Map<string, { row: SheetRow; title: string }>();
	for (const p of pubRows) {
		if (!p.title) {
			flags.push({ kind: 'skipped', sheet: p.row.sheet, row: p.row.row, message: 'No title: row skipped.' });
			skipped.push({ sheet: p.row.sheet, row: p.row.row, title: '', reason: 'no title' });
			continue;
		}
		const key = matchKey(p.title);
		if (byKey.has(key)) {
			flags.push({ kind: 'skipped', sheet: p.row.sheet, row: p.row.row, title: p.title, message: `Same title as row ${byKey.get(key)!.row.row}: row skipped.` });
			skipped.push({ sheet: p.row.sheet, row: p.row.row, title: p.title, reason: 'duplicate title' });
			continue;
		}
		byKey.set(key, p);
	}

	// merges: format rows are not outputs of their own
	const formatOf = new Map<string, string>(); // format key → main key
	for (const m of MERGES) {
		const main = byKey.get(matchKey(m.main));
		const fmt = byKey.get(matchKey(m.format));
		if (!main || !fmt) {
			flags.push({ kind: 'relation', message: `Merge not applied: ${!main ? `main "${m.main}"` : `format "${m.format}"`} not found in the sheet (titles changed?). Update scripts/import/config.ts.` });
			continue;
		}
		formatOf.set(matchKey(m.format), matchKey(m.main));
	}

	for (const [key, { row, title }] of byKey) {
		if (formatOf.has(key)) continue;
		const out = common(row, title, COLUMNS.publications, { source_key: key, kind: 'publication', code: null, title, slug: publicationSlug(title) });
		applyPublicationFields(out, row, title);
		outputs.push(out);
	}

	function applyPublicationFields(out: OutputRecord | FormatRecord & Record<string, unknown>, row: SheetRow, title: string) {
		const c = row.cells;
		const pid = parsePid(str(c['PID (publisher version of record)']), str(c['Type of PID']));
		if (pid) Object.assign(out, { link: pid.link, pid_type: pid.pid_type });
		if (pid?.note) flags.push({ kind: pid.note.startsWith('"Type of PID"') ? 'data' : 'normalised', sheet: row.sheet, row: row.row, title, message: pid.note });
		if (!('issn' in out)) return;
		const o = out as OutputRecord;
		o.issn = str(c['ISSN or eISSN']) ? clean(str(c['ISSN or eISSN'])!) : null;
		for (const [field, col] of [['book_rid', 'RID of Book (required for Chapters in books)'], ['book_title', 'Book title (required for Chapters in books)']] as const) {
			const v = str(c[col]);
			o[field] = v && !/^no$/i.test(v.trim()) ? clean(v) : null;
			if (v && /^no$/i.test(v.trim())) flags.push({ kind: 'normalised', sheet: row.sheet, row: row.row, title, message: `"${col}" is "No": treated as not applicable.` });
		}
		for (const [field, col] of [['open_access', 'Available in Open Access through repository at time of publication?'], ['peer_reviewed', 'Peer-reviewed?']] as const) {
			const v = str(c[col]);
			o[field] = yesNo(v);
			if (v && o[field] === null) flags.push({ kind: 'data', sheet: row.sheet, row: row.row, title, message: `"${col}" is "${v}", expected Yes or No.` });
		}
	}

	// attach formats
	for (const [fmtKey, mainKey] of formatOf) {
		const main = outputs.find((o) => o.source_key === mainKey)!;
		const { row, title } = byKey.get(fmtKey)!;
		const c = row.cells;
		const typeLabel = str(c['Publication type']);
		const format: FormatRecord & Record<string, unknown> = {
			source_key: fmtKey, title, output_type: typeLabel ? (typeByKey.get(clean(typeLabel).toLowerCase()) ?? null) : null,
			link: null, pid_type: null, publisher: str(c['Publisher']) ? clean(str(c['Publisher'])!) : null, date: isoDate(c['Timeline']?.value)
		};
		applyPublicationFields(format, row, title);
		main.formats.push(format as FormatRecord);
		// tags of the format must not add anything the main item lacks
		// (parse its tags only to compare them; its own data flags don't apply, as it is not an output)
		const mark = flags.length;
		const probe = common(row, title, COLUMNS.publications, { source_key: fmtKey, kind: 'publication', code: null, title, slug: '' });
		flags.length = mark;
		for (const field of ['actors', 'principles', 'dimensions', 'regions'] as const) {
			const extra = probe[field].filter((x) => !main[field].includes(x));
			if (extra.length) flags.push({ kind: 'relation', sheet: row.sheet, row: row.row, title, message: `Merged into "${main.title}", but has ${field} the main item lacks: ${extra.join(', ')} (not imported).` });
		}
		skipped.push({ sheet: row.sheet, row: row.row, title, reason: `merged into "${main.title}" as its ${format.output_type ?? 'second'} format; its teaser, abstract and key messages are not imported` });
	}

	// typed links
	for (const l of LINKS) {
		const from = outputs.find((o) => o.source_key === matchKey(l.from));
		const to = outputs.find((o) => o.source_key === matchKey(l.to));
		if (!from || !to) {
			flags.push({ kind: 'relation', message: `Link not applied: "${!from ? l.from : l.to}" not found among imported outputs. Update scripts/import/config.ts.` });
			continue;
		}
		from.relations.push({ to: to.source_key, type: l.type, note: l.note ?? null });
	}

	// cross-check the sheet's "Platform relation" column against the configured relations
	const pairs = new Set([...MERGES.map((m) => [m.main, m.format]), ...LINKS.map((l) => [l.from, l.to])].flatMap(([a, b]) => [`${matchKey(a)}|${matchKey(b)}`, `${matchKey(b)}|${matchKey(a)}`]));
	for (const { row, title } of byKey.values()) {
		for (const ref of rowRefs(str(row.cells['Platform relation']))) {
			const other = pubRows.find((p) => p.row.row === ref);
			if (!other) flags.push({ kind: 'relation', sheet: row.sheet, row: row.row, title, message: `"Platform relation" mentions row ${ref}, which does not exist.` });
			else if (!pairs.has(`${matchKey(title)}|${matchKey(other.title)}`))
				flags.push({ kind: 'relation', sheet: row.sheet, row: row.row, title, message: `"Platform relation" mentions row ${ref} ("${other.title}"), but no relation between the two is configured in scripts/import/config.ts (rows may have moved).` });
		}
	}

	// unique slugs within the import
	const seen = new Set<string>();
	for (const o of outputs) {
		let s = o.slug || o.source_key;
		if (seen.has(s) && o.date) s = `${s}-${o.date.slice(0, 4)}`;
		for (let n = 2; seen.has(s); n++) s = `${o.slug}-${n}`;
		o.slug = s;
		seen.add(s);
	}

	// visuals used with different alt texts
	for (const v of visuals.values()) {
		if (v.altSeen.size > 1) flags.push({ kind: 'accessibility', message: `Visual ${v.filename} has different alt texts on different rows; the first one is used.` });
	}

	return {
		taxonomies,
		outputs,
		visuals: [...visuals.values()].map(({ altSeen, ...v }) => v),
		webinars: [...webinars],
		flags,
		skipped
	};
}

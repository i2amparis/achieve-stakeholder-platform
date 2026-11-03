import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { DRAFT_FILL } from './config.ts';
import { exportCsv } from './export.ts';
import { readWorkbook } from './read.ts';
import { transform } from './transform.ts';

// ---------------------------------------------------------------------------
// Fixture workbook. A value wrapped in Y(...) is written as a yellow (draft) cell.
// ---------------------------------------------------------------------------
type V = string | Date | null | { draft: string };
const Y = (v: string) => ({ draft: v });

const DM_HEADERS = ['Title', 'Lead ', 'Due Date', 'Status', 'CDE content', 'Dissemination Level', 'WP', 'Type', 'Platform actors', 'Integrity principles', 'Key dimensions', 'Abstract', 'Link / DOI', 'Associated webinar', 'Associated visual / data', 'Teaser', 'Actor key messages', 'Alt text', 'Region focus'];
const OP_HEADERS = ['Lead ', 'Contributor ', 'Timeline ', 'Publication type ', 'Status', 'Type of PID', 'PID (publisher version of record)', 'Type of publication', 'Title of the Scientific publication', 'Authors', 'ISSN or eISSN', 'Publisher', 'Available in Open Access through repository at time of publication?', 'Peer-reviewed?', 'RID of Book \n(required for Chapters in books) ', 'Book title \n(required for Chapters in books) ', 'Full reference', 'Platform actors', 'Abstract', 'Integrity principles', 'Key dimensions', 'Actor sub-tags', 'Teaser', 'Actor key messages', 'Region focus', 'Associated visual / data', 'Alt text', 'Draft basis', 'Platform relation'];

const LEGEND: [string, string | null][] = [
	['How to use', null],
	['Yellow cells', 'Unconfirmed drafts.'],
	['Platform actors', null],
	['Business', 'Industry & businesses'],
	['Cities', 'Local climate action plans'],
	['Regulators', 'Regulators/policymakers'],
	['Carbon markets', 'Voluntary carbon markets'],
	['CCIs', 'Cooperative Climate Initiatives'],
	['Integrity principles', null],
	['P1', 'Integrated accountability: target coherence; policy & governance; data, reporting & transparency; monitoring & verification; compliance & enforcement'],
	['P2', 'Justice and equity: equity & inclusion; support & capacity; inclusive decision-making; just transition; differentiated responsibilities'],
	['P3', 'Environmental protection: ecosystem protection & restoration; biodiversity conservation; systemic environmental integrity; integrated practices; sustainable resource use'],
	['P4', 'Low-carbon & resilient transformation: ambitious policies; dealing with trade-offs; standard-setting; sector-wide change; innovation & systemic change']
];

async function fixture(dm: Record<string, V>[], op: Record<string, V>[], opts: { extraColumns?: Record<string, string>; dropColumn?: string } = {}): Promise<string> {
	const wb = new ExcelJS.Workbook();
	const write = (name: string, headers: string[], rows: Record<string, V>[]) => {
		const ws = wb.addWorksheet(name);
		const hs = [...headers.filter((h) => h.trim() !== opts.dropColumn), ...Object.keys(opts.extraColumns ?? {})];
		ws.addRow(hs);
		for (const r of rows) {
			const row = ws.addRow(hs.map(() => null));
			hs.forEach((h, i) => {
				const key = h.replace(/[\s ]+/g, ' ').trim();
				const v = key in (opts.extraColumns ?? {}) ? opts.extraColumns![key] : r[key];
				const cell = row.getCell(i + 1);
				if (v && typeof v === 'object' && 'draft' in v) {
					cell.value = v.draft;
					cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DRAFT_FILL } };
				} else cell.value = (v as string | Date | null) ?? null;
			});
		}
	};
	write('Deliverables & Milestones', DM_HEADERS, dm);
	write('Other publications', OP_HEADERS, op);
	const lg = wb.addWorksheet('Tagging legend');
	for (const [a, b] of LEGEND) {
		const row = lg.addRow([a, b]);
		if (a === 'Yellow cells') row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DRAFT_FILL } };
	}
	const path = join(mkdtempSync(join(tmpdir(), 'achieve-import-')), 'fixture.xlsx');
	await wb.xlsx.writeFile(path);
	return path;
}

const d = (y: number, m: number) => new Date(Date.UTC(y, m - 1, 1));
const deliverable = (over: Record<string, V> = {}): Record<string, V> => ({
	Title: 'D9.1 - Lorem ipsum report', Lead: 'RU', 'Due Date': d(2025, 12), Status: 'Completed', 'CDE content': 'Yes', 'Dissemination Level': 'Public',
	WP: 'WP1', Type: 'Report', 'Platform actors': 'Cities; Business', 'Integrity principles': 'P1', 'Key dimensions': 'target coherence',
	Abstract: 'Lorem ipsum dolor sit amet.', 'Link / DOI': 'https://example.org/d9-1.pdf', Teaser: 'Lorem ipsum teaser.',
	'Actor key messages': 'Cities: Lorem ipsum.\nBusiness: Dolor sit amet.', 'Region focus': 'Global', ...over
});
const publication = (title: string, over: Record<string, V> = {}): Record<string, V> => ({
	Lead: 'OEKO', Timeline: d(2025, 6), 'Publication type': 'Policy Brief', Status: 'Published', 'Type of PID': 'URL', 'PID (publisher version of record)': `https://example.org/${encodeURIComponent(title)}`,
	'Type of publication': 'Other', 'Title of the Scientific publication': title, Authors: 'Lorem, I.', Publisher: 'Lorem Press',
	'Available in Open Access through repository at time of publication?': 'Yes', 'Peer-reviewed?': 'No', 'Platform actors': 'Regulators',
	Abstract: 'Lorem ipsum.', 'Integrity principles': 'P1', 'Key dimensions': 'policy & governance', Teaser: 'Lorem ipsum.',
	'Actor key messages': 'Regulators: Lorem ipsum.', 'Region focus': 'Europe', 'Draft basis': 'EDITORIAL-NOTE-MUST-NOT-BE-IMPORTED', ...over
});

const load = async (path: string) => transform(await readWorkbook(path));

// ---------------------------------------------------------------------------

describe('Deliverables & Milestones', () => {
	it('imports only CDE content = Yes and Dissemination Level = Public', async () => {
		const m = await load(await fixture([
			deliverable(),
			deliverable({ Title: 'D9.2 - Not for the platform', 'CDE content': 'No' }),
			deliverable({ Title: 'D9.3 - Classified', 'Dissemination Level': 'Classified' })
		], []));
		expect(m.outputs.map((o) => o.code)).toEqual(['D9.1']);
		expect(m.skipped.map((s) => s.title)).toEqual(['D9.2 - Not for the platform', 'D9.3 - Classified']);
	});

	it('stops when the public filter columns are missing', async () => {
		await expect(load(await fixture([deliverable()], [], { dropColumn: 'Dissemination Level' }))).rejects.toThrow(/Dissemination Level/);
	});

	it('treats a blank status as Upcoming', async () => {
		const m = await load(await fixture([deliverable({ Status: null })], []));
		expect(m.outputs[0].status).toBe('upcoming');
	});

	it('splits code and title, and uses the code for the slug and match key', async () => {
		const [o] = (await load(await fixture([deliverable({ Title: 'MS3 - Lorem milestone' })], []))).outputs;
		expect(o).toMatchObject({ code: 'MS3', kind: 'milestone', title: 'Lorem milestone', slug: 'ms3', source_key: 'ms3' });
	});
});

describe('tags', () => {
	it('keeps actor and principle order from the sheet', async () => {
		const [o] = (await load(await fixture([deliverable({ 'Platform actors': 'Carbon markets; Business; Cities; CCIs', 'Integrity principles': 'P3; P1', 'Key dimensions': 'systemic environmental integrity; target coherence' })], []))).outputs;
		expect(o.actors).toEqual(['carbon-markets', 'business', 'cities', 'ccis']);
		expect(o.principles).toEqual(['p3', 'p1']);
	});

	it('appends Actor sub-tags after the platform actors', async () => {
		const [o] = (await load(await fixture([], [publication('Lorem finance brief', { 'Platform actors': 'CCIs; Business', 'Actor sub-tags': 'Finance', 'Actor key messages': 'CCIs: a.\nBusiness: b.' })]))).outputs;
		expect(o.actors).toEqual(['ccis', 'business', 'finance']);
	});

	it('never puts Finance first, and says so', async () => {
		const m = await load(await fixture([], [publication('Lorem finance first', { 'Platform actors': 'Finance; Business', 'Actor key messages': 'Business: b.' })]));
		expect(m.outputs[0].actors).toEqual(['business', 'finance']);
		expect(m.flags.some((f) => f.kind === 'normalised' && /finance moved after the hub actors/.test(f.message))).toBe(true);
	});

	it('flags Finance without Business or CCIs', async () => {
		const m = await load(await fixture([], [publication('Lorem finance only', { 'Platform actors': 'Regulators', 'Actor sub-tags': 'Finance' })]));
		expect(m.flags.some((f) => /none of business\/ccis/.test(f.message))).toBe(true);
	});

	it('flags unknown terms instead of importing them', async () => {
		const m = await load(await fixture([deliverable({ 'Platform actors': 'Cities; Universities', 'Key dimensions': 'target coherence; vibes' })], []));
		expect(m.outputs[0].actors).toEqual(['cities']);
		expect(m.outputs[0].dimensions).toEqual(['target-coherence']);
		expect(m.flags.filter((f) => /Unknown (actor|dimension)/.test(f.message))).toHaveLength(2);
	});

	it('flags a dimension whose principle is not tagged', async () => {
		const m = await load(await fixture([deliverable({ 'Integrity principles': 'P1', 'Key dimensions': 'target coherence; standard-setting' })], []));
		expect(m.flags.some((f) => /standard-setting" belongs to P4/.test(f.message))).toBe(true);
	});
});

describe('key messages and visuals', () => {
	it('splits key messages into actor + message entries, in order', async () => {
		const [o] = (await load(await fixture([deliverable()], []))).outputs;
		expect(o.actor_messages).toEqual([{ actor: 'cities', message: 'Lorem ipsum.' }, { actor: 'business', message: 'Dolor sit amet.' }]);
	});

	it('flags a key message for an actor the item is not tagged with', async () => {
		const m = await load(await fixture([deliverable({ 'Actor key messages': 'Cities: a.\nBusiness: b.\nRegulators: c.' })], []));
		expect(m.flags.some((f) => /Key message for regulators/.test(f.message))).toBe(true);
	});

	it('matches alt text to each visual file and shares visuals between outputs', async () => {
		const alt = 'v1.pdf: Lorem infographic one.\n\nv2.png: Lorem diagram two.';
		const m = await load(await fixture([deliverable({ 'Associated visual / data': 'v1.pdf; v2.png', 'Alt text': alt })], [publication('Lorem reuse', { 'Associated visual / data': 'v1.pdf', 'Alt text': 'v1.pdf: Lorem infographic one.' })]));
		expect(m.visuals.map((v) => [v.filename, v.alt_text])).toEqual([['v1.pdf', 'Lorem infographic one.'], ['v2.png', 'Lorem diagram two.']]);
		expect(m.outputs.find((o) => o.code === 'D9.1')!.visuals).toEqual(['v1.pdf', 'v2.png']);
	});

	it('flags a visual without alt text', async () => {
		const m = await load(await fixture([deliverable({ 'Associated visual / data': 'v1.pdf' })], []));
		expect(m.flags.some((f) => f.kind === 'accessibility' && /v1\.pdf has no alt text/.test(f.message))).toBe(true);
		expect(m.visuals[0].confirmed).toBe(false);
	});
});

describe('draft (yellow) cells', () => {
	it('imports drafts but records them as unconfirmed', async () => {
		const m = await load(await fixture([deliverable({ Teaser: Y('Draft teaser.'), 'Region focus': Y('Global') })], []));
		expect(m.outputs[0].teaser).toBe('Draft teaser.');
		expect(m.outputs[0].unconfirmed_fields).toEqual(['regions', 'teaser']);
		expect(m.outputs[0].confirmed).toBe(false);
	});

	it('marks an item confirmed when no cell is yellow', async () => {
		expect((await load(await fixture([deliverable()], []))).outputs[0].confirmed).toBe(true);
	});

	it('ignores yellow on empty cells', async () => {
		const m = await load(await fixture([deliverable({ 'Alt text': Y('') })], []));
		expect(m.outputs[0].confirmed).toBe(true);
	});
});

describe('columns', () => {
	it('warns about an unknown column, skips it and leaves it out of the CSV export', async () => {
		const path = await fixture([deliverable()], [publication('Lorem')], { extraColumns: { 'Article processing costs': '1450 EUR' } });
		const m = await load(path);
		expect(m.flags.filter((f) => f.kind === 'column' && /Article processing costs/.test(f.message))).toHaveLength(2);
		expect(JSON.stringify(m)).not.toContain('1450 EUR');
		const dir = mkdtempSync(join(tmpdir(), 'achieve-export-'));
		await exportCsv(path, dir);
		for (const f of readdirSync(dir)) {
			const csv = readFileSync(join(dir, f), 'utf8');
			expect(csv, f).not.toContain('Article processing costs');
			expect(csv, f).not.toContain('1450 EUR');
		}
	});

	it('never imports Draft basis', async () => {
		const m = await load(await fixture([], [publication('Lorem')]));
		expect(JSON.stringify(m)).not.toContain('EDITORIAL-NOTE-MUST-NOT-BE-IMPORTED');
	});
});

describe('publications', () => {
	it('normalises partner codes and splits contributors on commas', async () => {
		const m = await load(await fixture([], [publication('Lorem', { Lead: 'WWF+3:20', Contributor: 'NCI, OEKO' })]));
		expect(m.outputs[0].lead_partner).toBe('WWF');
		expect(m.outputs[0].contributors).toEqual(['NCI', 'OEKO']);
		expect(m.flags.some((f) => f.kind === 'normalised' && /WWF\+3:20/.test(f.message))).toBe(true);
	});

	it('turns bare DOIs into links', async () => {
		const [o] = (await load(await fixture([], [publication('Lorem', { 'Type of PID': 'DOI', 'PID (publisher version of record)': '10.5281/zenodo.1' })]))).outputs;
		expect(o).toMatchObject({ link: 'https://doi.org/10.5281/zenodo.1', pid_type: 'doi' });
	});
});

describe('merges and links (by title, not row number)', () => {
	const main = 'From pledges to places: action agendas need spatial data to integrate climate and biodiversity action';
	const brief = 'Integrating Spatial Data for Credible, Just and Synergic Non-state and Transnational Climate and Biodiversity Action';
	const newer = 'Using International Carbon Credits towards the EU 2040 Climate Target';
	const older = "Conditions for Using International Carbon Credits towards the EU's 2040 Climate Target"; // straight quote: still matches

	it('makes one output with two formats, whatever the row order', async () => {
		const m = await load(await fixture([], [
			publication(brief, { 'Publication type': 'Policy Brief', 'PID (publisher version of record)': '10.5281/zenodo.2', 'Type of PID': 'DOI' }),
			publication('Lorem filler'),
			publication(main, { 'Publication type': 'Journal article' })
		]));
		expect(m.outputs.map((o) => o.title)).toEqual(['Lorem filler', main]);
		const o = m.outputs.find((x) => x.title === main)!;
		expect(o.formats).toEqual([expect.objectContaining({ title: brief, output_type: 'Policy Brief', link: 'https://doi.org/10.5281/zenodo.2' })]);
		expect(m.skipped.some((s) => s.title === brief && /merged/.test(s.reason))).toBe(true);
	});

	it('links the newer brief to the one it supersedes', async () => {
		const m = await load(await fixture([], [publication(newer), publication(older)]));
		const o = m.outputs.find((x) => x.title === newer)!;
		expect(o.relations).toEqual([{ to: m.outputs.find((x) => x.title === older)!.source_key, type: 'supersedes', note: 'partly' }]);
	});

	it('flags a "Platform relation" note that points at an unrelated row', async () => {
		const m = await load(await fixture([], [publication('Lorem one', { 'Platform relation': 'Second format: row 3.' }), publication('Lorem two')]));
		expect(m.flags.some((f) => f.kind === 'relation' && /mentions row 3/.test(f.message))).toBe(true);
	});

	it('flags a configured merge whose titles are not in the sheet', async () => {
		const m = await load(await fixture([], [publication('Lorem')]));
		expect(m.flags.some((f) => f.kind === 'relation' && /Merge not applied/.test(f.message))).toBe(true);
	});
});

describe('the real content sheet', async () => {
	const m = await load(resolve(import.meta.dirname, '../../data/achieve-cde-content.xlsx'));

	it('yields 34 outputs: 15 deliverables and milestones, 19 publications', () => {
		expect(m.outputs).toHaveLength(34);
		expect(m.outputs.filter((o) => o.kind !== 'publication')).toHaveLength(15);
		expect(m.outputs.filter((o) => o.status === 'published')).toHaveLength(26);
	});

	it('gives every output at least one hub actor and one principle', () => {
		for (const o of m.outputs) {
			expect(o.actors[0], o.slug).not.toBe('finance');
			expect(o.principles.length, o.slug).toBeGreaterThan(0);
		}
	});

	it('has unique slugs and match keys', () => {
		expect(new Set(m.outputs.map((o) => o.slug)).size).toBe(34);
		expect(new Set(m.outputs.map((o) => o.source_key)).size).toBe(34);
	});

	it('builds the full taxonomy from the legend', () => {
		expect(m.taxonomies.dimensions).toHaveLength(20);
		expect(m.taxonomies.actors.filter((a) => a.is_hub)).toHaveLength(5);
		expect(m.taxonomies.actors.find((a) => a.slug === 'finance')).toMatchObject({ is_hub: false, shown_in: ['business', 'ccis'] });
	});

	it('reports no unknown columns', () => {
		expect(m.flags.filter((f) => f.kind === 'column')).toEqual([]);
	});
});

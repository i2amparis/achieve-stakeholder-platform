// Read the content workbook into plain rows. Knows nothing about Directus.

import ExcelJS from 'exceljs';
import { COLUMNS, DRAFT_FILL, SHEETS } from './config.ts';
import { clean, splitMulti } from './parse.ts';

export type CellValue = string | Date | null;
export interface Cell {
	value: CellValue;
	/** Highlighted as an unconfirmed draft (yellow). */
	draft: boolean;
}
export interface SheetRow {
	sheet: string;
	/** Spreadsheet row number, for messages only. Rows are matched by title or code. */
	row: number;
	cells: Record<string, Cell>;
}
export interface SheetData {
	name: string;
	/** Known columns in sheet order (unknown ones are dropped). */
	columns: string[];
	unknownColumns: string[];
	rows: SheetRow[];
}
export interface Legend {
	actorDescriptions: Map<string, string>;
	principles: { label: string; name: string; dimensions: string[] }[];
	draftFill: string | null;
}
export interface Workbook {
	deliverables: SheetData;
	publications: SheetData;
	legend: Legend;
	/** Raw grid of every sheet, for the CSV export (known columns only for content sheets). */
	warnings: string[];
}

export const normaliseHeader = (h: unknown) => clean(String(h ?? ''));

function cellValue(v: ExcelJS.CellValue): CellValue {
	if (v == null) return null;
	if (v instanceof Date) return v;
	if (typeof v === 'string') return v;
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	if (typeof v === 'object') {
		if ('richText' in v) return v.richText.map((r) => r.text).join('');
		if ('text' in v && typeof v.text === 'string') return v.text; // hyperlink cell: use its text
		if ('result' in v) return cellValue(v.result as ExcelJS.CellValue); // formula
		if ('error' in v) return null;
	}
	return String(v);
}

function isDraft(cell: ExcelJS.Cell, fill: string): boolean {
	const f = cell.fill as ExcelJS.FillPattern | undefined;
	return f?.type === 'pattern' && f.pattern === 'solid' && f.fgColor?.argb?.toUpperCase() === fill;
}

function readSheet(ws: ExcelJS.Worksheet, known: Record<string, unknown>, fill: string): SheetData {
	const headerRow = ws.getRow(1);
	const columns: { index: number; name: string }[] = [];
	const unknownColumns: string[] = [];
	headerRow.eachCell({ includeEmpty: false }, (cell, index) => {
		const name = normaliseHeader(cell.value);
		if (!name) return;
		if (name in known) columns.push({ index, name });
		else unknownColumns.push(name);
	});
	const rows: SheetRow[] = [];
	for (let r = 2; r <= ws.rowCount; r++) {
		const row = ws.getRow(r);
		const cells: Record<string, Cell> = {};
		let any = false;
		for (const { index, name } of columns) {
			const c = row.getCell(index);
			const value = cellValue(c.value);
			const v = typeof value === 'string' && !value.trim() ? null : value;
			if (v != null) any = true;
			cells[name] = { value: v, draft: isDraft(c, fill) };
		}
		if (any) rows.push({ sheet: ws.name, row: r, cells });
	}
	return { name: ws.name, columns: columns.map((c) => c.name), unknownColumns, rows };
}

function readLegend(ws: ExcelJS.Worksheet | undefined): Legend {
	const legend: Legend = { actorDescriptions: new Map(), principles: [], draftFill: null };
	if (!ws) return legend;
	let section = '';
	for (let r = 1; r <= ws.rowCount; r++) {
		const a = cellValue(ws.getCell(r, 1).value);
		const b = cellValue(ws.getCell(r, 2).value);
		const key = typeof a === 'string' ? clean(a) : '';
		const text = typeof b === 'string' ? clean(b) : '';
		if (key && !text) {
			section = key.toLowerCase();
			continue;
		}
		if (/^yellow cells$/i.test(key)) {
			const f = ws.getCell(r, 1).fill as ExcelJS.FillPattern | undefined;
			legend.draftFill = f?.fgColor?.argb?.toUpperCase() ?? null;
		}
		if (section === 'platform actors' && key) legend.actorDescriptions.set(key, text);
		if (section === 'integrity principles' && /^P\d$/i.test(key)) {
			const [name, dims] = text.split(/:\s*/, 2);
			legend.principles.push({ label: key.toUpperCase(), name: clean(name), dimensions: splitMulti(dims) });
		}
	}
	return legend;
}

export async function readWorkbook(path: string): Promise<Workbook> {
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.readFile(path);
	const warnings: string[] = [];
	const legend = readLegend(wb.getWorksheet(SHEETS.legend));
	let fill = DRAFT_FILL;
	if (legend.draftFill && legend.draftFill !== DRAFT_FILL) {
		warnings.push(`The legend's "Yellow cells" colour is ${legend.draftFill}, not ${DRAFT_FILL}; using the legend's colour.`);
		fill = legend.draftFill;
	}
	const get = (name: string) => {
		const ws = wb.getWorksheet(name);
		if (!ws) throw new Error(`Sheet "${name}" not found in ${path}`);
		return ws;
	};
	const deliverables = readSheet(get(SHEETS.deliverables), COLUMNS.deliverables, fill);
	const publications = readSheet(get(SHEETS.publications), COLUMNS.publications, fill);
	for (const s of [deliverables, publications]) {
		for (const c of s.unknownColumns) warnings.push(`Unknown column "${c}" on "${s.name}": skipped (not imported, not exported).`);
	}
	return { deliverables, publications, legend, warnings };
}

/** Every sheet as rows of strings, for the CSV export. Content sheets keep known columns only. */
export async function readForExport(path: string): Promise<{ name: string; header: string[]; rows: string[][] }[]> {
	const wb = new ExcelJS.Workbook();
	await wb.xlsx.readFile(path);
	const out: { name: string; header: string[]; rows: string[][] }[] = [];
	const fmt = (v: CellValue) => (v instanceof Date ? v.toISOString().slice(0, 10) : (v ?? ''));
	for (const ws of wb.worksheets) {
		const known = ws.name === SHEETS.deliverables ? COLUMNS.deliverables : ws.name === SHEETS.publications ? COLUMNS.publications : null;
		if (known) {
			const data = readSheet(ws, known, DRAFT_FILL);
			out.push({
				name: ws.name,
				header: ['row', ...data.columns, 'unconfirmed (yellow)'],
				rows: data.rows.map((r) => [String(r.row), ...data.columns.map((c) => fmt(r.cells[c].value)), data.columns.filter((c) => r.cells[c].draft && r.cells[c].value != null).join('; ')])
			});
		} else {
			const rows: string[][] = [];
			for (let r = 1; r <= ws.rowCount; r++) {
				const vals: string[] = [];
				for (let c = 1; c <= ws.columnCount; c++) vals.push(fmt(cellValue(ws.getCell(r, c).value)));
				rows.push(vals);
			}
			out.push({ name: ws.name, header: [], rows });
		}
	}
	return out;
}

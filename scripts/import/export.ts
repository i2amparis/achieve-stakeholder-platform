// Write each sheet to data/export/<sheet-slug>.csv so content changes show up as readable git diffs.
// Content sheets keep known columns only (unknown columns never reach the repo).

import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { slugify } from './parse.ts';
import { readForExport } from './read.ts';

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
export const toCsv = (rows: string[][]) => rows.map((r) => r.map(csvCell).join(',')).join('\n') + '\n';

export async function exportCsv(xlsxPath: string, outDir: string): Promise<string[]> {
	mkdirSync(outDir, { recursive: true });
	const written: string[] = [];
	for (const sheet of await readForExport(xlsxPath)) {
		const file = join(outDir, `${slugify(sheet.name)}.csv`);
		writeFileSync(file, toCsv(sheet.header.length ? [sheet.header, ...sheet.rows] : sheet.rows));
		written.push(file);
	}
	// remove exports of sheets that no longer exist
	for (const f of readdirSync(outDir)) {
		const path = join(outDir, f);
		if (f.endsWith('.csv') && !written.includes(path)) rmSync(path);
	}
	return written;
}

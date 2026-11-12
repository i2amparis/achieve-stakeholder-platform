// Human-readable import report: what was imported, skipped and flagged.

import type { Flag, FlagKind, ImportModel } from './transform.ts';

const KIND_TITLES: Record<FlagKind, string> = {
	column: 'Columns',
	skipped: 'Rows skipped',
	relation: 'Merges and links',
	data: 'For partners to check',
	accessibility: 'Accessibility (alt text)',
	normalised: 'Normalised automatically'
};
const ORDER: FlagKind[] = ['column', 'skipped', 'relation', 'accessibility', 'data', 'normalised'];

const where = (f: Flag) => [f.sheet && f.row ? `${f.sheet} row ${f.row}` : f.sheet, f.title ? `"${f.title}"` : ''].filter(Boolean).join(', ');

export function renderReport(model: ImportModel, meta: { mode: string; source: string; csvs: string[] }) {
	const flags = model.flags;
	const count = (k: FlagKind) => flags.filter((f) => f.kind === k).length;

	const out = model.outputs;
	const summary = [
		`ACHIEVE content import: ${meta.mode}`,
		`Source: ${meta.source}`,
		``,
		`Outputs in the sheet: ${out.length} (${out.filter((o) => o.kind === 'deliverable').length} deliverables, ${out.filter((o) => o.kind === 'milestone').length} milestones, ${out.filter((o) => o.kind === 'publication').length} publications; ${out.filter((o) => o.status === 'published').length} published, ${out.filter((o) => o.status === 'upcoming').length} upcoming)`,
		`Visuals: ${model.visuals.length}, webinars: ${model.webinars.length}`,
		`Confirmed by partners: ${out.filter((o) => o.confirmed).length} of ${out.length} outputs, ${model.visuals.filter((v) => v.confirmed).length} of ${model.visuals.length} visuals`,
		`Rows not imported as outputs: ${model.skipped.length}`,
		`Flags: ${ORDER.map((k) => `${KIND_TITLES[k].toLowerCase()} ${count(k)}`).join(', ')}`,
		`Written: ${meta.csvs.join(', ')}`
	].join('\n');

	const lines: string[] = [`# Import report`, '', '```', summary, '```', ''];
	if (model.skipped.length) {
		lines.push('## Rows not imported as outputs', '');
		for (const s of model.skipped) lines.push(`- ${s.sheet} row ${s.row}, "${s.title}": ${s.reason}`);
		lines.push('');
	}
	for (const k of ORDER) {
		const list = flags.filter((f) => f.kind === k);
		if (!list.length) continue;
		lines.push(`## ${KIND_TITLES[k]} (${list.length})`, '');
		for (const f of list) lines.push(`- ${where(f) ? where(f) + ': ' : ''}${f.message}`);
		lines.push('');
	}
	lines.push('## Unconfirmed (yellow) fields per output', '');
	for (const o of out.filter((x) => !x.confirmed)) lines.push(`- \`${o.slug}\`: ${o.unconfirmed_fields.join(', ')}`);
	return { summary, full: lines.join('\n') + '\n' };
}

// Write an ImportModel to Directus, idempotently.
// Records are matched by natural keys (slug, code, file name, URL, and the output's
// source_key = deliverable code or normalised title), never by row number.
// Only fields the sheet owns are written; a second run with the same sheet writes nothing.

import type { Directus } from '../../directus/setup/lib/client.ts';
import { qs } from '../../directus/setup/lib/client.ts';
import type { Flag, ImportModel, OutputRecord } from './transform.ts';

export interface Change {
	collection: string;
	key: string;
	action: 'create' | 'update';
	fields: string[];
}
export interface ApplyResult {
	changes: Change[];
	unchanged: Record<string, number>;
	flags: Flag[];
}

type Row = Record<string, any>;

const stable = (v: unknown): string => JSON.stringify(v ?? null);
const same = (a: unknown, b: unknown) => stable(a) === stable(b);

export async function apply(model: ImportModel, d: Directus, opts: { dryRun?: boolean; now?: string } = {}): Promise<ApplyResult> {
	const dry = !!opts.dryRun;
	const now = opts.now ?? new Date().toISOString();
	const changes: Change[] = [];
	const unchanged: Record<string, number> = {};
	const flags: Flag[] = [];
	let tempId = -1; // ids for records that would be created in a dry run

	const all = (collection: string, fields: string, deep?: object) =>
		d.get<Row[]>(`/items/${collection}` + qs({ limit: -1, fields, deep }));

	/** Upsert simple records by a key field; returns key → id. */
	async function upsert<T extends Row>(collection: string, keyField: string, records: T[], pkField = 'id'): Promise<Map<string, any>> {
		const owned = Object.keys(records[0] ?? {});
		const existing = await all(collection, [pkField, ...owned].join(','));
		const byKey = new Map(existing.map((r) => [String(r[keyField]), r]));
		const ids = new Map<string, any>();
		for (const rec of records) {
			const key = String(rec[keyField]);
			const cur = byKey.get(key);
			if (!cur) {
				changes.push({ collection, key, action: 'create', fields: owned });
				ids.set(key, dry ? tempId-- : (await d.post(`/items/${collection}`, rec))[pkField]);
				continue;
			}
			ids.set(key, cur[pkField]);
			const diff = owned.filter((f) => !same(cur[f], rec[f]));
			if (!diff.length) {
				unchanged[collection] = (unchanged[collection] ?? 0) + 1;
				continue;
			}
			changes.push({ collection, key, action: 'update', fields: diff });
			if (!dry) await d.patch(`/items/${collection}/${encodeURIComponent(cur[pkField])}`, Object.fromEntries(diff.map((f) => [f, rec[f]])));
		}
		return ids;
	}

	// --- taxonomies ---------------------------------------------------------
	const t = model.taxonomies;
	await upsert('languages', 'code', t.languages, 'code');
	const actorIds = await upsert('actors', 'slug', t.actors.map(({ shown_in, ...a }) => a));
	const principleIds = await upsert('principles', 'code', t.principles);
	const dimensionIds = await upsert('dimensions', 'slug', t.dimensions.map((x) => ({ ...x, principle: principleIds.get(x.principle) })));
	const regionIds = await upsert('regions', 'slug', t.regions);
	const typeIds = await upsert('output_types', 'slug', t.output_types);
	const typeByName = new Map(t.output_types.map((x) => [x.name, typeIds.get(x.slug)]));
	const partnerIds = await upsert('partners', 'code', t.partners);

	// actors.shown_in (junction actors_shown_in, unordered)
	const shown = await all('actors', 'id,slug,shown_in.related_actors_id');
	for (const a of t.actors) {
		const id = actorIds.get(a.slug);
		const want = a.shown_in.map((s) => actorIds.get(s)).sort();
		const cur = shown.find((x) => x.id === id)?.shown_in?.map((j: Row) => j.related_actors_id).sort() ?? [];
		if (same(want, cur)) continue;
		changes.push({ collection: 'actors', key: a.slug, action: 'update', fields: ['shown_in'] });
		if (!dry) await d.patch(`/items/actors/${id}`, { shown_in: want.map((related_actors_id) => ({ related_actors_id })) });
	}

	// --- webinars and visuals ------------------------------------------------
	const webinarIds = await upsert('webinars', 'url', model.webinars.map((url) => ({ url })));
	const visualIds = await upsert('visuals', 'filename', model.visuals);

	// --- outputs ----------------------------------------------------------------
	const J = { actors: 'actors_id', principles: 'principles_id', dimensions: 'dimensions_id', regions: 'regions_id', contributors: 'partners_id', visuals: 'visuals_id' } as const;
	const fields = [
		'id', 'source_key', 'slug', 'workflow_state', 'kind', 'code', 'title', 'status', 'date', 'work_package', 'output_type', 'lead_partner', 'authors',
		'teaser', 'abstract', 'link', 'pid_type', 'citation', 'publisher', 'issn', 'book_rid', 'book_title', 'open_access', 'peer_reviewed', 'webinar',
		'unconfirmed_fields', 'confirmed', 'source_sheet',
		...Object.entries(J).map(([alias, key]) => `${alias}.${key}`),
		'actor_messages.actor', 'actor_messages.message',
		'formats.id', 'formats.source_key', 'formats.output_type', 'formats.title', 'formats.link', 'formats.pid_type', 'formats.publisher', 'formats.date',
		'relations.id', 'relations.related_output', 'relations.relation_type', 'relations.note'
	].join(',');
	const deep = Object.fromEntries([...Object.keys(J), 'actor_messages'].map((k) => [k, { _sort: ['sort'], _limit: -1 }]));
	const existing = await all('outputs', fields, deep);
	const bySource = new Map(existing.filter((o) => o.source_key).map((o) => [o.source_key, o]));
	const takenSlugs = new Set(existing.map((o) => o.slug));
	const modelKeys = new Set(model.outputs.map((o) => o.source_key));

	const scalars = (o: OutputRecord) => ({
		kind: o.kind, code: o.code, title: o.title, status: o.status, date: o.date, work_package: o.work_package,
		output_type: o.output_type ? (typeByName.get(o.output_type) ?? null) : null,
		lead_partner: o.lead_partner ? (partnerIds.get(o.lead_partner) ?? null) : null,
		authors: o.authors, teaser: o.teaser, abstract: o.abstract, link: o.link, pid_type: o.pid_type, citation: o.citation, publisher: o.publisher,
		issn: o.issn, book_rid: o.book_rid, book_title: o.book_title, open_access: o.open_access, peer_reviewed: o.peer_reviewed,
		webinar: o.webinar ? (webinarIds.get(o.webinar) ?? null) : null,
		unconfirmed_fields: o.unconfirmed_fields, confirmed: o.confirmed, source_sheet: o.source_sheet
	});
	const tagIds = (o: OutputRecord) => ({
		actors: o.actors.map((s) => actorIds.get(s)),
		principles: o.principles.map((c) => principleIds.get(c)),
		dimensions: o.dimensions.map((s) => dimensionIds.get(s)),
		regions: o.regions.map((s) => regionIds.get(s)),
		contributors: o.contributors.map((c) => partnerIds.get(c)),
		visuals: o.visuals.map((f) => visualIds.get(f))
	});
	const messages = (o: OutputRecord) => o.actor_messages.map((m) => ({ actor: actorIds.get(m.actor), message: m.message }));
	const formatRow = (f: OutputRecord['formats'][number]) => ({
		source_key: f.source_key, output_type: f.output_type ? (typeByName.get(f.output_type) ?? null) : null, title: f.title,
		link: f.link, pid_type: f.pid_type, publisher: f.publisher, date: f.date
	});

	const outputIds = new Map<string, number>();
	for (const o of model.outputs) {
		let cur = bySource.get(o.source_key);
		// renamed in the sheet? same link, and the old key is no longer in the sheet
		if (!cur && o.link) {
			const renamed = existing.find((e) => e.link === o.link && e.source_key && !modelKeys.has(e.source_key));
			if (renamed) {
				flags.push({ kind: 'normalised', sheet: o.source_sheet, row: o.sheetRow, title: o.title, message: `Matched to the existing record "${renamed.title}" by its link (title changed in the sheet).` });
				changes.push({ collection: 'outputs', key: o.source_key, action: 'update', fields: ['source_key'] });
				if (!dry) await d.patch(`/items/outputs/${renamed.id}`, { source_key: o.source_key });
				bySource.delete(renamed.source_key);
				renamed.source_key = o.source_key;
				cur = renamed;
			}
		}
		const want = scalars(o);
		const tags = tagIds(o);
		const msgs = messages(o);

		if (!cur) {
			let slug = o.slug;
			if (takenSlugs.has(slug)) slug = o.date ? `${slug}-${o.date.slice(0, 4)}` : slug;
			for (let n = 2; takenSlugs.has(slug); n++) slug = `${o.slug}-${n}`;
			takenSlugs.add(slug);
			const body = {
				...want, source_key: o.source_key, slug, workflow_state: 'published', imported_at: now,
				...Object.fromEntries(Object.entries(tags).map(([alias, ids]) => [alias, ids.map((id, i) => ({ [J[alias as keyof typeof J]]: id, sort: i + 1 }))])),
				actor_messages: msgs.map((m, i) => ({ ...m, sort: i + 1 })),
				formats: o.formats.map((f, i) => ({ ...formatRow(f), sort: i + 1 }))
			};
			changes.push({ collection: 'outputs', key: o.source_key, action: 'create', fields: [] });
			outputIds.set(o.source_key, dry ? tempId-- : (await d.post('/items/outputs', body)).id);
			continue;
		}

		outputIds.set(o.source_key, cur.id);
		const patch: Row = {};
		for (const [f, v] of Object.entries(want)) if (!same(cur[f], v)) patch[f] = v;
		for (const [alias, ids] of Object.entries(tags)) {
			const key = J[alias as keyof typeof J];
			const have = (cur[alias] ?? []).map((j: Row) => j[key]);
			if (!same(have, ids)) patch[alias] = ids.map((id, i) => ({ [key]: id, sort: i + 1 }));
		}
		const haveMsgs = (cur.actor_messages ?? []).map((m: Row) => ({ actor: m.actor, message: m.message }));
		if (!same(haveMsgs, msgs)) patch.actor_messages = msgs.map((m, i) => ({ ...m, sort: i + 1 }));

		// formats: the import owns rows with a source_key; rows added by editors are kept
		const curFormats: Row[] = cur.formats ?? [];
		const fCreate: Row[] = [], fUpdate: Row[] = [], fDelete: number[] = [];
		o.formats.forEach((f, i) => {
			const row = formatRow(f);
			const have = curFormats.find((x) => x.source_key === f.source_key);
			if (!have) fCreate.push({ ...row, sort: i + 1 });
			else if (Object.entries(row).some(([k, v]) => !same(have[k], v))) fUpdate.push({ id: have.id, ...row });
		});
		for (const x of curFormats) if (x.source_key && !o.formats.some((f) => f.source_key === x.source_key)) fDelete.push(x.id);
		if (fCreate.length || fUpdate.length || fDelete.length) patch.formats = { create: fCreate, update: fUpdate, delete: fDelete };

		if (!Object.keys(patch).length) {
			unchanged.outputs = (unchanged.outputs ?? 0) + 1;
			continue;
		}
		changes.push({ collection: 'outputs', key: o.source_key, action: 'update', fields: Object.keys(patch) });
		if (!dry) await d.patch(`/items/outputs/${cur.id}`, { ...patch, imported_at: now });
	}

	// --- typed relations (ensured; rows added by editors are never removed) ------
	for (const o of model.outputs) {
		for (const r of o.relations) {
			const from = outputIds.get(o.source_key)!;
			const to = outputIds.get(r.to)!;
			const cur = existing.find((e) => e.id === from)?.relations?.find((x: Row) => x.related_output === to && x.relation_type === r.type);
			if (cur && same(cur.note, r.note)) continue;
			changes.push({ collection: 'output_relations', key: `${o.source_key} ${r.type} ${r.to}`, action: cur ? 'update' : 'create', fields: ['note'] });
			if (dry) continue;
			if (cur) await d.patch(`/items/output_relations/${cur.id}`, { note: r.note });
			else await d.post('/items/output_relations', { output: from, related_output: to, relation_type: r.type, note: r.note, sort: 1 });
		}
	}

	// --- records in Directus that are no longer in the sheet ---------------------
	for (const e of existing) {
		if (e.source_sheet && e.source_key && !modelKeys.has(e.source_key)) {
			flags.push({ kind: 'data', title: e.title, message: `In Directus (${e.slug}) but no longer in the sheet. Not deleted: archive it in Directus if it should go.` });
		}
	}

	return { changes, unchanged, flags };
}

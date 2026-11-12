// What the import knows about the content sheet: columns, taxonomies, and
// the cross-row relations (matched by title, never by row number).

export const SHEETS = {
	deliverables: 'Deliverables & Milestones',
	publications: 'Other publications',
	legend: 'Tagging legend'
} as const;

/** Cells highlighted in this colour are unconfirmed drafts (see the legend's "Yellow cells" row). */
export const DRAFT_FILL = 'FFFFF4CC';

/**
 * Known columns per sheet (header text after trimming and collapsing whitespace).
 * - `field`: the output field the column feeds; used for `unconfirmed_fields`.
 * - `ignore`: known, import-only columns that never reach Directus.
 * Any other column is unknown: the import warns, skips it and leaves it out of the CSV export,
 * so internal or EU-reporting columns cannot leak into the public repo.
 */
export interface ColumnSpec {
	field?: string;
	ignore?: string;
}

export const COLUMNS: Record<'deliverables' | 'publications', Record<string, ColumnSpec>> = {
	deliverables: {
		Title: { field: 'title' },
		Lead: { field: 'lead_partner' },
		'Due Date': { field: 'date' },
		Status: { field: 'status' },
		'CDE content': { ignore: 'import filter' },
		'Dissemination Level': { ignore: 'import filter' },
		WP: { field: 'work_package' },
		Type: { field: 'output_type' },
		'Platform actors': { field: 'actors' },
		'Integrity principles': { field: 'principles' },
		'Key dimensions': { field: 'dimensions' },
		Abstract: { field: 'abstract' },
		'Link / DOI': { field: 'link' },
		'Associated webinar': { field: 'webinar' },
		'Associated visual / data': { field: 'visuals' },
		Teaser: { field: 'teaser' },
		'Actor key messages': { field: 'actor_messages' },
		'Alt text': { field: 'alt_text' },
		'Region focus': { field: 'regions' }
	},
	publications: {
		Lead: { field: 'lead_partner' },
		Contributor: { field: 'contributors' },
		Timeline: { field: 'date' },
		'Publication type': { field: 'output_type' },
		Status: { field: 'status' },
		'Type of PID': { field: 'pid_type' },
		'PID (publisher version of record)': { field: 'link' },
		'Type of publication': { ignore: 'EU-reporting category' },
		'Title of the Scientific publication': { field: 'title' },
		Authors: { field: 'authors' },
		'ISSN or eISSN': { field: 'issn' },
		Publisher: { field: 'publisher' },
		'Available in Open Access through repository at time of publication?': { field: 'open_access' },
		'Peer-reviewed?': { field: 'peer_reviewed' },
		'RID of Book (required for Chapters in books)': { field: 'book_rid' },
		'Book title (required for Chapters in books)': { field: 'book_title' },
		'Full reference': { field: 'citation' },
		'Platform actors': { field: 'actors' },
		Abstract: { field: 'abstract' },
		'Integrity principles': { field: 'principles' },
		'Key dimensions': { field: 'dimensions' },
		'Actor sub-tags': { field: 'actors' },
		Teaser: { field: 'teaser' },
		'Actor key messages': { field: 'actor_messages' },
		'Region focus': { field: 'regions' },
		'Associated visual / data': { field: 'visuals' },
		'Alt text': { field: 'alt_text' },
		'Draft basis': { ignore: 'editorial note for partner review' },
		'Platform relation': { field: 'relations' }
	}
};

// ---------------------------------------------------------------------------
// Taxonomies. Slugs are fixed (CLAUDE.md): ask before changing them.
// ---------------------------------------------------------------------------

export const LANGUAGES = [
	{ code: 'en', name: 'English', sort: 1 },
	{ code: 'es', name: 'Español', sort: 2 },
	{ code: 'pt-br', name: 'Português (Brasil)', sort: 3 }
];

/** Sheet label → actor. Descriptions come from the legend at import time. */
export const ACTORS = [
	{ label: 'Business', slug: 'business', name: 'Business', is_hub: true },
	{ label: 'Cities', slug: 'cities', name: 'Cities', is_hub: true },
	{ label: 'Regulators', slug: 'regulators', name: 'Regulators', is_hub: true },
	{ label: 'Carbon markets', slug: 'carbon-markets', name: 'Carbon markets', is_hub: true },
	{ label: 'CCIs', slug: 'ccis', name: 'CCIs', is_hub: true },
	{ label: 'Finance', slug: 'finance', name: 'Finance', is_hub: false, shown_in: ['business', 'ccis'] }
];

export const PRINCIPLES = [
	{ code: 'p1', label: 'P1', slug: 'accountability', short_name: 'Accountability' },
	{ code: 'p2', label: 'P2', slug: 'justice-equity', short_name: 'Justice and equity' },
	{ code: 'p3', label: 'P3', slug: 'environmental-protection', short_name: 'Environmental protection' },
	{ code: 'p4', label: 'P4', slug: 'transformation', short_name: 'Transformation' }
];

export const REGIONS = [
	{ label: 'Global', slug: 'global', name: 'Global' },
	{ label: 'Europe', slug: 'europe', name: 'Europe' },
	{ label: 'Latin America', slug: 'latin-america', name: 'Latin America' }
];

export const OUTPUT_TYPES = ['Report', 'Website', 'Policy Brief', 'Journal article', 'Blog', 'Research report', 'Detailed assessment and factsheet'];

/** Consortium partner acronyms (ACHIEVE design system README). Full names are added in Directus. */
export const PARTNERS = ['RU', 'NCI', 'PBL', 'OEKO', 'E3M', 'UEF', 'CATIE', 'SU', 'HOL', 'WWF', 'CDP', 'UOXF'];

export const WORK_PACKAGES = ['WP1', 'WP2', 'WP3', 'WP4', 'WP5', 'WP6'];

// ---------------------------------------------------------------------------
// Cross-row relations, by title (compared after normalisation: case, quotes,
// whitespace and punctuation are ignored). The sheet's "Platform relation"
// column is checked against these; a mismatch is flagged, not guessed.
// ---------------------------------------------------------------------------

/** One output shown with several formats: `format` rows become output_formats of `main`. */
export const MERGES = [
	{
		main: 'From pledges to places: action agendas need spatial data to integrate climate and biodiversity action',
		format: 'Integrating Spatial Data for Credible, Just and Synergic Non-state and Transnational Climate and Biodiversity Action'
	}
];

/** Typed links between outputs. */
export const LINKS = [
	{
		from: 'Using International Carbon Credits towards the EU 2040 Climate Target',
		to: 'Conditions for Using International Carbon Credits towards the EU’s 2040 Climate Target',
		type: 'supersedes' as const,
		note: 'partly'
	}
];

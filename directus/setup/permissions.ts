// Access model for the ACHIEVE platform: who may do what in Directus.
// Applied by setup.ts. Each managed policy's permissions are replaced on every run,
// so this file is the source of truth: change it here, not in the admin UI.

export type Action = 'create' | 'read' | 'update' | 'delete';
export interface Permission {
	collection: string;
	action: Action;
	fields?: string[];
	permissions?: Record<string, unknown> | null;
	validation?: Record<string, unknown> | null;
	presets?: Record<string, unknown> | null;
}
export interface PolicySpec {
	name: string;
	description: string;
	icon: string;
	app_access: boolean;
	admin_access: false;
	permissions: Permission[];
}

const PUBLISHED = { workflow_state: { _eq: 'published' } };
const via = (path: string, filter: Record<string, unknown>) =>
	path.split('.').reduceRight<Record<string, unknown>>((acc, key) => ({ [key]: acc }), filter);

export const TAXONOMIES = ['languages', 'actors', 'actors_shown_in', 'principles', 'dimensions', 'regions', 'output_types', 'partners'];
const TAXONOMY_TRANSLATIONS = ['actors_translations', 'principles_translations', 'dimensions_translations'];
const OUTPUT_JUNCTIONS = ['outputs_actors', 'outputs_principles', 'outputs_dimensions', 'outputs_regions', 'outputs_contributors', 'outputs_visuals'];
const OUTPUT_PARTS = ['output_actor_messages', 'output_formats', 'output_relations'];
const ROADMAP_PARTS = ['roadmap_milestones', 'roadmap_recommendations', 'roadmap_glossary', 'roadmap_links'];
const ROADMAP_JUNCTIONS = ['roadmaps_outputs', 'roadmaps_principles', 'roadmaps_dimensions'];
export const CONTENT = ['outputs', 'visuals', 'webinars', 'roadmaps', 'pages', 'feedback_prompts'];
const CONTENT_TRANSLATIONS = ['outputs_translations', 'visuals_translations', 'roadmaps_translations', 'pages_translations', 'feedback_prompts_translations'];
export const FEEDBACK_DATA = ['feedback_responses', 'community_signups'];
/** Personal data: contact details. Readable by admins only. */
export const PERSONAL_FEEDBACK_FIELDS = ['followup_email', 'followup_consent_at', 'consent_text_version'];
/** What editors see of a response: the text and its context, never contact details. */
export const EDITOR_FEEDBACK_FIELDS = [
	'id', 'date_created', 'prompt', 'stream', 'message', 'usefulness', 'page_path', 'context_output', 'context_actor', 'context_principle', 'context_dimension',
	'context_roadmap', 'context_recommendation', 'context_filters', 'respondent_actor_type', 'respondent_region', 'respondent_country',
	'followup_requested', 'triage_status', 'triage_note'
];

/** Fields that exist for editors and the import only. Never public. */
export const INTERNAL_OUTPUT_FIELDS = ['confirmed', 'unconfirmed_fields', 'source_key', 'source_sheet', 'imported_at', 'confirmation', 'import_info'];

const OUTPUT_PUBLIC_FIELDS = [
	'id', 'workflow_state', 'status', 'kind', 'code', 'title', 'slug', 'output_type', 'date', 'work_package', 'lead_partner', 'authors',
	'teaser', 'abstract', 'link', 'pid_type', 'citation', 'publisher', 'issn', 'book_rid', 'book_title', 'open_access', 'peer_reviewed', 'webinar',
	'actors', 'principles', 'dimensions', 'regions', 'contributors', 'visuals', 'actor_messages', 'formats', 'relations', 'translations',
	'date_updated'
];

const read = (collection: string, permissions: Permission['permissions'] = null, fields = ['*']): Permission => ({ collection, action: 'read', fields, permissions });
const crud = (collection: string, opts: Partial<Record<Action, Partial<Permission>>> = {}): Permission[] =>
	(['create', 'read', 'update', 'delete'] as Action[]).map((action) => ({ collection, action, fields: ['*'], permissions: null, ...opts[action] }));

// ---------------------------------------------------------------------------
// Public (no login): published content only. No feedback data, no internal fields.
// The PUBLIC_FILES_FOLDER placeholder is replaced with the "Public" folder id.
// ---------------------------------------------------------------------------
export const PUBLIC_FILES_FOLDER = '$PUBLIC_FILES_FOLDER';

export const publicPermissions: Permission[] = [
	...TAXONOMIES.map((c) => read(c)),
	...TAXONOMY_TRANSLATIONS.map((c) => read(c)),
	read('outputs', PUBLISHED, OUTPUT_PUBLIC_FIELDS),
	...OUTPUT_JUNCTIONS.map((c) => read(c, via('outputs_id', PUBLISHED))),
	read('outputs_translations', via('outputs_id', PUBLISHED)),
	read('output_actor_messages', via('output', PUBLISHED)),
	read('output_formats', via('output', PUBLISHED), ['id', 'output', 'output_type', 'title', 'link', 'pid_type', 'publisher', 'date', 'sort']),
	read('output_relations', { _and: [via('output', PUBLISHED), via('related_output', PUBLISHED)] }),
	read('visuals', null, ['id', 'filename', 'file', 'alt_text', 'html_text', 'interactive', 'embed_url', 'outputs', 'translations']),
	read('visuals_translations'),
	read('webinars', null, ['id', 'url', 'title', 'date', 'recording_url', 'outputs']),
	read('roadmaps', PUBLISHED),
	...ROADMAP_PARTS.map((c) => read(c, via('roadmap', PUBLISHED))),
	...ROADMAP_JUNCTIONS.map((c) => read(c, via('roadmaps_id', PUBLISHED))),
	read('roadmaps_translations', via('roadmaps_id', PUBLISHED)),
	read('pages', PUBLISHED),
	read('pages_translations', via('pages_id', PUBLISHED)),
	read('feedback_prompts', { status: { _eq: 'active' } }, ['id', 'key', 'question', 'stream', 'placement', 'open_until', 'translations']),
	read('feedback_prompts_translations', via('feedback_prompts_id', { status: { _eq: 'active' } })),
	read('directus_files', { folder: { _eq: PUBLIC_FILES_FOLDER } }, ['id', 'title', 'description', 'type', 'filesize', 'width', 'height', 'filename_download', 'modified_on'])
];

// ---------------------------------------------------------------------------
// Service accounts (API only, static token, no Studio access → no seat).
// ---------------------------------------------------------------------------
const STREAMS = ['comment', 'suggest_research', 'share_challenge'];

/** Used by the SvelteKit server to store form submissions. Write-only. */
export const feedbackWriter: PolicySpec = {
	name: 'Feedback writer',
	description: 'Service account for the website: creates feedback responses and community sign-ups. Cannot read them back.',
	icon: 'edit_note',
	app_access: false,
	admin_access: false,
	permissions: [
		{
			collection: 'feedback_responses',
			action: 'create',
			fields: ['prompt', 'stream', 'message', 'usefulness', 'page_path', 'context_output', 'context_actor', 'context_principle', 'context_dimension', 'context_roadmap', 'context_recommendation', 'context_filters', 'respondent_actor_type', 'respondent_region', 'respondent_country', 'followup_email', 'followup_consent_at', 'consent_text_version', 'followup_requested'],
			validation: {
				_and: [
					{ stream: { _in: STREAMS } },
					// a response needs a message or a usefulness rating
					{ _or: [{ message: { _nnull: true } }, { usefulness: { _in: ['very_useful', 'somewhat', 'not_really'] } }] },
					// an email is only accepted together with its consent timestamp
					{ _or: [{ followup_email: { _null: true } }, { followup_consent_at: { _nnull: true } }] },
					// the flag editors see must match whether an email was given
					{ _or: [{ _and: [{ followup_email: { _null: true } }, { followup_requested: { _eq: false } }] }, { _and: [{ followup_email: { _nnull: true } }, { followup_requested: { _eq: true } }] }] }
				]
			},
			// Directus validates only the fields present in the payload; presets make
			// sure the consent fields are always there, so the rules above apply.
			presets: { message: null, usefulness: null, followup_email: null, followup_consent_at: null, followup_requested: false }
		},
		{
			collection: 'community_signups',
			action: 'create',
			fields: ['email', 'consent_at', 'consent_text_version', 'locale'],
			validation: { _and: [{ email: { _nnull: true } }, { consent_at: { _nnull: true } }] },
			presets: { consent_at: null }
		}
	]
};

/** Used by scripts/import. Manages content and taxonomies; no access to feedback data or pages. */
export const importer: PolicySpec = {
	name: 'Importer',
	description: 'Service account for the content-sheet import (scripts/import).',
	icon: 'sync',
	app_access: false,
	admin_access: false,
	permissions: [
		...[...TAXONOMIES, ...TAXONOMY_TRANSLATIONS, 'outputs', 'visuals', 'webinars', 'roadmaps', 'feedback_prompts', ...OUTPUT_JUNCTIONS, ...OUTPUT_PARTS, ...ROADMAP_PARTS, ...ROADMAP_JUNCTIONS, 'outputs_translations', 'visuals_translations', 'roadmaps_translations', 'feedback_prompts_translations'].flatMap((c) => crud(c)),
		read('directus_files'),
		read('directus_folders')
	]
};

// ---------------------------------------------------------------------------
// People (Studio access → each active user takes a seat).
// ---------------------------------------------------------------------------

/**
 * ACHIEVE partners: edit outputs, visuals, webinars and roadmaps, and triage feedback.
 * They see a response's text and context, never contact details or community sign-ups
 * (admins only). Taxonomies, static pages and feedback prompts are admin-only.
 */
export const editor: PolicySpec = {
	name: 'Editor',
	description: 'ACHIEVE partners: edit outputs, visuals, webinars and roadmaps; read and triage feedback responses without contact details.',
	icon: 'edit',
	app_access: true,
	admin_access: false,
	permissions: [
		...TAXONOMIES.map((c) => read(c)),
		...TAXONOMY_TRANSLATIONS.map((c) => read(c)),
		...crud('outputs', {
			update: { fields: editableOutputFields() },
			create: { fields: editableOutputFields() },
			delete: { permissions: { workflow_state: { _eq: 'draft' } } }
		}),
		...['visuals', 'webinars'].flatMap((c) => crud(c)),
		...crud('roadmaps', { delete: { permissions: { workflow_state: { _eq: 'draft' } } } }),
		...[...OUTPUT_JUNCTIONS, ...OUTPUT_PARTS, ...ROADMAP_PARTS, ...ROADMAP_JUNCTIONS, 'outputs_translations', 'visuals_translations', 'roadmaps_translations'].flatMap((c) => crud(c)),
		read('pages'),
		read('pages_translations'),
		read('feedback_prompts'),
		read('feedback_prompts_translations'),
		read('feedback_responses', null, EDITOR_FEEDBACK_FIELDS),
		{ collection: 'feedback_responses', action: 'update', fields: ['triage_status', 'triage_note'] },
		...crud('directus_files', { delete: { permissions: { uploaded_by: { _eq: '$CURRENT_USER' } } } }),
		read('directus_folders')
	]
};

/* Retired 2026-11-03: merged into Editor; personal data moved to admins only. */
function editableOutputFields(): string[] {
	// Directus has no field deny-list, so list what editors may write
	// (everything except INTERNAL fields owned by the import).
	return [
		'confirmed', 'workflow_state', 'status', 'kind', 'code', 'title', 'slug', 'output_type', 'date', 'work_package', 'lead_partner', 'authors',
		'teaser', 'abstract', 'link', 'pid_type', 'citation', 'publisher', 'issn', 'book_rid', 'book_title', 'open_access', 'peer_reviewed', 'webinar',
		'actors', 'principles', 'dimensions', 'regions', 'contributors', 'visuals', 'actor_messages', 'formats', 'relations', 'translations'
	];
}

export const POLICIES: PolicySpec[] = [editor, feedbackWriter, importer];
/** Removed policies and roles; setup.ts deletes them if they still exist. */
export const RETIRED = { policies: ['Feedback manager'], roles: ['Feedback manager'] };

/** Roles group policies for assignment to users. */
export const ROLES = [
	{ name: 'Editor', icon: 'edit', description: 'ACHIEVE partners: content and feedback triage', policies: ['Editor'] },
	{ name: 'Website service', icon: 'dns', description: 'API-only account for the SvelteKit server', policies: ['Feedback writer'] },
	{ name: 'Import service', icon: 'sync', description: 'API-only account for the content-sheet import', policies: ['Importer'] }
];

/** API-only users with static tokens (no Studio access, so no seat). */
export const SERVICE_USERS = [
	{ first_name: 'Website', last_name: 'service', role: 'Website service', tokenEnv: 'DIRECTUS_FEEDBACK_TOKEN' },
	{ first_name: 'Import', last_name: 'service', role: 'Import service', tokenEnv: 'DIRECTUS_IMPORT_TOKEN' }
];

# ACHIEVE stakeholder platform

Online stakeholder engagement platform for the Horizon Europe project ACHIEVE
(grant agreement 101137625), delivered under Task 4.2. ACHIEVE studies the
integrity of voluntary climate pledges and actions. Scope is international,
with a focus on Europe and Latin America. Hosted and maintained by HOL.

Core message the platform must carry: high-integrity action is more than net
zero and Paris alignment.

## Decisions

Record every decision that changes the stack, the content model, routes or hosting in
[`docs/decisions.md`](docs/decisions.md) (newest first, with date and reason), and update the
sections below to match. Current state: the backend is moving from Directus to headless
Drupal on Hostinger web hosting; Portuguese is `pt-br`.

## Stack

- **CMS:** Directus 12 under the Open Innovation Grant licence (granted to HOL). Matches the I2AM PARIS stack. **Being replaced by Drupal (see Decisions).**
  The key goes in `LICENSE_KEY` in `.env` (never committed). It binds to the
  Directus project and `PUBLIC_URL`, and the grant allows a limited number of
  activations, so do not throw away the local database volume
  (`docker compose down -v`) without reason. Without a key Directus runs on
  the Core tier (25 collections, 3 seats, no custom permission rules), which
  this schema exceeds.
- **Frontend:** SvelteKit + TypeScript.
- **Database:** PostgreSQL.
- **Local dev:** Docker Compose (Directus + Postgres), SvelteKit dev server.
- **Feedback/survey:** a Directus collection behind SvelteKit forms (the Grant Agreement's "integrated survey tool"). Data stays in our EU-hosted database.

## Sources of truth

| What | Where | Notes |
| --- | --- | --- |
| Content model, page tree, tag rules, feedback placement | `docs/content-model.md` | Exported from the shared doc. Do not change the model in code without updating this file. |
| Content | `data/achieve-cde-content.xlsx` | Public copy of the consortium sheet; versions tracked by git (tags `content-v6`, `content-v7`…). Until public launch; after launch, editors work in Directus. |
| Database structure | `directus/snapshot.yaml` | See "Schema workflow". |
| Roles, permissions, flows | `directus/setup/` scripts | Not covered by the schema snapshot. Access rules: `directus/setup/permissions.ts`; apply with `npm run setup`. |
| Deployment | `docker-compose.prod.yml`, `deploy/`; guide in `docs/internal/deploy-hostinger.md` | Demo on a Hostinger VPS behind Caddy (HTTPS, shared password). |
| Internal docs | `docs/internal/` (git-ignored, never published) | Hosting account notes (`hosting.md`), deployment guide, privacy-notice inputs, one-off operations scripts (`scripts/`). |
| Frontend/import types | `types/directus-schema.ts` | Generated from the snapshot by `npm run typegen`. Do not edit. |

## Schema workflow

The Directus database holds the live schema; git holds the snapshot.

1. Change the schema (edit `directus/snapshot.yaml` or use the Directus API on the local instance).
2. Apply locally: `docker compose exec directus node cli.js schema apply --yes /directus/project/snapshot.yaml`.
3. After changes made in the admin UI, export: `docker compose exec directus node cli.js schema snapshot --yes /directus/project/snapshot.yaml`.
   (The Directus 12 image has no `npx`; `./directus` is mounted at `/directus/project`.)
4. Commit the snapshot with the code that depends on it, in the same commit.
5. Data changes go in separate, idempotent migration or import scripts, never in the snapshot.

Regenerate the frontend TypeScript types from the schema after every schema change
(`npm run schema:snapshot` exports and runs `npm run typegen`). Then run `npm test`:
the access-model tests run against the local Directus.

## Fixed content model

Treat these as fixed unless the content model doc changes.

**Actors (primary navigation axis).** Hub slugs: `business`, `cities`,
`regulators`, `carbon-markets`, `ccis`.

**Finance** is a sixth record in the Actor collection with `is_hub = false`
and `shown_in = [business, ccis]`. Rules:
- It has no hub page. Anything that lists hubs (menu, home tiles, coverage
  grid, roadmaps) filters on `is_hub = true`.
- Finance items always also carry Business and/or CCIs, so hubs list them
  through their normal tags. On the hubs in `shown_in`, the Finance tag only
  adds a "Finance" filter chip.
- Finance is never the first actor on an item. The import appends it after
  the hub actors.
- The rule lives in these two fields, not in frontend code. A Finance hub
  later means setting `is_hub = true` and adding the page.

**Integrity principles (secondary axis).** Slugs: `accountability` (P1),
`justice-equity` (P2), `environmental-protection` (P3), `transformation` (P4).
Each has five dimensions (20 in total), listed in the spreadsheet's
"Tagging legend" sheet. Every dimension belongs to exactly one principle.

**Tag order matters.** Actor and principle tags are ordered, most relevant
first. Store the order (sort field on the junction table). The first actor
decides which hub features an item; the first principle sets the card colour.

**Content types:** Output (one type for deliverables, milestones and
publications), Visual, Webinar, Roadmap, Feedback prompt, Feedback response,
plus the Actor, Principle, Dimension, Region, Output type and Partner
taxonomies. Field-by-field mapping from spreadsheet columns is in
`docs/content-model.md`.

**Roadmap template (one per actor, finalised during 2027).** Ten sections:
timeline (next 1-2 years, 2030, 2050), summary, audiences, context and added
value, integrity issues (tagged by principle/dimension), barriers, enablers,
recommendations (who, what, by when, principle), references (Output links),
glossary. Until then, roadmaps show as "in preparation".

## Routes

`/`, `/actors/[actor]`, `/principles`, `/principles/[principle]`, `/roadmaps`,
`/roadmaps/[actor]`, `/library`, `/library/[slug]`, `/have-your-say`,
`/have-your-say/thank-you`, `/about`, `/privacy`, `/cookies`, `/accessibility`,
`/legal-notice`.

Output slugs are set once, at first import, and never regenerated (editors may
change them in Directus):
- Deliverables and milestones: the code, e.g. `d2-2`, `ms9`.
- Publications: the main title (before the first `:` or ` - `), lowercased
  ASCII, without a leading article, at most 6 words and 50 characters, cut at
  a word boundary, no trailing stop word. On a clash, append the year.

Hubs and principle pages are preset library queries. Every filtered view must
have a shareable URL (for example `/library?actor=cities&principle=p2`).

## Drupal backend (`drupal/`) — replacing Directus

- Drupal 11 (Composer project, Drush 13), headless: JSON:API **read-only**, used by the
  SvelteKit server. Contrib modules: Paragraphs (+ Entity Reference Revisions) and Admin
  Toolbar only; add others only after asking (each one adds security updates).
- Local: DDEV (`cd drupal && ddev start`), PHP 8.3 and MariaDB 11.8 as on Hostinger, at
  `http://achieve-cms.ddev.site:8580` (router ports 8580/8543, because Docker Desktop cannot
  open 80/443 here). Admin login: `ddev drush user:login`.
- **Config is the source of truth for the content model** (`drupal/config/sync`): change it
  in the admin UI or code, then `ddev drush config:export`, commit with the code that needs
  it. A fresh site is built with `drush site:install --existing-config`; deployments apply it
  with `drush deploy`. Content is not in git.
- Secrets and per-environment values live in `web/sites/default/settings.local.php` (git
  ignores it; template `settings.local.php.example`): database, hash salt, trusted host,
  `achieve_feedback_secret`. `settings.php` is tracked and holds no secrets.
- Custom modules:
  - `achieve_core`: internal output fields (`field_confirmed`, `field_unconfirmed_fields`,
    `field_source_key`, `field_source_sheet`, `field_imported_at`) are never public;
    import-owned fields are not editable in the UI; unique slugs, codes and keys; editors
    delete only unpublished outputs and roadmaps; no user names or authorship for
    anonymous visitors.
  - `achieve_feedback`: `feedback_response` and `community_signup` entities (internal: not
    in JSON:API; no IP, no revisions). Editors (permission "triage achieve feedback") see
    responses without contact details and edit only the triage status and note; emails and
    sign-ups are admin-only. The website posts to `/api/achieve/feedback` and
    `/api/achieve/signup` with the `X-Achieve-Secret` header; the endpoint applies the same
    rules as the website forms.
- Content model: taxonomies `actor`, `principle`, `dimension`, `region`, `output_type`,
  `partner`; content types `output`, `webinar`, `roadmap`, `page`, `feedback_prompt`;
  Paragraphs `actor_message`, `format`, `relation`, `milestone`, `recommendation`,
  `glossary_term`; media type `infographic`. Ordered tags are multi-value reference fields
  (Drupal keeps the order); "workflow state" is the node's published status. Mapping in
  `docs/content-model.md`.
- Roles: Editor (partners) and Administrator (HOL). Anonymous: `access content`, `view media`.
- Tests: `npx vitest run drupal` (root) runs `drupal/tests/drupal.test.ts` against DDEV:
  public JSON:API, the feedback endpoint, and editor/anonymous access via
  `tests/probe.php`. Needs `DRUPAL_FEEDBACK_SECRET` in the root `.env` (same value as in
  the local `settings.local.php`).

## Frontend (`web/`)

- SvelteKit 3 (`#lib/…` imports with file extensions, `$app/state`), adapter-node, server-rendered so
  filters and forms work without JavaScript. `cd web && npm run dev`; tests: `npm test`
  (filters, forms, formatting) and `npm run test:a11y` (axe WCAG 2.1 AA, console errors,
  keyboard use of the filters, at 1440 and 390 px; run against a build: `node build`).
- The site reads Directus with **no token** (it sees exactly what the public role allows) and writes
  feedback with `DIRECTUS_FEEDBACK_TOKEN` from the server only.
- Build for a server with `SITE_ORIGIN=https://…` (sets `paths.origin`; CSRF checks on form posts
  need it). The dev server skips CSRF checks; production does not.
- Design system: vendored, unmodified, in `web/src/lib/design-system/` (see its README); site styles
  in `web/src/lib/styles/app.css`. Layouts follow the "ACHIEVE platform screens" design.
- Pages not built yet (`/principles`, `/roadmaps`) show the designed 404. Static pages (`/about`,
  legal) render from the Directus `pages` collection and 404 until published.
- Locales: English at the root; `es`/`pt` are routed under `/[lang]` once enabled in
  `web/src/lib/i18n/locales.ts`.
- Project copy that is not in the sheet (feedback prompts, hub descriptions and intros, roadmap
  records) is seeded by `npm run seed` (idempotent; never overwrites edits).

## Import rules (`scripts/import`)

- **Deliverables & Milestones:** import only rows with `CDE content = Yes` and
  `Dissemination Level = Public`. Blank `Status` means Upcoming.
- **Other publications:** import all rows.
- Multi-value cells are separated by `"; "`; keep the order.
- `Actor sub-tags` (Other publications): add these to the item's actors,
  after the `Platform actors` values (currently only "Finance").
- `Actor key messages`: one `Actor: message` line per actor; split into
  repeating actor + message entries.
- `Alt text`: one `file: text` entry per visual file.
- `Platform relation`: rows 15 and 18 become one Output with two formats;
  row 21 links to row 10 as "supersedes".
- `Lead` and `Contributor` hold partner acronyms. Contributors are separated by
  commas (not `"; "`). Normalise to the acronym and report the change: drop
  anything after it, such as `WWF+3:20` → `WWF` or `RU (Sander, Sebastian)` → `RU`.
- Yellow cells are unconfirmed drafts. Import them, but keep a `confirmed`
  flag (false) so partners can sign them off before the public launch. The
  flag is an editorial note in Directus only (a toggle plus the list of
  still-unconfirmed fields); the public site shows the content without a
  draft label.
- `Draft basis` is an editorial note for partner review: do not import it.
- Text that is only a bracketed note (`[Add one from the full report…]`) in key messages, teasers
  or alt text is an editorial note too: never imported, always flagged.
- The repo is public. The sheet in `data/` is a public copy: internal and
  EU-reporting columns (costs, EU portal status, Grant Agreement text and
  similar) were removed and must never be added back to the repo. If the
  import script meets an unknown column, warn and skip it.
- Also write each sheet to `data/export/<sheet>.csv` on every run and commit
  them, so content changes show up as readable diffs. File names are the
  slugged sheet names (`deliverables-milestones.csv`, `other-publications.csv`,
  `tagging-legend.csv`); content sheets keep known columns only, plus the row
  number and the list of yellow columns.
- The import must be idempotent: re-running it after partners correct the
  sheet updates records instead of duplicating them.
- Usage: `npm run import` (`-- --dry-run` to preview, `-- --offline` to check
  the sheet without Directus). The report goes to
  `scripts/import/reports/latest.md`; relations between rows are configured by
  title in `scripts/import/config.ts`.
- Until launch the sheet owns the content: each run overwrites the
  sheet-sourced fields, including the `confirmed` toggle (derived from the
  yellow cells). Partners confirm by removing the highlight in the sheet. The
  import never changes `slug` or `workflow_state` of existing records, never
  deletes records (it flags those no longer in the sheet), and keeps formats
  and relations added by editors.

## Feedback

Three streams from the Grant Agreement: comment on our work, suggest
research, share a challenge. One prompt per page, at most three questions
inline, linking to `/have-your-say`. Each response stores the page context
(output, actor, principle or roadmap) automatically. Placement table is in
`docs/content-model.md`.

## Compliance checks (every feature)

- **GDPR:** feedback is anonymous by default. Ask for an email only for
  follow-up or community sign-up, each with its own unticked consent box.
  No third-party trackers; use cookie-free analytics or ask consent first.
  EU hosting only.
- **Accessibility, WCAG 2.1 AA:** every visual needs alt text and its text
  as HTML. Filter chips are keyboard-operable and announce result counts.
  Interactive charts have a table fallback. Check contrast in both themes.
- **EU funding visibility:** EU emblem, "Funded by the European Union" and
  the standard disclaimer in every footer; grant number on `/about`.

## Languages

Content is written in English. Build with i18n from the start (Directus
translations + SvelteKit locale routing) so Spanish and Portuguese can be
added. First candidates: the "Bridging Levels" brief, the Cities and CCIs
hubs, all feedback prompts, and roadmap summaries.

## Working conventions

- Small commits; schema snapshot and dependent code in the same commit.
- Write tests for the import script and the library filters.
- Do not invent research findings, numbers or quotes in placeholder content;
  use content from the spreadsheet or clearly marked lorem text.
- Ask before changing the actor or principle taxonomy, route structure or
  slugs. These are expensive to change after launch.
- The repository is public. Keep account identifiers (hosting user IDs, server names,
  non-public site addresses), credentials and one-off operations scripts in
  `docs/internal/`, never in tracked files, commit messages or CLAUDE.md. Tracked files
  hold only what is needed to build and run the project.

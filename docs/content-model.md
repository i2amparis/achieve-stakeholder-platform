# ACHIEVE platform: sitemap and content model

Oct 6, 2026 · @George

## Scope and ground rules

The platform launches with 35 outputs from *ACHIEVE\_CDE\_Content\_v6.xlsx*: 15 deliverables and milestones flagged `CDE content = Yes` (7 completed, 8 due Dec 2026 – Oct 2027) and 20 published items from *Other publications*. Every one of them already carries at least one actor tag and one principle tag, so the actor × principle model can run on real content from day one.

Rules the model follows:

- **Actors are the primary axis.** They drive the main menu, the hubs and the default filter. Principles are the secondary axis: they cut across actors and appear as filters and on their own pages.
- **Tags are ordered.** The spreadsheet puts the most relevant value first; the platform keeps that order. The first actor decides which hub features an item; the first principle decides its colour on cards.
- **Only public items are imported.** Rows with `Dissemination Level = Classified` (9) or `CDE content = No` (37) never reach the CMS.
- **The spreadsheet stays the source of truth until launch.** Each column maps to one CMS field (see Content types); after launch, editors work in the CMS and the sheet is retired or exported back for EU reporting.

## Page tree

Seven sections sit under Home: six in the main menu, in the order below, and Legal in the footer. Actor hubs come first because they are the main way in.

&#91;embedded content: page tree · 7 sections under Home\]

The table below gives each template's URL pattern, what it shows and which fields feed it.

| Page | URL | What it shows | Fed by |
| --- | --- | --- | --- |
| Home | `/` | Core message (high integrity is more than net zero and Paris alignment); five actor tiles; four principle tiles; three newest outputs; next upcoming output; feedback teaser | Output teasers and dates; actor and principle intros |
| Actor hub (×5) | `/actors/business`, `/cities`, `/regulators`, `/carbon-markets`, `/ccis` | Intro on the actor's integrity questions; ACHIEVE key messages for this actor; outputs filtered to the actor, with principle chips (P1–P4) and counts; coming soon; roadmap teaser; feedback prompt | Output: `actors`, `actor_messages`, `principles` |
| Principles overview | `/principles` | The framework as an interactive graphic; the actor × principle grid, each cell linking to a filtered library view | D1.3 infographic, `ACHIEVE_integrity_framework.png`; tag counts |
| Principle page (×4) | `/principles/accountability`, `/justice-equity`, `/environmental-protection`, `/transformation` | Definition; its five dimensions as chips; outputs filtered to the principle, grouped by actor; feedback prompt | Output: `principles`, `dimensions`, `actors` |
| Roadmaps overview | `/roadmaps` | Five roadmap cards with status (in preparation until 2027); how the roadmaps connect | Roadmap: status, summary |
| Roadmap (×5) | `/roadmaps/<actor>` | The 10-section template: timeline, summary, audiences, context, integrity issues, barriers, enablers, recommendations, references, glossary | Roadmap type; references point to Outputs |
| Library | `/library` | Search plus facets: actor, principle, dimension, output type, region, year, status | All Outputs |
| Output page | `/library/<slug>` | Teaser, abstract, key messages by actor, visual with HTML text, link or DOI, citation, related items; feedback prompt | Output fields |
| Have your say | `/have-your-say` | Three prompts: comment on our work, suggest research, share a challenge; then a thank-you page | Feedback prompts |
| About | `/about` | Project and aims, consortium, Task 4.2 and how stakeholder input is used, join the community, contact | Static pages |
| Legal (footer) | `/privacy`, `/cookies`, `/accessibility`, `/legal-notice` | Privacy notice, cookie notice, accessibility statement, legal notice; the EU emblem and funding statement appear in every footer | Static pages |

## Content types and fields

Both sheets map into one **Output** type, so the library, hubs and filters treat a deliverable and a policy brief the same way. Two supporting types come from the sheet too (**Visual**, **Webinar**). **Actor**, **Principle**, **Dimension**, **Roadmap** and **Feedback prompt** are defined by the project, not the sheet.

### Output

| Field | Type | From *Deliverables & Milestones* | From *Other publications* | On the site |
| --- | --- | --- | --- | --- |
| `title` | text | Title (text after "D2.2 - ") | Title of the Scientific publication | Yes |
| `code` | text | Title (prefix: D2.2, MS9) | — | Yes |
| `kind` | Deliverable / Milestone / Publication | From the code prefix | Always Publication | Yes |
| `output_type` | term | Type | Publication type | Facet |
| `lead_partner` | Partner term | Lead | Lead | Yes |
| `contributors` | Partner terms | — | Contributor | Yes |
| `authors` | text | — | Authors | Yes |
| `date` | date | Due Date | Timeline | Facet (year) |
| `status` | Published / Upcoming | Status (blank = Upcoming) | Status | Facet |
| `work_package` | term | WP | — | Secondary |
| `actors` | Actor terms, ordered | Platform actors | Platform actors | Navigation |
| `principles` | Principle terms, ordered | Integrity principles | Integrity principles | Navigation |
| `dimensions` | Dimension terms | Key dimensions | Key dimensions | Facet |
| `regions` | Global / Europe / Latin America | Region focus | **Region focus** | Facet |
| `teaser` | text, max 200 characters | Teaser | **Teaser** | Cards |
| `abstract` | rich text | Abstract | Abstract | Output page |
| `actor_messages` | repeating: actor + message | Actor key messages, one "Actor: message" line each | **Actor key messages** | Hubs, output page |
| `link` | URL | Link / DOI | PID (publisher version of record) | Yes |
| `pid_type` | DOI / URL | inferred from the link | Type of PID | Internal |
| `citation` | text | — | Full reference | Copy-citation box |
| `publisher`, `issn`, `book_rid`, `book_title` | text | — | Publisher; ISSN or eISSN; RID of Book; Book title | Citation block |
| `open_access`, `peer_reviewed` | yes/no | — | Available in Open Access…; Peer-reviewed? | Badges |
| `webinar` | Webinar reference | Associated webinar | — | Output page |
| `visuals` | Visual references | Associated visual / data (split on "; ") | — | Output page, hubs |
| `ga_description` | text | Grant Agreement Description | — | Internal |
| `related` | Output references | — | from Tagging note (pairs, supersedes) | Output page |

Import-only and EU-reporting columns stay out of the CMS or sit in a hidden admin group: CDE content, Dissemination Level, In EU Portal?, Type of publication, Did you charge Open Access fees, Article processing costs, Result Type, Key results (KER), Activity & description, Tagging note. The cost columns should never be exposed by the site's API.

### Visual

| Field | Type | Source | Notes |
| --- | --- | --- | --- |
| `file` | PDF, PNG or SVG | Associated visual / data (one per file name) | 6 files today, all project files |
| `alt_text` | text | Alt text, the "file: text" part | Required before publishing |
| `html_text` | rich text | new | The infographic's full text as HTML (legend rule; WCAG 2.1 AA) |
| `interactive` | yes/no + embed | new | For the graphics rebuilt as interactive charts |
| `output` | Output reference | the row it came from |  |

### Webinar

`title`, `date`, `url` (from Associated webinar; two today, on achieveproject.eu), `recording` (new), `outputs` (references).

### Taxonomies

| Term set | Values | Source |
| --- | --- | --- |
| Actor | Business, Cities, Regulators, Carbon markets, CCIs; Finance as a sixth actor with no hub (is\_hub = false, shown\_in = Business, CCIs): finance items keep their Business/CCIs tags, and Finance adds a filter chip on those two hubs | Tagging legend |
| Principle | P1 Integrated accountability, P2 Justice and equity, P3 Environmental protection, P4 Low-carbon and resilient transformation | Tagging legend |
| Dimension | 20 terms, 5 per principle, each tied to its parent principle | Tagging legend |
| Region | Global, Europe, Latin America | Tagging legend |
| Output type | Report, Website, Policy Brief, Journal article, Blog, Research report, Detailed assessment and factsheet | Type; Publication type |
| Partner | Lead codes (RU, PBL, OEKO, NCI, UEF, HOL, WWF, UOXF…) | Lead; Contributor |

### Roadmap (one per actor)

| Field | Type | Template section |
| --- | --- | --- |
| `actor` | Actor term | — |
| `status` | In preparation / Draft for comment / Final | — |
| `milestones` | repeating: horizon (next 1–2 years, 2030, 2050) + date + text | 1. Visual timeline |
| `summary` | text, 100–150 words | 2. Short summary |
| `audiences` | terms, multi | 3. Target audience |
| `context` | rich text | 4. Context and added value |
| `integrity_issues` | rich text + Principle and Dimension tags | 5. Integrity issues |
| `barriers` | rich text | 6. Barriers |
| `enablers` | rich text | 7. Enabling factors and pathways |
| `recommendations` | repeating: who + what + by when + principle | 8. Recommendations (3–5) |
| `references` | Output references + external links | 9. References |
| `glossary` | repeating: term + definition | 10. Glossary |

### Feedback prompt

`question`, `stream` (Comment on our work / Suggest research / Share a challenge), `placement` (page or template), `context` (the Output, Actor, Principle or Roadmap the answer is about, captured automatically), `form` (link to the survey tool), `research_tasks` (T1.1, 1.2, 1.3, 3.1, 3.4, 4.3, 5.2, 5.3 that read the answers), `open_until` (date).

## How actor and principle tags drive navigation

The actor tag decides where a visitor enters; the principle tag decides how they narrow down. Every hub and principle page is a saved library query, so each filtered view has its own shareable URL (`/library?actor=cities&principle=p2`).

1. **Main menu.** "Who are you?" lists the five actors and opens `/actors/<slug>`.
2. **Actor hub.** Lists every Output whose `actors` include the hub's actor. Outputs where it is the *first* actor fill the three featured slots, newest first. The key-messages block pulls that actor's line from `actor_messages` across all outputs.
3. **Principle chips on a hub.** P1–P4 filter the list in place and show counts. Picking a principle reveals its five dimension chips. Chips with no items are hidden, not greyed.
4. **Principle page.** The inverse view: outputs tagged with the principle, grouped under the five actors, with dimension chips as the filter.
5. **Actor × principle grid** (`/principles`). Twenty cells, each with a count and a link to the filtered library.
6. **Cards.** Actor badges in tag order; the card's colour comes from the first principle.
7. **Related items.** Explicit `related` links first, then outputs sharing the first actor and at least one principle.
8. **Roadmaps.** Each roadmap belongs to one actor hub. Its recommendations carry principle tags, so they also surface on principle pages.
9. **Feedback.** A prompt inherits the actor, principle or output of the page it sits on, so responses arrive pre-tagged (next section).

### Coverage today

Every cell in the grid has at least five published outputs, so no hub or principle filter launches empty. Counts are published items, with upcoming items in brackets.

| Actor | P1 Accountability | P2 Justice and equity | P3 Environment | P4 Transformation |
| --- | --- | --- | --- | --- |
| Regulators | 19 (+4) | 11 (+2) | 12 (+2) | 11 (+4) |
| CCIs | 16 (+4) | 8 (+1) | 9 (+1) | 8 (+5) |
| Business | 12 (+3) | 6 (+1) | 6 (+2) | 8 (+4) |
| Carbon markets | 11 (+2) | 6 (+1) | 8 (+2) | 6 (+2) |
| Cities | 11 (+3) | 7 (+2) | 7 (+1) | 5 (+4) |

P1 is on 32 of the 35 outputs, so the P1 chip barely narrows a list. On P1 views, the dimension chips (target coherence, monitoring & verification…) do the real filtering. Of the 20 dimensions, 19 are used; *sustainable resource use* has no items yet.

## Where each feedback prompt sits

Each of the three streams in the Grant Agreement has a fixed home, and every prompt records the page it came from. One prompt per page, at most three questions inline, with a link to the full form at `/have-your-say`.

| Placement | Prompt (draft wording) | Stream | Captured with the answer | Read by |
| --- | --- | --- | --- | --- |
| Output page, published | "Is this useful for your work? What is missing?" | Comment on our work | Output, its actors and principles | The output's lead partner |
| Output page, upcoming (8 items) | "What should this report answer for you?" | Suggest research | Output, due date | The output's lead, before publication |
| Actor hub, after the key messages | "What is the biggest integrity challenge your organisation faces right now?" | Share a challenge | Actor | Roadmap author for that actor (D4.6) |
| Principle page, after the dimensions | "Which part of this principle is hardest to apply in practice?" | Share a challenge | Principle, selected dimension | Framework team (WP1) |
| Roadmap page, under each recommendation (draft-for-comment phase, 2027) | "Could your organisation act on this, and by when?" | Comment on our work | Roadmap, section, recommendation | Roadmap author |
| Library, below results and on "no results" | "Didn't find what you need? Suggest a topic." | Suggest research | Active filters | Task 4.2 team |
| Home | Teaser with three buttons, one per stream | All three | Stream | — |
| `/have-your-say` | Full form: stream, free text, optional actor type, region and country | All three | Everything the visitor chooses to give | Task 4.2 team, then routed |
| Thank-you page | Optional sign-up to the stakeholder community | Community | Email, with its own consent | Task 4.2 team |

The routing column ties each answer to the co-creation tasks listed in the Grant Agreement (T1.1, 1.2, 1.3, 3.1, 3.4, 4.3, 5.2, 5.3). The exact task per prompt is for the task leads to confirm.

### Questions for partners

- [ ] **Task leads (T1.1, 1.2, 1.3, 3.1, 3.4, 4.3, 5.2, 5.3):** Which prompt should feed your task, and what do you most need to hear from stakeholders?
- [ ] **Output leads:** Who on your team reads comments on your outputs, and how soon can they reply?
- [ ] **Roadmap authors (D4.6):** When will each roadmap be ready for comment, and which recommendations should be open for comment?
- [ ] **WP1 framework team:** Should answers from the principle pages feed further work on the framework?
- [ ] **All partners:** Does the draft wording work for your stakeholders? What would you change?
- [ ] **Latin American partners (CATIE):** Which prompts need Spanish or Portuguese versions at launch?
- [ ] **All partners:** Does anyone already use a GDPR-compliant survey tool (EUSurvey, for example)? Who should hold the response data?

## Fixes before import, and compliance flags

All spreadsheet fixes below are done in v6. Only the partner check of the highlighted cells remains, before the public launch.

### Spreadsheet fixes

- [x] Add Teaser, Actor key messages, Region focus, Associated visual and Alt text columns to *Other publications*, matching the first sheet.
- [x] Add a Finance tag to finance items. Finance is a filter on the Business and CCIs hubs, not a separate hub, so each finance item also needs Business, CCIs or both as its actor tag. Update the legend line that parks finance under Business "pending a decision".
- [x] Resolve the two flagged actor tags: Carbon markets on "Net zero or zero sense" and CCIs on "Conditions for Using International Carbon Credits towards the EU's 2040 Climate Target".
- [x] Merge the spatial-data journal article and its policy brief into one output with two formats. Link "Using International Carbon Credits towards the EU 2040 Climate Target" to the brief it partly supersedes.
- [x] Write a section-specific abstract for the Yearbook of Global Climate Action 2025 (the current one covers the whole Yearbook).
- [x] Replace "all dimensions" (D1.3, D4.6) with the actual terms, or add a "Framework" flag. Change "standard setting" (D3.7) to "standard-setting".
- [ ] Before the public launch, ACHIEVE partners check the highlighted (yellow) cells and remove the highlight once confirmed. The demo can run on them as they are.
- [x] The legend mentions a "Tagging basis" column on the first sheet and a separate column for Claude's actor additions; neither is in v5. Either restore them or update the legend.

### Compliance and language flags

- **GDPR.** Feedback is anonymous by default; email is asked only for follow-up or community sign-up, each with its own consent box. Host the survey tool in the EU (EUSurvey is one option), set a retention period in the privacy notice, and use cookie-free analytics or ask consent first.
- **Accessibility (WCAG 2.1 AA).** Every Visual needs alt text plus the infographic's text as HTML; today D1.3, D2.2 and D2.4 have it, and two publications reuse D2.2 infographics with their alt text. Filter chips need keyboard focus and announce result counts. Interactive charts need a table fallback.
- **EU funding visibility.** EU emblem, "Funded by the European Union" and the standard disclaimer in every footer and on the About page, with the grant number on About.
- **Spanish and Portuguese.** Priority: the "Bridging Levels" brief (Argentina, Chile, Colombia, Mexico), the Cities and CCIs hubs, all feedback prompts and the roadmap summaries. Only two items are tagged Latin America (D4.6 and "Bridging Levels"), so the region filter will stay thin until more Latin American outputs appear.

## Data model as built (Directus schema, November 2026)

The Directus schema (`directus/snapshot.yaml`) implements the model above with these agreed changes. Where this section and the tables above differ, this section is current.

- **Two status fields on Output.** `status` is the research status (Published / Upcoming, both shown on the site). `workflow_state` (Draft / Published / Archived) decides whether an item is visible on the site at all; the public API returns only `workflow_state = published`. Roadmaps and static pages use `workflow_state` too.
- **Partner confirmation.** `confirmed` (toggle) and `unconfirmed_fields` (the columns still yellow in the sheet) are editorial notes in Directus only. The site shows the content without a draft label, and the public API never returns these fields.
- **Visual ↔ Output is many-to-many** (`outputs_visuals`, ordered). Visuals are unique by file name, because two publications reuse D2.2 infographics.
- **Related items are typed.** `output_relations` holds `relation_type` (supersedes / related) and a `note` (for example "partly").
- **One output, several formats.** `output_formats` holds the extra formats of an output (the policy-brief version of "From pledges to places"). The library's output-type filter matches an output by its own type or any of its formats' types.
- **Ordered tags.** Actors, principles, dimensions, regions and contributors are stored in junctions with a `sort` field, in sheet order.
- **Finance** is an actor with `is_hub = false`; `shown_in` (self-referencing, `actors_shown_in`) lists the hubs where it is a filter chip.
- **Principles** have both a `code` (`p1`–`p4`, used in library URLs such as `?principle=p2`) and a `slug` (used in `/principles/<slug>`).
- **Feedback.** The page context (output, actor, principle, dimension, roadmap, recommendation, library filters) is stored on the **response**, not the prompt. The prompt's `form` field is dropped: the survey tool is the `feedback_responses` collection. Community sign-ups are a separate collection (`community_signups`), never linked to responses. Neither collection logs activity or revisions.
- **Dropped:** `ga_description` and every cost, EU-portal and Grant Agreement field. They do not exist in the schema, so the API cannot expose them; a test (`directus/schema.test.ts`) keeps it that way.
- **Roadmap references** link to existing Outputs (`roadmaps_outputs`) plus external links (`roadmap_links`). `audiences` is a list of free tags until the term set is agreed.
- **Static pages** (`pages`) hold About and the legal pages.
- **Translations.** English stays on the main record; `<collection>_translations` tables hold Spanish and Portuguese for actors, principles, dimensions, outputs, visuals, feedback prompts, roadmaps and pages.
- **Output slugs** are set once at first import (see `CLAUDE.md`, Routes).

### Who can do what

| Role | Studio | Can |
| --- | --- | --- |
| Public (no login) | — | Read published outputs, roadmaps and pages; all taxonomies; active feedback prompts; files in the "Public" folder. No internal fields, no feedback data. |
| Editor (partners) | Yes | Create and edit outputs, visuals, webinars and roadmaps; delete drafts only. Read taxonomies, pages and prompts. No feedback data; cannot change taxonomies or import-owned fields. |
| Feedback manager (Task 4.2) | Yes | Read feedback responses and sign-ups, triage and delete them (not rewrite them); manage feedback prompts and static pages; read content. |
| Website service | No (API token) | Create feedback responses and sign-ups. Cannot read them back. An email is accepted only with a consent time. |
| Import service | No (API token) | Manage content and taxonomies for the sheet import. No feedback data. |
| Administrator (HOL) | Yes | Everything, including taxonomies and the schema. |

The permission rules live in `directus/setup/permissions.ts`; `npm run setup` applies them.

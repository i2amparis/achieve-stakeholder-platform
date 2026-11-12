# Decisions

Decisions that change the stack, the content model, routes or hosting, newest first.
Each entry says what was decided, when and why. `CLAUDE.md` and `docs/content-model.md`
are kept in line with them.

This project is developed with AI assistance (Claude Code). The instructions the assistant
works under are in [`CLAUDE.md`](../CLAUDE.md); commits it co-authored carry a
`Co-Authored-By: Claude` line.

- **2026-11-13: decisions are recorded here**, not in `CLAUDE.md`, so that people can read
  them easily; the README states that the project is developed with AI assistance. Still to
  decide (consortium): a sentence on `/about` that summaries and key messages were drafted
  with AI assistance and reviewed by the responsible partners (EU AI Act, Article 50).
- **2026-11-12: Portuguese is Brazilian Portuguese (`pt-br`)**, for the Latin American
  audience; Spanish is `es`. Drupal languages: `en` (source), `es`, `pt-br`.
- **2026-11-12: move the backend from Directus to Drupal (headless), keep the SvelteKit
  frontend, host both on HOL's Hostinger Business plan** (Frankfurt, EU): Drupal as a PHP
  site on a subdomain, SvelteKit as a Node.js web app deployed from GitHub. Reason: run on
  the existing plan without a VPS. Until the migration lands, the code on this branch
  still uses Directus, and the sections below still describe it.
- **2026-11-12: feasibility test passed (18/18)** on a test site of the Business plan:
  Composer-based Drupal 11 runs there, served from `drupal/web` by making the site's
  `public_html` a link to it; PHP 8.3 with OPcache, MariaDB, HTTPS, clean URLs and JSON:API
  work; code, `vendor/` and `settings.php` are not reachable from the web; the web server
  can write files while `settings.php` stays read-only. Lessons: run Drush as
  `vendor/bin/drush`; put database credentials in `settings.php`, not in a `--db-url`
  (Drush mishandles some special characters); Hostinger prefixes database names and users
  with the account ID. Account, site and test details: `docs/internal/hosting.md`.
- **2026-11-12:** the Directus implementation (Phases 1–4 and the VPS deployment) is kept
  on branch `directus`, tag `directus-demo-v1`. Internal documents live in the git-ignored
  `docs/internal/`.
- **2026-11-03:** Directus 12 under the Open Innovation Grant; route
  `/have-your-say/thank-you`; output slug rules; one Editor role for partners, with
  contact details admin-only (details in the sections below).

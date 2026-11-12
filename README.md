# ACHIEVE Stakeholder Platform

A platform for facilitating stakeholder interaction with the findings of the Horizon Europe project ACHIEVE (grant agreement 101137625).

Stack: headless Drupal 11 backend (`drupal/`) and a SvelteKit + TypeScript site (`web/`). Decisions: `docs/decisions.md`. Content model: `docs/content-model.md`.

Developed with AI assistance (Claude Code): the instructions it works under are in `CLAUDE.md`, and decisions are recorded in `docs/decisions.md`.

## Local setup

Requires Docker, [DDEV](https://ddev.com) and Node 24 (`.nvmrc`).

```sh
cp .env.example .env                                   # set DRUPAL_FEEDBACK_SECRET (openssl rand -hex 32)
npm install

# Drupal backend: http://achieve-cms.ddev.site:8580
cd drupal
ddev start
ddev composer install
cp web/sites/default/settings.local.php.example web/sites/default/settings.local.php
#   locally only $settings['achieve_feedback_secret'] is needed: the same value as in .env
ddev drush site:install --existing-config --yes
cd ..

# Content: sheet → drupal/import/model.json → Drupal
npm run import
npm run import:drupal                                  # = cd drupal && ddev drush achieve:import
npm run seed                                           # = cd drupal && ddev drush achieve:seed

# Site: http://localhost:5173
cd web && npm install && npm run dev
```

Drupal admin: `cd drupal && ddev drush user:login` prints a one-time login link.

## Tests

```sh
npm test                       # sheet rules, model file, and (with DDEV running) Drupal API, endpoint, access and import
cd web && npm test             # filters, forms, formatting
cd web && npm run build && node build &   # then: npm run test:a11y (axe WCAG 2.1 AA, keyboard)
```

## Deploy (Hostinger web hosting)

- **Drupal** (PHP site, over SSH): `bash drupal/scripts/hostinger.sh install <site-folder>` once, then
  `… update <site-folder>` after each merge to `main`. The script asks for the database credentials and
  generates the secrets on the server; it prints the values the site needs.
- **Site** (Node.js web app built from GitHub `main`): root directory `web`, build `npm run build`,
  start `npm start`. Environment: `DRUPAL_URL`, `DRUPAL_FEEDBACK_SECRET`, `SITE_ORIGIN`, and for the demo
  `DEMO_USER`/`DEMO_PASSWORD`; behind a proxy `ADDRESS_HEADER=x-forwarded-for`, `XFF_DEPTH=1`.

The earlier Directus version of the backend is on branch `directus` (tag `directus-demo-v1`).

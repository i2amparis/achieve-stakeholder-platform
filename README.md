# ACHIEVE Stakeholder Platform

A platform for facilitating stakeholder interaction with the findings of the Horizon Europe project ACHIEVE (grant agreement 101137625).

Stack: Directus 12 + PostgreSQL (Docker Compose), SvelteKit + TypeScript. See `CLAUDE.md` for the project brief and `docs/content-model.md` for the content model.

## Local setup

Requires Docker and Node 24 (`.nvmrc`).

```sh
cp .env.example .env            # fill in secrets and the Directus LICENSE_KEY
docker compose up -d            # Directus on http://localhost:8055
npm install
npm run schema:apply            # create the schema from directus/snapshot.yaml
npm run setup                   # roles, permissions, service accounts (tokens go to .env)
npm run import                  # import data/achieve-cde-content.xlsx (idempotent)
npm run seed                    # feedback prompts, roadmaps, hub copy (idempotent)
npm test
cd web && npm install && npm run dev   # site on http://localhost:5173
npm test
```

Keep the database volume: the Directus licence binds to the local project. Avoid `docker compose down -v`.

### Drupal backend (replacing Directus)

```sh
cd drupal
ddev start                          # http://achieve-cms.ddev.site:8580
ddev composer install
cp web/sites/default/settings.local.php.example web/sites/default/settings.local.php   # locally: only the feedback secret
ddev drush site:install --existing-config --yes
ddev drush user:login               # one-time admin login link
cd .. && npx vitest run drupal      # needs DRUPAL_FEEDBACK_SECRET in .env
```

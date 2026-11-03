# achieve-stakeholder-platform

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
npm test
```

Keep the database volume: the Directus licence binds to the local project. Avoid `docker compose down -v`.

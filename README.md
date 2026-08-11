# Lifting Tracker

A single-user, no-auth strength-training program tracker. Data is entered retrospectively on desktop/laptop, not live in-gym. Full destination spec: [wayfinder map #1](https://github.com/jNosch/Personal-Tracker/issues/1).

This is a `pnpm` + `turbo` monorepo. `apps/web` is the actual app (Next.js); `apps/docs` and `packages/*` are Turborepo-starter scaffolding, mostly unused so far.

## Dev setup

1. **Start Postgres**: `docker compose up -d` (repo root) — spins up `postgres:17-alpine` on `localhost:5432` with `dev`/`dev` credentials, and creates the integration-test database on first init of an empty volume.
2. **Install dependencies**: `pnpm install` (repo root).
3. **Env vars**: `cp apps/web/.env.example apps/web/.env.local` and adjust if needed — defaults already match the compose credentials above.
4. **Run migrations**: `pnpm --filter web db:migrate`.
5. **Seed the exercise library**: `pnpm --filter web db:seed` — inserts the exercise library from `apps/web/db/seed-data.ts`; safe to re-run, only inserts names not already present.
6. **Run the app**: `pnpm --filter web dev` — [http://localhost:3000](http://localhost:3000).

Useful `apps/web` scripts: `db:studio` (Drizzle Studio), `test` / `test:integration`, `lint`, `check-types`. See [docs/engineering/testing.md](docs/engineering/testing.md) for the test split and [docs/engineering/ci.md](docs/engineering/ci.md) for what CI enforces.

## Docs

- [`CONTEXT.md`](CONTEXT.md) — domain glossary, ubiquitous language.
- [`docs/adr/`](docs/adr) — architectural decisions.
- [`docs/engineering/`](docs/engineering) — git workflow, code conventions, testing, CI, known issues.
- [`docs/agents/`](docs/agents) — issue tracker, triage labels, domain-doc conventions (for AI agents working in this repo).

This README is intentionally thin for now — expanding as the project grows.

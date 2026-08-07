# CI

GitHub Actions, `.github/workflows/ci.yml` — decided via `/grill-me` in issue #27.

## Trigger

`pull_request` events targeting `develop` or `master` only. Not on raw pushes to `feature/*`/`bugfix/*` — that would just be noise on a solo repo where the PR is opened deliberately once local checks are already clean.

## Jobs

Three, run in parallel:

- **`checks`** — `pnpm lint` → `pnpm check-types` → `pnpm test` (unit). Plain runner, no service container.
- **`integration`** — Postgres 17 (`postgres:17-alpine`, matching `docker-compose.yml`) as a service container, then `pnpm test:integration`. Runs unconditionally — no path-filtering on `db/` changes. The local honor-system exception in the [PR checklist](./git-workflow.md) exists because a human has to remember to start `docker-compose`; CI doesn't have that friction, so there's no reason to carry the exception into the pipeline.
- **`build`** — `pnpm build`. Not for deploy (see below) — `next build` catches build-time failures (route conflicts, build-only errors) that lint/check-types/test don't.

No migration step needed for `integration` — the suite's own `beforeAll` (`apps/web/db/test-db.ts`'s `migrateTestDb()`) applies migrations against `TEST_DATABASE_URL` on every run. This holds because the one integration test file that exists today calls it; the workflow itself has no independent migration guarantee, so a future `*.integration.test.ts` file that skips calling `migrateTestDb()` in its own `beforeAll` would run against an unmigrated schema. Worth a lint/convention check if this ever bites — not worth a workflow-level fix for one test file.

## Env vars

- Every job gets a dummy `DATABASE_URL` (`postgres://build:build@localhost:5432/build`). `apps/web/db/client.ts` throws if `DATABASE_URL` is unset at module-load time — harmless today since nothing in `app/` imports it yet, but `next build` actually evaluates route modules, so once a route imports `db/client.ts` this becomes load-bearing in a clean CI checkout (no `.env.local` exists there). The `postgres` package connects lazily, so a syntactically-valid fake string satisfies the check without needing a reachable database.
- `integration` additionally gets a real `TEST_DATABASE_URL` pointed at its own Postgres service container.

## Branch protection

Required status check on both `develop` and `master` — all three jobs (`checks`, `integration`, `build`) block the merge button, not just informational. Configured via repo Settings → Branches (or `gh api`) once the workflow has run at least once (GitHub requires a check to have reported before it can be marked required).

## No CD

CI-only. The app is local/Docker-only, no-network-exposure by design ([issue #3](https://github.com/jNosch/Personal-Tracker/issues/3)) — there's no deploy target to build a CD pipeline toward.

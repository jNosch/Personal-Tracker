# Testing

## Framework

**Vitest**, in `apps/web` (the only workspace with anything to test right now). Native ESM, fast, first-class TypeScript, no fight with Next.js 16 / React 19 the way Jest's CJS-era config would need.

## Scope

Not every layer is tested equally — match effort to where bugs are cheap to introduce and expensive to find:

- **`apps/web/lib/`** — unit tests **mandatory**. Pure domain logic (scheme engine, 1RM calc), no I/O, highest bug risk, cheapest to test.
- **`apps/web/db/`** — integration tests **mandatory when a schema change encodes behavior worth verifying** (a constraint, cascade, default, computed value) — not for every trivial column add. Run against a real Postgres, never mocked.
- **`apps/web/app/`** (routes) — not required now. Routes stay thin (fetch + render) by convention; testing them means route-handler or e2e tests, a heavier investment not justified yet. Revisit once routes carry real logic.
- **`packages/ui`** — not required now. Presentational, low logic density, cheap to eyeball in a single-user app. Revisit if components grow real interaction logic.

## File convention

Colocate tests with source — `foo.ts` next to `foo.test.ts` — rather than a parallel `__tests__/`/`tests/` tree. Keeps a function and its test moving together through renames and reviews.

DB integration tests use a distinct suffix so they can be excluded from the fast unit run: `schema.integration.test.ts`.

Two scripts in `apps/web`:
- `test` — unit tests only (`*.test.ts`, excludes `*.integration.test.ts`), no DB required.
- `test:integration` — only `*.integration.test.ts`, needs the docker-compose Postgres up.

## DB integration test isolation

Dedicated test database on the existing docker-compose Postgres instance (separate `DATABASE_URL`, not the dev DB). Migrations run once per suite; tables are truncated `afterEach`. No transaction-rollback wrapper — it fights Drizzle's own transaction/pooling API for a level of airtightness this solo project doesn't need. Truncate-between-tests is simpler and fast enough at this data volume.

## Coverage

No enforced coverage percentage — a % threshold is a vanity metric with no CI to gate it, and chasing it produces low-value tests. Instead: every new/changed `lib/` function ships tests in the same PR (mirrors the vertical-slice rule in [general.md](./general.md)); `db/` schema changes get an integration test only when the change encodes behavior worth verifying.

## Workflow

Same honor-system step as lint/check-types in the [PR checklist](./git-workflow.md): `pnpm test` always, `pnpm test:integration` when the PR touches `db/`. No CI wired up yet — revisit both when one exists.

## Agent note

After implementing a feature or fix, run the associated tests via `pnpm test` and iterate until it passes. Fix the root cause of failures — never suppress or skip a failing test to make it pass. Show the output as evidence it passes before considering the work done.

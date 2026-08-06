# General Rules

These engineering docs are living — as the project grows, expand this file (or add new ones under `docs/engineering/`) with new rules and knowledge as they come up, rather than letting undocumented conventions accumulate only in agent memory.

## Implementation approach

- **Spec-driven**: implementation work traces back to a resolved wayfinder ticket or an explicit ask — never freelanced mid-session. If a piece of work doesn't map to a decided spec, stop and resolve the spec first (`/grill-with-docs`) rather than guessing.
- **Vertical slices, not big-bang changes**: build one feature/slice at a time — a thin, working path through the stack (schema → domain logic → route) — rather than attempting several features or a large multi-part change in one pass. Smaller slices are easier to review, easier to revert, and match the one-feature-branch-per-ticket branching model.

## Rules

- **Package manager**: pnpm only. Never `npm install` / `yarn add` — this is a pnpm workspace (`packageManager` pinned in the root `package.json`); a stray `package-lock.json`/`yarn.lock` corrupts it.
- **Migrations**: always `pnpm db:generate` off a schema change, never hand-edit a file under `db/migrations/`. Generated migrations are committed as-is.
- **Secrets**: `.env.local` (and any `.env*` beyond `.env.example`) is never committed. `DATABASE_URL` and friends stay local/Docker-only, per the single-user, no-network-exposure decision ([issue #3](https://github.com/jNosch/Personal-Tracker/issues/3)).
- **Domain decisions**: new domain concepts or architecture trade-offs go through `/grill-with-docs` (or `/grilling` + `/domain-modeling` directly) — not decided ad hoc mid-implementation. `CONTEXT.md` stays glossary-only, no implementation details; ADRs go in `docs/adr/` only when a decision is hard to reverse, non-obvious without context, and the result of a real trade-off.
- **UI/UX decisions**: "how should this look/behave" questions go through `/prototype`, captured on a `prototype/*` branch, before being built for real. See [git-workflow.md](./git-workflow.md) for which prototype branches get kept vs. discarded.

# Git Workflow

## Branches

- **`master`** — the cleanest branch. Only updated at milestones, via PR from `develop`.
- **`develop`** — the controlled integration branch. Every change lands here through a PR; nothing is pushed directly.
- **`feature/<issue#>-<slug>`** / **`bugfix/<issue#>-<slug>`** — one branch per unit of work, cut from `develop`. The issue number is mandatory: every branch traces back to a GitHub issue. No ticket yet? Create one first, even a quick one.
- **`prototype/<slug>`** — exploration branches captured during a `/prototype` session (see [domain docs](../agents/domain.md) / wayfinder map [#1](https://github.com/jNosch/Personal-Tracker/issues/1)). Never merged. Once a decision is made: if the prototype was the one decided on, **keep the branch** in the repo for future reference; only discard branches for directions that weren't chosen.

`main` is a stale leftover — delete it, and make sure the GitHub default branch is set to `master`, not `main`.

## Commits

Free-form, imperative summary — no enforced `feat:`/`fix:` prefix. Always lead with the issue number:

```
#20: add theme JSON files and next-themes wiring
```

## Pull requests

**`feature/*` / `bugfix/*` → `develop`**
1. Run `pnpm lint`, `pnpm check-types`, and `pnpm test` locally — all clean before opening the PR. Also run `pnpm test:integration` if the PR touches `db/`. No CI wired up yet, so this is on the honor system until one exists. See [testing.md](./testing.md).
2. Run `/code-review` on the branch. This is a solo project with no second human reviewer — `/code-review`'s Standards + Spec pass substitutes for one. Resolve or consciously acknowledge every finding.
3. **Ask before opening the PR** — an agent never opens a PR unprompted, even once lint/types/review are clean.
4. **Merging is manual, human-only.** The repo owner is the sole approver and the only one who clicks merge — **squash merge**, PR title becomes the resulting commit on `develop`. An agent never self-approves or merges its own PR.

**`develop` → `master`**
Opened deliberately when a milestone is hit, not on a schedule. **Merge commit**, not squash — `master`'s history should show the individual `develop` commits that made up the milestone, unlike the collapsed feature merges below it.

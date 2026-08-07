## Agent skills

### Issue tracker

Issues are tracked on GitHub (`github.com/jNosch/Personal-Tracker`) via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Default label vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` + `docs/adr/` at the repo root. See `docs/agents/domain.md`.

## Engineering guidelines

### Git workflow

Branch model, naming, commit format, and PR/merge rules. See `docs/engineering/git-workflow.md`.

### Code conventions

Naming, comment philosophy, and file organization. See `docs/engineering/code-conventions.md`.

### Testing

Test concept, structure, and rules. See `docs/engineering/testing.md`.

### Visual references

ERD and architecture-flow diagrams. See `docs/engineering/visual/`.

### CI

GitHub Actions pipeline: triggers, jobs, env vars, branch protection. See `docs/engineering/ci.md`.

### Session notes

Scratch space for carrying context to the next session. See `docs/engineering/session-notes.md`. **Always clear it back to empty at the start of a session.** Only write to it at the end of a session, and only when the user explicitly asks — never automatically.

### Known issues

Persistent knowledge about ongoing problems and accepted tech debt, not cleared between sessions. See `docs/engineering/known-issues.md`.

### General rules

Package manager, migrations, secrets, and when to route work through `/grill-with-docs` or `/prototype`. See `docs/engineering/general.md`.

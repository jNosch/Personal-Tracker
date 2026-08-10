# Known Issues

Persistent knowledge about ongoing problems and accepted tech debt — things worth remembering across sessions that don't belong in `session-notes.md` (cleared every session) but also aren't yet resolved enough for an ADR. Add an entry per issue as they come up; don't let this accumulate only in agent memory.

## Styling has no design system yet, and isn't theme-aware

**What**: Every route built so far (`app/programs/`, `app/log/`, `app/bodyweight/`) uses plain inline `style={{...}}` objects with hardcoded hex colors (`#111`, `#fff`, `#999`, `#ccc`, `#e5e5e5`, `#dc2626`, ...) — no CSS-in-JS, no shared component library, no design tokens. `app/globals.css` separately defines `--background`/`--foreground` tied to `prefers-color-scheme`, but no page actually references those variables — it's dead weight relative to how the pages are actually styled.

This wasn't a decision made along the way — it's a precedent set in #24 (Program Creator, the first real UI) and repeated by every ticket since, each one matching what came before rather than reopening the question.

**Why it matters for #32 (Theming)**: #32's resolved plan (see the ticket + #20) is 7 semantic roles (`background`, `surface`, `text`, `textMuted`, `accent`, `border`, `danger`) via `next-themes` + `localStorage`, picked by the user — explicitly **not** `prefers-color-scheme` auto-detection. That means:

- `globals.css`'s current light/dark media-query approach is the wrong shape already, not just incomplete — it needs replacing, not extending.
- Every hardcoded hex value across every existing page needs retrofitting to pull from theme tokens instead. There's no shared component to swap centrally, since none exists — it's a page-by-page sweep.

**Solution**: accepted as-is for now. When #32 is picked up, expect it to require a real styling-implementation pass (introduce some shared way of consuming theme tokens, then retrofit every existing page), not just "add two JSON files and a toggle." Not dramatic — just bigger than #32's own ticket text implies today, since it was written before this precedent had spread across three pages. Worth sizing #32 with that in mind rather than being surprised by scope mid-ticket.

## Recurring Prettier/formatting noise on untouched files

**What**: `git status` regularly shows ~30 files as modified — reformatting only (quote style, line-wrapping, import multi-lining, trailing-newline/EOL changes), never real content changes — on files nobody edited that session. Same set each time: `db/schema.ts`, `docker-compose.yml`, `.claude/skills/*`, migration meta JSON, `pnpm-lock.yaml`, etc.

**History**: first hit during #29's session. Worked around then with a `.gitattributes` line (`* text=auto eol=lf`) to normalize line endings, on the theory CRLF/LF thrash between Prettier (writes LF) and Windows `core.autocrlf` was the cause. Didn't work — recurred 4+ times after that fix, every commit needing a manual `git checkout -- <files>` sweep. On 2026-08-10, removed `.gitattributes` entirely to test a WebStorm extension-settings change made the same session. Noise reappeared **immediately** — before any real edit, right after a plain `git checkout -- .`, and even survived a second `checkout -- .` (which also clobbered an in-progress `session-notes.md` clear, had to redo it). So: not caused by `.gitattributes`, and not fixed by the WebStorm change either.

**Root cause**: still unconfirmed. Reappearing on a bare `checkout` (no editor save, no build step) points at something touching files on disk independent of editing — a background watcher/reformatter (WebStorm reformat-on-save scope, a file-watcher plugin, git's own CRLF conversion on checkout) rather than Prettier being run manually. `core.autocrlf` is a live suspect: checkout emitted `LF will be replaced by CRLF` warnings on the same files.

**Solution**: none yet. Accepted as-is — sweep noise files with `git checkout -- <files>` before every commit, same as before. Next real lead to try: check `git config core.autocrlf` and consider setting it to `false` (or `input`) instead of the removed `.gitattributes` approach; check WebStorm's Settings → Tools → Actions on Save (Reformat code scope) directly rather than inferring from the extension change.

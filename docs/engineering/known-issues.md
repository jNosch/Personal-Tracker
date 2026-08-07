# Known Issues

Persistent knowledge about ongoing problems and accepted tech debt — things worth remembering across sessions that don't belong in `session-notes.md` (cleared every session) but also aren't yet resolved enough for an ADR. Add an entry per issue as they come up; don't let this accumulate only in agent memory.

## Styling has no design system yet, and isn't theme-aware

**What**: Every route built so far (`app/programs/`, `app/log/`, `app/bodyweight/`) uses plain inline `style={{...}}` objects with hardcoded hex colors (`#111`, `#fff`, `#999`, `#ccc`, `#e5e5e5`, `#dc2626`, ...) — no CSS-in-JS, no shared component library, no design tokens. `app/globals.css` separately defines `--background`/`--foreground` tied to `prefers-color-scheme`, but no page actually references those variables — it's dead weight relative to how the pages are actually styled.

This wasn't a decision made along the way — it's a precedent set in #24 (Program Creator, the first real UI) and repeated by every ticket since, each one matching what came before rather than reopening the question.

**Why it matters for #32 (Theming)**: #32's resolved plan (see the ticket + #20) is 7 semantic roles (`background`, `surface`, `text`, `textMuted`, `accent`, `border`, `danger`) via `next-themes` + `localStorage`, picked by the user — explicitly **not** `prefers-color-scheme` auto-detection. That means:

- `globals.css`'s current light/dark media-query approach is the wrong shape already, not just incomplete — it needs replacing, not extending.
- Every hardcoded hex value across every existing page needs retrofitting to pull from theme tokens instead. There's no shared component to swap centrally, since none exists — it's a page-by-page sweep.

**Solution**: accepted as-is for now. When #32 is picked up, expect it to require a real styling-implementation pass (introduce some shared way of consuming theme tokens, then retrofit every existing page), not just "add two JSON files and a toggle." Not dramatic — just bigger than #32's own ticket text implies today, since it was written before this precedent had spread across three pages. Worth sizing #32 with that in mind rather than being surprised by scope mid-ticket.

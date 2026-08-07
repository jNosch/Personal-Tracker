# Code Conventions

Formatting itself — indentation, quotes, semicolons — is tool-enforced: Prettier defaults via `pnpm format`, linted through the shared `@repo/eslint-config/next-js` config. Don't hand-debate what the tools already settle. This file covers what they don't.

## Naming

- **TypeScript**: camelCase (`nextDayPosition`, `isBodyweightBased`).
- **Database columns**: snake_case (`next_day_position`, `is_bodyweight_based`), mapped explicitly in Drizzle's column definitions — the snake_case name is always the explicit first argument to the column builder (`integer("next_day_position")`), even where it'd be inferable. Never let the two naming schemes drift apart silently.

## Comments

Explain *why*, not *what*. A comment restating the line below it is noise; a comment recording a non-obvious constraint, or pointing at the decision that produced it, earns its place. Reference the wayfinder issue number when a piece of code exists specifically because of a resolved decision:

```ts
// Rotation position: which day template comes next. Lives here (not
// derived) so it survives untouched while a program is inactive —
// reactivating resumes exactly where it left off (Program lifecycle, #9).
nextDayPosition: integer("next_day_position").notNull().default(0),
```

## File organization

- **`apps/web/lib/`** — pure domain/business logic (scheme engine, 1RM calculation, theme resolution). No Next.js or React imports. Testable in isolation, independent of routing.
- **`apps/web/db/`** — schema, migrations, DB client. A sibling of `app/`, not nested inside it.
- **`apps/web/app/`** — routes. Stay thin: data fetching + rendering, delegating real logic to `lib/`.

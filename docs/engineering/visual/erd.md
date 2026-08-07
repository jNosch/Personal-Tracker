# ERD

Current state of `apps/web/db/schema.ts` (migrations `0000`/`0001`). Regenerate this diagram by hand whenever the schema changes — it's a snapshot, not generated from the schema file.

```mermaid
erDiagram
    PROGRAMS ||--o{ DAY_TEMPLATES : "rotation of"
    DAY_TEMPLATES ||--o{ EXERCISE_IN_DAY : "prescribes"
    DAY_TEMPLATES ||--o{ SESSIONS : "logged against"
    EXERCISES ||--o{ EXERCISE_IN_DAY : "assigned via"
    EXERCISES ||--o{ LOGGED_SETS : "performed as"
    EXERCISES ||--o{ ONE_RM_ESTIMATES : "estimated for"
    EXERCISE_IN_DAY ||--o{ LOGGED_SETS : "prescribed by"
    SESSIONS ||--o{ LOGGED_SETS : "contains"
    SESSIONS ||--o{ ONE_RM_ESTIMATES : "computed at"

    PROGRAMS {
        uuid id PK
        text name
        boolean is_active "partial unique index: at most one true"
        boolean is_archived
        integer next_day_position
    }
    DAY_TEMPLATES {
        uuid id PK
        uuid program_id FK
        text label
        integer position "unique per program_id"
        boolean is_archived
    }
    EXERCISES {
        uuid id PK
        text name
        boolean is_bodyweight_based
        boolean tracks_1rm
        boolean is_archived
    }
    EXERCISE_IN_DAY {
        uuid id PK
        uuid day_template_id FK
        uuid exercise_id FK
        integer position "unique per day_template_id"
        text scheme_type "not a pg enum, see schema.ts header"
        jsonb scheme_config "static, shape depends on scheme_type"
        jsonb scheme_state "dynamic, evolved by scheme.update()"
        boolean is_archived
    }
    SESSIONS {
        uuid id PK
        uuid day_template_id FK
        date session_date
    }
    LOGGED_SETS {
        uuid id PK
        uuid session_id FK
        uuid exercise_id FK
        uuid exercise_in_day_id FK "NOT NULL, see archive-only note below"
        integer set_number "unique per session_id + exercise_id"
        integer reps_achieved "nullable - Failure Sets tracks neither"
        numeric actual_weight_kg "nullable"
        numeric rpe "nullable"
        boolean counts_toward_1rm "stamped at log time, never re-derived"
        boolean is_done
    }
    ONE_RM_ESTIMATES {
        uuid id PK
        uuid exercise_id FK
        uuid session_id FK "unique per exercise_id + session_id"
        numeric estimated_1rm_kg
    }
    BODYWEIGHT_ENTRIES {
        uuid id PK
        date entry_date
        numeric weight_kg
    }
```

`BODYWEIGHT_ENTRIES` has no foreign keys — it's a standalone log, not tied to a program/session.

## Non-obvious constraints

Worth knowing before touching this schema — see [ADR-0001](../../adr/0001-archive-only-across-referenced-entities.md) and [CONTEXT.md](../../../CONTEXT.md) for the full reasoning:

- **Archive-only.** `programs`, `day_templates`, `exercise_in_day`, `exercises` are never hard-deleted, only flagged `is_archived`. That's why `logged_sets.exercise_in_day_id` is `NOT NULL` — the row it points at always still exists.
- **`one_active_program`** — a partial unique index (`is_active = true`), not application-level validation. Covered by the integration test in `apps/web/db/schema.integration.test.ts` (see [testing.md](../testing.md)).
- **`scheme_type` is plain text**, not a Postgres enum — the scheme catalog has already grown once organically (Failure Sets added after the fact); an enum would force a migration every time it grows again. The known set is enforced in application code (`SCHEME_TYPES` in `schema.ts`).
- **One-RM estimates are one row per (exercise, session)** — the highest Epley estimate among that session's qualifying sets, computed once at save time, not one row per set.

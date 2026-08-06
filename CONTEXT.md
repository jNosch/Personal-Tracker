# Lifting Tracker

A single-user, no-auth strength-training program tracker. Data is entered retrospectively on desktop/laptop, not live in-gym. Full destination spec: [wayfinder map #1](https://github.com/jNosch/Personal-Tracker/issues/1).

## Language

**Exercise**:
A global library entry (e.g. "Barbell Squat"). Independent of any program; referenced by Exercise-in-Day and Logged Set. Flags `isBodyweightBased` and `tracksOneRm` control 1RM behavior.
_Avoid_: Movement, lift (as a table/entity name)

**Program**:
A library item representing a repeating rotation of Day Templates. Exactly one Program is active at a time (DB-enforced). Never hard-deleted — archived instead, so history always keeps a valid reference.
_Avoid_: Routine, plan

**Day Template**:
One position in a Program's rotation — an ordered list of Exercise-in-Day entries. Not tied to a calendar week; "day" means rotation slot, not weekday.
_Avoid_: Workout day, split day

**Exercise-in-Day**:
One exercise's placement within a Day Template: an Exercise reference + exactly one Scheme (type + config + state) + a position. The unit that actually prescribes sets.
_Avoid_: Program exercise, workout item

**Scheme**:
The progression algorithm attached to an Exercise-in-Day. Fixed built-in catalog (not user-authorable): Double Progression (default), Wave, Rep Accumulation, Top-set + Back-off, Failure Sets. Has static `config` and dynamic `state`, with `prescribe`/`update` operations. Prescribed sets are never stored — always generated dynamically from config + state.
_Avoid_: Progression, program type

**Rotation advance**:
Saving a Session always advances the owning Program's `nextDayPosition` to (the Day Template actually logged's position + 1, mod day count) — regardless of what `nextDayPosition` pointed at before the save. Rotation follows what was logged, not a predetermined sequence.

**Session**:
A single retrospective log entry, always linked to one specific Day Template (never freeform/unlinked). Order and prescriptions are inherited from that Day Template.

**Logged Set**:
One concrete, actually-performed set within a Session, tied to one Exercise and one Exercise-in-Day (never freeform — every logged set corresponds to a prescribed Exercise-in-Day entry). Stores its own concrete data (reps, weight, RPE) rather than re-deriving from the Program's live definition, so editing a Program in place never rewrites history.
_Avoid_: Set (ambiguous with prescribed/target set)

**Counts toward 1RM**:
A per-Logged-Set flag stamped once at log time from whatever the Scheme designated that session (e.g. an AMRAP set, a top set, or the reps-≤10 fallback). Never re-derived later.

**One-RM Estimate**:
One row per (Exercise, Session) — the highest Epley estimate among that session's qualifying ("counts toward 1RM") sets for that exercise, computed once at session-save time. Only exercises flagged `tracksOneRm` get estimates.

**Archive-only**:
The deletion policy across Program, Day Template, Exercise-in-Day, and Exercise: nothing referenced by history is ever hard-deleted, only flagged `isArchived`. See [ADR-0001](./docs/adr/0001-archive-only-across-referenced-entities.md).

**Theme**:
A named, fixed, hand-authored visual skin — a JSON file defining 7 semantic color roles (`background`, `surface`, `text`, `textMuted`, `accent`, `border`, `danger`). Not a light/dark/system mode: v1 ships two themes, Black and Purple, both dark. `danger` is held constant across every theme; every other role is theme-specific. Chosen theme persists client-side (`localStorage`, no server/cookie involvement) via `next-themes`. See [issue #20](https://github.com/jNosch/Personal-Tracker/issues/20).
_Avoid_: Mode, color scheme (implies light/dark duality this app doesn't have)

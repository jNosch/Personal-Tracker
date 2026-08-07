# Archive-only deletion extends to every history-referenced entity, not just Programs

[Issue #9](https://github.com/jNosch/Personal-Tracker/issues/9) decided Programs are archive-only (never hard-deleted) so history always keeps a valid reference. That reasoning applies equally to Day Template, Exercise-in-Day, and Exercise: Logged Sets and Sessions reference all three, and a true delete of any of them would either be blocked by a foreign key (if the row has history) or silently orphan/nullify historical data (if cascaded). We extend `isArchived` to all four tables — `programs`, `day_templates`, `exercise_in_day`, `exercises` — rather than special-casing deletion behavior per table.

**Considered:** letting Day Template / Exercise-in-Day / Exercise deletes fail via FK `RESTRICT` when history exists (forcing the user to archive the whole Program instead). Rejected — it would surface as a confusing DB error for what should be a normal "remove this exercise from my program" action, and it breaks the "editing a used program in place is safe" guarantee from issue #9.

**Consequence:** `logged_sets.exerciseInDayId` is `NOT NULL` — since the referenced row is never actually gone (only archived), every logged set always has a valid link to the Exercise-in-Day it was prescribed from. No freestyle/unlinked exercises in a session.

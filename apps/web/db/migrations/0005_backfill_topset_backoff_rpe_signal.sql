-- #61: Top-set+Backoff's RPE signal set is the top set — prescribeTopsetBackoff
-- now stamps counts_toward_rpe_signal = true on it unconditionally for
-- every session logged from here on. Pre-existing rows predate this
-- column and all default to false, which would make recentExerciseRpeTrends
-- (see lib/progressRange.ts) find zero signal-flagged readings for every
-- already-logged Top-set+Backoff session and drop it from RpeBox entirely
-- — the same silent history-wipe migration 0002 caused for Wave (and 0003
-- had to correct). Fixing it here in the same migration that introduces
-- the column, rather than in a follow-up discovered by testing, since the
-- failure mode is now a known, anticipated one.
--
-- Unlike Wave's own backfill (0002/0003), Top-set+Backoff's top set has no
-- ambiguity to resolve: it's always set_number = 1, and prescribeTopsetBackoff
-- has always unconditionally set countsTowardOneRm = true on it too (no
-- deload-week-style fallback that could mark more than one set) — so
-- set_number = 1 alone is a safe, unambiguous condition, not a proxy that
-- could over- or under-match the way Wave's counts_toward_1rm reuse did.
UPDATE "logged_sets" AS ls
SET "counts_toward_rpe_signal" = true
FROM "exercise_in_day" AS eid
WHERE ls."exercise_in_day_id" = eid."id"
  AND eid."scheme_type" = 'topset_backoff'
  AND ls."set_number" = 1;

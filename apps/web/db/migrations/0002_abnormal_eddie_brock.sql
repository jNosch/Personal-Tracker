ALTER TABLE "logged_sets" ADD COLUMN "counts_toward_rpe_signal" boolean DEFAULT false NOT NULL;
--> statement-breakpoint
-- Backfill (#60): pre-existing Wave logged_sets rows predate this column and
-- all default to false, which would make recentExerciseRpeTrends() (see
-- lib/progressRange.ts) find zero signal-flagged readings for every
-- already-logged Wave session and drop it from RpeBox entirely — a silent
-- history wipe on deploy, not asked for by #60's spec ("replacing the flat
-- average for Wave rows", not discarding rows that predate the flag).
-- For Wave specifically, counts_toward_1rm is already true on exactly the
-- AMRAP set of a training week (see schemes.ts's prescribeWave:
-- countsTowardOneRm: s.repTarget === "AMRAP") — under the locked 5/3/1
-- preset every training week has one, so that's the same set
-- pickWaveSignalSetNumber would designate as the signal set had #60 existed
-- at log time. Reusing it here recovers the historic flag instead of
-- guessing at a new rule. Deload-week rows have no AMRAP set either way, so
-- counts_toward_1rm is already false there and this leaves them untouched
-- (correct: DELOAD_WEEK is never stamped as a signal set going forward
-- either). Doesn't cover a hypothetical custom week table with no AMRAP row
-- at all (#16) — out of scope here, same as the rest of custom-table
-- support.
UPDATE "logged_sets" AS ls
SET "counts_toward_rpe_signal" = true
FROM "exercise_in_day" AS eid
WHERE ls."exercise_in_day_id" = eid."id"
  AND eid."scheme_type" = 'wave'
  AND ls."counts_toward_1rm" = true;
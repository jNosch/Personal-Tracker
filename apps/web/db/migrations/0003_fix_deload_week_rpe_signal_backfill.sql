-- #60 follow-up: corrects an over-broad assumption in migration 0002's
-- backfill (found in manual testing after that PR merged).
--
-- 0002 backfilled counts_toward_rpe_signal = true wherever
-- counts_toward_1rm was already true on a Wave row, reasoning that for
-- Wave, counts_toward_1rm is only ever true on the AMRAP set. That's true
-- for every *real* training week (prescribeWave always designates exactly
-- the AMRAP set) but not for the deload week: DELOAD_WEEK has no AMRAP set,
-- so prescribeWave designates none of its 3 sets, which makes
-- resolveCountsTowardOneRm (lib/oneRm.ts) fall through to its "no set
-- statically designated -> every set with reps <= 10 qualifies" rule —
-- and deload sets are always 5/5/5 reps, so all 3 end up
-- counts_toward_1rm = true. 0002's backfill then incorrectly flagged all 3
-- as the RPE signal set too, even though a deload week should never carry
-- one (prescribeWave stamps signalSetNumber = -1 while inDeload, see
-- lib/schemes.ts) — the app's own live updateWave/RpeBox logic never
-- reads this stored flag for the streak trigger, so this only ever
-- corrupted RpeBox's Wave-row display for historic deload-week sessions,
-- never the deload suggestion itself.
--
-- Fix: a legitimate Wave signal set is exactly one set per (session,
-- exercise). Any session where the backfill left more than one set flagged
-- can only be this deload-week fallback case under the current locked
-- 5/3/1 preset (its 3 real weeks always have exactly one AMRAP each, so
-- anyDesignated is always true for them — only the no-AMRAP deload week
-- hits the fallback that marks multiple sets). Clearing all of them back
-- to false for those sessions matches what prescribeWave would have
-- stamped had #60 existed at log time. Doesn't cover a hypothetical custom
-- week table with a real (non-deload) week that also has no AMRAP set
-- (#16) — same out-of-scope caveat 0002 already carried.
UPDATE "logged_sets" AS ls
SET "counts_toward_rpe_signal" = false
FROM (
  SELECT ls2."session_id", ls2."exercise_in_day_id"
  FROM "logged_sets" AS ls2
  INNER JOIN "exercise_in_day" AS eid ON ls2."exercise_in_day_id" = eid."id"
  WHERE eid."scheme_type" = 'wave'
  GROUP BY ls2."session_id", ls2."exercise_in_day_id"
  HAVING count(*) FILTER (WHERE ls2."counts_toward_rpe_signal") > 1
) AS over_flagged
WHERE ls."session_id" = over_flagged."session_id"
  AND ls."exercise_in_day_id" = over_flagged."exercise_in_day_id";

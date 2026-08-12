-- #61: DoubleProgressionConfig/TopsetBackoffConfig both gained a required
-- deloadCutPercentage field, but existing exercise_in_day rows for these
-- two scheme types were created before this ticket and their scheme_config
-- JSON has no such key. Left alone, accepting a deload suggestion on one of
-- these pre-existing rows would compute NaN (undefined / 100) the next
-- time prescribe() ran for it. Backfills the same default the app itself
-- ships (defaultConfigFor's own 60) into every row missing the key —
-- config fields are meant to always be fully specified (unlike optional
-- *state* fields, which already tolerate missing values via `?? default`
-- throughout schemes.ts), so this is a one-time fix rather than adding a
-- runtime fallback that would need to exist forever.
UPDATE "exercise_in_day"
SET "scheme_config" = "scheme_config" || '{"deloadCutPercentage": 60}'::jsonb
WHERE "scheme_type" IN ('double_progression', 'topset_backoff')
  AND NOT ("scheme_config" ? 'deloadCutPercentage');

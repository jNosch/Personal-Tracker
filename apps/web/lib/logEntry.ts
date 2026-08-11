// Pure pre-fill/aggregation logic for Session Logging's set-entry inputs
// (#14/#29/#55/#57). Colocated here (not app/log/LogSessionForm.tsx, where
// this originally lived) per code-conventions.md's file-organization rule
// — lib/ is for pure domain logic, no React/Next imports — and so it gets
// the testing.md-mandatory unit-test coverage pure lib/ functions get
// (found in code review: this logic shipped with zero tests while living
// in app/, unlike everything else this session with the same "pure
// pre-fill/aggregation" shape).
import type { PrescribedSet } from "./schemes";

export interface SetEntry {
  actualWeightKg: number | "";
  repsAchieved: number | "";
}

// The displayed/submitted weight: whatever the user typed, or the current
// prescription if they haven't touched the field yet (issue #14's
// "pre-filled from the prescription, overridable").
export function effectiveWeight(
  entry: SetEntry,
  set: PrescribedSet,
): number | "" {
  return entry.actualWeightKg === ""
    ? (set.prescribedWeightKg ?? "")
    : entry.actualWeightKg;
}

// Same pre-filled-but-overridable pattern as effectiveWeight above, for
// reps (#55). Only pre-fills when repTarget is a concrete number — left
// blank for null (Rep Accumulation's whole-session-total target, no
// per-set number to show; Failure Sets, handled separately with no reps
// input at all) and for "AMRAP" (no sensible number to default "as many as
// possible" to).
export function effectiveReps(
  entry: SetEntry,
  set: PrescribedSet,
): number | "" {
  if (entry.repsAchieved !== "") return entry.repsAchieved;
  return typeof set.repTarget === "number" ? set.repTarget : "";
}

// Live running total for Rep Accumulation's whole-session target (#57) —
// sums whatever's actually been typed into each set's reps field so far.
// Deliberately reads entry.repsAchieved directly, not effectiveReps: Rep
// Accumulation's repTarget is always null (schemes.ts), so effectiveReps
// never pre-fills it anyway, but reading the raw entry keeps this
// unambiguous ("what the user actually entered") regardless of that.
export function loggedTotalReps(
  sets: PrescribedSet[],
  entries: Record<number, SetEntry | undefined>,
): number {
  return sets.reduce((sum, set) => {
    const reps = entries[set.setNumber]?.repsAchieved;
    return sum + (typeof reps === "number" ? reps : 0);
  }, 0);
}

// 1RM calculation (#5) — Epley formula, qualifying-set resolution, and
// per-session aggregation. Sits alongside schemes.ts (which owns
// prescribe/update's per-set countsTowardOneRm designation) rather than
// duplicating that logic.
import { epley1Rm, type PrescribedSet } from "./schemes";

export { epley1Rm };

// Resolves the final countsTowardOneRm per set for one exercise's session,
// applying the fallback rule (#5): if the scheme statically designated any
// set (Wave's AMRAP, every Rep Accumulation set, Top-set's top set),
// honor exactly those and nothing else. Otherwise (Double Progression, and
// Top-set's back-off sets alone were never enough to trigger this branch
// since the top set already designates) every set with reps_achieved <= 10
// qualifies.
export function resolveCountsTowardOneRm(
  prescribedSets: PrescribedSet[],
  repsAchievedBySetNumber: Map<number, number | null>,
): Map<number, boolean> {
  const anyDesignated = prescribedSets.some((s) => s.countsTowardOneRm);
  const result = new Map<number, boolean>();
  for (const set of prescribedSets) {
    if (anyDesignated) {
      result.set(set.setNumber, set.countsTowardOneRm);
      continue;
    }
    const reps = repsAchievedBySetNumber.get(set.setNumber) ?? null;
    result.set(set.setNumber, reps !== null && reps <= 10);
  }
  return result;
}

// Aggregates one session's qualifying sets for one exercise into a single
// 1RM estimate — highest Epley estimate among them, not an average (#5).
// Bodyweight-based exercises add the nearest weekly bodyweight log entry to
// actualWeightKg before running Epley; the caller resolves "nearest entry"
// (a DB query) and passes the resulting kg figure in.
//
// A bodyweight-based exercise with no bodyweightKg supplied (no bodyweight
// ever logged yet) returns null rather than defaulting the load to 0kg —
// silently computing an estimate off a fictitious 0kg bodyweight would
// produce a real-looking but badly wrong number instead of correctly
// reporting "not enough data yet."
export function computeSessionOneRmKg(
  qualifyingSets: { actualWeightKg: number; repsAchieved: number }[],
  opts: { isBodyweightBased: boolean; bodyweightKg?: number },
): number | null {
  if (qualifyingSets.length === 0) return null;
  if (opts.isBodyweightBased && opts.bodyweightKg === undefined) return null;
  // Safe: the branch above already returned when isBodyweightBased is true
  // and bodyweightKg is missing, so this fallback only ever applies to the
  // non-bodyweight-based case, where it's unused (load uses actualWeightKg
  // directly instead).
  const bodyweightKg = opts.bodyweightKg ?? 0;
  const estimates = qualifyingSets.map((s) => {
    const load = opts.isBodyweightBased
      ? bodyweightKg + s.actualWeightKg
      : s.actualWeightKg;
    return epley1Rm(load, s.repsAchieved);
  });
  return Math.max(...estimates);
}

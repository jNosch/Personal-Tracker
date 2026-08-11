// Pure simulation helpers for the realistic demo-data seed script (#49).
// Colocated in lib/ (not db/seed-demo.ts) per code-conventions.md's file-org
// rule — this is deterministic domain logic worth unit testing, not I/O.
// The script itself drives lib/schemes.ts's real prescribe()/update() engine
// per #49's resolved spec (simulate through the real engine, not fabricate
// independent numbers); these helpers only cover the parts that engine
// doesn't decide for you — how a lifter's actual performance and session
// dates plausibly look.

// Deterministic PRNG (mulberry32) — the seed script needs reproducible
// reruns (#49's resolved spec: fixed seed, not fresh randomness every run)
// so a chart oddity found once stays reproducible instead of being chased
// across different random data on every run.
export function createPrng(seed: number): () => number {
  let state = seed | 0;
  return function () {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Integer in [min, max], inclusive both ends.
export function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

// Plausible reps for one prescribed set (#49) — mimics a real lifter mostly
// hitting the prescribed target with occasional misses/good days, not a
// perfectly robotic hit-every-time simulation.
//
// Takes weight alongside repTarget, not repTarget alone — schemes.ts's
// PrescribedSet doc comment is explicit that null weight *and* null
// repTarget *together* mean "nothing to log at all" (Failure Sets only,
// #19). Rep Accumulation also has a null repTarget (its target is a
// whole-session total, not a per-set number, see schemes.ts) but a real
// prescribedWeightKg, and still expects a real logged rep count — treating
// "repTarget === null" alone as "nothing to log" silently drops every Rep
// Accumulation set's reps, which starved its 1RM estimate entirely (found
// live-running this against the dev DB: Pull-up, tracks_1rm + Rep
// Accumulation, got zero estimates).
export function simulateReps(
  set: {
    repTarget: number | "AMRAP" | null;
    prescribedWeightKg: number | null;
  },
  rng: () => number,
): number | null {
  const { repTarget, prescribedWeightKg } = set;
  if (repTarget === null && prescribedWeightKg === null) return null;
  if (repTarget === "AMRAP") {
    // No percentage context at this level — just a plausible AMRAP rep
    // count on its own, biased toward the low-single-digits real AMRAP
    // sets usually land on.
    return randInt(rng, 1, 6);
  }
  if (repTarget === null) {
    // Rep Accumulation: no specific number to hit or miss against, just a
    // plausible per-set rep count.
    return randInt(rng, 6, 12);
  }
  // ~80% hit-or-exceed the target by 0-2 reps, ~20% miss by 1-2 (floored at
  // 1 — a set with 0 reps logged isn't realistic demo data).
  const hits = rng() < 0.8;
  if (hits) return repTarget + randInt(rng, 0, 2);
  return Math.max(1, repTarget - randInt(rng, 1, 2));
}

// Ascending, distinct ISO session dates across [startDate, endDate] (#49) —
// `count` dates spread roughly evenly across the window rather than landing
// in an unrealistic perfectly-robotic cadence, but never collapsing onto
// the same calendar day: the exact same-day collapse the chart already has
// a bug fixed for (#46) — demo data shouldn't reintroduce the case that fix
// exists to guard against.
//
// Guaranteed unique by construction (not by generating collisions and then
// resolving them, which an earlier version of this function did — an
// independent +/-1 day jitter per candidate could still collide at a
// tight-fit boundary and a bounded forward-nudge couldn't always recover,
// caught by this file's own test suite): the window is split into `count`
// non-overlapping day-buckets up front, and one random day is picked from
// within each bucket's own exclusive range. Distinct buckets can never
// produce the same day. Only impossible when `count` exceeds the number of
// days actually available in the window — a programmer error for this
// script's own fixed call sites, not a case real callers need to recover
// from gracefully.
export function scheduleSessionDates(
  startDate: string,
  endDate: string,
  count: number,
  rng: () => number,
): string[] {
  if (count <= 0) return [];
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  const totalDays = Math.max(1, Math.round((end - start) / 86_400_000)) + 1;
  if (count > totalDays) {
    throw new Error(
      `scheduleSessionDates: cannot place ${count} distinct dates in a ${totalDays}-day window (${startDate} to ${endDate}).`,
    );
  }
  const dates: string[] = [];
  for (let i = 0; i < count; i++) {
    const bucketStart = Math.floor((i * totalDays) / count);
    const bucketEnd = Math.floor(((i + 1) * totalDays) / count) - 1;
    const offset = randInt(rng, bucketStart, Math.max(bucketStart, bucketEnd));
    dates.push(
      new Date(start + offset * 86_400_000).toISOString().slice(0, 10),
    );
  }
  return dates;
}

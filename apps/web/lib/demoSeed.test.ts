import { describe, expect, it } from "vitest";
import {
  createPrng,
  randInt,
  scheduleSessionDates,
  simulateReps,
} from "./demoSeed";

describe("createPrng", () => {
  it("is deterministic — same seed produces the same sequence", () => {
    const a = createPrng(42);
    const b = createPrng(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });

  it("produces values in [0, 1)", () => {
    const rng = createPrng(1);
    for (let i = 0; i < 50; i++) {
      const v = rng();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("different seeds diverge", () => {
    const a = createPrng(1);
    const b = createPrng(2);
    expect(a()).not.toBe(b());
  });
});

describe("randInt", () => {
  it("stays within [min, max] inclusive across many draws", () => {
    const rng = createPrng(7);
    for (let i = 0; i < 100; i++) {
      const v = randInt(rng, 3, 5);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(5);
    }
  });

  it("returns the single possible value when min === max", () => {
    const rng = createPrng(7);
    expect(randInt(rng, 4, 4)).toBe(4);
  });
});

describe("simulateReps", () => {
  it("returns null only when weight AND repTarget are both null — Failure Sets' actual contract (schemes.ts), not repTarget alone", () => {
    expect(
      simulateReps(
        { repTarget: null, prescribedWeightKg: null },
        createPrng(1),
      ),
    ).toBeNull();
  });

  it("still logs a plausible rep count for a null repTarget when weight isn't null — Rep Accumulation's shape (whole-session target, not per-set, but a real weight)", () => {
    const rng = createPrng(2);
    for (let i = 0; i < 50; i++) {
      const reps = simulateReps(
        { repTarget: null, prescribedWeightKg: 40 },
        rng,
      );
      expect(reps).toBeGreaterThanOrEqual(6);
      expect(reps).toBeLessThanOrEqual(12);
    }
  });

  it("returns a plausible AMRAP rep count (1-6) with no percentage context", () => {
    const rng = createPrng(3);
    for (let i = 0; i < 50; i++) {
      const reps = simulateReps(
        { repTarget: "AMRAP", prescribedWeightKg: 100 },
        rng,
      );
      expect(reps).toBeGreaterThanOrEqual(1);
      expect(reps).toBeLessThanOrEqual(6);
    }
  });

  it("hits (meets or exceeds) the target when the roll is under 0.8", () => {
    // A stub rng returning 0 always takes the "hits" branch (0 < 0.8) and
    // makes every randInt() draw its minimum (0), so this is fully
    // deterministic: target + 0.
    const alwaysHits = () => 0;
    expect(
      simulateReps({ repTarget: 5, prescribedWeightKg: 50 }, alwaysHits),
    ).toBe(5);
  });

  it("misses the target (floored at 1) when the roll is 0.8 or over", () => {
    // A stub rng returning 0.9 always takes the "miss" branch and makes
    // randInt() draw its maximum for [1,2] -> 2, so target - 2.
    const alwaysMisses = () => 0.9;
    expect(
      simulateReps({ repTarget: 5, prescribedWeightKg: 50 }, alwaysMisses),
    ).toBe(3);
  });

  it("floors a miss at 1 rep — a 0-rep set isn't realistic demo data", () => {
    const alwaysMisses = () => 0.9;
    expect(
      simulateReps({ repTarget: 2, prescribedWeightKg: 50 }, alwaysMisses),
    ).toBe(1);
  });
});

describe("scheduleSessionDates", () => {
  it("returns an empty array for a non-positive count", () => {
    expect(
      scheduleSessionDates("2026-01-01", "2026-02-01", 0, createPrng(1)),
    ).toEqual([]);
  });

  it("returns exactly `count` dates, ascending, all within the window", () => {
    const dates = scheduleSessionDates(
      "2026-01-01",
      "2026-03-01",
      12,
      createPrng(5),
    );
    expect(dates).toHaveLength(12);
    expect([...dates].sort()).toEqual(dates);
    for (const d of dates) {
      expect(d >= "2026-01-01").toBe(true);
      expect(d <= "2026-03-01").toBe(true);
    }
  });

  it("never returns duplicate dates, even with a dense schedule that would otherwise collide (guards against #46's same-day chart collapse)", () => {
    const dates = scheduleSessionDates(
      "2026-01-01",
      "2026-01-15",
      14,
      createPrng(9),
    );
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("is deterministic — same seed and inputs produce the same schedule", () => {
    const a = scheduleSessionDates(
      "2026-01-01",
      "2026-04-01",
      20,
      createPrng(11),
    );
    const b = scheduleSessionDates(
      "2026-01-01",
      "2026-04-01",
      20,
      createPrng(11),
    );
    expect(a).toEqual(b);
  });

  it("throws rather than silently producing duplicates when count exceeds the days available", () => {
    // 2026-01-01 to 2026-01-03 is a 3-day window; 4 distinct dates don't fit.
    expect(() =>
      scheduleSessionDates("2026-01-01", "2026-01-03", 4, createPrng(1)),
    ).toThrow();
  });
});

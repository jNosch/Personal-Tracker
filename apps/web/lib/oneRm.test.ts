// 1RM calculation rules, locked in #5: highest Epley estimate among
// qualifying sets per (exercise, session); qualifying sets are either the
// scheme's static designation, or a reps-<=10 fallback when nothing was
// designated.
import { describe, expect, it } from "vitest";
import { computeSessionOneRmKg, resolveCountsTowardOneRm } from "./oneRm";
import type { PrescribedSet } from "./schemes";

describe("resolveCountsTowardOneRm", () => {
  it("honors the scheme's static designation when any set was designated", () => {
    const prescribed: PrescribedSet[] = [
      {
        setNumber: 1,
        prescribedWeightKg: 100,
        repTarget: 5,
        countsTowardOneRm: true,
      },
      {
        setNumber: 2,
        prescribedWeightKg: 80,
        repTarget: 5,
        countsTowardOneRm: false,
      },
    ];
    // Even though set 2's logged reps would qualify under the fallback,
    // designation already exists for this exercise this session.
    const reps = new Map([
      [1, 5],
      [2, 4],
    ]);
    expect(resolveCountsTowardOneRm(prescribed, reps)).toEqual(
      new Map([
        [1, true],
        [2, false],
      ]),
    );
  });

  it("falls back to reps-achieved <= 10 when nothing was designated", () => {
    const prescribed: PrescribedSet[] = [
      {
        setNumber: 1,
        prescribedWeightKg: 60,
        repTarget: 8,
        countsTowardOneRm: false,
      },
      {
        setNumber: 2,
        prescribedWeightKg: 60,
        repTarget: 8,
        countsTowardOneRm: false,
      },
    ];
    const reps = new Map([
      [1, 8],
      [2, 12],
    ]);
    expect(resolveCountsTowardOneRm(prescribed, reps)).toEqual(
      new Map([
        [1, true],
        [2, false],
      ]),
    );
  });

  it("treats a missing/null reps entry as not qualifying under the fallback", () => {
    const prescribed: PrescribedSet[] = [
      {
        setNumber: 1,
        prescribedWeightKg: 60,
        repTarget: 8,
        countsTowardOneRm: false,
      },
    ];
    expect(resolveCountsTowardOneRm(prescribed, new Map())).toEqual(
      new Map([[1, false]]),
    );
  });
});

describe("computeSessionOneRmKg", () => {
  it("returns the highest Epley estimate among qualifying sets, not an average", () => {
    const result = computeSessionOneRmKg(
      [
        { actualWeightKg: 100, repsAchieved: 5 },
        { actualWeightKg: 100, repsAchieved: 3 },
      ],
      { isBodyweightBased: false },
    );
    // Epley(100,5) = 116.67, Epley(100,3) = 110 -> highest wins.
    expect(result).toBeCloseTo(116.67, 2);
  });

  it("returns null when there are no qualifying sets", () => {
    expect(computeSessionOneRmKg([], { isBodyweightBased: false })).toBeNull();
  });

  it("adds the nearest bodyweight entry to actual weight for bodyweight-based exercises", () => {
    const result = computeSessionOneRmKg(
      [{ actualWeightKg: 20, repsAchieved: 5 }],
      { isBodyweightBased: true, bodyweightKg: 80 },
    );
    // Total load = 80 + 20 = 100kg, same math as the non-bodyweight case above.
    expect(result).toBeCloseTo(epley1RmFor(100, 5), 2);
  });

  it("returns null for a bodyweight-based exercise with no bodyweight logged yet, rather than assuming 0kg", () => {
    const result = computeSessionOneRmKg(
      [{ actualWeightKg: 20, repsAchieved: 5 }],
      { isBodyweightBased: true },
    );
    expect(result).toBeNull();
  });
});

function epley1RmFor(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

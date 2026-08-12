import { describe, expect, it } from "vitest";
import type { PrescribedSet } from "./schemes";
import { effectiveReps, effectiveWeight, loggedTotalReps } from "./logEntry";

function set(overrides: Partial<PrescribedSet> = {}): PrescribedSet {
  return {
    setNumber: 1,
    prescribedWeightKg: 50,
    repTarget: 8,
    countsTowardOneRm: false,
    countsTowardRpeSignal: false,
    ...overrides,
  };
}

describe("effectiveWeight", () => {
  it("shows the current prescription when the user hasn't typed anything", () => {
    expect(
      effectiveWeight(
        { actualWeightKg: "", repsAchieved: "" },
        set({ prescribedWeightKg: 62.5 }),
      ),
    ).toBe(62.5);
  });

  it("shows whatever the user typed, overriding the prescription", () => {
    expect(
      effectiveWeight(
        { actualWeightKg: 65, repsAchieved: "" },
        set({ prescribedWeightKg: 62.5 }),
      ),
    ).toBe(65);
  });

  it("stays blank when both the entry and the prescription are blank (Failure Sets)", () => {
    expect(
      effectiveWeight(
        { actualWeightKg: "", repsAchieved: "" },
        set({ prescribedWeightKg: null }),
      ),
    ).toBe("");
  });
});

describe("effectiveReps", () => {
  it("pre-fills from a concrete numeric repTarget", () => {
    expect(
      effectiveReps(
        { actualWeightKg: "", repsAchieved: "" },
        set({ repTarget: 8 }),
      ),
    ).toBe(8);
  });

  it("shows whatever the user typed, overriding the target", () => {
    expect(
      effectiveReps(
        { actualWeightKg: "", repsAchieved: 6 },
        set({ repTarget: 8 }),
      ),
    ).toBe(6);
  });

  it("stays blank for a null repTarget (Rep Accumulation's whole-session target)", () => {
    expect(
      effectiveReps(
        { actualWeightKg: "", repsAchieved: "" },
        set({ repTarget: null }),
      ),
    ).toBe("");
  });

  it("stays blank for AMRAP — no sensible number to default to", () => {
    expect(
      effectiveReps(
        { actualWeightKg: "", repsAchieved: "" },
        set({ repTarget: "AMRAP" }),
      ),
    ).toBe("");
  });
});

describe("loggedTotalReps", () => {
  const sets: PrescribedSet[] = [
    set({ setNumber: 1 }),
    set({ setNumber: 2 }),
    set({ setNumber: 3 }),
  ];

  it("sums whatever's been entered so far, treating blank sets as 0", () => {
    expect(
      loggedTotalReps(sets, {
        1: { actualWeightKg: 17, repsAchieved: 12 },
        2: { actualWeightKg: 17, repsAchieved: 10 },
        // set 3 not entered yet
      }),
    ).toBe(22);
  });

  it("returns 0 when nothing's been entered yet", () => {
    expect(loggedTotalReps(sets, {})).toBe(0);
  });

  it("ignores blank ('') entries, not just missing ones", () => {
    expect(
      loggedTotalReps(sets, {
        1: { actualWeightKg: 17, repsAchieved: "" },
        2: { actualWeightKg: 17, repsAchieved: 10 },
      }),
    ).toBe(10);
  });
});

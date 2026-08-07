// Locked defaults per issue: #8 (Double Progression), #16 (Wave), #17 (Rep
// Accumulation), #18 (Top-set + back-off), #19 (Failure Sets). Every
// exercise-in-day always has exactly one scheme (#8) — defaultConfigFor is
// what makes that guarantee real at the call sites in app/programs/actions.ts.
import { describe, expect, it } from "vitest";
import {
  defaultConfigFor,
  PRESET_5_3_1_WEEK_TABLE,
  SCHEME_CATALOG,
} from "./schemes";

describe("defaultConfigFor", () => {
  it("returns Double Progression's locked defaults", () => {
    expect(defaultConfigFor("double_progression")).toEqual({
      type: "double_progression",
      config: {
        repRangeLow: 8,
        repRangeHigh: 12,
        setCount: 3,
        weightIncrement: 2.5,
      },
    });
  });

  it("returns Wave's locked defaults, including the 5/3/1 preset table", () => {
    const scheme = defaultConfigFor("wave");
    expect(scheme.type).toBe("wave");
    if (scheme.type !== "wave") throw new Error("unreachable");
    expect(scheme.config.trainingMaxPercentage).toBe(90);
    expect(scheme.config.deloadMode).toBe("on_regression");
    expect(scheme.config.usePreset).toBe(true);
    expect(scheme.config.supplementalSetType).toBe("none");
    expect(scheme.config.weekTable).toBe(PRESET_5_3_1_WEEK_TABLE);
  });

  it("returns Rep Accumulation's locked defaults", () => {
    expect(defaultConfigFor("rep_accumulation")).toEqual({
      type: "rep_accumulation",
      config: { targetTotalReps: 50, setCount: 5, weightIncrement: 2.5 },
    });
  });

  it("returns Top-set + back-off's locked defaults", () => {
    expect(defaultConfigFor("topset_backoff")).toEqual({
      type: "topset_backoff",
      config: {
        topSetRepRangeLow: 1,
        topSetRepRangeHigh: 3,
        weightIncrement: 2.5,
        backoffPercentage: 85,
        backoffSetCount: 3,
        backoffRepTarget: 5,
      },
    });
  });

  it("returns Failure Sets' locked defaults — no weight, no reps, no state", () => {
    expect(defaultConfigFor("failure_sets")).toEqual({
      type: "failure_sets",
      config: { setCount: 3 },
    });
  });
});

describe("SCHEME_CATALOG", () => {
  it("requires tracks_1rm only for Wave and Top-set + back-off, per #15", () => {
    const requiring = SCHEME_CATALOG.filter((s) => s.requiresTracksOneRm).map(
      (s) => s.type,
    );
    expect(requiring.sort()).toEqual(["topset_backoff", "wave"]);
  });

  it("has exactly the 5 locked scheme types, no more, no fewer", () => {
    expect(SCHEME_CATALOG.map((s) => s.type).sort()).toEqual(
      [
        "double_progression",
        "failure_sets",
        "rep_accumulation",
        "topset_backoff",
        "wave",
      ].sort(),
    );
  });
});

describe("PRESET_5_3_1_WEEK_TABLE", () => {
  it("matches the exact 5/3/1 week table locked in #16", () => {
    expect(PRESET_5_3_1_WEEK_TABLE).toEqual([
      [
        { percentageOfTrainingMax: 65, repTarget: 5 },
        { percentageOfTrainingMax: 75, repTarget: 5 },
        { percentageOfTrainingMax: 85, repTarget: "AMRAP" },
      ],
      [
        { percentageOfTrainingMax: 70, repTarget: 3 },
        { percentageOfTrainingMax: 80, repTarget: 3 },
        { percentageOfTrainingMax: 90, repTarget: "AMRAP" },
      ],
      [
        { percentageOfTrainingMax: 75, repTarget: 5 },
        { percentageOfTrainingMax: 85, repTarget: 3 },
        { percentageOfTrainingMax: 95, repTarget: "AMRAP" },
      ],
    ]);
  });
});

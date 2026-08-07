// Locked defaults per issue: #8 (Double Progression), #16 (Wave), #17 (Rep
// Accumulation), #18 (Top-set + back-off), #19 (Failure Sets). Every
// exercise-in-day always has exactly one scheme (#8) — defaultConfigFor is
// what makes that guarantee real at the call sites in app/programs/actions.ts.
import { describe, expect, it } from "vitest";
import {
  defaultConfigFor,
  epley1Rm,
  PRESET_5_3_1_WEEK_TABLE,
  prescribe,
  SCHEME_CATALOG,
  update,
  type DoubleProgressionConfig,
  type FailureSetsConfig,
  type LoggedSetInput,
  type RepAccumulationConfig,
  type TopsetBackoffConfig,
  type WaveConfig,
  type WaveState,
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

describe("epley1Rm", () => {
  it("computes 1RM = weight x (1 + reps/30)", () => {
    expect(epley1Rm(100, 5)).toBeCloseTo(116.67, 2);
    expect(epley1Rm(100, 0)).toBe(100);
  });
});

describe("prescribe/update: double_progression", () => {
  const config: DoubleProgressionConfig = {
    repRangeLow: 8,
    repRangeHigh: 12,
    setCount: 3,
    weightIncrement: 2.5,
  };
  const scheme = { type: "double_progression" as const, config };

  it("prescribes blank weight and repRangeLow as the target on first use", () => {
    const sets = prescribe(scheme, {});
    expect(sets).toEqual([
      {
        setNumber: 1,
        prescribedWeightKg: 0,
        repTarget: 8,
        countsTowardOneRm: false,
      },
      {
        setNumber: 2,
        prescribedWeightKg: 0,
        repTarget: 8,
        countsTowardOneRm: false,
      },
      {
        setNumber: 3,
        prescribedWeightKg: 0,
        repTarget: 8,
        countsTowardOneRm: false,
      },
    ]);
  });

  it("bootstraps state.currentWeightKg from the first logged session's actual weight", () => {
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 60 },
    ];
    expect(update(scheme, {}, sets)).toEqual({
      currentWeightKg: 60,
      currentRepTarget: 8,
    });
  });

  it("climbs the rep target by 1 when every set hits it, below the range top", () => {
    const state = { currentWeightKg: 60, currentRepTarget: 8 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 8, actualWeightKg: 60 },
      { setNumber: 2, repsAchieved: 9, actualWeightKg: 60 },
      { setNumber: 3, repsAchieved: 8, actualWeightKg: 60 },
    ];
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 60,
      currentRepTarget: 9,
    });
  });

  it("bumps weight and resets target to the range low when hitting target at the range top", () => {
    const state = { currentWeightKg: 60, currentRepTarget: 12 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 12, actualWeightKg: 60 },
      { setNumber: 2, repsAchieved: 12, actualWeightKg: 60 },
      { setNumber: 3, repsAchieved: 13, actualWeightKg: 60 },
    ];
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 62.5,
      currentRepTarget: 8,
    });
  });

  it("makes no change when any set falls short", () => {
    const state = { currentWeightKg: 60, currentRepTarget: 8 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 8, actualWeightKg: 60 },
      { setNumber: 2, repsAchieved: 7, actualWeightKg: 60 },
      { setNumber: 3, repsAchieved: 8, actualWeightKg: 60 },
    ];
    expect(update(scheme, state, sets)).toEqual(state);
  });
});

describe("prescribe/update: rep_accumulation", () => {
  const config: RepAccumulationConfig = {
    targetTotalReps: 50,
    setCount: 5,
    weightIncrement: 2.5,
  };
  const scheme = { type: "rep_accumulation" as const, config };

  it("prescribes every set as program-designated toward 1RM, no per-set rep target", () => {
    const sets = prescribe(scheme, { currentWeightKg: 40 });
    expect(sets).toHaveLength(5);
    expect(sets.every((s) => s.countsTowardOneRm)).toBe(true);
    expect(sets.every((s) => s.repTarget === null)).toBe(true);
    expect(sets.every((s) => s.prescribedWeightKg === 40)).toBe(true);
  });

  it("increases weight when the summed reps across sets hit the total target", () => {
    const sets: LoggedSetInput[] = [10, 10, 10, 10, 10].map((reps, i) => ({
      setNumber: i + 1,
      repsAchieved: reps,
      actualWeightKg: 40,
    }));
    expect(update(scheme, { currentWeightKg: 40 }, sets)).toEqual({
      currentWeightKg: 42.5,
    });
  });

  it("makes no change when the summed total falls short", () => {
    const sets: LoggedSetInput[] = [8, 8, 8, 8, 8].map((reps, i) => ({
      setNumber: i + 1,
      repsAchieved: reps,
      actualWeightKg: 40,
    }));
    expect(update(scheme, { currentWeightKg: 40 }, sets)).toEqual({
      currentWeightKg: 40,
    });
  });
});

describe("prescribe/update: topset_backoff", () => {
  const config: TopsetBackoffConfig = {
    topSetRepRangeLow: 1,
    topSetRepRangeHigh: 3,
    weightIncrement: 2.5,
    backoffPercentage: 80,
    backoffSetCount: 2,
    backoffRepTarget: 5,
  };
  const scheme = { type: "topset_backoff" as const, config };

  it("prescribes the top set (designated) plus back-off sets derived from its prescribed weight", () => {
    const sets = prescribe(scheme, {
      currentWeightKg: 100,
      currentRepTarget: 1,
    });
    expect(sets).toEqual([
      {
        setNumber: 1,
        prescribedWeightKg: 100,
        repTarget: 1,
        countsTowardOneRm: true,
      },
      {
        setNumber: 2,
        prescribedWeightKg: 80,
        repTarget: 5,
        countsTowardOneRm: false,
      },
      {
        setNumber: 3,
        prescribedWeightKg: 80,
        repTarget: 5,
        countsTowardOneRm: false,
      },
    ]);
  });

  it("climbs the top set's target, ignoring back-off performance entirely", () => {
    const state = { currentWeightKg: 100, currentRepTarget: 1 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 1, actualWeightKg: 100 },
      { setNumber: 2, repsAchieved: 0, actualWeightKg: 80 },
    ];
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 100,
      currentRepTarget: 2,
    });
  });

  it("bumps weight and resets target when the top set hits target at the range top", () => {
    const state = { currentWeightKg: 100, currentRepTarget: 3 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 3, actualWeightKg: 100 },
    ];
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 102.5,
      currentRepTarget: 1,
    });
  });
});

describe("prescribe/update: failure_sets", () => {
  const config: FailureSetsConfig = { setCount: 3 };
  const scheme = { type: "failure_sets" as const, config };

  it("prescribes null weight and null rep target for every set — nothing to log", () => {
    const sets = prescribe(scheme, {});
    expect(sets).toEqual([
      {
        setNumber: 1,
        prescribedWeightKg: null,
        repTarget: null,
        countsTowardOneRm: false,
      },
      {
        setNumber: 2,
        prescribedWeightKg: null,
        repTarget: null,
        countsTowardOneRm: false,
      },
      {
        setNumber: 3,
        prescribedWeightKg: null,
        repTarget: null,
        countsTowardOneRm: false,
      },
    ]);
  });

  it("update is a true no-op regardless of input", () => {
    expect(update(scheme, { anything: "here" }, [])).toEqual({});
  });
});

describe("prescribe/update: wave", () => {
  const config: WaveConfig = {
    trainingMaxPercentage: 90,
    deloadMode: "on_regression",
    usePreset: true,
    weekTable: PRESET_5_3_1_WEEK_TABLE,
    supplementalSetType: "none",
  };
  const scheme = { type: "wave" as const, config };

  it("prescribes week 1's percentages against the training max, marking the AMRAP set", () => {
    const sets = prescribe(scheme, { trainingMaxKg: 100, weekIndex: 0 });
    expect(sets).toEqual([
      {
        setNumber: 1,
        prescribedWeightKg: 65,
        repTarget: 5,
        countsTowardOneRm: false,
      },
      {
        setNumber: 2,
        prescribedWeightKg: 75,
        repTarget: 5,
        countsTowardOneRm: false,
      },
      {
        setNumber: 3,
        prescribedWeightKg: 85,
        repTarget: "AMRAP",
        countsTowardOneRm: true,
      },
    ]);
  });

  it("appends BBB supplemental sets at 50% of training max after the main sets", () => {
    const bbbScheme = {
      type: "wave" as const,
      config: { ...config, supplementalSetType: "bbb" as const },
    };
    const sets = prescribe(bbbScheme, { trainingMaxKg: 100, weekIndex: 0 });
    expect(sets).toHaveLength(3 + 5);
    expect(sets.slice(3)).toEqual(
      Array.from({ length: 5 }, (_, i) => ({
        setNumber: 4 + i,
        prescribedWeightKg: 50,
        repTarget: 10,
        countsTowardOneRm: false,
      })),
    );
  });

  it("advances weekIndex without recalculating training max mid-cycle", () => {
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 65 },
      { setNumber: 2, repsAchieved: 5, actualWeightKg: 75 },
      { setNumber: 3, repsAchieved: 8, actualWeightKg: 85 },
    ];
    expect(update(scheme, { trainingMaxKg: 100, weekIndex: 0 }, sets)).toEqual({
      trainingMaxKg: 100,
      weekIndex: 1,
      inDeload: false,
    });
  });

  it("recalculates training max from week 3's AMRAP set and rolls into next cycle when not deloading", () => {
    const neverDeload: WaveConfig = { ...config, deloadMode: "never" };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 75 },
      { setNumber: 2, repsAchieved: 3, actualWeightKg: 85 },
      { setNumber: 3, repsAchieved: 5, actualWeightKg: 95 },
    ];
    const result = update(
      { type: "wave" as const, config: neverDeload },
      { trainingMaxKg: 100, weekIndex: 2 },
      sets,
    );
    // Epley(95, 5) = 110.83 -> x90% = 99.75 -> rounded to nearest 0.5 = 100.
    expect(result).toEqual({
      trainingMaxKg: 100,
      weekIndex: 0,
      inDeload: false,
    });
  });

  it("enters deload when deloadMode is 'always', regardless of performance", () => {
    const alwaysDeload: WaveConfig = { ...config, deloadMode: "always" };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 75 },
      { setNumber: 2, repsAchieved: 3, actualWeightKg: 85 },
      { setNumber: 3, repsAchieved: 5, actualWeightKg: 95 },
    ];
    const result = update(
      { type: "wave" as const, config: alwaysDeload },
      { trainingMaxKg: 100, weekIndex: 2 },
      sets,
    ) as WaveState;
    expect(result.inDeload).toBe(true);
  });

  it("enters deload on 'on_regression' only when the recalculated TM is strictly lower", () => {
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 75 },
      { setNumber: 2, repsAchieved: 3, actualWeightKg: 85 },
      // A weak AMRAP set that produces a lower estimate than the current TM.
      { setNumber: 3, repsAchieved: 1, actualWeightKg: 90 },
    ];
    const result = update(
      scheme,
      { trainingMaxKg: 100, weekIndex: 2 },
      sets,
    ) as WaveState;
    expect(result.inDeload).toBe(true);
  });

  it("prescribes the fixed deload week and never recalculates training max from it", () => {
    const sets = prescribe(scheme, { trainingMaxKg: 100, inDeload: true });
    expect(sets).toEqual([
      {
        setNumber: 1,
        prescribedWeightKg: 40,
        repTarget: 5,
        countsTowardOneRm: false,
      },
      {
        setNumber: 2,
        prescribedWeightKg: 50,
        repTarget: 5,
        countsTowardOneRm: false,
      },
      {
        setNumber: 3,
        prescribedWeightKg: 60,
        repTarget: 5,
        countsTowardOneRm: false,
      },
    ]);

    const result = update(
      scheme,
      { trainingMaxKg: 100, weekIndex: 2, inDeload: true },
      [],
    );
    expect(result).toEqual({
      trainingMaxKg: 100,
      weekIndex: 0,
      inDeload: false,
    });
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

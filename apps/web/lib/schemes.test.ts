// Locked defaults per issue: #8 (Double Progression), #16 (Wave), #17 (Rep
// Accumulation), #18 (Top-set + back-off), #19 (Failure Sets). Every
// exercise-in-day always has exactly one scheme (#8) — defaultConfigFor is
// what makes that guarantee real at the call sites in app/programs/actions.ts.
import { describe, expect, it } from "vitest";
import {
  acceptDoubleProgressionDeloadSuggestion,
  acceptRpeDeloadSuggestion,
  acceptTopsetBackoffDeloadSuggestion,
  defaultConfigFor,
  epley1Rm,
  pickWaveSignalSetNumber,
  PRESET_5_3_1_WEEK_TABLE,
  prescribe,
  SCHEME_CATALOG,
  rpeDeloadEligibleForScheme,
  update,
  type DoubleProgressionConfig,
  type FailureSetsConfig,
  type LoggedSetInput,
  type RepAccumulationConfig,
  type TopsetBackoffConfig,
  type TopsetBackoffState,
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
        deloadCutPercentage: 60,
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
        deloadCutPercentage: 60,
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
    deloadCutPercentage: 60,
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
        countsTowardRpeSignal: false,
      },
      {
        setNumber: 2,
        prescribedWeightKg: 0,
        repTarget: 8,
        countsTowardOneRm: false,
        countsTowardRpeSignal: false,
      },
      {
        setNumber: 3,
        prescribedWeightKg: 0,
        repTarget: 8,
        countsTowardOneRm: false,
        countsTowardRpeSignal: false,
      },
    ]);
  });

  it("bootstraps state.currentWeightKg from the first logged session's actual weight", () => {
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 60, rpe: null },
    ];
    expect(update(scheme, {}, sets)).toEqual({
      currentWeightKg: 60,
      currentRepTarget: 8,
      redStreak: 0,
    });
  });

  it("climbs the rep target by 1 when every set hits it, below the range top", () => {
    const state = { currentWeightKg: 60, currentRepTarget: 8 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 8, actualWeightKg: 60, rpe: null },
      { setNumber: 2, repsAchieved: 9, actualWeightKg: 60, rpe: null },
      { setNumber: 3, repsAchieved: 8, actualWeightKg: 60, rpe: null },
    ];
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 60,
      currentRepTarget: 9,
      redStreak: 0,
    });
  });

  it("bumps weight and resets target to the range low when hitting target at the range top", () => {
    const state = { currentWeightKg: 60, currentRepTarget: 12 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 12, actualWeightKg: 60, rpe: null },
      { setNumber: 2, repsAchieved: 12, actualWeightKg: 60, rpe: null },
      { setNumber: 3, repsAchieved: 13, actualWeightKg: 60, rpe: null },
    ];
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 62.5,
      currentRepTarget: 8,
      redStreak: 0,
    });
  });

  it("makes no change when any set falls short", () => {
    const state = { currentWeightKg: 60, currentRepTarget: 8 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 8, actualWeightKg: 60, rpe: null },
      { setNumber: 2, repsAchieved: 7, actualWeightKg: 60, rpe: null },
      { setNumber: 3, repsAchieved: 8, actualWeightKg: 60, rpe: null },
    ];
    expect(update(scheme, state, sets)).toEqual({ ...state, redStreak: 0 });
  });
});

// #61: RPE-triggered deload suggestion for Double Progression.
describe("prescribe/update: double_progression RPE deload (#61)", () => {
  const config: DoubleProgressionConfig = {
    repRangeLow: 8,
    repRangeHigh: 12,
    setCount: 3,
    weightIncrement: 2.5,
    deloadCutPercentage: 60,
  };
  const scheme = { type: "double_progression" as const, config };

  function setsAt(rpe: number | null, repsAchieved = 8): LoggedSetInput[] {
    return [1, 2, 3].map((setNumber) => ({
      setNumber,
      repsAchieved,
      actualWeightKg: 60,
      rpe,
    }));
  }

  it("increments redStreak when every set's RPE is at/above the threshold", () => {
    const state = { currentWeightKg: 60, currentRepTarget: 8, redStreak: 2 };
    expect(update(scheme, state, setsAt(9))).toEqual({
      currentWeightKg: 60,
      currentRepTarget: 9,
      redStreak: 3,
    });
  });

  it("resets redStreak to 0 when the average RPE is below the threshold", () => {
    const state = { currentWeightKg: 60, currentRepTarget: 8, redStreak: 2 };
    expect(update(scheme, state, setsAt(6))).toEqual({
      currentWeightKg: 60,
      currentRepTarget: 9,
      redStreak: 0,
    });
  });

  it("resets redStreak to 0 when any set is missing RPE, not a partial average", () => {
    const state = { currentWeightKg: 60, currentRepTarget: 8, redStreak: 2 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 8, actualWeightKg: 60, rpe: 9.5 },
      { setNumber: 2, repsAchieved: 8, actualWeightKg: 60, rpe: 9.5 },
      { setNumber: 3, repsAchieved: 8, actualWeightKg: 60, rpe: null }, // missing
    ];
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 60,
      currentRepTarget: 9,
      redStreak: 0,
    });
  });

  it("prescribes the cut weight for exactly one session once deloadPending is set", () => {
    const sets = prescribe(scheme, {
      currentWeightKg: 100,
      currentRepTarget: 8,
      deloadPending: true,
    });
    expect(sets.every((s) => s.prescribedWeightKg === 60)).toBe(true); // 60% of 100
    expect(sets.every((s) => s.repTarget === 8)).toBe(true); // reps untouched
  });

  it("prescribes the untouched weight once deloadPending is false/absent", () => {
    const sets = prescribe(scheme, {
      currentWeightKg: 100,
      currentRepTarget: 8,
    });
    expect(sets.every((s) => s.prescribedWeightKg === 100)).toBe(true);
  });

  it("ignores the deload session's actual performance entirely, clears deloadPending, resets redStreak", () => {
    const state = {
      currentWeightKg: 100,
      currentRepTarget: 8,
      deloadPending: true,
      redStreak: 3,
    };
    // Even a blowout session (way past target) doesn't climb — the deload
    // session is a no-op for progression purposes.
    const sets = setsAt(9.5, 20);
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 100,
      currentRepTarget: 8,
      deloadPending: false,
      redStreak: 0,
    });
  });

  it("acceptDoubleProgressionDeloadSuggestion sets deloadPending and resets redStreak, leaves weight/reps untouched", () => {
    const state = { currentWeightKg: 100, currentRepTarget: 8, redStreak: 3 };
    expect(acceptDoubleProgressionDeloadSuggestion(state)).toEqual({
      currentWeightKg: 100,
      currentRepTarget: 8,
      deloadPending: true,
      redStreak: 0,
    });
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
      rpe: null,
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
      rpe: null,
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
    deloadCutPercentage: 60,
  };
  const scheme = { type: "topset_backoff" as const, config };

  it("prescribes the top set (designated, and the RPE signal set) plus back-off sets derived from its prescribed weight", () => {
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
        countsTowardRpeSignal: true,
      },
      {
        setNumber: 2,
        prescribedWeightKg: 80,
        repTarget: 5,
        countsTowardOneRm: false,
        countsTowardRpeSignal: false,
      },
      {
        setNumber: 3,
        prescribedWeightKg: 80,
        repTarget: 5,
        countsTowardOneRm: false,
        countsTowardRpeSignal: false,
      },
    ]);
  });

  it("climbs the top set's target, ignoring back-off performance entirely", () => {
    const state = { currentWeightKg: 100, currentRepTarget: 1 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 1, actualWeightKg: 100, rpe: null },
      { setNumber: 2, repsAchieved: 0, actualWeightKg: 80, rpe: null },
    ];
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 100,
      currentRepTarget: 2,
      redStreak: 0,
    });
  });

  it("bumps weight and resets target when the top set hits target at the range top", () => {
    const state = { currentWeightKg: 100, currentRepTarget: 3 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 3, actualWeightKg: 100, rpe: null },
    ];
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 102.5,
      currentRepTarget: 1,
      redStreak: 0,
    });
  });
});

// #61: RPE-triggered deload suggestion for Top-set+Backoff.
describe("prescribe/update: topset_backoff RPE deload (#61)", () => {
  const config: TopsetBackoffConfig = {
    topSetRepRangeLow: 1,
    topSetRepRangeHigh: 3,
    weightIncrement: 2.5,
    backoffPercentage: 80,
    backoffSetCount: 2,
    backoffRepTarget: 5,
    deloadCutPercentage: 60,
  };
  const scheme = { type: "topset_backoff" as const, config };

  it("increments redStreak when the top set's RPE is at/above the threshold", () => {
    const state = { currentWeightKg: 100, currentRepTarget: 1, redStreak: 2 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 1, actualWeightKg: 100, rpe: 9.5 },
    ];
    const result = update(scheme, state, sets) as TopsetBackoffState;
    expect(result.redStreak).toBe(3);
  });

  it("resets redStreak when the top set's RPE is below the threshold, regardless of back-off RPE", () => {
    const state = { currentWeightKg: 100, currentRepTarget: 1, redStreak: 2 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 1, actualWeightKg: 100, rpe: 6 },
      // Even a brutal back-off set doesn't count — top set only (#61).
      { setNumber: 2, repsAchieved: 5, actualWeightKg: 80, rpe: 9.8 },
    ];
    const result = update(scheme, state, sets) as TopsetBackoffState;
    expect(result.redStreak).toBe(0);
  });

  it("resets redStreak when the top set is missing RPE", () => {
    const state = { currentWeightKg: 100, currentRepTarget: 1, redStreak: 2 };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 1, actualWeightKg: 100, rpe: null },
    ];
    const result = update(scheme, state, sets) as TopsetBackoffState;
    expect(result.redStreak).toBe(0);
  });

  it("prescribes the cut weight for exactly one session once deloadPending is set, scaling back-off sets too", () => {
    const sets = prescribe(scheme, {
      currentWeightKg: 100,
      currentRepTarget: 1,
      deloadPending: true,
    });
    // Top set: 60% of 100 = 60. Back-off: 80% of the *cut* 60 = 48, not 80.
    expect(sets[0]!.prescribedWeightKg).toBe(60);
    expect(sets[1]!.prescribedWeightKg).toBe(48);
    expect(sets[2]!.prescribedWeightKg).toBe(48);
    expect(sets[0]!.repTarget).toBe(1); // reps untouched
  });

  it("ignores the deload session's actual performance entirely, clears deloadPending, resets redStreak", () => {
    const state = {
      currentWeightKg: 100,
      currentRepTarget: 1,
      deloadPending: true,
      redStreak: 3,
    };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 60, rpe: 9.8 }, // blowout, still no-op
    ];
    expect(update(scheme, state, sets)).toEqual({
      currentWeightKg: 100,
      currentRepTarget: 1,
      deloadPending: false,
      redStreak: 0,
    });
  });

  it("acceptTopsetBackoffDeloadSuggestion sets deloadPending and resets redStreak, leaves weight/reps untouched", () => {
    const state = { currentWeightKg: 100, currentRepTarget: 1, redStreak: 3 };
    expect(acceptTopsetBackoffDeloadSuggestion(state)).toEqual({
      currentWeightKg: 100,
      currentRepTarget: 1,
      deloadPending: true,
      redStreak: 0,
    });
  });
});

// #61: the shared scheme-type dispatch wrapper around isRpeDeloadEligible
// — every caller (Log page, Progress page) should be able to call this one
// function instead of switching on scheme.type and casting state
// themselves (the duplication code review caught even after
// isRpeDeloadEligible existed).
describe("rpeDeloadEligibleForScheme", () => {
  it("wave: reads inDeload as the 'already deloading' flag", () => {
    expect(
      rpeDeloadEligibleForScheme("wave", { redStreak: 3, inDeload: false }),
    ).toBe(true);
    expect(
      rpeDeloadEligibleForScheme("wave", { redStreak: 3, inDeload: true }),
    ).toBe(false);
  });

  it("double_progression: reads deloadPending as the 'already deloading' flag", () => {
    expect(
      rpeDeloadEligibleForScheme("double_progression", {
        redStreak: 3,
        deloadPending: false,
      }),
    ).toBe(true);
    expect(
      rpeDeloadEligibleForScheme("double_progression", {
        redStreak: 3,
        deloadPending: true,
      }),
    ).toBe(false);
  });

  it("topset_backoff: reads deloadPending as the 'already deloading' flag", () => {
    expect(
      rpeDeloadEligibleForScheme("topset_backoff", {
        redStreak: 3,
        deloadPending: false,
      }),
    ).toBe(true);
  });

  it("returns false below the redStreak threshold, for any eligible scheme", () => {
    expect(
      rpeDeloadEligibleForScheme("wave", { redStreak: 2, inDeload: false }),
    ).toBe(false);
  });

  it("returns false for schemes with no deload concept (rep_accumulation, failure_sets)", () => {
    expect(rpeDeloadEligibleForScheme("rep_accumulation", {})).toBe(false);
    expect(rpeDeloadEligibleForScheme("failure_sets", {})).toBe(false);
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
        countsTowardRpeSignal: false,
      },
      {
        setNumber: 2,
        prescribedWeightKg: null,
        repTarget: null,
        countsTowardOneRm: false,
        countsTowardRpeSignal: false,
      },
      {
        setNumber: 3,
        prescribedWeightKg: null,
        repTarget: null,
        countsTowardOneRm: false,
        countsTowardRpeSignal: false,
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
        countsTowardRpeSignal: false,
      },
      {
        setNumber: 2,
        prescribedWeightKg: 75,
        repTarget: 5,
        countsTowardOneRm: false,
        countsTowardRpeSignal: false,
      },
      {
        setNumber: 3,
        prescribedWeightKg: 85,
        repTarget: "AMRAP",
        countsTowardOneRm: true,
        // #60: the AMRAP set is also the RPE signal set — same set both
        // flags land on here, though the two flags aren't the same concept
        // (see PrescribedSet's own doc comment on countsTowardRpeSignal).
        countsTowardRpeSignal: true,
      },
    ]);
  });

  it("appends BBB supplemental sets at 50% of training max after the main sets, never flagged as the RPE signal", () => {
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
        countsTowardRpeSignal: false,
      })),
    );
  });

  it("advances weekIndex without recalculating training max mid-cycle", () => {
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 65, rpe: null },
      { setNumber: 2, repsAchieved: 5, actualWeightKg: 75, rpe: null },
      { setNumber: 3, repsAchieved: 8, actualWeightKg: 85, rpe: 7 },
    ];
    expect(update(scheme, { trainingMaxKg: 100, weekIndex: 0 }, sets)).toEqual({
      trainingMaxKg: 100,
      weekIndex: 1,
      inDeload: false,
      redStreak: 0,
    });
  });

  it("recalculates training max from week 3's AMRAP set and rolls into next cycle when not deloading", () => {
    const neverDeload: WaveConfig = { ...config, deloadMode: "never" };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 75, rpe: null },
      { setNumber: 2, repsAchieved: 3, actualWeightKg: 85, rpe: null },
      { setNumber: 3, repsAchieved: 5, actualWeightKg: 95, rpe: 7 },
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
      redStreak: 0,
    });
  });

  it("enters deload when deloadMode is 'always', regardless of performance", () => {
    const alwaysDeload: WaveConfig = { ...config, deloadMode: "always" };
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 75, rpe: null },
      { setNumber: 2, repsAchieved: 3, actualWeightKg: 85, rpe: null },
      { setNumber: 3, repsAchieved: 5, actualWeightKg: 95, rpe: null },
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
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 75, rpe: null },
      { setNumber: 2, repsAchieved: 3, actualWeightKg: 85, rpe: null },
      // A weak AMRAP set that produces a lower estimate than the current TM.
      { setNumber: 3, repsAchieved: 1, actualWeightKg: 90, rpe: null },
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
        countsTowardRpeSignal: false,
      },
      {
        setNumber: 2,
        prescribedWeightKg: 50,
        repTarget: 5,
        countsTowardOneRm: false,
        countsTowardRpeSignal: false,
      },
      {
        setNumber: 3,
        prescribedWeightKg: 60,
        repTarget: 5,
        countsTowardOneRm: false,
        countsTowardRpeSignal: false,
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
      redStreak: 0,
    });
  });
});

// #60: Wave's optional RPE-triggered deload suggestion — redStreak's own
// increment/reset rules, independent of the deload-entry paths tested
// above (which all just assert redStreak lands on 0, the uncontroversial
// case since something else already caused the deload that session).
describe("prescribe/update: wave redStreak (#60)", () => {
  const config: WaveConfig = {
    trainingMaxPercentage: 90,
    deloadMode: "on_regression",
    usePreset: true,
    weekTable: PRESET_5_3_1_WEEK_TABLE,
    supplementalSetType: "none",
  };
  const scheme = { type: "wave" as const, config };

  it("increments when the signal set's RPE is at or above the threshold", () => {
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 65, rpe: null },
      { setNumber: 2, repsAchieved: 5, actualWeightKg: 75, rpe: null },
      { setNumber: 3, repsAchieved: 3, actualWeightKg: 85, rpe: 9 },
    ];
    const result = update(
      scheme,
      { trainingMaxKg: 100, weekIndex: 0, redStreak: 2 },
      sets,
    ) as WaveState;
    expect(result.redStreak).toBe(3);
  });

  it("resets to 0 when the signal set's RPE is below the threshold", () => {
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 65, rpe: null },
      { setNumber: 2, repsAchieved: 5, actualWeightKg: 75, rpe: null },
      { setNumber: 3, repsAchieved: 8, actualWeightKg: 85, rpe: 7 },
    ];
    const result = update(
      scheme,
      { trainingMaxKg: 100, weekIndex: 0, redStreak: 2 },
      sets,
    ) as WaveState;
    expect(result.redStreak).toBe(0);
  });

  it("resets to 0 when the signal set has no RPE logged — a missing read never counts as red", () => {
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 65, rpe: null },
      { setNumber: 2, repsAchieved: 5, actualWeightKg: 75, rpe: null },
      { setNumber: 3, repsAchieved: 3, actualWeightKg: 85, rpe: null },
    ];
    const result = update(
      scheme,
      { trainingMaxKg: 100, weekIndex: 0, redStreak: 2 },
      sets,
    ) as WaveState;
    expect(result.redStreak).toBe(0);
  });

  it("resets to 0 when the signal set wasn't logged at all", () => {
    const sets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 65, rpe: null },
      { setNumber: 2, repsAchieved: 5, actualWeightKg: 75, rpe: null },
      // Set 3 (the AMRAP/signal set) never logged this session.
    ];
    const result = update(
      scheme,
      { trainingMaxKg: 100, weekIndex: 0, redStreak: 2 },
      sets,
    ) as WaveState;
    expect(result.redStreak).toBe(0);
  });

  it("climbs mid-cycle, reaching 3 before the end-of-cycle checkpoint on a longer custom table", () => {
    // A 4-week custom table — the 3rd red week lands mid-cycle (weekIndex
    // 2 of 0..3), not on the table's actual last working week.
    const customConfig: WaveConfig = {
      ...config,
      usePreset: false,
      weekTable: [
        [{ percentageOfTrainingMax: 70, repTarget: "AMRAP" }],
        [{ percentageOfTrainingMax: 70, repTarget: "AMRAP" }],
        [{ percentageOfTrainingMax: 70, repTarget: "AMRAP" }],
        [{ percentageOfTrainingMax: 70, repTarget: "AMRAP" }],
      ],
    };
    const customScheme = { type: "wave" as const, config: customConfig };
    const redSets: LoggedSetInput[] = [
      { setNumber: 1, repsAchieved: 5, actualWeightKg: 70, rpe: 9.5 },
    ];
    const afterWeek1 = update(
      customScheme,
      { trainingMaxKg: 100, weekIndex: 0, redStreak: 0 },
      redSets,
    ) as WaveState;
    expect(afterWeek1).toMatchObject({ weekIndex: 1, redStreak: 1 });

    const afterWeek2 = update(customScheme, afterWeek1, redSets) as WaveState;
    expect(afterWeek2).toMatchObject({ weekIndex: 2, redStreak: 2 });

    const afterWeek3 = update(customScheme, afterWeek2, redSets) as WaveState;
    // Mid-cycle (weekIndex 2 of 0..3, not the last working week) — advances
    // normally, doesn't force a deload by itself, but the streak is already
    // eligible (>= 3) for the Log page banner to offer one.
    expect(afterWeek3).toMatchObject({
      weekIndex: 3,
      inDeload: false,
      redStreak: 3,
    });
  });
});

describe("pickWaveSignalSetNumber (#60)", () => {
  it("returns the AMRAP set's number when the week has one", () => {
    expect(
      pickWaveSignalSetNumber([
        { percentageOfTrainingMax: 65, repTarget: 5 },
        { percentageOfTrainingMax: 75, repTarget: 5 },
        { percentageOfTrainingMax: 85, repTarget: "AMRAP" },
      ]),
    ).toBe(3);
  });

  it("falls back to the highest percentageOfTrainingMax main set when there's no AMRAP", () => {
    expect(
      pickWaveSignalSetNumber([
        { percentageOfTrainingMax: 70, repTarget: 5 },
        { percentageOfTrainingMax: 90, repTarget: 3 },
        { percentageOfTrainingMax: 80, repTarget: 5 },
      ]),
    ).toBe(2);
  });

  it("breaks a tie in the highest percentage by keeping the higher set number", () => {
    expect(
      pickWaveSignalSetNumber([
        { percentageOfTrainingMax: 90, repTarget: 3 },
        { percentageOfTrainingMax: 90, repTarget: 3 },
      ]),
    ).toBe(2);
  });

  it("returns set 1 for a single-set week with no AMRAP", () => {
    expect(
      pickWaveSignalSetNumber([{ percentageOfTrainingMax: 70, repTarget: 5 }]),
    ).toBe(1);
  });
});

describe("acceptRpeDeloadSuggestion (#60)", () => {
  it("flips inDeload true and resets redStreak, carrying trainingMaxKg/weekIndex through unchanged", () => {
    const state: WaveState = {
      trainingMaxKg: 100,
      weekIndex: 1,
      inDeload: false,
      redStreak: 3,
    };
    expect(acceptRpeDeloadSuggestion(state)).toEqual({
      trainingMaxKg: 100,
      weekIndex: 1,
      inDeload: true,
      redStreak: 0,
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

import { describe, expect, it } from "vitest";
import {
  pruneSetStyles,
  setStyleAt,
  styleAt,
  validSetStylePositions,
  type SetStyleEntry,
} from "./setStyles";
import { defaultConfigFor, type SchemeConfig } from "./schemes";

function wave(overrides: Partial<SchemeConfig & { type: "wave" }> = {}) {
  const base = defaultConfigFor("wave");
  return { ...base, ...overrides } as SchemeConfig & { type: "wave" };
}

describe("validSetStylePositions", () => {
  it("double_progression: one position per set, weekIndex null", () => {
    const scheme: SchemeConfig = {
      type: "double_progression",
      config: {
        repRangeLow: 8,
        repRangeHigh: 12,
        setCount: 3,
        weightIncrement: 2.5,
        deloadCutPercentage: 60,
      },
    };
    expect(validSetStylePositions(scheme)).toEqual([
      { weekIndex: null, setNumber: 1 },
      { weekIndex: null, setNumber: 2 },
      { weekIndex: null, setNumber: 3 },
    ]);
  });

  it("rep_accumulation: one position per set, weekIndex null", () => {
    const scheme: SchemeConfig = {
      type: "rep_accumulation",
      config: { targetTotalReps: 50, setCount: 4, weightIncrement: 2.5 },
    };
    expect(validSetStylePositions(scheme)).toEqual([
      { weekIndex: null, setNumber: 1 },
      { weekIndex: null, setNumber: 2 },
      { weekIndex: null, setNumber: 3 },
      { weekIndex: null, setNumber: 4 },
    ]);
  });

  it("topset_backoff: top set is #1, backoff sets follow", () => {
    const scheme: SchemeConfig = {
      type: "topset_backoff",
      config: {
        topSetRepRangeLow: 1,
        topSetRepRangeHigh: 3,
        weightIncrement: 2.5,
        backoffPercentage: 85,
        backoffSetCount: 2,
        backoffRepTarget: 5,
        deloadCutPercentage: 60,
      },
    };
    expect(validSetStylePositions(scheme)).toEqual([
      { weekIndex: null, setNumber: 1 },
      { weekIndex: null, setNumber: 2 },
      { weekIndex: null, setNumber: 3 },
    ]);
  });

  it("failure_sets: no positions at all", () => {
    const scheme: SchemeConfig = {
      type: "failure_sets",
      config: { setCount: 3 },
    };
    expect(validSetStylePositions(scheme)).toEqual([]);
  });

  it("wave: positions carry a real weekIndex, one per set per week", () => {
    const scheme = wave();
    const positions = validSetStylePositions(scheme);
    // Locked 5/3/1 preset: 3 weeks x 3 sets each.
    expect(positions).toHaveLength(9);
    expect(positions.slice(0, 3)).toEqual([
      { weekIndex: 0, setNumber: 1 },
      { weekIndex: 0, setNumber: 2 },
      { weekIndex: 0, setNumber: 3 },
    ]);
    expect(positions[8]).toEqual({ weekIndex: 2, setNumber: 3 });
  });

  it("wave: reflects a custom week table's actual shape, not the preset's", () => {
    const scheme = wave({
      config: {
        ...wave().config,
        usePreset: false,
        weekTable: [
          [{ percentageOfTrainingMax: 70, repTarget: 5 }],
          [
            { percentageOfTrainingMax: 80, repTarget: 3 },
            { percentageOfTrainingMax: 85, repTarget: "AMRAP" },
          ],
        ],
      },
    });
    expect(validSetStylePositions(scheme)).toEqual([
      { weekIndex: 0, setNumber: 1 },
      { weekIndex: 1, setNumber: 1 },
      { weekIndex: 1, setNumber: 2 },
    ]);
  });
});

describe("pruneSetStyles", () => {
  it("drops entries whose position no longer exists after setCount shrinks", () => {
    const scheme: SchemeConfig = {
      type: "double_progression",
      config: {
        repRangeLow: 8,
        repRangeHigh: 12,
        setCount: 2,
        weightIncrement: 2.5,
        deloadCutPercentage: 60,
      },
    };
    const stored: SetStyleEntry[] = [
      { weekIndex: null, setNumber: 1, style: "rest_pause" },
      { weekIndex: null, setNumber: 3, style: "cluster" }, // no longer exists
    ];
    expect(pruneSetStyles(scheme, stored)).toEqual([
      { weekIndex: null, setNumber: 1, style: "rest_pause" },
    ]);
  });

  it("drops all entries for a scheme with no valid positions (failure_sets)", () => {
    const scheme: SchemeConfig = {
      type: "failure_sets",
      config: { setCount: 3 },
    };
    const stored: SetStyleEntry[] = [
      { weekIndex: null, setNumber: 1, style: "rest_pause" },
    ];
    expect(pruneSetStyles(scheme, stored)).toEqual([]);
  });

  it("wave: drops entries for a removed week, keeps entries for surviving weeks", () => {
    const scheme = wave({
      config: {
        ...wave().config,
        usePreset: false,
        weekTable: [[{ percentageOfTrainingMax: 70, repTarget: 5 }]],
      },
    });
    const stored: SetStyleEntry[] = [
      { weekIndex: 0, setNumber: 1, style: "cluster" },
      { weekIndex: 1, setNumber: 1, style: "rest_pause" }, // week removed
    ];
    expect(pruneSetStyles(scheme, stored)).toEqual([
      { weekIndex: 0, setNumber: 1, style: "cluster" },
    ]);
  });

  it("keeps everything when every stored position is still valid", () => {
    const scheme = wave();
    const stored: SetStyleEntry[] = [
      { weekIndex: 2, setNumber: 3, style: "cluster" },
    ];
    expect(pruneSetStyles(scheme, stored)).toEqual(stored);
  });
});

describe("styleAt / setStyleAt", () => {
  it("styleAt returns null for an untagged position", () => {
    expect(styleAt([], null, 1)).toBeNull();
  });

  it("styleAt finds a matching entry by (weekIndex, setNumber)", () => {
    const styles: SetStyleEntry[] = [
      { weekIndex: 1, setNumber: 2, style: "cluster" },
    ];
    expect(styleAt(styles, 1, 2)).toBe("cluster");
    expect(styleAt(styles, 0, 2)).toBeNull(); // same setNumber, different week
  });

  it("setStyleAt adds a new entry", () => {
    const next = setStyleAt([], null, 1, "rest_pause");
    expect(next).toEqual([
      { weekIndex: null, setNumber: 1, style: "rest_pause" },
    ]);
  });

  it("setStyleAt replaces an existing entry at the same position", () => {
    const initial: SetStyleEntry[] = [
      { weekIndex: null, setNumber: 1, style: "rest_pause" },
    ];
    const next = setStyleAt(initial, null, 1, "cluster");
    expect(next).toEqual([{ weekIndex: null, setNumber: 1, style: "cluster" }]);
  });

  it("setStyleAt removes the entry when style is null", () => {
    const initial: SetStyleEntry[] = [
      { weekIndex: null, setNumber: 1, style: "rest_pause" },
    ];
    expect(setStyleAt(initial, null, 1, null)).toEqual([]);
  });

  it("setStyleAt leaves other positions untouched", () => {
    const initial: SetStyleEntry[] = [
      { weekIndex: null, setNumber: 1, style: "rest_pause" },
      { weekIndex: null, setNumber: 2, style: "cluster" },
    ];
    const next = setStyleAt(initial, null, 1, null);
    expect(next).toEqual([{ weekIndex: null, setNumber: 2, style: "cluster" }]);
  });
});

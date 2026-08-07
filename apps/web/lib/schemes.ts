// Scheme catalog: config shapes + defaults for the 5 progression schemes.
// First real occupant of lib/ (#24) — shared with Session Logging (#29),
// which owns the prescribe/update runtime logic these configs feed into.
// Config shapes are locked per issue: #8 (Double Progression), #16 (Wave),
// #17 (Rep Accumulation), #18 (Top-set + back-off), #19 (Failure Sets).
// SchemeType itself lives in db/schema.ts (SCHEME_TYPES) — reused here
// rather than redefined, since the DB column is the canonical source.
import { type SchemeType } from "../db/schema";

export const SCHEME_CATALOG: {
  type: SchemeType;
  label: string;
  requiresTracksOneRm: boolean;
}[] = [
  {
    type: "double_progression",
    label: "Double Progression",
    requiresTracksOneRm: false,
  },
  { type: "wave", label: "Wave (5/3/1-style)", requiresTracksOneRm: true },
  {
    type: "rep_accumulation",
    label: "Rep Accumulation",
    requiresTracksOneRm: false,
  },
  {
    type: "topset_backoff",
    label: "Top-set + back-off",
    requiresTracksOneRm: true,
  },
  { type: "failure_sets", label: "Failure Sets", requiresTracksOneRm: false },
];

export interface DoubleProgressionConfig {
  repRangeLow: number;
  repRangeHigh: number;
  setCount: number;
  weightIncrement: number;
}

export interface RepAccumulationConfig {
  targetTotalReps: number;
  setCount: number;
  weightIncrement: number;
}

export interface TopsetBackoffConfig {
  topSetRepRangeLow: number;
  topSetRepRangeHigh: number;
  weightIncrement: number;
  backoffPercentage: number;
  backoffSetCount: number;
  backoffRepTarget: number;
}

export interface FailureSetsConfig {
  setCount: number;
}

export interface WaveWeekSet {
  percentageOfTrainingMax: number;
  repTarget: number | "AMRAP";
}

export interface WaveConfig {
  trainingMaxPercentage: number;
  deloadMode: "always" | "never" | "on_regression";
  // true = 5/3/1 preset, false = custom week table (#16).
  usePreset: boolean;
  weekTable: WaveWeekSet[][];
  supplementalSetType: "none" | "bbb" | "fsl" | "ssl" | "custom";
}

export type SchemeConfig =
  | { type: "double_progression"; config: DoubleProgressionConfig }
  | { type: "wave"; config: WaveConfig }
  | { type: "rep_accumulation"; config: RepAccumulationConfig }
  | { type: "topset_backoff"; config: TopsetBackoffConfig }
  | { type: "failure_sets"; config: FailureSetsConfig };

// The locked 5/3/1 preset week table (#16): 65/75/85% x 5/5/5+, 70/80/90% x
// 3/3/3+, 75/85/95% x 5/3/1+. Deload week isn't a 4th table row — it's
// applied per deloadMode at prescribe time (#29's concern, not stored here).
export const PRESET_5_3_1_WEEK_TABLE: WaveWeekSet[][] = [
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
];

// Every exercise-in-day always has exactly one scheme, defaulting to Double
// Progression (#8) — never a bare "no scheme" state.
export function defaultConfigFor(type: SchemeType): SchemeConfig {
  switch (type) {
    case "double_progression":
      return {
        type,
        config: {
          repRangeLow: 8,
          repRangeHigh: 12,
          setCount: 3,
          weightIncrement: 2.5,
        },
      };
    case "wave":
      return {
        type,
        config: {
          trainingMaxPercentage: 90,
          deloadMode: "on_regression",
          usePreset: true,
          weekTable: PRESET_5_3_1_WEEK_TABLE,
          supplementalSetType: "none",
        },
      };
    case "rep_accumulation":
      return {
        type,
        config: { targetTotalReps: 50, setCount: 5, weightIncrement: 2.5 },
      };
    case "topset_backoff":
      return {
        type,
        config: {
          topSetRepRangeLow: 1,
          topSetRepRangeHigh: 3,
          weightIncrement: 2.5,
          backoffPercentage: 85,
          backoffSetCount: 3,
          backoffRepTarget: 5,
        },
      };
    case "failure_sets":
      return { type, config: { setCount: 3 } };
  }
}

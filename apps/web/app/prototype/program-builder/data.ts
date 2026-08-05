// PROTOTYPE DATA — throwaway sample data for the program-builder UI prototype
// (wayfinder ticket "Program creation & editing UI", issue #15).
//
// Shapes mirror decisions already locked on the map:
// - exercises are a global library, hand-typed, with is_bodyweight_based/tracks_1rm
//   flags set once at creation (issues #2, #5, #7)
// - a program is a rotation of day templates; a day template is an ordered list of
//   exercise-in-day entries, each just an exercise ref + one scheme + scheme config
//   (issue #7) — every exercise always has exactly one scheme (issue #8)
// - the 5 scheme types and their exact config shapes (issues #8, #16, #17, #18, #19)

export type ExerciseId = string;

export interface Exercise {
  id: ExerciseId;
  name: string;
  isBodyweightBased: boolean;
  tracksOneRm: boolean;
}

export const EXERCISE_LIBRARY: Exercise[] = [
  { id: "squat", name: "Back Squat", isBodyweightBased: false, tracksOneRm: true },
  { id: "bench", name: "Bench Press", isBodyweightBased: false, tracksOneRm: true },
  { id: "pullup", name: "Weighted Pull-up", isBodyweightBased: true, tracksOneRm: true },
  { id: "curl", name: "Bicep Curl", isBodyweightBased: false, tracksOneRm: false },
  { id: "raise", name: "Lateral Raise", isBodyweightBased: false, tracksOneRm: false },
];

export type SchemeType = "double_progression" | "wave" | "rep_accumulation" | "topset_backoff" | "failure_sets";

export const SCHEME_CATALOG: { type: SchemeType; label: string; requiresOneRm: boolean }[] = [
  { type: "double_progression", label: "Double Progression", requiresOneRm: false },
  { type: "wave", label: "Wave (5/3/1-style)", requiresOneRm: true },
  { type: "rep_accumulation", label: "Rep Accumulation", requiresOneRm: false },
  { type: "topset_backoff", label: "Top-set + back-off", requiresOneRm: true },
  { type: "failure_sets", label: "Failure Sets", requiresOneRm: false },
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
export interface TopSetBackoffConfig {
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
  usePreset: boolean; // true = 5/3/1 preset, false = custom week table
  weekTable: WaveWeekSet[][];
  supplementalSetType: "none" | "bbb" | "fsl" | "ssl" | "custom";
}

export type SchemeConfig =
  | { type: "double_progression"; config: DoubleProgressionConfig }
  | { type: "wave"; config: WaveConfig }
  | { type: "rep_accumulation"; config: RepAccumulationConfig }
  | { type: "topset_backoff"; config: TopSetBackoffConfig }
  | { type: "failure_sets"; config: FailureSetsConfig };

export interface ExerciseInDay {
  exerciseId: ExerciseId;
  scheme: SchemeConfig;
}

export interface DayTemplate {
  id: string;
  label: string;
  exercises: ExerciseInDay[];
}

export interface Program {
  id: string;
  name: string;
  active: boolean;
  days: DayTemplate[];
}

export const DEFAULT_5_3_1_WEEK_TABLE: WaveWeekSet[][] = [
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

export function defaultConfigFor(type: SchemeType): SchemeConfig {
  switch (type) {
    case "double_progression":
      return { type, config: { repRangeLow: 8, repRangeHigh: 12, setCount: 3, weightIncrement: 2.5 } };
    case "wave":
      return {
        type,
        config: {
          trainingMaxPercentage: 90,
          deloadMode: "on_regression",
          usePreset: true,
          weekTable: DEFAULT_5_3_1_WEEK_TABLE,
          supplementalSetType: "none",
        },
      };
    case "rep_accumulation":
      return { type, config: { targetTotalReps: 50, setCount: 5, weightIncrement: 2.5 } };
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

export function sampleProgram(): Program {
  return {
    id: "prog1",
    name: "Strength Block A",
    active: true,
    days: [
      {
        id: "day1",
        label: "Day 1 — Squat focus",
        exercises: [
          { exerciseId: "squat", scheme: defaultConfigFor("wave") },
          { exerciseId: "curl", scheme: defaultConfigFor("double_progression") },
        ],
      },
      {
        id: "day2",
        label: "Day 2 — Bench focus",
        exercises: [
          { exerciseId: "bench", scheme: defaultConfigFor("topset_backoff") },
          { exerciseId: "raise", scheme: defaultConfigFor("failure_sets") },
        ],
      },
      {
        id: "day3",
        label: "Day 3 — Pull focus",
        exercises: [{ exerciseId: "pullup", scheme: defaultConfigFor("rep_accumulation") }],
      },
    ],
  };
}

export const OTHER_PROGRAMS = [
  { id: "prog2", name: "5/3/1 BBB (archived)", active: false },
  { id: "prog3", name: "Bodyweight Focus", active: false },
];

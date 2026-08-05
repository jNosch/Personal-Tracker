// PROTOTYPE DATA — throwaway sample data for the session-logging UI prototype
// (wayfinder ticket "Session logging UI", issue #14).
//
// Shapes mirror decisions already locked on the map:
// - a session always links to a specific program day (issue #4, #7)
// - a day template's prescribed sets are generated dynamically by whatever scheme is
//   attached — not stored — so this is just a snapshot of "what prescribe() returned
//   for today", not real scheme logic
// - per set: reps_achieved, actual_weight_kg (defaulted from prescription, overridable),
//   optional rpe (issue #4); which set(s) count toward 1RM is scheme output (issue #5)

export interface PrescribedSet {
  setNumber: number;
  prescribedWeightKg: number;
  repTarget: number | "AMRAP";
  countsTowardOneRm: boolean;
}

export interface PrescribedExercise {
  exerciseId: string;
  exerciseName: string;
  sets: PrescribedSet[];
}

export interface PrescribedDay {
  programName: string;
  dayLabel: string;
}

export const PRESCRIBED_DAY: PrescribedDay = {
  programName: "Strength Block A",
  dayLabel: "Day 2 — Squat / Bench / Accessories",
};

export const PRESCRIBED_EXERCISES: PrescribedExercise[] = [
  {
    exerciseId: "squat",
    exerciseName: "Back Squat",
    sets: [
      { setNumber: 1, prescribedWeightKg: 100, repTarget: 5, countsTowardOneRm: false },
      { setNumber: 2, prescribedWeightKg: 100, repTarget: 5, countsTowardOneRm: false },
      { setNumber: 3, prescribedWeightKg: 100, repTarget: "AMRAP", countsTowardOneRm: true },
    ],
  },
  {
    exerciseId: "bench",
    exerciseName: "Bench Press",
    sets: [
      { setNumber: 1, prescribedWeightKg: 70, repTarget: 5, countsTowardOneRm: false },
      { setNumber: 2, prescribedWeightKg: 70, repTarget: 5, countsTowardOneRm: false },
      { setNumber: 3, prescribedWeightKg: 70, repTarget: "AMRAP", countsTowardOneRm: true },
    ],
  },
  {
    exerciseId: "curl",
    exerciseName: "Bicep Curl",
    sets: [
      { setNumber: 1, prescribedWeightKg: 12, repTarget: 10, countsTowardOneRm: false },
      { setNumber: 2, prescribedWeightKg: 12, repTarget: 10, countsTowardOneRm: false },
      { setNumber: 3, prescribedWeightKg: 12, repTarget: 10, countsTowardOneRm: false },
    ],
  },
];

export interface SetEntry {
  actualWeightKg: number | "";
  repsAchieved: number | "";
  rpe: number | "";
}

export type EntryState = Record<string, Record<number, SetEntry>>;

export function initialEntryState(): EntryState {
  const state: EntryState = {};
  for (const ex of PRESCRIBED_EXERCISES) {
    state[ex.exerciseId] = {};
    for (const set of ex.sets) {
      state[ex.exerciseId]![set.setNumber] = {
        actualWeightKg: set.prescribedWeightKg, // pre-filled from prescription, overridable
        repsAchieved: "",
        rpe: "",
      };
    }
  }
  return state;
}

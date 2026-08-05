// PROTOTYPE DATA — throwaway sample data for the progress-charts UI prototype
// (wayfinder ticket "Progress chart requirements", issue #6).
//
// Shapes mirror decisions already locked on the map (issue #1):
// - one 1RM estimate (kg) per exercise per session, only for tracks_1rm exercises (issue #5)
// - weekly bodyweight entries, independent of sessions (issue #4)
// - volume (weight × reps) is derivable from logged sets, not stored directly — faked
//   here as a finished series for simplicity, since deriving it isn't the question.

export type ExerciseId = "squat" | "bench" | "deadlift" | "pullup";

export interface Exercise {
  id: ExerciseId;
  name: string;
  isBodyweightBased: boolean;
}

export const EXERCISES: Exercise[] = [
  { id: "squat", name: "Back Squat", isBodyweightBased: false },
  { id: "bench", name: "Bench Press", isBodyweightBased: false },
  { id: "deadlift", name: "Deadlift", isBodyweightBased: false },
  { id: "pullup", name: "Weighted Pull-up", isBodyweightBased: true },
];

export interface SeriesPoint {
  date: string; // ISO date
  value: number;
}

function weeklyDates(weeks: number, endingOn: Date): string[] {
  const dates: string[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const d = new Date(endingOn);
    d.setDate(d.getDate() - i * 7);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

const TODAY = new Date("2026-08-05");
const WEEKS = 16;
const DATES = weeklyDates(WEEKS, TODAY);

// deterministic pseudo-noise so the lines look organic without a real RNG dependency
function noise(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x) - 0.5; // roughly -0.5..0.5
}

function trendSeries(start: number, weeklyGain: number, seedOffset: number, wobble = 4): SeriesPoint[] {
  return DATES.map((date, i) => ({
    date,
    value: Math.round((start + i * weeklyGain + noise(i + seedOffset) * wobble) * 10) / 10,
  }));
}

export const ONE_RM: Record<ExerciseId, SeriesPoint[]> = {
  squat: trendSeries(140, 0.9, 1),
  bench: trendSeries(100, 0.5, 2),
  deadlift: trendSeries(170, 1.1, 3),
  pullup: trendSeries(105, 0.3, 4), // total load (bodyweight + added), per issue #5
};

export const VOLUME: Record<ExerciseId, SeriesPoint[]> = {
  squat: trendSeries(3200, 25, 5, 150),
  bench: trendSeries(2400, 15, 6, 120),
  deadlift: trendSeries(2800, 20, 7, 140),
  pullup: trendSeries(900, 8, 8, 60),
};

export const BODYWEIGHT: SeriesPoint[] = trendSeries(84, -0.15, 9, 0.8);

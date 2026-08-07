// Real exercise library, decided in issue #23 (list + is_bodyweight_based /
// tracks_1rm classification per the #5 1RM rules). One-time content, not
// schema — kept as data, not a migration.

export type ExerciseSeed = {
  name: string;
  isBodyweightBased: boolean;
  tracksOneRm: boolean;
};

export const EXERCISE_SEED: ExerciseSeed[] = [
  // --- 1RM-viable main compounds ---
  { name: "Barbell Front Squat", isBodyweightBased: false, tracksOneRm: true },
  { name: "Barbell Back Squat", isBodyweightBased: false, tracksOneRm: true },
  { name: "Conventional Deadlift", isBodyweightBased: false, tracksOneRm: true },
  { name: "Romanian Deadlift", isBodyweightBased: false, tracksOneRm: true },
  { name: "Stiff-Legged Deadlift", isBodyweightBased: false, tracksOneRm: true },
  { name: "Sumo Deadlift", isBodyweightBased: false, tracksOneRm: true },
  { name: "Barbell Row", isBodyweightBased: false, tracksOneRm: true },
  { name: "Barbell Bench Press", isBodyweightBased: false, tracksOneRm: true },
  { name: "Dumbbell Bench Press", isBodyweightBased: false, tracksOneRm: true },
  { name: "Barbell Overhead Press", isBodyweightBased: false, tracksOneRm: true },
  { name: "Barbell Hip Thrust", isBodyweightBased: false, tracksOneRm: true },
  { name: "Incline Bench Press (Barbell)", isBodyweightBased: false, tracksOneRm: true },
  { name: "Incline Bench Press (Dumbbell)", isBodyweightBased: false, tracksOneRm: true },
  // Bodyweight-based: actual_weight_kg holds added weight (0/null = pure
  // bodyweight set), see #5 — one row covers both weighted and unweighted.
  { name: "Pull-up", isBodyweightBased: true, tracksOneRm: true },
  { name: "Chin-up", isBodyweightBased: true, tracksOneRm: true },
  { name: "Dip", isBodyweightBased: true, tracksOneRm: true },

  // --- Compounds, not 1RM-viable ---
  { name: "Lat Pulldown", isBodyweightBased: false, tracksOneRm: false },
  { name: "Machine Rows", isBodyweightBased: false, tracksOneRm: false },
  { name: "Dumbbell Rows", isBodyweightBased: false, tracksOneRm: false },
  { name: "Leg Press", isBodyweightBased: false, tracksOneRm: false },
  { name: "Smith Machine Bench Press", isBodyweightBased: false, tracksOneRm: false },
  { name: "Smith Machine Overhead Press", isBodyweightBased: false, tracksOneRm: false },
  { name: "Bulgarian Split Squat", isBodyweightBased: false, tracksOneRm: false },
  { name: "Rack Pulls", isBodyweightBased: false, tracksOneRm: false },
  { name: "Hammer Strength Chest Press", isBodyweightBased: false, tracksOneRm: false },
  { name: "Back Extensions", isBodyweightBased: true, tracksOneRm: false },

  // --- Isolation ---
  { name: "Standing Lateral Raises", isBodyweightBased: false, tracksOneRm: false },
  { name: "Seated Lateral Raises", isBodyweightBased: false, tracksOneRm: false },
  { name: "Lying Lateral Raises", isBodyweightBased: false, tracksOneRm: false },
  { name: "Machine Lateral Raises", isBodyweightBased: false, tracksOneRm: false },
  { name: "Rear Delt Flys", isBodyweightBased: false, tracksOneRm: false },
  { name: "Rear Delt Dumbbell Rows", isBodyweightBased: false, tracksOneRm: false },
  { name: "Face Pulls", isBodyweightBased: false, tracksOneRm: false },
  { name: "Dumbbell Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Seated Incline Dumbbell Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Hammer Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Barbell Preacher Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Barbell Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Cable Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Spider Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Machine Preacher Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Concentration Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Shrugs", isBodyweightBased: false, tracksOneRm: false },
  { name: "Forearm Roller", isBodyweightBased: false, tracksOneRm: false },
  { name: "Dumbbell Wrist Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Dumbbell Wrist Extension", isBodyweightBased: false, tracksOneRm: false },
  { name: "Smith Machine Calf Raises", isBodyweightBased: false, tracksOneRm: false },
  { name: "Machine Calf Raises", isBodyweightBased: false, tracksOneRm: false },
  { name: "Lying Hamstring Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Seated Hamstring Curl", isBodyweightBased: false, tracksOneRm: false },
  { name: "Quad Extensions", isBodyweightBased: false, tracksOneRm: false },
  { name: "Abductor Machine", isBodyweightBased: false, tracksOneRm: false },
  { name: "Cable Push Downs", isBodyweightBased: false, tracksOneRm: false },
  { name: "Cable Overhead Extensions", isBodyweightBased: false, tracksOneRm: false },
  { name: "Barbell Skull Crusher", isBodyweightBased: false, tracksOneRm: false },
  { name: "Dumbbell Skull Crusher", isBodyweightBased: false, tracksOneRm: false },
  { name: "Dumbbell Overhead Extension", isBodyweightBased: false, tracksOneRm: false },
  { name: "Ab Wheel Roll-Out", isBodyweightBased: true, tracksOneRm: false },
  { name: "Hanging Leg Raises", isBodyweightBased: true, tracksOneRm: false },
  { name: "Hanging Leg Raises (Weighted, Dip Belt)", isBodyweightBased: true, tracksOneRm: false },
  { name: "Weighted Decline Sit-Ups", isBodyweightBased: true, tracksOneRm: false },
  { name: "Machine Crunches", isBodyweightBased: false, tracksOneRm: false },
  { name: "Machine Flys", isBodyweightBased: false, tracksOneRm: false },
  { name: "Cable Flys", isBodyweightBased: false, tracksOneRm: false },
  { name: "Dumbbell Flys", isBodyweightBased: false, tracksOneRm: false },

  // --- Duration/distance-based: logged_sets has no field for that yet.
  // reps_achieved gets repurposed as duration-seconds until #25 resolves it
  // properly (a domain decision, not decided here) — see #23/#25.
  { name: "Farmer Carries", isBodyweightBased: false, tracksOneRm: false },
  { name: "Plate Holds", isBodyweightBased: false, tracksOneRm: false },
  { name: "Dead Hang", isBodyweightBased: true, tracksOneRm: false },
];

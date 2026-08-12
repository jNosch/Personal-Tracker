// Realistic demo-data seed script (#49) — populates the dev DB with two
// programs' worth of weeks of simulated training history plus bodyweight
// entries, so features (Progress charts, badges, deltas) can be played with
// against data that actually looks like real usage instead of a handful of
// sparse/synthetic rows.
//
// Simulates through the *real* progression engine (lib/schemes.ts's
// prescribe()/update()) and the *real* 1RM math (lib/oneRm.ts) rather than
// fabricating independent numbers (#49's resolved spec) — the numbers this
// produces are only ever as "wrong" as the app's own math is, never a
// second parallel truth that could quietly drift out of sync with it.
//
// Destructive but narrowly scoped: deletes and regenerates only the rows it
// owns (programs literally named DEMO_PROGRAM_NAMES below, everything
// hanging off them, and bodyweight entries inside the exact date window it
// generates) — never a blanket truncate, and refuses to run at all unless
// DATABASE_URL looks like the local dev database (see
// assertLocalDevDatabase). Safe to rerun: each run wipes its own prior
// output and regenerates fresh, deterministically (fixed PRNG seed, #49's
// resolved spec) so a chart oddity found once stays reproducible.
//
// Requires the exercise library already seeded — run `pnpm --filter web
// db:seed` first if this errors on a missing exercise name.
import { config as loadEnv } from "dotenv";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import {
  bodyweightEntries,
  dayTemplates,
  exerciseInDay,
  exercises,
  loggedSets,
  oneRmEstimates,
  programs,
  sessions,
  type SchemeType,
} from "./schema";
import { computeSessionOneRmKg, resolveCountsTowardOneRm } from "../lib/oneRm";
import { nearestBodyweight, type SeriesPoint } from "../lib/progressRange";
import { nextDayPosition } from "../lib/rotation";
import {
  defaultConfigFor,
  prescribe,
  update,
  type LoggedSetInput,
  type SchemeConfig,
} from "../lib/schemes";
import {
  createPrng,
  scheduleSessionDates,
  simulateReps,
} from "../lib/demoSeed";

loadEnv({ path: ".env.local" });

const SEED = 49_20260811; // fixed — #49's resolved spec: reproducible reruns.

const DEMO_PROGRAM_NAMES = ["SBD (demo)", "Dip & Pull-up (demo)"] as const;

// Refuses to run against anything that doesn't look like the local
// dev/docker-compose Postgres (see .env.example) — this script deletes
// data by name/date-range match, and that's only safe to trust blind on a
// database nothing else depends on.
function assertLocalDevDatabase(url: string | undefined) {
  if (!url || !/^postgres:\/\/dev:dev@localhost:5432\//.test(url)) {
    throw new Error(
      "db:seed:demo refuses to run: DATABASE_URL doesn't look like the local " +
        "dev database (expected postgres://dev:dev@localhost:5432/...). This " +
        "script deletes and regenerates demo data by name/date-range match — " +
        "too risky to run anywhere that isn't obviously a disposable local DB.",
    );
  }
}

// name -> (scheme type, starting state). Starting state is seeded directly
// rather than left at {} (what a real brand-new exercise-in-day starts
// with, see schemes.ts's file-header note) — sidesteps the fresh-exercise
// 0kg-prescription bootstrap entirely, which gets genuinely messy for
// Top-set+Backoff specifically (its back-off sets derive their weight from
// the *same* state as the top set at prescribe time, so a first-occurrence
// override would need retroactively reshaping sets prescribe() already
// returned). Seeding realistic starting numbers is simpler and just as
// realistic for demo purposes — a fresh program in real use starts at 0kg
// too, but this script isn't trying to simulate someone's very first day
// in the gym.
const EXERCISE_PLAN: Record<
  string,
  { scheme: SchemeType; state: Record<string, unknown> }
> = {
  "Barbell Back Squat": {
    scheme: "wave",
    state: { trainingMaxKg: 100, weekIndex: 0, inDeload: false },
  },
  "Leg Press": {
    scheme: "double_progression",
    state: { currentWeightKg: 80, currentRepTarget: 8 },
  },
  "Lying Hamstring Curl": {
    scheme: "double_progression",
    state: { currentWeightKg: 25, currentRepTarget: 8 },
  },
  "Barbell Bench Press": {
    scheme: "wave",
    state: { trainingMaxKg: 65, weekIndex: 0, inDeload: false },
  },
  // Deliberately non-tracked (tracksOneRm: false in seed-data.ts) — an
  // earlier version of this plan picked "Incline Bench Press (Dumbbell)"
  // here, which is actually tracksOneRm: true (one of seed-data.ts's
  // 1RM-viable compounds), silently contradicting the "non-tracked
  // accessory" intent and producing an unwanted 1RM estimate every
  // session. Caught in code review, not by any test — worth double
  // checking seed-data.ts's flags directly next time rather than assuming
  // an exercise name "sounds like" an accessory.
  "Dumbbell Flys": {
    scheme: "rep_accumulation",
    state: { currentWeightKg: 12 },
  },
  "Cable Push Downs": {
    scheme: "double_progression",
    state: { currentWeightKg: 20, currentRepTarget: 8 },
  },
  "Conventional Deadlift": {
    scheme: "wave",
    state: { trainingMaxKg: 120, weekIndex: 0, inDeload: false },
  },
  // Same non-tracked mistake as "Dumbbell Flys" above — "Barbell Row" is
  // also tracksOneRm: true in seed-data.ts. Rack Pulls fits the Deadlift
  // day thematically and is genuinely non-tracked.
  "Rack Pulls": {
    scheme: "rep_accumulation",
    state: { currentWeightKg: 90 },
  },
  "Face Pulls": {
    scheme: "double_progression",
    state: { currentWeightKg: 15, currentRepTarget: 8 },
  },
  // Bodyweight-based (#5): currentWeightKg here is *added* weight, 0 = pure
  // bodyweight — matches EXERCISE_SEED's convention.
  Dip: {
    scheme: "topset_backoff",
    state: { currentWeightKg: 0, currentRepTarget: 1 },
  },
  "Pull-up": {
    scheme: "rep_accumulation",
    state: { currentWeightKg: 0 },
  },
  "Dumbbell Rows": {
    scheme: "double_progression",
    state: { currentWeightKg: 22, currentRepTarget: 8 },
  },
  "Hammer Curl": {
    scheme: "double_progression",
    state: { currentWeightKg: 12, currentRepTarget: 8 },
  },
};

const SBD_DAYS: { label: string; exercises: string[] }[] = [
  {
    label: "Squat",
    exercises: ["Barbell Back Squat", "Leg Press", "Lying Hamstring Curl"],
  },
  {
    label: "Bench",
    exercises: ["Barbell Bench Press", "Dumbbell Flys", "Cable Push Downs"],
  },
  {
    label: "Deadlift",
    exercises: ["Conventional Deadlift", "Rack Pulls", "Face Pulls"],
  },
];
const DIP_PULLUP_DAY = {
  label: "Dip & Pull-up",
  exercises: ["Dip", "Pull-up", "Dumbbell Rows", "Hammer Curl"],
};

function isoDaysAgo(from: Date, days: number): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function main() {
  assertLocalDevDatabase(process.env.DATABASE_URL);
  const { db } = await import("./client");
  const rng = createPrng(SEED);

  const today = isoDaysAgo(new Date(), 0);
  const windowStart = isoDaysAgo(new Date(), 16 * 7);
  const switchDate = isoDaysAgo(new Date(), 10 * 7); // 6 weeks after windowStart

  const requiredNames = Object.keys(EXERCISE_PLAN);
  // One query, two lookup maps off the same rows — createDay() needs
  // id-by-name (building exercise_in_day), simulateSession() needs
  // flags-by-id (deciding whether/how to compute a 1RM estimate).
  const foundExercises = await db
    .select({
      id: exercises.id,
      name: exercises.name,
      isBodyweightBased: exercises.isBodyweightBased,
      tracksOneRm: exercises.tracksOneRm,
    })
    .from(exercises)
    .where(inArray(exercises.name, requiredNames));
  const exerciseByName = new Map(foundExercises.map((e) => [e.name, e]));
  const missing = requiredNames.filter((n) => !exerciseByName.has(n));
  if (missing.length > 0) {
    throw new Error(
      `db:seed:demo requires the exercise library already seeded. Missing: ` +
        `${missing.join(", ")}. Run \`pnpm --filter web db:seed\` first.`,
    );
  }
  const flagsById = new Map(foundExercises.map((e) => [e.id, e]));

  await db.transaction(async (tx) => {
    // --- wipe this script's own prior output, nothing else ---
    const oldPrograms = await tx
      .select({ id: programs.id })
      .from(programs)
      .where(inArray(programs.name, DEMO_PROGRAM_NAMES));
    const oldProgramIds = oldPrograms.map((p) => p.id);
    if (oldProgramIds.length > 0) {
      const oldDays = await tx
        .select({ id: dayTemplates.id })
        .from(dayTemplates)
        .where(inArray(dayTemplates.programId, oldProgramIds));
      const oldDayIds = oldDays.map((d) => d.id);
      const oldSessions = oldDayIds.length
        ? await tx
            .select({ id: sessions.id })
            .from(sessions)
            .where(inArray(sessions.dayTemplateId, oldDayIds))
        : [];
      const oldSessionIds = oldSessions.map((s) => s.id);
      if (oldSessionIds.length > 0) {
        await tx
          .delete(oneRmEstimates)
          .where(inArray(oneRmEstimates.sessionId, oldSessionIds));
        await tx
          .delete(loggedSets)
          .where(inArray(loggedSets.sessionId, oldSessionIds));
        await tx.delete(sessions).where(inArray(sessions.id, oldSessionIds));
      }
      if (oldDayIds.length > 0) {
        await tx
          .delete(exerciseInDay)
          .where(inArray(exerciseInDay.dayTemplateId, oldDayIds));
        await tx
          .delete(dayTemplates)
          .where(inArray(dayTemplates.id, oldDayIds));
      }
      await tx.delete(programs).where(inArray(programs.id, oldProgramIds));
    }
    // Bodyweight entries have no ownership marker (no FK, no tag column) —
    // the pragmatic scoping this script can offer is "whatever's inside a
    // window generated by this run or a recent prior one," not a precise
    // "whatever a prior demo run created." windowStart itself is relative
    // to *today*, which drifts forward a little on every rerun (not
    // literally fixed) — an exact-window-only delete would leave the
    // oldest few days of a prior run's bodyweight entries orphaned outside
    // the new window (caught in code review). A generous extra buffer
    // behind windowStart catches any plausible prior run without needing
    // to persist "the last window this script used" anywhere. Still not
    // airtight for reruns spaced further apart than the buffer — accepted,
    // same as the rest of this script's local-dev-only risk profile.
    const deleteFrom = isoDaysAgo(new Date(), 16 * 7 + 30);
    await tx
      .delete(bodyweightEntries)
      .where(
        and(
          gte(bodyweightEntries.entryDate, deleteFrom),
          lte(bodyweightEntries.entryDate, today),
        ),
      );

    // --- bodyweight entries across the whole window (both programs' 1RM
    // estimates for bodyweight-based exercises read from these) ---
    const bwDates = scheduleSessionDates(windowStart, today, 16, rng);
    let weightKg = 78;
    const bodyweightSeries: SeriesPoint[] = [];
    for (const date of bwDates) {
      weightKg += (rng() - 0.55) * 0.8; // slight downward drift, realistic noise
      const rounded = Math.round(weightKg * 10) / 10;
      await tx.insert(bodyweightEntries).values({
        entryDate: date,
        weightKg: rounded.toFixed(1),
      });
      bodyweightSeries.push({ date, value: rounded });
    }

    // --- deactivate whatever's currently active (partial unique index:
    // one_active_program) before inserting SBD as the new active one ---
    await tx
      .update(programs)
      .set({ isActive: false })
      .where(eq(programs.isActive, true));

    // --- create programs / day templates / exercise-in-day rows ---
    const [sbd] = await tx
      .insert(programs)
      .values({ name: "SBD (demo)", isActive: true, isArchived: false })
      .returning({ id: programs.id });
    const [dipPullup] = await tx
      .insert(programs)
      .values({
        name: "Dip & Pull-up (demo)",
        isActive: false,
        isArchived: true,
      })
      .returning({ id: programs.id });
    if (!sbd || !dipPullup) throw new Error("Failed to create demo programs");

    type DayPlan = { dayTemplateId: string; exerciseInDayIds: string[] };
    const state = new Map<string, Record<string, unknown>>(); // exerciseInDayId -> schemeState

    async function createDay(
      programId: string,
      position: number,
      label: string,
      exerciseNames: string[],
    ): Promise<DayPlan> {
      const [day] = await tx
        .insert(dayTemplates)
        .values({ programId, label, position })
        .returning({ id: dayTemplates.id });
      if (!day) throw new Error(`Failed to create day template ${label}`);
      const exerciseInDayIds: string[] = [];
      for (let i = 0; i < exerciseNames.length; i++) {
        const name = exerciseNames[i]!;
        const plan = EXERCISE_PLAN[name]!;
        const ex = exerciseByName.get(name)!;
        const config = defaultConfigFor(plan.scheme);
        const [row] = await tx
          .insert(exerciseInDay)
          .values({
            dayTemplateId: day.id,
            exerciseId: ex.id,
            position: i,
            schemeType: plan.scheme,
            schemeConfig: config.config,
            schemeState: plan.state,
          })
          .returning({ id: exerciseInDay.id });
        if (!row)
          throw new Error(`Failed to create exercise-in-day for ${name}`);
        state.set(row.id, plan.state);
        exerciseInDayIds.push(row.id);
      }
      return { dayTemplateId: day.id, exerciseInDayIds };
    }

    const sbdDays = await Promise.all(
      SBD_DAYS.map((d, i) => createDay(sbd.id, i, d.label, d.exercises)),
    );
    const dipPullupDay = await createDay(
      dipPullup.id,
      0,
      DIP_PULLUP_DAY.label,
      DIP_PULLUP_DAY.exercises,
    );

    // --- simulate one session occurrence: prescribe -> simulate performance
    // -> log sets -> advance scheme state -> compute 1RM estimate, exactly
    // the shape app/log/actions.ts's logSession writes, minus the
    // Next-only revalidatePath/redirect calls a plain script can't use ---
    async function simulateSession(day: DayPlan, sessionDate: string) {
      const [session] = await tx
        .insert(sessions)
        .values({ dayTemplateId: day.dayTemplateId, sessionDate })
        .returning({ id: sessions.id });
      if (!session) throw new Error("Failed to create session");

      for (const exerciseInDayId of day.exerciseInDayIds) {
        const row = (
          await tx
            .select()
            .from(exerciseInDay)
            .where(eq(exerciseInDay.id, exerciseInDayId))
        )[0]!;
        const scheme = {
          type: row.schemeType,
          config: row.schemeConfig,
        } as SchemeConfig;
        const currentState = state.get(exerciseInDayId) ?? {};
        const prescribedSets = prescribe(scheme, currentState);

        const repsBySetNumber = new Map<number, number | null>();
        const loggedInputs: LoggedSetInput[] = [];
        for (const set of prescribedSets) {
          const reps = simulateReps(set, rng);
          repsBySetNumber.set(set.setNumber, reps);
          loggedInputs.push({
            setNumber: set.setNumber,
            repsAchieved: reps,
            actualWeightKg: set.prescribedWeightKg,
            // Demo data never simulates RPE — #60's redStreak/signal
            // machinery is a no-op against seeded sessions either way.
            rpe: null,
          });
        }
        const designations = resolveCountsTowardOneRm(
          prescribedSets,
          repsBySetNumber,
        );

        for (const set of prescribedSets) {
          const reps = repsBySetNumber.get(set.setNumber) ?? null;
          await tx.insert(loggedSets).values({
            sessionId: session.id,
            exerciseId: row.exerciseId,
            exerciseInDayId: row.id,
            setNumber: set.setNumber,
            repsAchieved: reps,
            actualWeightKg:
              set.prescribedWeightKg === null
                ? null
                : String(set.prescribedWeightKg),
            countsTowardOneRm: designations.get(set.setNumber) ?? false,
            countsTowardRpeSignal: set.countsTowardRpeSignal,
            isDone: true,
          });
        }

        const newState = update(scheme, currentState, loggedInputs);
        state.set(exerciseInDayId, newState as Record<string, unknown>);
        await tx
          .update(exerciseInDay)
          .set({ schemeState: newState })
          .where(eq(exerciseInDay.id, exerciseInDayId));

        const flags = flagsById.get(row.exerciseId)!;
        if (flags.tracksOneRm) {
          // Mirrors logSession's own qualifying-set filter exactly (designated
          // + non-null weight + non-null reps, checked before mapping — an
          // earlier version coerced reps to 0 in the map step first, which
          // made its "not null" recheck after the fact dead code and
          // silently substituted a >0 check logSession doesn't have).
          const qualifying = prescribedSets
            .filter((s) => {
              const reps = repsBySetNumber.get(s.setNumber) ?? null;
              return (
                designations.get(s.setNumber) &&
                s.prescribedWeightKg !== null &&
                reps !== null
              );
            })
            .map((s) => ({
              actualWeightKg: s.prescribedWeightKg!,
              repsAchieved: repsBySetNumber.get(s.setNumber)!,
            }));

          let bodyweightKg: number | undefined;
          if (flags.isBodyweightBased) {
            const nearest = nearestBodyweight(bodyweightSeries, sessionDate);
            if (nearest !== null) bodyweightKg = nearest;
          }
          const estimate = computeSessionOneRmKg(qualifying, {
            isBodyweightBased: flags.isBodyweightBased,
            bodyweightKg,
          });
          if (estimate !== null) {
            await tx.insert(oneRmEstimates).values({
              exerciseId: row.exerciseId,
              sessionId: session.id,
              estimatedOneRmKg: estimate.toFixed(2),
            });
          }
        }
      }
      return day.dayTemplateId;
    }

    // --- Dip & Pull-up: single day template, 2x/week for 6 weeks, before
    // the (simulated) switch to SBD ---
    const dipPullupDates = scheduleSessionDates(
      windowStart,
      switchDate,
      12,
      rng,
    );
    for (const date of dipPullupDates) {
      await simulateSession(dipPullupDay, date);
    }

    // --- SBD: rotates through its 3 day templates the same way the real
    // app does (lib/rotation.ts's nextDayPosition), 3x/week for 10 weeks,
    // from the switch date up to today ---
    const sbdDates = scheduleSessionDates(switchDate, today, 30, rng);
    const sbdPositions = SBD_DAYS.map((_, i) => i);
    let nextPos = 0;
    for (const date of sbdDates) {
      await simulateSession(sbdDays[nextPos]!, date);
      nextPos = nextDayPosition(sbdPositions, nextPos);
    }
    await tx
      .update(programs)
      .set({ nextDayPosition: nextPos })
      .where(eq(programs.id, sbd.id));

    console.log(
      `Seeded demo data: SBD (active, ${sbdDates.length} sessions) and ` +
        `Dip & Pull-up (archived, ${dipPullupDates.length} sessions), ` +
        `${bwDates.length} bodyweight entries, ${windowStart} to ${today}.`,
    );
  });
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

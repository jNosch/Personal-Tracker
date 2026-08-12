"use server";

// Server actions backing Session Logging (#29). logSession is the sole
// place that writes sessions/logged_sets/one_rm_estimates and advances
// programs.next_day_position, all in one transaction so a session is never
// half-saved. setTrainingMax is Wave's manual-entry bootstrap (#16) —
// trainingMaxKg has no other way to get its first value (see schemes.ts's
// prescribe/update file-header note). acceptWaveRpeDeloadSuggestion is
// #60's Log-page banner Accept action.
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "../../db/client";
import {
  bodyweightEntries,
  dayTemplates,
  exerciseInDay,
  exercises,
  loggedSets,
  oneRmEstimates,
  programs,
  sessions,
} from "../../db/schema";
import {
  computeSessionOneRmKg,
  resolveCountsTowardOneRm,
} from "../../lib/oneRm";
import { nextDayPosition } from "../../lib/rotation";
import {
  acceptRpeDeloadSuggestion,
  prescribe,
  roundToNearest,
  update,
  type LoggedSetInput,
  type SchemeConfig,
  type WaveState,
} from "../../lib/schemes";

export interface SessionSetEntry {
  setNumber: number;
  actualWeightKg: number | null;
  repsAchieved: number | null;
  rpe: number | null;
  isDone: boolean;
}

export interface SessionExerciseEntry {
  exerciseInDayId: string;
  sets: SessionSetEntry[];
}

export async function logSession(
  programId: string,
  dayTemplateId: string,
  sessionDate: string,
  exerciseEntries: SessionExerciseEntry[],
) {
  await db.transaction(async (tx) => {
    const [session] = await tx
      .insert(sessions)
      .values({ dayTemplateId, sessionDate })
      .returning({ id: sessions.id });
    if (!session) throw new Error("Failed to create session");

    for (const exEntry of exerciseEntries) {
      const row = await tx.query.exerciseInDay.findFirst({
        where: eq(exerciseInDay.id, exEntry.exerciseInDayId),
      });
      if (!row) continue;

      const scheme = {
        type: row.schemeType,
        config: row.schemeConfig,
      } as SchemeConfig;
      const prescribedSets = prescribe(scheme, row.schemeState);
      const repsBySetNumber = new Map(
        exEntry.sets.map((s) => [s.setNumber, s.repsAchieved]),
      );
      const designations = resolveCountsTowardOneRm(
        prescribedSets,
        repsBySetNumber,
      );
      // #60: stamped statically by prescribe() (Wave's AMRAP-or-heaviest
      // rule; always false for every other scheme) — no fallback resolution
      // needed the way countsTowardOneRm's designations map above has one.
      const rpeSignalBySetNumber = new Map(
        prescribedSets.map((s) => [s.setNumber, s.countsTowardRpeSignal]),
      );

      for (const set of exEntry.sets) {
        await tx.insert(loggedSets).values({
          sessionId: session.id,
          exerciseId: row.exerciseId,
          exerciseInDayId: row.id,
          setNumber: set.setNumber,
          repsAchieved: set.repsAchieved,
          actualWeightKg:
            set.actualWeightKg === null ? null : String(set.actualWeightKg),
          rpe: set.rpe === null ? null : String(set.rpe),
          countsTowardOneRm: designations.get(set.setNumber) ?? false,
          countsTowardRpeSignal:
            rpeSignalBySetNumber.get(set.setNumber) ?? false,
          isDone: set.isDone,
        });
      }

      const loggedInputs: LoggedSetInput[] = exEntry.sets.map((s) => ({
        setNumber: s.setNumber,
        repsAchieved: s.repsAchieved,
        actualWeightKg: s.actualWeightKg,
        rpe: s.rpe,
      }));
      const newState = update(scheme, row.schemeState, loggedInputs);
      await tx
        .update(exerciseInDay)
        .set({ schemeState: newState })
        .where(eq(exerciseInDay.id, row.id));

      const exercise = await tx.query.exercises.findFirst({
        where: eq(exercises.id, row.exerciseId),
      });
      if (exercise?.tracksOneRm) {
        const qualifying = exEntry.sets
          .filter(
            (s) =>
              designations.get(s.setNumber) &&
              s.actualWeightKg !== null &&
              s.repsAchieved !== null,
          )
          .map((s) => ({
            actualWeightKg: s.actualWeightKg!,
            repsAchieved: s.repsAchieved!,
          }));

        let bodyweightKg: number | undefined;
        if (exercise.isBodyweightBased) {
          // Nearest weekly log entry to the session date, either side (#5).
          const [nearest] = await tx
            .select()
            .from(bodyweightEntries)
            .orderBy(
              sql`abs(${bodyweightEntries.entryDate}::date - ${sessionDate}::date)`,
            )
            .limit(1);
          if (nearest) bodyweightKg = Number(nearest.weightKg);
        }

        const estimate = computeSessionOneRmKg(qualifying, {
          isBodyweightBased: exercise.isBodyweightBased,
          bodyweightKg,
        });
        if (estimate !== null) {
          await tx.insert(oneRmEstimates).values({
            exerciseId: exercise.id,
            sessionId: session.id,
            estimatedOneRmKg: estimate.toFixed(2),
          });
        }
      }
    }

    // Rotation advance (#9) — the actual "next position, wrapping over
    // archived-day gaps" rule lives in lib/rotation.ts so it's unit-tested;
    // this block is just the DB fetch/write around it.
    const loggedDay = await tx.query.dayTemplates.findFirst({
      where: eq(dayTemplates.id, dayTemplateId),
    });
    const activeDays = await tx
      .select({ position: dayTemplates.position })
      .from(dayTemplates)
      .where(
        and(
          eq(dayTemplates.programId, programId),
          eq(dayTemplates.isArchived, false),
        ),
      );
    if (loggedDay && activeDays.length > 0) {
      await tx
        .update(programs)
        .set({
          nextDayPosition: nextDayPosition(
            activeDays.map((d) => d.position),
            loggedDay.position,
          ),
        })
        .where(eq(programs.id, programId));
    }
  });

  revalidatePath("/log");
}

// Wave's training max is manual-entry-only (#16) — never inferred from a
// logged set, unlike every other scheme's bootstrap (see schemes.ts).
export async function setTrainingMax(exerciseInDayId: string, oneRmKg: number) {
  const row = await db.query.exerciseInDay.findFirst({
    where: eq(exerciseInDay.id, exerciseInDayId),
  });
  if (!row || row.schemeType !== "wave") return;

  const config = row.schemeConfig as { trainingMaxPercentage: number };
  const prevState = row.schemeState as WaveState;
  const trainingMaxKg = roundToNearest(
    (config.trainingMaxPercentage / 100) * oneRmKg,
    0.5,
  );
  const newState: WaveState = {
    trainingMaxKg,
    weekIndex: prevState.weekIndex ?? 0,
    inDeload: prevState.inDeload ?? false,
    redStreak: prevState.redStreak ?? 0,
  };
  await db
    .update(exerciseInDay)
    .set({ schemeState: newState })
    .where(eq(exerciseInDay.id, exerciseInDayId));
  revalidatePath("/log");
}

// #60: the Log page banner's Accept button. Re-reads current state rather
// than trusting whatever the page rendered — the streak could have broken
// (or the exercise could already be mid-deload) between page load and
// click, e.g. two tabs open. Silently no-ops when the suggestion is no
// longer live rather than erroring; the page just re-renders without the
// banner on refresh either way.
export async function acceptWaveRpeDeloadSuggestion(exerciseInDayId: string) {
  const row = await db.query.exerciseInDay.findFirst({
    where: eq(exerciseInDay.id, exerciseInDayId),
  });
  if (!row || row.schemeType !== "wave") return;

  const state = row.schemeState as WaveState;
  const eligible = (state.redStreak ?? 0) >= 3 && !state.inDeload;
  if (!eligible) return;

  await db
    .update(exerciseInDay)
    .set({ schemeState: acceptRpeDeloadSuggestion(state) })
    .where(eq(exerciseInDay.id, exerciseInDayId));
  revalidatePath("/log");
}

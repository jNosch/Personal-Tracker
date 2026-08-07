"use server";

// Server actions backing Session Logging (#29). logSession is the sole
// place that writes sessions/logged_sets/one_rm_estimates and advances
// programs.next_day_position, all in one transaction so a session is never
// half-saved. setTrainingMax is Wave's manual-entry bootstrap (#16) —
// trainingMaxKg has no other way to get its first value (see schemes.ts's
// prescribe/update file-header note).
import { and, asc, eq, sql } from "drizzle-orm";
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
import {
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
          isDone: set.isDone,
        });
      }

      const loggedInputs: LoggedSetInput[] = exEntry.sets.map((s) => ({
        setNumber: s.setNumber,
        repsAchieved: s.repsAchieved,
        actualWeightKg: s.actualWeightKg,
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

    // Rotation advance (#9): always (loggedDay.position + 1) mod day count,
    // regardless of what next_day_position previously pointed at. "mod day
    // count" is read as "next position in the active rotation, wrapping" —
    // walking the sorted list of active positions rather than doing literal
    // arithmetic on the raw position number, because positions aren't
    // contiguous once any day has ever been archived (archived days keep
    // their position slot forever, see addDayTemplate in
    // programs/actions.ts). Raw (position + 1) % count can land on a gap
    // that no active day occupies.
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
      )
      .orderBy(asc(dayTemplates.position));
    if (loggedDay && activeDays.length > 0) {
      const positions = activeDays.map((d) => d.position);
      const index = positions.indexOf(loggedDay.position);
      const nextIndex = index === -1 ? 0 : (index + 1) % positions.length;
      await tx
        .update(programs)
        .set({ nextDayPosition: positions[nextIndex] })
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
  };
  await db
    .update(exerciseInDay)
    .set({ schemeState: newState })
    .where(eq(exerciseInDay.id, exerciseInDayId));
  revalidatePath("/log");
}

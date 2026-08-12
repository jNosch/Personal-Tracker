import { and, asc, eq, isNotNull } from "drizzle-orm";
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
import ProgressCharts, { type ExerciseOption } from "./ProgressCharts";
import {
  recentExerciseRpeTrends,
  type SeriesPoint,
} from "../../lib/progressRange";
import type { WaveState } from "../../lib/schemes";

// #56: how many of its own most recent RPE-logged sessions the recent-RPE
// box shows per exercise (not "last N sessions of the program" — see
// recentExerciseRpeTrends' own comment for why that's a different, wrong
// question for an exercise trained only every Nth session in rotation).
const RECENT_RPE_READINGS_PER_EXERCISE = 3;

// Same reasoning as app/programs/page.tsx — not statically prerenderable.
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  // Scoped to the active program's exercises, not every tracks_1rm exercise
  // ever seeded — with 16 seeded exercises the unscoped list was too
  // cluttered to read (see #31 follow-up discussion). No archived-history
  // awareness needed here the way #12 rejected for the chart itself: this
  // is just "what am I currently allowed to toggle," and switching programs
  // naturally changes that.
  const activeProgram = await db.query.programs.findFirst({
    where: eq(programs.isActive, true),
    with: {
      dayTemplates: {
        where: eq(dayTemplates.isArchived, false),
        with: {
          exercises: {
            where: eq(exerciseInDay.isArchived, false),
            with: { exercise: true },
          },
        },
      },
    },
  });

  const trackedExercises = activeProgram
    ? toExerciseOptions(
        activeProgram.dayTemplates
          .flatMap((d) => d.exercises)
          .map((e) => e.exercise),
      )
    : [];

  // #53: the "show all exercises" toggle's candidate list — every
  // tracks_1rm exercise ever assigned to *any* program's day templates,
  // active or archived, isArchived or not (unlike trackedExercises above,
  // this deliberately doesn't filter out archived day_templates/
  // exercise_in_day rows — the whole point is surfacing history that the
  // active-only list above can no longer see). Always a superset of
  // trackedExercises, since the active program's own rows are exercise_in_day
  // rows too.
  const allTrackedRows = await db.query.exerciseInDay.findMany({
    with: { exercise: true },
  });
  const allTrackedExercises = toExerciseOptions(
    allTrackedRows.map((e) => e.exercise),
  );

  // One row per (exercise, session) already (schema's unique index); join
  // sessions for the date and sort ascending so it's chart-ready without a
  // client-side sort.
  const estimateRows = await db
    .select({
      exerciseId: oneRmEstimates.exerciseId,
      date: sessions.sessionDate,
      value: oneRmEstimates.estimatedOneRmKg,
    })
    .from(oneRmEstimates)
    .innerJoin(sessions, eq(oneRmEstimates.sessionId, sessions.id))
    .orderBy(asc(sessions.sessionDate));

  // Keyed over allTrackedExercises (the superset) so both the active-only
  // and show-all views find a series for every exercise they might render.
  const oneRmSeries: Record<string, SeriesPoint[]> = {};
  for (const ex of allTrackedExercises) oneRmSeries[ex.id] = [];
  for (const row of estimateRows) {
    // Guards against an estimate for an exercise that's since had
    // tracks_1rm turned off entirely — neither list would have a checkbox
    // for it, so there's nowhere to add the point.
    if (!oneRmSeries[row.exerciseId]) continue;
    oneRmSeries[row.exerciseId]!.push({
      date: row.date,
      value: Number(row.value),
    });
  }

  const bodyweightRows = await db
    .select({
      date: bodyweightEntries.entryDate,
      value: bodyweightEntries.weightKg,
    })
    .from(bodyweightEntries)
    .orderBy(asc(bodyweightEntries.entryDate));
  const bodyweightSeries: SeriesPoint[] = bodyweightRows.map((r) => ({
    date: r.date,
    value: Number(r.value),
  }));

  // #56: recent-RPE box — display-only, tied to the active program
  // specifically (same scoping principle as #31's original active-program
  // default), not global history. Every set that logged an RPE, across
  // every exercise/day of the active program, joined to exercises for the
  // name and exerciseInDay for the scheme type + #60's signal flag;
  // recentExerciseRpeTrends (lib/) does the per-session aggregation
  // (Wave-aware since #60) and picks each exercise's own most recent
  // RECENT_RPE_READINGS_PER_EXERCISE readings (#56 follow-up: grouped by
  // exercise, not by session — see that function's own comment).
  const recentRpe = activeProgram
    ? recentExerciseRpeTrends(
        (
          await db
            .select({
              sessionId: sessions.id,
              date: sessions.sessionDate,
              exerciseId: loggedSets.exerciseId,
              exerciseName: exercises.name,
              schemeType: exerciseInDay.schemeType,
              rpe: loggedSets.rpe,
              countsTowardRpeSignal: loggedSets.countsTowardRpeSignal,
            })
            .from(loggedSets)
            .innerJoin(sessions, eq(loggedSets.sessionId, sessions.id))
            .innerJoin(
              dayTemplates,
              eq(sessions.dayTemplateId, dayTemplates.id),
            )
            .innerJoin(exercises, eq(loggedSets.exerciseId, exercises.id))
            .innerJoin(
              exerciseInDay,
              eq(loggedSets.exerciseInDayId, exerciseInDay.id),
            )
            .where(
              and(
                eq(dayTemplates.programId, activeProgram.id),
                isNotNull(loggedSets.rpe),
              ),
            )
        ).map((r) => ({
          sessionId: r.sessionId,
          date: r.date,
          exerciseId: r.exerciseId,
          exerciseName: r.exerciseName,
          schemeType: r.schemeType,
          rpe: Number(r.rpe),
          countsTowardRpeSignal: r.countsTowardRpeSignal,
        })),
        RECENT_RPE_READINGS_PER_EXERCISE,
      )
    : [];

  // #60: small passive flag on RpeBox's Wave rows — same redStreak >= 3 &&
  // !inDeload eligibility the Log page banner uses, just read-only here
  // (the Accept button lives only on the Log page, see that ticket's
  // resolved spec). Scoped to the active program's own exercises, matching
  // recentRpe's scoping above.
  const suggestDeloadExerciseIds = activeProgram
    ? activeProgram.dayTemplates
        .flatMap((d) => d.exercises)
        .filter((ex) => {
          if (ex.schemeType !== "wave") return false;
          const state = ex.schemeState as WaveState;
          return (state.redStreak ?? 0) >= 3 && !state.inDeload;
        })
        .map((ex) => ex.exerciseId)
    : [];

  return (
    <ProgressCharts
      exercises={trackedExercises}
      allExercises={allTrackedExercises}
      oneRmSeries={oneRmSeries}
      bodyweightSeries={bodyweightSeries}
      hasActiveProgram={activeProgram !== undefined}
      recentRpe={recentRpe}
      suggestDeloadExerciseIds={suggestDeloadExerciseIds}
    />
  );
}

// An exercise can appear in more than one day template of the same program
// (e.g. Bench Press on both an upper day and a push day) — one checkbox per
// exercise, not one per appearance.
function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Map<string, T>();
  for (const item of items) seen.set(item.id, item);
  return [...seen.values()];
}

// Shared by both trackedExercises and allTrackedExercises above (#53) —
// same filter (tracks_1rm, not archived) -> ExerciseOption shape -> dedupe
// -> alphabetical sort pipeline, differing only in which rows feed it.
function toExerciseOptions(
  exercisesList: {
    id: string;
    name: string;
    isBodyweightBased: boolean;
    tracksOneRm: boolean;
    isArchived: boolean;
  }[],
): ExerciseOption[] {
  return dedupeById(
    exercisesList
      .filter((ex) => ex.tracksOneRm && !ex.isArchived)
      .map((ex) => ({
        id: ex.id,
        name: ex.name,
        isBodyweightBased: ex.isBodyweightBased,
      })),
  ).sort((a, b) => a.name.localeCompare(b.name));
}

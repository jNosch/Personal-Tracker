import { asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import {
  bodyweightEntries,
  dayTemplates,
  exerciseInDay,
  oneRmEstimates,
  programs,
  sessions,
} from "../../db/schema";
import ProgressCharts from "./ProgressCharts";
import type { SeriesPoint } from "../../lib/progressRange";

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
    ? dedupeById(
        activeProgram.dayTemplates
          .flatMap((d) => d.exercises)
          .map((e) => e.exercise)
          .filter((ex) => ex.tracksOneRm && !ex.isArchived)
          .map((ex) => ({
            id: ex.id,
            name: ex.name,
            isBodyweightBased: ex.isBodyweightBased,
          })),
      ).sort((a, b) => a.name.localeCompare(b.name))
    : [];

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

  const oneRmSeries: Record<string, SeriesPoint[]> = {};
  for (const ex of trackedExercises) oneRmSeries[ex.id] = [];
  for (const row of estimateRows) {
    // Guards against an estimate for an exercise that's since been archived
    // or had tracks_1rm turned off — trackedExercises wouldn't have a
    // checkbox for it, so there's nowhere to add the point.
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

  return (
    <ProgressCharts
      exercises={trackedExercises}
      oneRmSeries={oneRmSeries}
      bodyweightSeries={bodyweightSeries}
      hasActiveProgram={activeProgram !== undefined}
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

import { and, asc, eq } from "drizzle-orm";
import { db } from "../../db/client";
import {
  bodyweightEntries,
  exercises,
  oneRmEstimates,
  sessions,
} from "../../db/schema";
import ProgressCharts from "./ProgressCharts";
import type { SeriesPoint } from "../../lib/progressRange";

// Same reasoning as app/programs/page.tsx — not statically prerenderable.
export const dynamic = "force-dynamic";

export default async function ProgressPage() {
  const trackedExercises = await db
    .select({ id: exercises.id, name: exercises.name })
    .from(exercises)
    .where(
      and(eq(exercises.tracksOneRm, true), eq(exercises.isArchived, false)),
    )
    .orderBy(asc(exercises.name));

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
    />
  );
}

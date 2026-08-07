import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "../../db/client";
import { dayTemplates, exerciseInDay, programs } from "../../db/schema";
import {
  prescribe,
  type SchemeConfig,
  type WaveState,
} from "../../lib/schemes";
import LogSessionForm from "./LogSessionForm";

// Same reasoning as app/programs/page.tsx — not statically prerenderable.
export const dynamic = "force-dynamic";

export default async function LogPage() {
  const program = await db.query.programs.findFirst({
    where: eq(programs.isActive, true),
    with: {
      dayTemplates: {
        where: eq(dayTemplates.isArchived, false),
        orderBy: asc(dayTemplates.position),
        with: {
          exercises: {
            where: eq(exerciseInDay.isArchived, false),
            orderBy: asc(exerciseInDay.position),
            with: { exercise: true },
          },
        },
      },
    },
  });

  if (!program) {
    return (
      <EmptyState message="No active program. Activate one to start logging sessions." />
    );
  }
  if (program.dayTemplates.length === 0) {
    return (
      <EmptyState
        message={`"${program.name}" has no days yet — add one first.`}
        href={`/programs/${program.id}`}
      />
    );
  }

  // Land on the day at next_day_position; a gap from an archived day (rare,
  // see actions.ts's rotation-advance comment) falls back to the first day
  // rather than erroring.
  const day =
    program.dayTemplates.find((d) => d.position === program.nextDayPosition) ??
    program.dayTemplates[0]!;

  const exerciseViews = day.exercises.map((ex) => {
    const scheme = {
      type: ex.schemeType,
      config: ex.schemeConfig,
    } as SchemeConfig;
    const sets = prescribe(scheme, ex.schemeState);
    const needsTrainingMax =
      scheme.type === "wave" &&
      (ex.schemeState as WaveState).trainingMaxKg == null;
    return {
      exerciseInDayId: ex.id,
      exerciseName: ex.exercise.name,
      schemeType: ex.schemeType,
      sets,
      needsTrainingMax,
    };
  });

  return (
    // Keyed on the day: after saving, router.refresh() re-renders this same
    // component position with a *different* day's exercises (rotation just
    // advanced). Without a key, React reuses the existing instance and its
    // local entries state — keyed by the old day's exerciseInDayIds — never
    // resets, crashing on lookup against the new day's ids.
    <LogSessionForm
      key={day.id}
      programId={program.id}
      programName={program.name}
      dayTemplateId={day.id}
      dayLabel={day.label}
      exercises={exerciseViews}
    />
  );
}

function EmptyState({ message, href }: { message: string; href?: string }) {
  return (
    <div
      style={{
        padding: 24,
        fontFamily: "sans-serif",
        maxWidth: 620,
        margin: "0 auto",
      }}
    >
      <p style={{ color: "#999", fontSize: 14, marginBottom: 12 }}>{message}</p>
      <Link
        href={href ?? "/programs"}
        style={{ fontSize: 14, fontWeight: 600 }}
      >
        Go to Programs →
      </Link>
    </div>
  );
}

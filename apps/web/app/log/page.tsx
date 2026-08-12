import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { db } from "../../db/client";
import { dayTemplates, exerciseInDay, programs } from "../../db/schema";
import {
  prescribe,
  type SchemeConfig,
  type WaveState,
} from "../../lib/schemes";
import { styleAt, type SetStyleEntry } from "../../lib/setStyles";
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
    const waveState =
      scheme.type === "wave" ? (ex.schemeState as WaveState) : undefined;
    const needsTrainingMax =
      scheme.type === "wave" && waveState!.trainingMaxKg == null;
    // #66: styleWeekIndex is deliberately null during deload even though
    // waveState.weekIndex still holds a real number (preserved for after
    // deload ends, see schemes.ts) — DELOAD_WEEK's 3 sets are numbered
    // 1/2/3 same as any real week's, so passing the stale weekIndex through
    // here would let a real week's style tag wrongly show up on the deload
    // week's sets. Stored Wave entries never use weekIndex: null (see
    // setStyles.ts), so this null is a genuine "never match" sentinel, not
    // a coincidence.
    const styleWeekIndex =
      scheme.type === "wave"
        ? waveState!.inDeload
          ? null
          : (waveState!.weekIndex ?? 0)
        : null;
    const setStyles = ex.setStyles as SetStyleEntry[];
    const setsWithStyle = sets.map((s) => ({
      ...s,
      style: styleAt(setStyles, styleWeekIndex, s.setNumber),
    }));
    // #60: the Log page banner's eligibility check — same rule
    // acceptWaveRpeDeloadSuggestion re-verifies server-side before actually
    // accepting, so a stale render here can only under- or over-show the
    // banner for one page load, never mis-write state.
    const suggestDeload =
      scheme.type === "wave" &&
      !waveState!.inDeload &&
      (waveState!.redStreak ?? 0) >= 3;
    return {
      exerciseInDayId: ex.id,
      exerciseName: ex.exercise.name,
      schemeType: ex.schemeType,
      sets: setsWithStyle,
      needsTrainingMax,
      suggestDeload,
      // #57: Rep Accumulation's per-set label already shows "weight×—" (no
      // per-set target, the target is a whole-session total, #55) — without
      // this, there's nothing on screen telling you what that total
      // actually is. undefined for every other scheme.
      repAccumulationTargetTotalReps:
        scheme.type === "rep_accumulation"
          ? scheme.config.targetTotalReps
          : undefined,
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

import { asc, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "../../../db/client";
import {
  dayTemplates,
  exerciseInDay,
  exercises,
  programs,
} from "../../../db/schema";
import type { SchemeConfig } from "../../../lib/schemes";
import type { SetStyleEntry } from "../../../lib/setStyles";
import ProgramEditor from "./ProgramEditor";

// Same reasoning as app/programs/page.tsx — not statically prerenderable.
export const dynamic = "force-dynamic";

export default async function ProgramPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const program = await db.query.programs.findFirst({
    where: eq(programs.id, id),
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

  if (!program) notFound();

  const exerciseLibrary = await db
    .select()
    .from(exercises)
    .where(eq(exercises.isArchived, false))
    .orderBy(asc(exercises.name));

  // schemeType/schemeConfig are stored as text + jsonb with no runtime
  // validation layer (out of this ticket's scope) — cast at this one
  // boundary rather than scattering `as` through the client component.
  // A malformed row here would surface as a runtime error in
  // SchemeConfigFields, not a type error.
  const days = program.dayTemplates.map((day) => ({
    id: day.id,
    label: day.label,
    exercises: day.exercises.map((ex) => ({
      id: ex.id,
      exercise: ex.exercise,
      scheme: { type: ex.schemeType, config: ex.schemeConfig } as SchemeConfig,
      // #66: same cast-at-the-boundary reasoning as scheme above.
      setStyles: ex.setStyles as SetStyleEntry[],
    })),
  }));

  return (
    <ProgramEditor
      program={{
        id: program.id,
        name: program.name,
        isActive: program.isActive,
        isArchived: program.isArchived,
      }}
      days={days}
      exerciseLibrary={exerciseLibrary}
    />
  );
}

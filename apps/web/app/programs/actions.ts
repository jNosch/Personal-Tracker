"use server";

// Server actions backing the Program Creator (#24). Every mutation takes an
// explicit programId (even where only a child id is strictly needed for the
// WHERE clause) purely so it can revalidatePath the one page all of this
// renders on — cheaper than an extra lookup query per call.
import { and, eq, max } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "../../db/client";
import {
  dayTemplates,
  exerciseInDay,
  exercises,
  programs,
} from "../../db/schema";
import { defaultConfigFor, type SchemeConfig } from "../../lib/schemes";
import { pruneSetStyles, type SetStyleEntry } from "../../lib/setStyles";

function programPath(programId: string) {
  return `/programs/${programId}`;
}

export async function createProgram() {
  const [program] = await db
    .insert(programs)
    .values({ name: "New Program" })
    .returning({ id: programs.id });
  if (!program) throw new Error("Failed to create program");
  redirect(programPath(program.id));
}

export async function renameProgram(programId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return;
  await db
    .update(programs)
    .set({ name: trimmed })
    .where(eq(programs.id, programId));
  revalidatePath(programPath(programId));
}

// Activating a program never touches next_day_position — reactivating
// resumes exactly where it left off (#9). The partial unique index
// (one_active_program) isn't deferrable, so statement order matters:
// deactivate whatever's currently active *before* activating the target,
// otherwise the second statement would momentarily try to have two rows
// with is_active = true and fail the constraint immediately.
export async function setActiveProgram(programId: string) {
  await db.transaction(async (tx) => {
    await tx
      .update(programs)
      .set({ isActive: false })
      .where(eq(programs.isActive, true));
    await tx
      .update(programs)
      .set({ isActive: true })
      .where(eq(programs.id, programId));
  });
  revalidatePath(programPath(programId));
  revalidatePath("/programs");
}

// An archived-and-active program is a nonsensical state, so archiving
// deactivates it too.
export async function archiveProgram(programId: string) {
  await db
    .update(programs)
    .set({ isArchived: true, isActive: false })
    .where(eq(programs.id, programId));
  revalidatePath(programPath(programId));
  revalidatePath("/programs");
}

// day_template_position_per_program isn't a partial index — archived days
// still hold their position slot forever, so the next position is always
// MAX(position)+1 across every row for this program, archived included.
// Never a count, never gap-filled.
export async function addDayTemplate(programId: string) {
  const [row] = await db
    .select({ max: max(dayTemplates.position) })
    .from(dayTemplates)
    .where(eq(dayTemplates.programId, programId));
  const position = (row?.max ?? -1) + 1;
  const [day] = await db
    .insert(dayTemplates)
    .values({ programId, label: `Day ${position + 1}`, position })
    .returning({ id: dayTemplates.id });
  if (!day) throw new Error("Failed to create day template");
  revalidatePath(programPath(programId));
  return day;
}

export async function renameDayTemplate(
  programId: string,
  dayTemplateId: string,
  label: string,
) {
  const trimmed = label.trim();
  if (!trimmed) return;
  await db
    .update(dayTemplates)
    .set({ label: trimmed })
    .where(eq(dayTemplates.id, dayTemplateId));
  revalidatePath(programPath(programId));
}

export async function archiveDayTemplate(
  programId: string,
  dayTemplateId: string,
) {
  await db
    .update(dayTemplates)
    .set({ isArchived: true })
    .where(eq(dayTemplates.id, dayTemplateId));
  revalidatePath(programPath(programId));
}

// 3-step swap, not a direct 2-statement exchange: the unique index isn't
// deferrable, so setting A's position straight to B's (while B still holds
// it) would violate the constraint immediately. Routing A through an unused
// sentinel first avoids ever having two rows at the same position at once.
export async function reorderDayTemplate(
  programId: string,
  dayTemplateId: string,
  direction: "up" | "down",
) {
  const rows = await db
    .select({ id: dayTemplates.id, position: dayTemplates.position })
    .from(dayTemplates)
    .where(
      and(
        eq(dayTemplates.programId, programId),
        eq(dayTemplates.isArchived, false),
      ),
    )
    .orderBy(dayTemplates.position);

  const index = rows.findIndex((r) => r.id === dayTemplateId);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= rows.length) return;

  const current = rows[index]!;
  const neighbor = rows[neighborIndex]!;

  await db.transaction(async (tx) => {
    await tx
      .update(dayTemplates)
      .set({ position: -1 })
      .where(eq(dayTemplates.id, current.id));
    await tx
      .update(dayTemplates)
      .set({ position: current.position })
      .where(eq(dayTemplates.id, neighbor.id));
    await tx
      .update(dayTemplates)
      .set({ position: neighbor.position })
      .where(eq(dayTemplates.id, current.id));
  });
  revalidatePath(programPath(programId));
}

export async function createExercise(
  name: string,
  isBodyweightBased: boolean,
  tracksOneRm: boolean,
) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Exercise name is required");
  const [exercise] = await db
    .insert(exercises)
    .values({ name: trimmed, isBodyweightBased, tracksOneRm })
    .returning({
      id: exercises.id,
      name: exercises.name,
      isBodyweightBased: exercises.isBodyweightBased,
      tracksOneRm: exercises.tracksOneRm,
    });
  if (!exercise) throw new Error("Failed to create exercise");
  return exercise;
}

// schemeState starts empty ({}) — every exercise-in-day always has exactly
// one scheme (#8), but this ticket only picks/stores scheme_config; the
// scheme engine's prescribe/update runtime logic AND first-time state
// initialization (e.g. Double Progression's starting current_weight, which
// isn't part of config anywhere in the resolved spec) is Session Logging's
// concern (#29), not this ticket's. #29 must handle an empty/missing state
// on first prescribe rather than assume it's pre-populated.
export async function addExerciseInDay(
  programId: string,
  dayTemplateId: string,
  exerciseId: string,
) {
  // Same non-partial-index reasoning as addDayTemplate's position above.
  const [row] = await db
    .select({ max: max(exerciseInDay.position) })
    .from(exerciseInDay)
    .where(eq(exerciseInDay.dayTemplateId, dayTemplateId));
  const position = (row?.max ?? -1) + 1;
  const scheme = defaultConfigFor("double_progression");
  await db.insert(exerciseInDay).values({
    dayTemplateId,
    exerciseId,
    position,
    schemeType: scheme.type,
    schemeConfig: scheme.config,
    schemeState: {},
  });
  revalidatePath(programPath(programId));
}

export async function archiveExerciseInDay(
  programId: string,
  exerciseInDayId: string,
) {
  await db
    .update(exerciseInDay)
    .set({ isArchived: true })
    .where(eq(exerciseInDay.id, exerciseInDayId));
  revalidatePath(programPath(programId));
}

// Changing scheme type resets state to {} — old state's shape belongs to
// the previous scheme and is meaningless under a new one. Same first-time-
// initialization handoff to #29 as addExerciseInDay above.
// #66: setStyles is pruned here, not trusted as-is from the client — the
// draft the program builder was editing may have referenced set positions
// (setNumber, or (weekIndex, setNumber) for Wave) that this same save just
// invalidated (setCount lowered, a Wave week removed, usePreset flipped).
// pruneSetStyles drops anything that no longer matches the config being
// saved alongside it, so stored styles never point at a set that doesn't
// exist.
export async function updateExerciseScheme(
  programId: string,
  exerciseInDayId: string,
  scheme: SchemeConfig,
  setStyles: SetStyleEntry[],
) {
  await db
    .update(exerciseInDay)
    .set({
      schemeType: scheme.type,
      schemeConfig: scheme.config,
      schemeState: {},
      setStyles: pruneSetStyles(scheme, setStyles),
    })
    .where(eq(exerciseInDay.id, exerciseInDayId));
  revalidatePath(programPath(programId));
}

export async function reorderExerciseInDay(
  programId: string,
  dayTemplateId: string,
  exerciseInDayId: string,
  direction: "up" | "down",
) {
  const rows = await db
    .select({ id: exerciseInDay.id, position: exerciseInDay.position })
    .from(exerciseInDay)
    .where(
      and(
        eq(exerciseInDay.dayTemplateId, dayTemplateId),
        eq(exerciseInDay.isArchived, false),
      ),
    )
    .orderBy(exerciseInDay.position);

  const index = rows.findIndex((r) => r.id === exerciseInDayId);
  const neighborIndex = direction === "up" ? index - 1 : index + 1;
  if (index === -1 || neighborIndex < 0 || neighborIndex >= rows.length) return;

  const current = rows[index]!;
  const neighbor = rows[neighborIndex]!;

  await db.transaction(async (tx) => {
    await tx
      .update(exerciseInDay)
      .set({ position: -1 })
      .where(eq(exerciseInDay.id, current.id));
    await tx
      .update(exerciseInDay)
      .set({ position: current.position })
      .where(eq(exerciseInDay.id, neighbor.id));
    await tx
      .update(exerciseInDay)
      .set({ position: neighbor.position })
      .where(eq(exerciseInDay.id, current.id));
  });
  revalidatePath(programPath(programId));
}

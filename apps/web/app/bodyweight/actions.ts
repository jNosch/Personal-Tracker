"use server";

// Server actions backing Bodyweight Logging (#30). Deliberately thin —
// bodyweight_entries is standalone with no foreign keys and no domain
// logic worth pulling into lib/ (see code-conventions.md's file-org rule:
// lib/ is for real logic, this is just a CRUD pair).
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "../../db/client";
import { bodyweightEntries } from "../../db/schema";

// Takes FormData (not separate params) so the page can wire it straight to
// a plain <form action={...}>, no client component needed for something
// this small (code-conventions.md: routes stay thin).
export async function addBodyweightEntry(formData: FormData) {
  const entryDate = String(formData.get("entryDate"));
  const weightKg = String(formData.get("weightKg"));
  if (!entryDate || !weightKg) return;
  await db.insert(bodyweightEntries).values({ entryDate, weightKg });
  revalidatePath("/bodyweight");
}

// Deletion is trivial to include alongside add (#30's scope note) — no
// FKs reference this table, so there's no archive-only concern here the
// way there is for programs/exercises (ADR-0001 doesn't apply: nothing
// downstream holds a reference to a bodyweight_entries row that would
// break if it were gone). Editing is left out — not required by the
// ticket, and less trivial than a one-button delete.
export async function deleteBodyweightEntry(id: string) {
  await db.delete(bodyweightEntries).where(eq(bodyweightEntries.id, id));
  revalidatePath("/bodyweight");
}

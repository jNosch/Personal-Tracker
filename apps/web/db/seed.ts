// Seeds the exercise library (issue #23). Insert-only, name-based dedup —
// safe to re-run: only inserts exercises not already present by name, never
// truncates. `exercises.name` has no DB-level unique constraint (not part of
// #23's scope), so dedup happens here rather than via onConflictDoNothing().
//
// ./client reads DATABASE_URL at module-evaluation time, and static ESM
// imports all evaluate before any of this file's own top-level statements
// run (regardless of source order) — so loadEnv() below would run too late
// if ./client were a static import. Deferred to a dynamic import inside
// main(), after loadEnv() has already populated process.env.
import { config as loadEnv } from "dotenv";
import { exercises } from "./schema";
import { EXERCISE_SEED } from "./seed-data";

loadEnv({ path: ".env.local" });

async function main() {
  const { db } = await import("./client");

  const namesInSeed = EXERCISE_SEED.map((e) => e.name);
  const duplicates = namesInSeed.filter((name, i) => namesInSeed.indexOf(name) !== i);
  if (duplicates.length > 0) {
    throw new Error(`Duplicate names in seed-data.ts: ${[...new Set(duplicates)].join(", ")}`);
  }

  const existing = await db.select({ name: exercises.name }).from(exercises);
  const existingNames = new Set(existing.map((e) => e.name));

  const toInsert = EXERCISE_SEED.filter((e) => !existingNames.has(e.name));

  if (toInsert.length === 0) {
    console.log(`Nothing to seed — all ${EXERCISE_SEED.length} exercises already present.`);
    return;
  }

  await db.insert(exercises).values(
    toInsert.map((e) => ({
      name: e.name,
      isBodyweightBased: e.isBodyweightBased,
      tracksOneRm: e.tracksOneRm,
    })),
  );

  console.log(
    `Seeded ${toInsert.length} exercise(s), skipped ${EXERCISE_SEED.length - toInsert.length} already present.`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => process.exit());

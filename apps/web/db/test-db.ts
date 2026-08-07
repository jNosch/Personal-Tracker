// Test-only DB client + lifecycle helpers for integration tests. Always
// points at TEST_DATABASE_URL, never the dev database — see
// docs/engineering/testing.md for the isolation strategy (dedicated test DB,
// truncate between tests, no transaction-rollback wrapper).
import { getTableName, is, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { PgTable } from "drizzle-orm/pg-core";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.TEST_DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "TEST_DATABASE_URL is not set — copy .env.example to .env.local and fill it in, " +
      "and make sure the test database exists (see docs/engineering/testing.md).",
  );
}

const client = postgres(connectionString);
export const testDb = drizzle(client, { schema });

export async function migrateTestDb() {
  await migrate(testDb, { migrationsFolder: "./db/migrations" });
}

// Closes the pool so vitest can exit cleanly. Call once in a top-level
// afterAll per integration test file.
export async function closeTestDb() {
  await client.end();
}

// Truncates every table in the schema and resets identity/sequences, so
// tests never leak state into each other. Reads the table list off the
// schema module itself rather than a hardcoded array, so it never drifts
// out of sync as tables are added.
export async function truncateAll() {
  const tableNames = Object.values(schema)
    .filter((value) => is(value, PgTable))
    .map((table) => getTableName(table));

  if (tableNames.length === 0) return;

  const identifiers = tableNames.map((name) => `"${name}"`).join(", ");
  await testDb.execute(sql.raw(`TRUNCATE TABLE ${identifiers} RESTART IDENTITY CASCADE`));
}

// Verifies the "exactly one active program" constraint enforced at the DB
// level via the one_active_program partial unique index (see schema.ts) —
// exactly the kind of schema behavior that earns an integration test per
// docs/engineering/testing.md.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { programs } from "./schema";
import { closeTestDb, migrateTestDb, testDb, truncateAll } from "./test-db";

beforeAll(async () => {
  await migrateTestDb();
});

afterEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await closeTestDb();
});

describe("one_active_program constraint", () => {
  it("allows a single active program", async () => {
    await expect(
      testDb.insert(programs).values({ name: "Push/Pull/Legs", isActive: true }),
    ).resolves.not.toThrow();
  });

  it("rejects a second active program", async () => {
    await testDb.insert(programs).values({ name: "Push/Pull/Legs", isActive: true });

    await expect(
      testDb.insert(programs).values({ name: "Upper/Lower", isActive: true }),
    ).rejects.toThrow();
  });

  it("allows multiple inactive programs", async () => {
    await testDb.insert(programs).values({ name: "Program A", isActive: false });

    await expect(
      testDb.insert(programs).values({ name: "Program B", isActive: false }),
    ).resolves.not.toThrow();
  });
});

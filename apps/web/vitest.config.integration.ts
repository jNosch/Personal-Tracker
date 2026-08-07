// Integration tests — needs the docker-compose Postgres up and a
// TEST_DATABASE_URL pointed at a dedicated test database, never the dev DB.
// See docs/engineering/testing.md.
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ path: ".env.local" });

export default defineConfig({
  test: {
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**"],
    hookTimeout: 30_000,
    passWithNoTests: true,
  },
});

// Unit tests only — no DB required. See docs/engineering/testing.md.
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["**/*.integration.test.ts", "**/node_modules/**", "**/.next/**"],
    // lib/ is still empty — don't fail the run until the first unit test lands.
    passWithNoTests: true,
  },
});

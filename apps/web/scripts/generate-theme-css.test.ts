import { describe, expect, it } from "vitest";
import {
  generateCss,
  generateManifest,
  type Theme,
} from "./generate-theme-css";

const black: Theme = {
  name: "black",
  roles: {
    background: "#0a0a0a",
    surface: "#171717",
    text: "#f5f5f5",
    textMuted: "#8a8a8a",
    accent: "#ffffff",
    border: "#2a2a2a",
    danger: "#ef4444",
  },
};

const purple: Theme = {
  name: "purple",
  roles: {
    background: "#130f1a",
    surface: "#2b1a45",
    text: "#f2eef8",
    textMuted: "#a396b8",
    accent: "#a855f7",
    border: "#4a2f73",
    danger: "#ef4444",
  },
};

describe("generateCss", () => {
  it("emits one [data-theme] block per theme, plus a :root fallback for the default", () => {
    const css = generateCss([black, purple], "black");

    expect(css).toContain(":root {");
    expect(css).toContain('[data-theme="black"] {');
    expect(css).toContain('[data-theme="purple"] {');
    // :root must match the default theme's values, not just exist.
    expect(css.indexOf(":root {")).toBeLessThan(
      css.indexOf('[data-theme="black"]'),
    );
  });

  it("includes all 7 roles, kebab-cased, for every theme", () => {
    const css = generateCss([black, purple], "black");

    for (const [selector, theme] of [
      ['[data-theme="black"]', black],
      ['[data-theme="purple"]', purple],
    ] as const) {
      const block = css.slice(css.indexOf(selector));
      expect(block).toContain(`--background: ${theme.roles.background};`);
      expect(block).toContain(`--surface: ${theme.roles.surface};`);
      expect(block).toContain(`--text: ${theme.roles.text};`);
      expect(block).toContain(`--text-muted: ${theme.roles.textMuted};`);
      expect(block).toContain(`--accent: ${theme.roles.accent};`);
      expect(block).toContain(`--border: ${theme.roles.border};`);
      expect(block).toContain(`--danger: ${theme.roles.danger};`);
    }
  });

  it("keeps danger identical across every theme", () => {
    const css = generateCss([black, purple], "black");
    const dangerValues = [...css.matchAll(/--danger: (#[0-9a-f]+);/g)].map(
      (m) => m[1],
    );
    expect(new Set(dangerValues).size).toBe(1);
  });

  it("throws if the requested default theme isn't in the catalog", () => {
    expect(() => generateCss([black, purple], "sunset")).toThrow(/sunset/);
  });
});

describe("generateManifest", () => {
  it("lists every theme name and marks the default", () => {
    const manifest = generateManifest([black, purple], "black");

    expect(manifest).toContain(
      'export const THEME_NAMES = ["black", "purple"] as const;',
    );
    expect(manifest).toContain(
      'export const DEFAULT_THEME: ThemeName = "black";',
    );
  });
});

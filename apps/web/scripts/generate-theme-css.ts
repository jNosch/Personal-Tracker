// Build-time theme CSS generator (#32). Reads the hand-authored theme JSON
// files in apps/web/themes/ and writes a static CSS file (one
// [data-theme="name"] block per theme, plus a :root fallback for the
// default) and a tiny theme-manifest.ts (theme names, for client
// components). Themes stay pure data; this script is the only thing that
// turns them into generated output. The actual CSS/manifest generation
// logic is pure and lives in ../lib/theme.ts (code-conventions.md's
// file-organization rule names "theme resolution" as lib/ material) — this
// file only does the fs I/O and the CLI entry point.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import {
  generateCss,
  generateManifest,
  validateTheme,
  type Theme,
} from "../lib/theme";

export function loadThemes(themesDir: string): Theme[] {
  const files = readdirSync(themesDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    throw new Error(`No theme JSON files found in ${themesDir}`);
  }
  return files
    .map((file) => {
      const theme = JSON.parse(
        readFileSync(join(themesDir, file), "utf8"),
      ) as Theme;
      validateTheme(theme, file);
      return theme;
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

// Only run the write side-effect when executed directly (not on import).
// pathToFileURL normalizes the platform-specific argv[1] path (Windows
// drive letters, separators) to compare against import.meta.url reliably.
const isMain =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const here = dirname(fileURLToPath(import.meta.url));
  const themesDir = join(here, "..", "themes");
  const cssFile = join(here, "..", "app", "theme-vars.css");
  const manifestFile = join(here, "..", "app", "theme-manifest.ts");
  const defaultThemeName = "black";

  const themes = loadThemes(themesDir);
  const css = generateCss(themes, defaultThemeName);
  const manifest = generateManifest(themes, defaultThemeName);

  mkdirSync(dirname(cssFile), { recursive: true });
  writeFileSync(cssFile, css, "utf8");
  writeFileSync(manifestFile, manifest, "utf8");
  console.log(
    `Generated ${cssFile} and ${manifestFile} (${themes.length} theme${themes.length === 1 ? "" : "s"}: ${themes.map((t) => t.name).join(", ")})`,
  );
}

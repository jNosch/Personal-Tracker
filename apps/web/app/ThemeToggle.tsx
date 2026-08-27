"use client";

// Theme cycle button (#32). A cycle button, not a binary switch, on purpose:
// the theme catalog is "fixed but extensible" (#20) — a 3rd theme should
// just mean a longer cycle, not a UI rework.
import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { THEME_NAMES, type ThemeName } from "./theme-manifest";

function label(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // Avoids a hydration mismatch: the server doesn't know the persisted
  // theme, so render nothing until mounted client-side picks it up.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <span style={{ width: 60, display: "inline-block" }} />;
  }

  const current = (theme as ThemeName) ?? THEME_NAMES[0];

  const cycle = () => {
    const index = THEME_NAMES.indexOf(current);
    // Modulo against THEME_NAMES.length always lands in range — the
    // non-null assertion is for noUncheckedIndexedAccess, not a real gap.
    const next = THEME_NAMES[(index + 1) % THEME_NAMES.length]!;
    setTheme(next);
  };

  return (
    <button
      type="button"
      onClick={cycle}
      aria-label={`Switch theme (current: ${label(current)})`}
      style={{
        fontSize: 14,
        fontFamily: "inherit",
        color: "var(--text-muted)",
        background: "transparent",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "4px 10px",
        cursor: "pointer",
      }}
    >
      {label(current)}
    </button>
  );
}

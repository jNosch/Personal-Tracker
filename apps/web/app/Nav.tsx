"use client";

// Persistent bottom nav (#38). Fixed, desktop-only — bottom placement is a
// deliberate stylistic choice (resolved via /grilling), not driven by
// mobile ergonomics; this app is desktop-only (#3). Text-only, subtle
// active-page highlight, exactly the four real routes — no link to `/`
// itself, which redirects to `/progress` (see page.tsx).
import Link from "next/link";
import { usePathname } from "next/navigation";

// Usage-frequency order, not alphabetical: Progress is the landing page,
// Log is the most frequent action, Bodyweight frequent but quick, Programs
// rare/setup-only.
const LINKS = [
  { href: "/progress", label: "Progress" },
  { href: "/log", label: "Log" },
  { href: "/bodyweight", label: "Bodyweight" },
  { href: "/programs", label: "Programs" },
] as const;

// Exported so layout.tsx can reserve matching space at the bottom of the
// page — otherwise the fixed bar overlaps the last bit of page content.
export const NAV_HEIGHT = 53;

export default function Nav() {
  const pathname = usePathname();
  return (
    <nav
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: NAV_HEIGHT,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 32,
        borderTop: "1px solid #e5e5e5",
        background: "#fff",
        fontFamily: "sans-serif",
      }}
    >
      {LINKS.map((link) => {
        const active = pathname === link.href;
        return (
          <Link
            key={link.href}
            href={link.href}
            style={{
              fontSize: 14,
              textDecoration: "none",
              // Subtle — deliberately not the bold filled-background style
              // the Progress page's range tabs use.
              color: active ? "#111" : "#999",
              fontWeight: active ? 600 : 400,
            }}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

"use client";

// PROTOTYPE INFRA — floating variant switcher for this route.
// Hidden in production builds; not meant to ship.

import { useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

const VARIANTS = [
  { key: "A", label: "Single-page nested accordion" },
  { key: "B", label: "Master-detail, three panes" },
  { key: "C", label: "Dense grid overview + modal wizard" },
] as const;

const btnStyle = {
  background: "transparent",
  border: "none",
  color: "#fff",
  fontSize: 16,
  cursor: "pointer",
  lineHeight: 1,
};

export default function PrototypeSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const index = Math.max(
    0,
    VARIANTS.findIndex((v) => v.key === current),
  );
  const active = VARIANTS[index]!;

  function go(delta: number) {
    const nextIndex = (index + delta + VARIANTS.length) % VARIANTS.length;
    const params = new URLSearchParams(searchParams.toString());
    params.set("variant", VARIANTS[nextIndex]!.key);
    router.replace(`${pathname}?${params.toString()}`);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (process.env.NODE_ENV === "production") return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 16,
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        background: "#111",
        color: "#fff",
        padding: "8px 16px",
        borderRadius: 999,
        boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
        fontFamily: "sans-serif",
        fontSize: 13,
        zIndex: 9999,
      }}
    >
      <button onClick={() => go(-1)} style={btnStyle} aria-label="Previous variant">
        ←
      </button>
      <span>
        {active.key} — {active.label}
      </span>
      <button onClick={() => go(1)} style={btnStyle} aria-label="Next variant">
        →
      </button>
    </div>
  );
}

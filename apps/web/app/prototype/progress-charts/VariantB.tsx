"use client";

// PROTOTYPE VARIANT B — "Sidebar + focused chart"
// Drill-down-first: pick one metric from a sidebar, see one large chart with time-range tabs.
// Primary affordance is focus on a single metric, not scanning everything at once.

import { useState } from "react";
import { EXERCISES, ONE_RM, BODYWEIGHT, type ExerciseId } from "./data";
import { seriesToPath } from "./svg-path";

type Metric = "bodyweight" | ExerciseId;
type RangeKey = "1m" | "3m" | "6m" | "all";

const RANGES: { key: RangeKey; label: string; weeks: number | null }[] = [
  { key: "1m", label: "1M", weeks: 4 },
  { key: "3m", label: "3M", weeks: 12 },
  { key: "6m", label: "6M", weeks: 16 }, // sample dataset only has 16 weeks total
  { key: "all", label: "All", weeks: null },
];

const CHART_W = 640;
const CHART_H = 280;

export default function VariantB() {
  const [metric, setMetric] = useState<Metric>("squat");
  const [range, setRange] = useState<RangeKey>("all");

  const rangeWeeks = RANGES.find((r) => r.key === range)!.weeks;
  const series = metric === "bodyweight" ? BODYWEIGHT : ONE_RM[metric];
  const sliced = rangeWeeks ? series.slice(-rangeWeeks) : series;
  const values = sliced.map((p) => p.value);
  const d = seriesToPath(values, CHART_W, CHART_H, 24);
  const latest = values[values.length - 1] ?? 0;
  const earliest = values[0] ?? 0;
  const delta = Math.round((latest - earliest) * 10) / 10;

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      <div style={{ width: 200, borderRight: "1px solid #e5e5e5", padding: 16, flexShrink: 0 }}>
        <h2 style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>Metrics</h2>
        <SidebarItem label="Bodyweight" active={metric === "bodyweight"} onClick={() => setMetric("bodyweight")} />
        {EXERCISES.map((ex) => (
          <SidebarItem key={ex.id} label={ex.name} active={metric === ex.id} onClick={() => setMetric(ex.id)} />
        ))}
      </div>
      <div style={{ flex: 1, padding: 24 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
          <h1 style={{ fontSize: 20 }}>
            {metric === "bodyweight" ? "Bodyweight" : `${EXERCISES.find((e) => e.id === metric)?.name} — est. 1RM`}
          </h1>
          <div style={{ display: "flex", gap: 4 }}>
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => setRange(r.key)}
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  border: "1px solid #ccc",
                  borderRadius: 4,
                  background: range === r.key ? "#111" : "#fff",
                  color: range === r.key ? "#fff" : "#111",
                  cursor: "pointer",
                }}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <p style={{ color: delta >= 0 ? "#16a34a" : "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {delta >= 0 ? "+" : ""}
          {delta} kg over this range
        </p>
        <svg width={CHART_W} height={CHART_H} style={{ border: "1px solid #eee" }}>
          <path d={d} fill="none" stroke="#2563eb" strokeWidth={2} />
        </svg>
      </div>
    </div>
  );
}

function SidebarItem({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "8px 10px",
        borderRadius: 6,
        cursor: "pointer",
        fontSize: 14,
        marginBottom: 4,
        background: active ? "#f0f0f0" : "transparent",
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </div>
  );
}

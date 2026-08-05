"use client";

// PROTOTYPE VARIANT D — "Combined overlay + time range" (synthesis of C + B)
// C's shared-axis overlay box (toggle exercises on/off) and separate bodyweight box,
// plus B's time-range tabs (applied globally, filtering both boxes together) and
// per-metric strength-gain delta indicators.

import { useState } from "react";
import { EXERCISES, ONE_RM, BODYWEIGHT, type ExerciseId } from "./data";
import { seriesToPath } from "./svg-path";

const COLORS: Record<ExerciseId, string> = {
  squat: "#2563eb",
  bench: "#dc2626",
  deadlift: "#16a34a",
  pullup: "#9333ea",
};

const CHART_W = 700;
const CHART_H = 300;
const BW_H = 120;

type RangeKey = "1m" | "3m" | "6m" | "all";
const RANGES: { key: RangeKey; label: string; weeks: number | null }[] = [
  { key: "1m", label: "1M", weeks: 4 },
  { key: "3m", label: "3M", weeks: 12 },
  { key: "6m", label: "6M", weeks: 16 }, // sample dataset only has 16 weeks total
  { key: "all", label: "All", weeks: null },
];

function delta(values: number[]): number {
  if (values.length < 2) return 0;
  return Math.round((values[values.length - 1]! - values[0]!) * 10) / 10;
}

function DeltaBadge({ value }: { value: number }) {
  const positive = value >= 0;
  return (
    <span style={{ fontSize: 12, color: positive ? "#16a34a" : "#dc2626", fontWeight: 600 }}>
      {positive ? "+" : ""}
      {value} kg
    </span>
  );
}

export default function VariantD() {
  const [visible, setVisible] = useState<Record<ExerciseId, boolean>>({
    squat: true,
    bench: true,
    deadlift: false,
    pullup: false,
  });
  const [range, setRange] = useState<RangeKey>("all");

  const rangeWeeks = RANGES.find((r) => r.key === range)!.weeks;
  const slice = (series: { date: string; value: number }[]) => (rangeWeeks ? series.slice(-rangeWeeks) : series);

  const activeExercises = EXERCISES.filter((ex) => visible[ex.id]);
  const activeSliced = activeExercises.map((ex) => ({ ex, values: slice(ONE_RM[ex.id]).map((p) => p.value) }));
  const allValues = activeSliced.flatMap((s) => s.values);
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 1;

  const bwSliced = slice(BODYWEIGHT).map((p) => p.value);

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <h1 style={{ fontSize: 20 }}>Progress</h1>
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
      <p style={{ color: "#666", marginBottom: 16 }}>
        Toggle exercises to overlay their 1RM trend — range applies to both boxes below.
      </p>

      {/* Exercise overlay box */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
          {EXERCISES.map((ex) => {
            const d = delta(slice(ONE_RM[ex.id]).map((p) => p.value));
            return (
              <label
                key={ex.id}
                style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}
              >
                <input
                  type="checkbox"
                  checked={visible[ex.id]}
                  onChange={() => setVisible((v) => ({ ...v, [ex.id]: !v[ex.id] }))}
                />
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: COLORS[ex.id],
                    display: "inline-block",
                  }}
                />
                {ex.name}
                {visible[ex.id] && <DeltaBadge value={d} />}
              </label>
            );
          })}
        </div>
        <svg width={CHART_W} height={CHART_H}>
          {activeSliced.map(({ ex, values }) => (
            <path
              key={ex.id}
              d={seriesToPath(values, CHART_W, CHART_H, 12, { min, max })}
              fill="none"
              stroke={COLORS[ex.id]}
              strokeWidth={2}
            />
          ))}
          {activeSliced.length === 0 && (
            <text x={CHART_W / 2} y={CHART_H / 2} textAnchor="middle" fill="#999" fontSize={13}>
              Toggle an exercise above to see its trend
            </text>
          )}
        </svg>
        <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
          est. 1RM (kg), shared axis across toggled exercises
        </div>
      </div>

      {/* Bodyweight box — always its own, never merged into the overlay */}
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
          <h2 style={{ fontSize: 15 }}>Bodyweight</h2>
          <DeltaBadge value={delta(bwSliced)} />
        </div>
        <svg width={CHART_W} height={BW_H}>
          <path d={seriesToPath(bwSliced, CHART_W, BW_H, 12)} fill="none" stroke="#111" strokeWidth={2} />
        </svg>
      </div>
    </div>
  );
}

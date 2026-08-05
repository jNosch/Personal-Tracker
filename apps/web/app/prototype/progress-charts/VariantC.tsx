"use client";

// PROTOTYPE VARIANT C — "Combined overlay"
// Comparison-first: toggle exercises on/off to overlay their 1RM trends on one shared-axis
// timeline, with bodyweight as a separate panel below. Primary affordance is cross-exercise
// comparison, not a single focused metric or an overview grid.

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
const BW_H = 100;

export default function VariantC() {
  const [visible, setVisible] = useState<Record<ExerciseId, boolean>>({
    squat: true,
    bench: true,
    deadlift: false,
    pullup: false,
  });

  const activeExercises = EXERCISES.filter((ex) => visible[ex.id]);
  const allValues = activeExercises.flatMap((ex) => ONE_RM[ex.id].map((p) => p.value));
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 1;

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Progress — combined view</h1>
      <p style={{ color: "#666", marginBottom: 16 }}>Toggle exercises to overlay their 1RM trend on one shared timeline</p>

      <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
        {EXERCISES.map((ex) => (
          <label key={ex.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={visible[ex.id]}
              onChange={() => setVisible((v) => ({ ...v, [ex.id]: !v[ex.id] }))}
            />
            <span
              style={{ width: 10, height: 10, borderRadius: 5, background: COLORS[ex.id], display: "inline-block" }}
            />
            {ex.name}
          </label>
        ))}
      </div>

      <svg width={CHART_W} height={CHART_H} style={{ border: "1px solid #eee", marginBottom: 8 }}>
        {activeExercises.map((ex) => {
          const values = ONE_RM[ex.id].map((p) => p.value);
          const d = seriesToPath(values, CHART_W, CHART_H, 12, { min, max });
          return <path key={ex.id} d={d} fill="none" stroke={COLORS[ex.id]} strokeWidth={2} />;
        })}
        {activeExercises.length === 0 && (
          <text x={CHART_W / 2} y={CHART_H / 2} textAnchor="middle" fill="#999" fontSize={13}>
            Toggle an exercise above to see its trend
          </text>
        )}
      </svg>
      <div style={{ fontSize: 12, color: "#999", marginBottom: 24 }}>
        est. 1RM (kg), shared axis across toggled exercises
      </div>

      <h2 style={{ fontSize: 15, marginBottom: 8 }}>Bodyweight</h2>
      <svg width={CHART_W} height={BW_H} style={{ border: "1px solid #eee" }}>
        <path
          d={seriesToPath(BODYWEIGHT.map((p) => p.value), CHART_W, BW_H, 12)}
          fill="none"
          stroke="#111"
          strokeWidth={2}
        />
      </svg>
    </div>
  );
}

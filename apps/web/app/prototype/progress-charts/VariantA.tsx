"use client";

// PROTOTYPE VARIANT A — "Dashboard grid"
// Overview-first: a grid of small cards, each a sparkline for one metric.
// Primary affordance is scanning everything at once; drill-down is a click away (stub link).

import { EXERCISES, ONE_RM, BODYWEIGHT } from "./data";
import { seriesToPath } from "./svg-path";

const CARD_W = 260;
const CARD_H = 80;

function Sparkline({ values, color }: { values: number[]; color: string }) {
  const d = seriesToPath(values, CARD_W, CARD_H, 8);
  return (
    <svg width={CARD_W} height={CARD_H} style={{ display: "block" }}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}

const cardStyle = { border: "1px solid #e5e5e5", borderRadius: 8, padding: 16 };
const cardHeader = { fontSize: 13, color: "#666", marginBottom: 8 };
const cardFooter = { fontSize: 13, marginTop: 8, fontWeight: 600 };

export default function VariantA() {
  return (
    <div style={{ padding: 24, fontFamily: "sans-serif" }}>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>Progress</h1>
      <p style={{ color: "#666", marginBottom: 20 }}>
        Overview — every tracked metric at a glance. Click a card to drill in (stub link only).
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
        <div style={cardStyle}>
          <div style={cardHeader}>Bodyweight</div>
          <Sparkline values={BODYWEIGHT.map((p) => p.value)} color="#2563eb" />
          <div style={cardFooter}>{BODYWEIGHT[BODYWEIGHT.length - 1]!.value} kg (latest weekly entry)</div>
        </div>
        {EXERCISES.map((ex) => {
          const points = ONE_RM[ex.id];
          const latest = points[points.length - 1]!;
          return (
            <a
              key={ex.id}
              href={`?variant=A&exercise=${ex.id}`}
              style={{ ...cardStyle, textDecoration: "none", color: "inherit" }}
            >
              <div style={cardHeader}>{ex.name} — est. 1RM</div>
              <Sparkline values={points.map((p) => p.value)} color="#16a34a" />
              <div style={cardFooter}>
                {latest.value} kg{ex.isBodyweightBased ? " (total load)" : ""}
              </div>
            </a>
          );
        })}
      </div>
      <p style={{ marginTop: 24, fontSize: 12, color: "#999" }}>
        Note: program-vs-actual / adherence is a separate, still-open ticket — not shown here.
      </p>
    </div>
  );
}

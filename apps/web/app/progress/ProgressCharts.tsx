"use client";

// Progress Charts (#31) — real-data version of prototype variant D (see
// prototype/progress-charts branch, and the ticket's spec: combined 1RM
// overlay box + separate bodyweight box, global time-range tabs, per-metric
// delta badges). No program-boundary awareness and no volume — both
// deliberately cut, see #31/#12/#6.

import { useState } from "react";
import {
  computeDelta,
  filterByRange,
  RANGES,
  type RangeKey,
  type SeriesPoint,
} from "../../lib/progressRange";
import {
  combinedDomain,
  seriesToPath,
  weekAxisTicks,
  type DateDomain,
} from "./svg-path";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];
// No Date object round-trip — parses "YYYY-MM-DD" directly (same reasoning
// as mondayTicks' UTC-only math) so this can't drift a day depending on
// the viewer's local timezone.
function formatShortDate(iso: string): string {
  const [, month, day] = iso.split("-");
  return `${MONTHS[Number(month) - 1]} ${Number(day)}`;
}

// Rough weekly axis: a tick + short date label per Monday in the chart's
// date range, with fallback behavior for short/no-Monday/single-day ranges
// — see svg-path.ts's weekAxisTicks for which dates get picked and why.
// Shared between both boxes; this component only renders what that
// (tested) function decides.
function WeekAxis({
  domain,
  width,
  plotHeight,
  padding = 12,
}: {
  domain: DateDomain | null;
  width: number;
  plotHeight: number;
  padding?: number;
}) {
  if (!domain) return null;
  return (
    <>
      {weekAxisTicks(domain, width, padding).map(({ date, x }) => (
        <g key={date}>
          <line
            x1={x}
            y1={plotHeight}
            x2={x}
            y2={plotHeight + 4}
            stroke="#ccc"
          />
          <text
            x={x}
            y={plotHeight + 15}
            textAnchor="middle"
            fontSize={10}
            fill="#999"
          >
            {formatShortDate(date)}
          </text>
        </g>
      ))}
    </>
  );
}

// Cycled by index rather than mapped per-exercise-id — exercises are
// user-defined (seeded, not a fixed set like the prototype's four), so
// there's no stable identity to hang a fixed color map off of.
const PALETTE = [
  "#2563eb",
  "#dc2626",
  "#16a34a",
  "#9333ea",
  "#d97706",
  "#0891b2",
];

const CHART_W = 700;
const CHART_H = 300;
const BW_H = 120;
// Extra strip below the plotted line, reserved for WeekAxis's ticks and
// date labels. Kept constant regardless of whether there's data to show an
// axis for, so toggling checkboxes never shifts the chart's overall height.
const AXIS_H = 24;

export interface ExerciseOption {
  id: string;
  name: string;
}

interface ProgressChartsProps {
  exercises: ExerciseOption[];
  oneRmSeries: Record<string, SeriesPoint[]>;
  bodyweightSeries: SeriesPoint[];
  // Distinguishes "no active program" from "active program, nothing tracked"
  // — exercises.length === 0 alone can't tell those apart, and they need
  // different empty-state copy.
  hasActiveProgram: boolean;
}

function DeltaBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span style={{ fontSize: 12, color: "#999" }}>not enough data yet</span>
    );
  }
  const positive = value >= 0;
  return (
    <span
      style={{
        fontSize: 12,
        color: positive ? "#16a34a" : "#dc2626",
        fontWeight: 600,
      }}
    >
      {positive ? "+" : ""}
      {value} kg
    </span>
  );
}

export default function ProgressCharts({
  exercises,
  oneRmSeries,
  bodyweightSeries,
  hasActiveProgram,
}: ProgressChartsProps) {
  // Default: everything toggled on. With a handful of tracked exercises
  // (the expected case for a single-user tracker) an overlay of all of them
  // is still readable, and it means the chart isn't blank on first visit.
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(exercises.map((ex) => [ex.id, true])),
  );
  const [range, setRange] = useState<RangeKey>("all");

  const activeExercises = exercises.filter((ex) => visible[ex.id]);
  const activeSliced = activeExercises.map((ex) => ({
    ex,
    series: filterByRange(oneRmSeries[ex.id] ?? [], range),
  }));
  const allValues = activeSliced.flatMap((s) => s.series.map((p) => p.value));
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 1;
  const oneRmDomain = combinedDomain(activeSliced.map((s) => s.series));

  const bwSliced = filterByRange(bodyweightSeries, range);
  const bwDomain = combinedDomain([bwSliced]);

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "sans-serif",
        maxWidth: 760,
        margin: "0 auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 4,
        }}
      >
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
      <p style={{ color: "#666", marginBottom: 16, fontSize: 13 }}>
        Toggle exercises to overlay their 1RM trend — range applies to both
        boxes below.
      </p>

      {/* Exercise overlay box */}
      <div
        style={{
          border: "1px solid #e5e5e5",
          borderRadius: 8,
          padding: 16,
          marginBottom: 16,
        }}
      >
        {exercises.length === 0 ? (
          <p style={{ color: "#999", fontSize: 13 }}>
            {hasActiveProgram
              ? "No exercises in the active program are tracked for 1RM yet."
              : "No active program. Activate one to see its exercises here."}
          </p>
        ) : (
          <>
            <div
              style={{
                display: "flex",
                gap: 16,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              {exercises.map((ex, i) => {
                const d = computeDelta(
                  filterByRange(oneRmSeries[ex.id] ?? [], range),
                );
                const color = PALETTE[i % PALETTE.length]!;
                return (
                  <label
                    key={ex.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 13,
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={visible[ex.id] ?? false}
                      onChange={() =>
                        setVisible((v) => ({ ...v, [ex.id]: !v[ex.id] }))
                      }
                    />
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 5,
                        background: color,
                        display: "inline-block",
                      }}
                    />
                    {ex.name}
                    {visible[ex.id] && <DeltaBadge value={d} />}
                  </label>
                );
              })}
            </div>
            <svg width={CHART_W} height={CHART_H + AXIS_H}>
              {oneRmDomain &&
                activeSliced.map(({ ex, series }) => {
                  const i = exercises.findIndex((e) => e.id === ex.id);
                  return (
                    <path
                      key={ex.id}
                      d={seriesToPath(
                        series,
                        oneRmDomain,
                        CHART_W,
                        CHART_H,
                        12,
                        {
                          min,
                          max,
                        },
                      )}
                      fill="none"
                      stroke={PALETTE[i % PALETTE.length]}
                      strokeWidth={2}
                    />
                  );
                })}
              {allValues.length === 0 && (
                <text
                  x={CHART_W / 2}
                  y={CHART_H / 2}
                  textAnchor="middle"
                  fill="#999"
                  fontSize={13}
                >
                  {activeExercises.length === 0
                    ? "Toggle an exercise above to see its trend"
                    : "No logged data in this range yet"}
                </text>
              )}
              <WeekAxis
                domain={oneRmDomain}
                width={CHART_W}
                plotHeight={CHART_H}
              />
            </svg>
            <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
              est. 1RM (kg), shared axis across toggled exercises
            </div>
          </>
        )}
      </div>

      {/* Bodyweight box — always its own, never merged into the overlay */}
      <div
        style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 16 }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: 8,
          }}
        >
          <h2 style={{ fontSize: 15 }}>Bodyweight</h2>
          <DeltaBadge value={computeDelta(bwSliced)} />
        </div>
        {bwSliced.length === 0 ? (
          <p style={{ color: "#999", fontSize: 13 }}>
            No bodyweight entries in this range yet.
          </p>
        ) : (
          <svg width={CHART_W} height={BW_H + AXIS_H}>
            {bwDomain && (
              <path
                d={seriesToPath(bwSliced, bwDomain, CHART_W, BW_H, 12)}
                fill="none"
                stroke="#111"
                strokeWidth={2}
              />
            )}
            <WeekAxis domain={bwDomain} width={CHART_W} plotHeight={BW_H} />
          </svg>
        )}
      </div>
    </div>
  );
}

"use client";

// Progress Charts (#31) — real-data version of prototype variant D (see
// prototype/progress-charts branch, and the ticket's spec: combined 1RM
// overlay box + separate bodyweight box, global time-range tabs, per-metric
// delta badges). No program-boundary awareness and no volume — both
// deliberately cut, see #31/#12/#6.
//
// #44 adds hover tooltips (nearest-line lookup) and fixed-step Y-axis
// gridlines to both boxes.

import { useRef, useState } from "react";
import {
  computeBodyweightMultiple,
  computeDelta,
  filterByRange,
  HIGH_RPE_THRESHOLD,
  RANGES,
  type ExerciseRpeTrend,
  type RangeKey,
  type SeriesPoint,
} from "../../lib/progressRange";
import {
  combinedDomain,
  gridlineValues,
  nearestHoverPoint,
  seriesToPath,
  valueToY,
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

// Fixed-step horizontal gridlines + left-edge value labels (#44) — a
// "raster" for rough at-a-glance reading of absolute values, not just
// relative trend shape. Fixed step size per box (5kg exercises, 1kg
// bodyweight — see ProgressCharts's Y_STEP constants), not derived/"nice
// number"-rounded from the data range, per #44's resolved spec.
function YAxis({
  min,
  max,
  step,
  plotWidth,
  plotHeight,
  padding = 12,
}: {
  min: number;
  max: number;
  step: number;
  plotWidth: number;
  plotHeight: number;
  padding?: number;
}) {
  return (
    <>
      {gridlineValues(min, max, step).map((v) => {
        const y = valueToY(v, min, max, plotHeight, padding);
        return (
          <g key={v}>
            <line
              x1={0}
              y1={y}
              x2={plotWidth}
              y2={y}
              stroke="#e5e5e5"
              strokeWidth={1}
            />
            <text
              x={-6}
              y={y}
              textAnchor="end"
              dominantBaseline="middle"
              fontSize={10}
              fill="#999"
            >
              {v}
            </text>
          </g>
        );
      })}
    </>
  );
}

interface HoverState {
  x: number;
  y: number;
  label: string;
  color: string;
}

// Marker dot + label bubble at the hovered point (#44). The bubble is a
// solid fill behind its own text — unlike a thin line, an opaque box has
// strong contrast against light or dark backgrounds regardless of the
// page's theme, so this doesn't need the same light/dark-aware color pick
// #41 needed for a thin stroke.
function HoverTooltip({
  x,
  y,
  label,
  color,
  plotWidth,
}: HoverState & { plotWidth: number }) {
  const boxWidth = label.length * 6 + 16;
  const boxHeight = 22;
  const boxX = Math.min(Math.max(x - boxWidth / 2, 0), plotWidth - boxWidth);
  const boxY = Math.max(y - boxHeight - 10, 0);
  return (
    <g pointerEvents="none">
      <circle
        cx={x}
        cy={y}
        r={4}
        fill={color}
        stroke="#fff"
        strokeWidth={1.5}
      />
      <rect
        x={boxX}
        y={boxY}
        width={boxWidth}
        height={boxHeight}
        rx={4}
        fill="#111"
        opacity={0.9}
      />
      <text
        x={boxX + 8}
        y={boxY + boxHeight / 2}
        dominantBaseline="middle"
        fontSize={11}
        fill="#fff"
      >
        {label}
      </text>
    </g>
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

// Shared by every place that needs "this exercise's chart color" — checkbox
// dot, path stroke, hover tooltip, RpeBox's exercise names (deduped in code
// review; each site previously did its own findIndex+modulo). -1 (not
// found in the given list — e.g. RpeBox's accessory exercises, never in
// the tracks_1rm-only chart at all) falls back to a neutral gray rather
// than wrapping a negative index through modulo.
function colorForExercise(exerciseId: string, list: { id: string }[]): string {
  const i = list.findIndex((e) => e.id === exerciseId);
  return i === -1 ? "#999" : PALETTE[i % PALETTE.length]!;
}

// Total <svg> width. The box wrapping it has border(1) + padding(16) on
// each side (border-box), sitting inside a maxWidth:760/padding:24
// container — 760 - 24*2 - (1+16)*2 = 678px is genuinely available inside
// the box. 700 overshot that by 22px (the box grows to fit non-shrinkable
// svg content, pushing past the header row above it, which isn't
// similarly constrained). 660 leaves a small margin rather than being an
// exact fit to that number.
const CHART_W = 660;
const CHART_H = 300;
const BW_H = 120;
// border(1) + padding(16) on each side (border-box) — the gap between an
// <svg width={CHART_W}> and the box that visually wraps it. Named (not an
// inline "+ 34") so it reads the same way CHART_W's own comment already
// spells the math out, rather than a bare literal at the one call site
// that needs it (the exercise-overlay box's explicit width, #56).
const BOX_CHROME = (1 + 16) * 2;
// Bodyweight box's own width (#58) — deliberately separate from CHART_W,
// not shared. The exercise-overlay box got an explicit fixed width (#56,
// see below) so RpeBox has somewhere stable to sit beside it, but the
// bodyweight box is still a plain full-width block with no sidebar — it
// stretches to fill the (now-920, was-760) container automatically, and if
// its SVG stayed pinned to CHART_W the extra room would just show up as a
// visibly empty gap on the right (found live-testing #56's container
// widen). Same box-model math as CHART_W's own comment, just against the
// new 920 container: 920 - 24*2(container padding) - (1+16)*2(box
// border+padding) = 838px available; 830 leaves the same small margin
// CHART_W's 660-vs-678 choice did.
const BW_CHART_W = 830;
// Extra strip below the plotted line, reserved for WeekAxis's ticks and
// date labels. Kept constant regardless of whether there's data to show an
// axis for, so toggling checkboxes never shifts the chart's overall height.
const AXIS_H = 24;
// Left margin reserved for YAxis's value labels — same reasoning as AXIS_H,
// but subtracted from CHART_W rather than added to it (see above). Shared
// by both boxes — only the chart width itself (CHART_W vs BW_CHART_W)
// differs between them.
const AXIS_W = 40;
// Actual plotting width once AXIS_W's margin is carved out — every line,
// gridline, tick, and hover lookup operates in this width, not CHART_W.
const PLOT_W = CHART_W - AXIS_W;
const BW_PLOT_W = BW_CHART_W - AXIS_W;
// Fixed Y-axis gridline step (#44) — same 10kg step for both boxes. The
// original 5kg/1kg split (per box's own typical range) produced far too
// many overlapping gridlines once the visible range actually got wide —
// found during implementation, corrected to a coarser shared step that
// stays readable at realistic ranges.
const Y_STEP = 10;
// Subtle, thick-but-translucent data lines (post-implementation feedback)
// so they read clearly without visually fighting the gridlines behind them.
const LINE_WIDTH = 3.5;
const LINE_OPACITY = 0.7;
// Distinct color, not a gray — a muted gray line was hard to distinguish
// against the near-white gridlines/background depending on viewer theme.
const BODYWEIGHT_COLOR = "#db2777";
// Shared "just a value, not a judgment" text color — BodyweightMultipleBadge
// and RpeBox's non-high readings both want this same muted tone rather than
// each hardcoding "#666" independently.
const NEUTRAL_VALUE_COLOR = "#666";
// RpeBox's own width cap — narrow enough to read as a sidebar next to the
// exercise-overlay box, not so narrow that 3 date+value columns crowd.
const RPE_BOX_MAX_W = 220;

export interface ExerciseOption {
  id: string;
  name: string;
  // Gates the bodyweight-multiple badge (#43) — bodyweight-based exercises
  // (weighted pull-ups/dips/etc.) already fold bodyweight into
  // estimated_1rm_kg as *total* load (see lib/oneRm.ts), so "1RM ÷
  // bodyweight" there would be a technically-valid but culturally-confusing
  // number; the metric lifters actually track for those is "added weight."
  isBodyweightBased: boolean;
}

interface ProgressChartsProps {
  // Active-program-scoped candidates (#31's original declutter default).
  exercises: ExerciseOption[];
  // #53: every tracks_1rm exercise ever assigned to any program, active or
  // archived — the "show all exercises" toggle's candidate list. Always a
  // superset of `exercises`.
  allExercises: ExerciseOption[];
  oneRmSeries: Record<string, SeriesPoint[]>;
  bodyweightSeries: SeriesPoint[];
  // Distinguishes "no active program" from "active program, nothing tracked"
  // — an empty candidate list alone can't tell those apart, and they need
  // different empty-state copy (see the showAllExercises/hasActiveProgram
  // three-way branch below).
  hasActiveProgram: boolean;
  // #56: each active-program exercise's own most recent RPE-logged
  // sessions, oldest first, already averaged per session — display-only,
  // doesn't feed any progression/estimate math. Empty when the active
  // program has none logged; caller (page.tsx) only computes this at all
  // when there's an active program, so RpeBox itself doesn't render
  // otherwise (see below).
  recentRpe: ExerciseRpeTrend[];
  // #60: exerciseIds (active-program-scoped) whose Wave redStreak has hit
  // 3+ with no deload underway yet — RpeBox marks these with a small
  // passive flag next to the name. The actionable Accept button lives only
  // on the Log page (app/log/LogSessionForm.tsx's RpeDeloadBanner); this is
  // read-only, same eligibility rule, different surface.
  suggestDeloadExerciseIds: string[];
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

// Bodyweight-multiple badge (#43) — "where do I stand right now" (e.g.
// `2.0x BW`), distinct from DeltaBadge's "how much changed" question next
// to it. Deliberately neutral/muted, not green/red — this is a snapshot
// standing, not a gain/loss judgment, so a colored treatment would wrongly
// imply "good vs. bad." Reuses DeltaBadge's null -> "not enough data yet"
// treatment for the in-range-but-no-point case; the caller is responsible
// for not rendering this at all when there's zero bodyweight data anywhere
// (a different, badge-disappears-entirely case per #43's resolved spec), or
// when the exercise itself has zero 1RM data ever — otherwise this badge's
// null state duplicates DeltaBadge's identical text right beside it.
function BodyweightMultipleBadge({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span style={{ fontSize: 12, color: "#999" }}>not enough data yet</span>
    );
  }
  return (
    <span style={{ fontSize: 12, color: NEUTRAL_VALUE_COLOR, fontWeight: 600 }}>
      {value.toFixed(1)}x BW
    </span>
  );
}

// Small vertical sidebar next to the exercise overlay box (#56) —
// deliberately separate from that box rather than merged into its header,
// since it's scoped to the active program specifically, not to whichever
// exercises are currently toggled. Grouped by exercise, each showing its
// own last few RPE-logged sessions side by side (#56 follow-up — grouping
// by session first hid an exercise's real trend whenever it's trained less
// often than every session, e.g. SBD's Squat only comes up every 3rd
// session; "last 3 sessions of the program" could show 0-1 Squat readings
// instead of its actual last 3). Each exercise's name is colored to match
// its line in the overlay chart above when it's one of the chart's own
// toggleable (tracks_1rm) exercises, so a glance at "which color is
// climbing" up there matches "which color is spiking" down here;
// accessories/isolation work (never in that chart at all) get a neutral
// gray instead of an arbitrary color that wouldn't mean anything. High RPE
// (>= HIGH_RPE_THRESHOLD, near-maximal effort) gets a warning color on the
// *number*, independent of the name's identity color — unlike
// DeltaBadge/BodyweightMultipleBadge's deliberate neutrality, this box
// exists specifically to flag "you might need a deload," so a plain
// "here's a number" treatment would undersell the one thing it's for.
function RpeBox({
  trends,
  exercises,
  suggestDeloadExerciseIds,
}: {
  trends: ExerciseRpeTrend[];
  // Active-program-scoped list (the `exercises` prop, not `allExercises`)
  // — RpeBox is itself always active-program-scoped, so its colors should
  // match what the chart looks like with the "show all" toggle off, not
  // shift depending on that toggle's current state.
  exercises: ExerciseOption[];
  // #60: passive echo of the Log page's deload suggestion — see the prop's
  // own doc comment on ProgressChartsProps.
  suggestDeloadExerciseIds: string[];
}) {
  return (
    <div
      style={{
        flex: "1 1 auto",
        maxWidth: RPE_BOX_MAX_W,
        border: "1px solid #e5e5e5",
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h2 style={{ fontSize: 13, marginBottom: 10 }}>Recent RPE</h2>
      {trends.length === 0 ? (
        <p style={{ color: "#999", fontSize: 12 }}>No RPE logged yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {trends.map((t) => (
            <div key={t.exerciseId}>
              <div
                style={{
                  color: colorForExercise(t.exerciseId, exercises),
                  fontSize: 12,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  marginBottom: 4,
                }}
              >
                {t.exerciseName}
                {/* #60: passive flag — 3+ consecutive red weeks, deload
                    suggestion pending on the Log page. Not clickable here;
                    a title attr spells it out since the icon alone doesn't
                    self-explain. */}
                {suggestDeloadExerciseIds.includes(t.exerciseId) && (
                  <span title="3+ weeks of high RPE — deload suggested on the Log page">
                    {" "}
                    ⚠
                  </span>
                )}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                {t.readings.map((r) => (
                  <div key={r.sessionId} style={{ textAlign: "center" }}>
                    <div
                      style={{
                        fontSize: 9,
                        color: "#999",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {formatShortDate(r.date)}
                    </div>
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        // NEUTRAL_VALUE_COLOR, not "#111" — the page
                        // background here is actually near-black
                        // (rgb(10,10,10), prefers-color-scheme dark; see
                        // known-issues.md's "no design system yet, isn't
                        // theme-aware" entry), so bare "#111" text with no
                        // background of its own is nearly invisible.
                        // Confirmed via getComputedStyle + a real render,
                        // not just guessed — every other "#111" in this
                        // file pairs it with an explicit opaque background
                        // of its own (HoverTooltip's fill, the active
                        // range-tab button), which this bare text color
                        // didn't have.
                        color:
                          r.avgRpe >= HIGH_RPE_THRESHOLD
                            ? "#dc2626"
                            : NEUTRAL_VALUE_COLOR,
                      }}
                    >
                      {r.avgRpe.toFixed(1)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProgressCharts({
  exercises,
  allExercises,
  oneRmSeries,
  bodyweightSeries,
  hasActiveProgram,
  recentRpe,
  suggestDeloadExerciseIds,
}: ProgressChartsProps) {
  // Default: everything toggled on. With a handful of tracked exercises
  // (the expected case for a single-user tracker) an overlay of all of them
  // is still readable, and it means the chart isn't blank on first visit.
  // Seeded from allExercises (the superset, #53) rather than just the
  // active-program list, so an exercise the "show all" toggle later reveals
  // already has a default rather than silently starting unchecked.
  const [visible, setVisible] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(allExercises.map((ex) => [ex.id, true])),
  );
  // #53: switches the candidate list between the active-program default
  // and every tracks_1rm exercise ever assigned to any program — opt-in,
  // #31's original declutter default stays untouched when this is off.
  const [showAllExercises, setShowAllExercises] = useState(false);
  const exerciseList = showAllExercises ? allExercises : exercises;
  const [range, setRange] = useState<RangeKey>("all");
  const [exerciseHover, setExerciseHover] = useState<HoverState | null>(null);
  const [bwHover, setBwHover] = useState<HoverState | null>(null);
  const exerciseSvgRef = useRef<SVGSVGElement>(null);
  const bwSvgRef = useRef<SVGSVGElement>(null);

  const activeExercises = exerciseList.filter((ex) => visible[ex.id]);
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
  const bwValues = bwSliced.map((p) => p.value);
  const bwMin = bwValues.length ? Math.min(...bwValues) : 0;
  const bwMax = bwValues.length ? Math.max(...bwValues) : 1;

  // #44: which line the cursor is nearest to, across whichever exercises
  // are currently toggled on — "nearest line," not every toggled line at
  // once (resolved spec). mouseX/mouseY are converted into the plot's own
  // local coordinate space by subtracting AXIS_W, since the plot content
  // renders inside a <g transform="translate(AXIS_W,0)"> to make room for
  // YAxis's labels.
  function handleExerciseMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = exerciseSvgRef.current?.getBoundingClientRect();
    if (!rect || !oneRmDomain) return;
    const mouseX = e.clientX - rect.left - AXIS_W;
    const mouseY = e.clientY - rect.top;
    const nearest = nearestHoverPoint(
      activeSliced.map((s) => s.series),
      oneRmDomain,
      { min, max },
      PLOT_W,
      CHART_H,
      12,
      mouseX,
      mouseY,
    );
    if (!nearest) {
      setExerciseHover(null);
      return;
    }
    const ex = activeExercises[nearest.seriesIndex]!;
    setExerciseHover({
      x: nearest.x,
      y: nearest.y,
      color: colorForExercise(ex.id, exerciseList),
      label: `${formatShortDate(nearest.point.date)} — ${ex.name}: ${nearest.point.value} kg`,
    });
  }

  function handleBwMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = bwSvgRef.current?.getBoundingClientRect();
    if (!rect || !bwDomain) return;
    const mouseX = e.clientX - rect.left - AXIS_W;
    const mouseY = e.clientY - rect.top;
    const nearest = nearestHoverPoint(
      [bwSliced],
      bwDomain,
      { min: bwMin, max: bwMax },
      BW_PLOT_W,
      BW_H,
      12,
      mouseX,
      mouseY,
    );
    if (!nearest) {
      setBwHover(null);
      return;
    }
    setBwHover({
      x: nearest.x,
      y: nearest.y,
      color: BODYWEIGHT_COLOR,
      label: `${formatShortDate(nearest.point.date)} — ${nearest.point.value} kg`,
    });
  }

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "sans-serif",
        // 920, not 760 (#56) — wide enough for RpeBox to sit beside the
        // exercise box without shrinking it below its own tuned width; see
        // CHART_W's comment for why that width is deliberate and shouldn't
        // move to make room instead.
        maxWidth: 920,
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

      {/* Exercise overlay box + recent-RPE sidebar (#56) — flex row so the
          sidebar sits beside it without shrinking the overlay box below its
          own tuned width (flex: "0 0 auto" below). Row, not the overlay box
          itself, carries the bottom margin now. */}
      <div
        style={{
          display: "flex",
          gap: 16,
          marginBottom: 16,
          alignItems: "flex-start",
        }}
      >
        <div
          style={{
            // Explicit width, not just flex: "0 0 auto" — without it, this
            // box's width becomes shrink-to-fit around its own content
            // (the checkbox row's natural single-line width, which can
            // exceed CHART_W once several exercises/badges are toggled on)
            // rather than staying pinned to the SVG's actual width,
            // squeezing RpeBox narrower than intended and wrapping its
            // date text (found live-testing #56).
            width: CHART_W + BOX_CHROME,
            flex: "0 0 auto",
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            padding: 16,
          }}
        >
          {/* #53: opt-in escape hatch from #31's active-program-only default
            — outside the empty-state branch below so it's reachable even
            when the active program has nothing tracked. */}
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              color: "#666",
              marginBottom: 10,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showAllExercises}
              onChange={() => setShowAllExercises((v) => !v)}
            />
            Show all exercises (including archived programs)
          </label>
          {exerciseList.length === 0 ? (
            <p style={{ color: "#999", fontSize: 13 }}>
              {showAllExercises
                ? "No 1RM-tracked exercises found across any program yet."
                : hasActiveProgram
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
                {exerciseList.map((ex) => {
                  const rangeSeries = filterByRange(
                    oneRmSeries[ex.id] ?? [],
                    range,
                  );
                  const d = computeDelta(rangeSeries);
                  // #43: only non-bodyweight-based exercises, and only once
                  // there's at least one bodyweight entry anywhere — zero
                  // bodyweight data hides the badge entirely rather than
                  // showing "not enough data yet" for every exercise row.
                  // Also hidden when the exercise itself has zero 1RM data
                  // ever recorded (not just out of the current range) —
                  // otherwise it duplicates DeltaBadge's identical "not
                  // enough data yet" text right next to it, which reads as a
                  // glitch rather than two distinct metrics. A narrow range
                  // with *some* data elsewhere still shows the badge with its
                  // own null state (spec's resolved behavior) — this check is
                  // against the exercise's whole series, not rangeSeries.
                  const showBwMultiple =
                    !ex.isBodyweightBased &&
                    bodyweightSeries.length > 0 &&
                    (oneRmSeries[ex.id]?.length ?? 0) > 0;
                  const bwMultiple = showBwMultiple
                    ? computeBodyweightMultiple(rangeSeries, bodyweightSeries)
                    : null;
                  const color = colorForExercise(ex.id, exerciseList);
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
                      {visible[ex.id] && showBwMultiple && (
                        <BodyweightMultipleBadge value={bwMultiple} />
                      )}
                    </label>
                  );
                })}
              </div>
              <svg
                ref={exerciseSvgRef}
                width={CHART_W}
                height={CHART_H + AXIS_H}
                onMouseMove={handleExerciseMouseMove}
                onMouseLeave={() => setExerciseHover(null)}
              >
                <g transform={`translate(${AXIS_W},0)`}>
                  {oneRmDomain && (
                    <YAxis
                      min={min}
                      max={max}
                      step={Y_STEP}
                      plotWidth={PLOT_W}
                      plotHeight={CHART_H}
                    />
                  )}
                  {oneRmDomain &&
                    activeSliced.map(({ ex, series }) => (
                      <path
                        key={ex.id}
                        d={seriesToPath(
                          series,
                          oneRmDomain,
                          PLOT_W,
                          CHART_H,
                          12,
                          {
                            min,
                            max,
                          },
                        )}
                        fill="none"
                        stroke={colorForExercise(ex.id, exerciseList)}
                        strokeWidth={LINE_WIDTH}
                        opacity={LINE_OPACITY}
                      />
                    ))}
                  {allValues.length === 0 && (
                    <text
                      x={PLOT_W / 2}
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
                    width={PLOT_W}
                    plotHeight={CHART_H}
                  />
                  {exerciseHover && (
                    <HoverTooltip {...exerciseHover} plotWidth={PLOT_W} />
                  )}
                </g>
              </svg>
              <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
                est. 1RM (kg), shared axis across toggled exercises
              </div>
            </>
          )}
        </div>
        {/* #56: doesn't render at all without an active program — recentRpe
            is only ever computed (page.tsx) when one exists, so an empty
            array here is indistinguishable from "active program, nothing
            logged yet" without this extra check, and the box would
            otherwise show a pointless empty state alongside "no active
            program" in the box beside it. */}
        {hasActiveProgram && (
          <RpeBox
            trends={recentRpe}
            exercises={exercises}
            suggestDeloadExerciseIds={suggestDeloadExerciseIds}
          />
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
          <svg
            ref={bwSvgRef}
            width={BW_CHART_W}
            height={BW_H + AXIS_H}
            onMouseMove={handleBwMouseMove}
            onMouseLeave={() => setBwHover(null)}
          >
            <g transform={`translate(${AXIS_W},0)`}>
              {bwDomain && (
                <YAxis
                  min={bwMin}
                  max={bwMax}
                  step={Y_STEP}
                  plotWidth={BW_PLOT_W}
                  plotHeight={BW_H}
                />
              )}
              {bwDomain && (
                <path
                  d={seriesToPath(bwSliced, bwDomain, BW_PLOT_W, BW_H, 12, {
                    min: bwMin,
                    max: bwMax,
                  })}
                  fill="none"
                  // #41 originally set this to "#888" (mid-gray) to fix
                  // invisibility against a dark theme; #44's gridlines then
                  // made plain gray hard to distinguish from the grid, so
                  // this moved to a distinct, non-gray color instead — see
                  // BODYWEIGHT_COLOR.
                  stroke={BODYWEIGHT_COLOR}
                  strokeWidth={LINE_WIDTH}
                  opacity={LINE_OPACITY}
                />
              )}
              <WeekAxis domain={bwDomain} width={BW_PLOT_W} plotHeight={BW_H} />
              {bwHover && <HoverTooltip {...bwHover} plotWidth={BW_PLOT_W} />}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}

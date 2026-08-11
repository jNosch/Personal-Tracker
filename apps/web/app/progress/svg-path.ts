// Turns a date-value series into an SVG path `d` string, and places points
// on a real calendar-time x-axis (not evenly spaced by index) so weekly
// axis ticks (lib/progressRange.ts's mondayTicks) line up with where the
// data actually falls, even with an irregular logging cadence.
// Presentational math specific to this chart's rendering, not domain logic
// — colocated here rather than lib/ (code-conventions.md: lib/ is for
// business logic).

import { mondayTicks, type SeriesPoint } from "../../lib/progressRange";

export interface DateDomain {
  start: string; // ISO date
  end: string; // ISO date
}

function domainSpanMs(domain: DateDomain): number {
  const start = new Date(`${domain.start}T00:00:00Z`).getTime();
  const end = new Date(`${domain.end}T00:00:00Z`).getTime();
  return end - start;
}

// x-pixel for a given ISO date within [domain.start, domain.end]. A
// zero-span domain (every point on the same date) has no meaningful
// fraction to compute — falls back to `padding`, the left edge.
export function dateToX(
  date: string,
  domain: DateDomain,
  width: number,
  padding = 4,
): number {
  const span = domainSpanMs(domain);
  if (span <= 0) return padding;
  const start = new Date(`${domain.start}T00:00:00Z`).getTime();
  const t = new Date(`${date}T00:00:00Z`).getTime();
  const frac = (t - start) / span;
  return padding + frac * (width - padding * 2);
}

// x-pixel for the point at `index` within `series`. Same-day fallback
// (#31): a zero-span domain can't distinguish more than one session logged
// the same calendar day, so it spaces points evenly by position instead of
// collapsing them onto one x. Shared by seriesToPath and nearestHoverPoint
// so hovering always lines up with what's actually drawn, fallback or not.
function xForPoint(
  series: SeriesPoint[],
  index: number,
  domain: DateDomain,
  width: number,
  padding: number,
): number {
  if (domainSpanMs(domain) <= 0) {
    const stepX = (width - padding * 2) / (series.length - 1 || 1);
    return padding + index * stepX;
  }
  return dateToX(series[index]!.date, domain, width, padding);
}

// y-pixel for a data value within [min, max]. Extracted so seriesToPath,
// YAxis's gridlines, and hover markers all agree on the exact same scale.
export function valueToY(
  value: number,
  min: number,
  max: number,
  height: number,
  padding = 4,
): number {
  const span = max - min || 1;
  return height - padding - ((value - min) / span) * (height - padding * 2);
}

export function seriesToPath(
  series: SeriesPoint[],
  domain: DateDomain,
  width: number,
  height: number,
  padding = 4,
  valueRange?: { min: number; max: number },
): string {
  if (series.length === 0) return "";
  const min = valueRange?.min ?? Math.min(...series.map((p) => p.value));
  const max = valueRange?.max ?? Math.max(...series.map((p) => p.value));
  const points = series.map((p, i) => {
    const x = xForPoint(series, i, domain, width, padding);
    const y = valueToY(p.value, min, max, height, padding);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${points.join(" L ")}`;
}

// Combined date range across one or more series — the domain the chart's
// x-axis (and its weekly ticks) is drawn against. Null when there's no data
// at all, so the caller can skip axis rendering entirely.
export function combinedDomain(seriesList: SeriesPoint[][]): DateDomain | null {
  const dates = seriesList.flatMap((s) => s.map((p) => p.date));
  if (dates.length === 0) return null;
  let start = dates[0]!;
  let end = dates[0]!;
  for (const d of dates) {
    if (d < start) start = d;
    if (d > end) end = d;
  }
  return { start, end };
}

export interface AxisTick {
  date: string; // ISO date
  x: number;
}

// Thins a Monday list down to at most `maxTicks` evenly-strided entries —
// a long range (many months) would otherwise crowd more date labels into
// the chart's fixed width than can render without overlapping (#52).
// Deterministic stride (every Nth Monday), not distance/pixel-measurement
// based, so the chosen ticks stay predictable and don't jitter as the
// domain grows week over week — the same "deliberately simple, fixed-step,
// not derived" philosophy already used for gridlineValues' Y_STEP (#44).
function thinTicks(dates: string[], maxTicks: number): string[] {
  if (maxTicks <= 0 || dates.length <= maxTicks) return dates;
  const stride = Math.ceil(dates.length / maxTicks);
  return dates.filter((_, i) => i % stride === 0);
}

// Which dates WeekAxis labels, and where. A tick per Monday in the domain
// (see mondayTicks) when there is one, thinned to at most `maxTicks` (#52)
// — a short range with no Monday in it falls back to labeling start/end
// instead — otherwise a chart whose data all falls within one non-Monday
// week would show no axis at all (the real bug this guards: single-day dev
// test data, a Friday). A single-day domain has only one date to show,
// centered rather than pinned to dateToX's zero-span left-edge fallback.
export function weekAxisTicks(
  domain: DateDomain,
  width: number,
  padding = 4,
  maxTicks = 8,
): AxisTick[] {
  const mondays = thinTicks(mondayTicks(domain.start, domain.end), maxTicks);
  if (mondays.length > 0) {
    return mondays.map((date) => ({
      date,
      x: dateToX(date, domain, width, padding),
    }));
  }
  if (domain.start === domain.end) {
    return [{ date: domain.start, x: width / 2 }];
  }
  return [
    { date: domain.start, x: dateToX(domain.start, domain, width, padding) },
    { date: domain.end, x: dateToX(domain.end, domain, width, padding) },
  ];
}

// Step-aligned reference values between min and max inclusive, for drawing
// horizontal gridlines (#44) — e.g. gridlineValues(61, 88, 5) => [65, 70,
// 75, 80, 85]. Fixed step size, not derived/"nice-rounded" from the data
// range — deliberately simple, see #44's resolved spec.
export function gridlineValues(
  min: number,
  max: number,
  step: number,
): number[] {
  if (step <= 0 || max < min) return [];
  const first = Math.ceil(min / step) * step;
  const values: number[] = [];
  for (let v = first; v <= max + 1e-9; v += step) {
    values.push(Math.round(v * 1000) / 1000);
  }
  return values;
}

export interface HoverResult {
  seriesIndex: number;
  point: SeriesPoint;
  x: number;
  y: number;
}

// Finds the line nearest the cursor across one or more series already
// plotted with seriesToPath's identical scale (#44's resolved "nearest
// line, not every toggled line" hover behavior). For each series, first
// finds its own nearest data point by x (time) distance, then across every
// series' nearest point picks whichever is physically closest to the
// cursor — so hovering near a point on one line doesn't accidentally
// highlight a different line's point at a similar x.
export function nearestHoverPoint(
  seriesList: SeriesPoint[][],
  domain: DateDomain,
  valueRange: { min: number; max: number },
  width: number,
  height: number,
  padding: number,
  mouseX: number,
  mouseY: number,
): HoverResult | null {
  let best: HoverResult | null = null;
  let bestDist = Infinity;
  seriesList.forEach((series, seriesIndex) => {
    // A single-point series never gets a visible stroke — seriesToPath's
    // `M x,y` alone with no `L` draws nothing — so it shouldn't be
    // hoverable either; a phantom tooltip for a line nothing is drawing
    // reads as a bug (found live-testing #43, unrelated to that ticket).
    if (series.length < 2) return;
    let nearestIndex = 0;
    let nearestXDist = Infinity;
    series.forEach((_, i) => {
      const x = xForPoint(series, i, domain, width, padding);
      const xDist = Math.abs(x - mouseX);
      if (xDist < nearestXDist) {
        nearestXDist = xDist;
        nearestIndex = i;
      }
    });
    const point = series[nearestIndex]!;
    const x = xForPoint(series, nearestIndex, domain, width, padding);
    const y = valueToY(
      point.value,
      valueRange.min,
      valueRange.max,
      height,
      padding,
    );
    const dist = Math.hypot(x - mouseX, y - mouseY);
    if (dist < bestDist) {
      bestDist = dist;
      best = { seriesIndex, point, x, y };
    }
  });
  return best;
}

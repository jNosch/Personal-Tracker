// Turns a date-value series into an SVG path `d` string, and places points
// on a real calendar-time x-axis (not evenly spaced by index) so weekly
// axis ticks (lib/progressRange.ts's mondayTicks) line up with where the
// data actually falls, even with an irregular logging cadence.
// Presentational math specific to this chart's rendering, not domain logic
// — colocated here rather than lib/ (code-conventions.md: lib/ is for
// business logic).

import type { SeriesPoint } from "../../lib/progressRange";

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
  const span = max - min || 1;
  // Day-granularity dates can't distinguish more than one session logged
  // the same calendar day — a zero-span domain would otherwise collapse
  // every point onto the same x and draw a vertical smear (the real bug
  // this guards: dev test data with several sessions logged one Friday).
  // Falls back to spacing points evenly by position instead, same as
  // before real dates were plotted at all.
  const evenlySpaced = domainSpanMs(domain) <= 0;
  const stepX = (width - padding * 2) / (series.length - 1 || 1);
  const points = series.map((p, i) => {
    const x = evenlySpaced
      ? padding + i * stepX
      : dateToX(p.date, domain, width, padding);
    const y =
      height - padding - ((p.value - min) / span) * (height - padding * 2);
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

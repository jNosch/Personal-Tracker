// Progress Charts (#31) — time-range filtering and delta math. Pure and
// date-based (not entry-count-based like the prototype's slice-by-week
// approach) so it behaves correctly regardless of how sparse or dense the
// underlying log entries actually are.

export type RangeKey = "1m" | "3m" | "6m" | "all";

export const RANGES: { key: RangeKey; label: string }[] = [
  { key: "1m", label: "1M" },
  { key: "3m", label: "3M" },
  { key: "6m", label: "6M" },
  { key: "all", label: "All" },
];

const RANGE_DAYS: Record<Exclude<RangeKey, "all">, number> = {
  "1m": 30,
  "3m": 90,
  "6m": 180,
};

export interface SeriesPoint {
  date: string; // ISO date (YYYY-MM-DD)
  value: number;
}

// Trailing window ending at `today`, inclusive of the cutoff date itself.
// `series` is expected pre-sorted ascending by date (callers sort at the
// query level); this only filters, never re-sorts.
export function filterByRange(
  series: SeriesPoint[],
  range: RangeKey,
  today: Date = new Date(),
): SeriesPoint[] {
  if (range === "all") return series;
  const days = RANGE_DAYS[range];
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return series.filter((p) => p.date >= cutoffStr);
}

// Strength/weight-gain delta over a series: last value minus first. Null
// (not 0) below two points — "no change yet" and "not enough data to know"
// are different states and the UI needs to tell them apart.
export function computeDelta(series: SeriesPoint[]): number | null {
  if (series.length < 2) return null;
  const first = series[0]!.value;
  const last = series[series.length - 1]!.value;
  return Math.round((last - first) * 10) / 10;
}

import { describe, expect, it } from "vitest";
import { computeDelta, filterByRange, type SeriesPoint } from "./progressRange";

const series: SeriesPoint[] = [
  { date: "2026-01-01", value: 100 },
  { date: "2026-04-01", value: 105 },
  { date: "2026-07-01", value: 110 },
  { date: "2026-08-01", value: 112 },
];
const today = new Date("2026-08-10");

describe("filterByRange", () => {
  it("returns everything for 'all', unfiltered", () => {
    expect(filterByRange(series, "all", today)).toEqual(series);
  });

  it("keeps only points within the trailing window for 1m/3m/6m", () => {
    // 30 days back from 2026-08-10 is 2026-07-11 — only the last point qualifies.
    expect(filterByRange(series, "1m", today)).toEqual([series[3]]);
    // 90 days back is 2026-05-12 — last two points qualify.
    expect(filterByRange(series, "3m", today)).toEqual([series[2], series[3]]);
    // 180 days back is 2026-02-11 — last three points qualify, not the first.
    expect(filterByRange(series, "6m", today)).toEqual([
      series[1],
      series[2],
      series[3],
    ]);
  });

  it("includes a point that falls exactly on the cutoff date", () => {
    const cutoffToday = new Date("2026-01-31");
    const point: SeriesPoint = { date: "2026-01-01", value: 50 };
    // 30 days back from 2026-01-31 is exactly 2026-01-01.
    expect(filterByRange([point], "1m", cutoffToday)).toEqual([point]);
  });

  it("returns an empty array for an empty series", () => {
    expect(filterByRange([], "1m", today)).toEqual([]);
    expect(filterByRange([], "all", today)).toEqual([]);
  });
});

describe("computeDelta", () => {
  it("returns null when there are fewer than two points — not enough data yet", () => {
    expect(computeDelta([])).toBeNull();
    expect(computeDelta([{ date: "2026-01-01", value: 100 }])).toBeNull();
  });

  it("returns last minus first, rounded to one decimal", () => {
    expect(
      computeDelta([
        { date: "2026-01-01", value: 100 },
        { date: "2026-02-01", value: 108.25 },
      ]),
    ).toBe(8.3);
  });

  it("returns a negative delta when the trend went down", () => {
    expect(
      computeDelta([
        { date: "2026-01-01", value: 90 },
        { date: "2026-02-01", value: 88 },
      ]),
    ).toBe(-2);
  });

  it("returns 0 (not null) for two points with no change — that's a real, known answer", () => {
    expect(
      computeDelta([
        { date: "2026-01-01", value: 100 },
        { date: "2026-02-01", value: 100 },
      ]),
    ).toBe(0);
  });
});

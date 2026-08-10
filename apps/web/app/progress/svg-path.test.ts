import { describe, expect, it } from "vitest";
import {
  combinedDomain,
  dateToX,
  seriesToPath,
  weekAxisTicks,
  type DateDomain,
} from "./svg-path";
import type { SeriesPoint } from "../../lib/progressRange";

const domain: DateDomain = { start: "2026-08-01", end: "2026-08-31" };

describe("dateToX", () => {
  it("places the domain start at the left padding and the end at the right padding", () => {
    expect(dateToX("2026-08-01", domain, 100, 10)).toBe(10);
    expect(dateToX("2026-08-31", domain, 100, 10)).toBe(90);
  });

  it("places a midpoint date proportionally between them", () => {
    // 2026-08-16 is 15/30 of the way through the domain.
    expect(dateToX("2026-08-16", domain, 100, 10)).toBeCloseTo(50, 0);
  });

  it("falls back to the left padding for a zero-span domain, rather than dividing by zero", () => {
    const sameDay: DateDomain = { start: "2026-08-07", end: "2026-08-07" };
    expect(dateToX("2026-08-07", sameDay, 100, 10)).toBe(10);
  });
});

describe("seriesToPath", () => {
  it("returns an empty string for an empty series", () => {
    expect(seriesToPath([], domain, 100, 100)).toBe("");
  });

  it("plots points at their real calendar-time x position", () => {
    const series: SeriesPoint[] = [
      { date: "2026-08-01", value: 0 },
      { date: "2026-08-31", value: 10 },
    ];
    const d = seriesToPath(series, domain, 100, 100, 10, { min: 0, max: 10 });
    // First point: x=10 (domain start), y=90 (value 0, bottom). Second:
    // x=90 (domain end), y=10 (value 10, top).
    expect(d).toBe("M 10.0,90.0 L 90.0,10.0");
  });

  it("falls back to even-by-position spacing when every point shares one date — the real bug this guards (several same-day dev sessions collapsing onto one x)", () => {
    const sameDay: DateDomain = { start: "2026-08-07", end: "2026-08-07" };
    const series: SeriesPoint[] = [
      { date: "2026-08-07", value: 0 },
      { date: "2026-08-07", value: 5 },
      { date: "2026-08-07", value: 10 },
    ];
    const d = seriesToPath(series, sameDay, 100, 100, 10, {
      min: 0,
      max: 10,
    });
    // Three points spread evenly across the width (x: 10, 50, 90), not
    // all collapsed onto x=10.
    expect(d).toBe("M 10.0,90.0 L 50.0,50.0 L 90.0,10.0");
  });
});

describe("combinedDomain", () => {
  it("returns null when there's no data at all", () => {
    expect(combinedDomain([[], []])).toBeNull();
  });

  it("returns the min/max date across every series combined", () => {
    const a: SeriesPoint[] = [
      { date: "2026-08-10", value: 1 },
      { date: "2026-08-20", value: 2 },
    ];
    const b: SeriesPoint[] = [{ date: "2026-08-01", value: 3 }];
    expect(combinedDomain([a, b])).toEqual({
      start: "2026-08-01",
      end: "2026-08-20",
    });
  });
});

describe("weekAxisTicks", () => {
  it("returns a tick per Monday, positioned by real date, when the domain spans full weeks", () => {
    const ticks = weekAxisTicks(domain, 100, 10);
    // Mondays in August 2026: 3, 10, 17, 24, 31.
    expect(ticks.map((t) => t.date)).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
      "2026-08-24",
      "2026-08-31",
    ]);
  });

  it("falls back to a single centered tick for a single-day domain with no Monday — the real 'no dates shown' bug this guards", () => {
    const friday: DateDomain = { start: "2026-08-07", end: "2026-08-07" };
    expect(weekAxisTicks(friday, 100)).toEqual([{ date: "2026-08-07", x: 50 }]);
  });

  it("falls back to start/end ticks for a short multi-day range with no Monday in it", () => {
    // Tue 2026-08-04 through Thu 2026-08-06 — no Monday in between.
    const range: DateDomain = { start: "2026-08-04", end: "2026-08-06" };
    expect(weekAxisTicks(range, 100, 10).map((t) => t.date)).toEqual([
      "2026-08-04",
      "2026-08-06",
    ]);
  });
});

import { describe, expect, it } from "vitest";
import {
  combinedDomain,
  dateToX,
  gridlineValues,
  nearestHoverPoint,
  seriesToPath,
  valueToY,
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

  it("#46: jitters a same-date cluster within an otherwise real-span domain, rather than collapsing it onto one vertical x", () => {
    // Domain has real span (Aug 1 - Aug 31), but two of the three points
    // share 2026-08-16 (the domain's exact midpoint, per dateToX's own
    // test above) — the case #46's whole-domain fallback doesn't (and
    // shouldn't) catch, since the domain itself isn't single-day.
    const series: SeriesPoint[] = [
      { date: "2026-08-01", value: 0 },
      { date: "2026-08-16", value: 5 },
      { date: "2026-08-16", value: 10 },
    ];
    const d = seriesToPath(series, domain, 100, 100, 10, { min: 0, max: 10 });
    // Real x for 08-16 = 50. The two same-date points jitter +/-2.5px
    // around it (centered, 5px step) instead of both landing on exactly
    // x=50.
    expect(d).toBe("M 10.0,90.0 L 47.5,50.0 L 52.5,10.0");
  });

  it("#46: a lone point sharing no date with anything else in its series is unaffected by the cluster fallback", () => {
    const series: SeriesPoint[] = [
      { date: "2026-08-01", value: 0 },
      { date: "2026-08-16", value: 5 },
      { date: "2026-08-31", value: 10 },
    ];
    const d = seriesToPath(series, domain, 100, 100, 10, { min: 0, max: 10 });
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

  it("thins a long range down to at most 8 ticks rather than one per Monday (#52 — a 16-week range would otherwise crowd 16+ labels)", () => {
    const longRange: DateDomain = { start: "2026-01-01", end: "2026-08-31" };
    const ticks = weekAxisTicks(longRange, 660, 10);
    expect(ticks.length).toBeLessThanOrEqual(8);
    expect(ticks.length).toBeGreaterThan(0);
  });

  it("still shows every Monday when the count is already within the cap", () => {
    // Same as the first test — 5 Mondays, well under the default max of 8.
    expect(weekAxisTicks(domain, 100, 10).length).toBe(5);
  });

  it("respects a custom maxTicks", () => {
    const longRange: DateDomain = { start: "2026-01-01", end: "2026-08-31" };
    const ticks = weekAxisTicks(longRange, 660, 10, 4);
    expect(ticks.length).toBeLessThanOrEqual(4);
  });

  it("always includes the earliest Monday as the first tick, so thinning never drops the domain's leading edge", () => {
    const longRange: DateDomain = { start: "2026-01-01", end: "2026-08-31" };
    const ticks = weekAxisTicks(longRange, 660, 10);
    expect(ticks[0]!.date).toBe("2026-01-05"); // first Monday in January 2026
  });
});

describe("valueToY", () => {
  it("places the min value at the bottom padding and the max at the top padding", () => {
    expect(valueToY(0, 0, 10, 100, 10)).toBe(90);
    expect(valueToY(10, 0, 10, 100, 10)).toBe(10);
  });

  it("places a midpoint value proportionally between them", () => {
    expect(valueToY(5, 0, 10, 100, 10)).toBe(50);
  });
});

describe("gridlineValues", () => {
  it("returns step-aligned values within [min, max]", () => {
    expect(gridlineValues(61, 88, 5)).toEqual([65, 70, 75, 80, 85]);
  });

  it("includes min/max exactly when they land on a step boundary", () => {
    expect(gridlineValues(60, 90, 10)).toEqual([60, 70, 80, 90]);
  });

  it("returns an empty array for a zero or negative step", () => {
    expect(gridlineValues(0, 10, 0)).toEqual([]);
    expect(gridlineValues(0, 10, -5)).toEqual([]);
  });

  it("returns an empty array when max is below min", () => {
    expect(gridlineValues(10, 0, 5)).toEqual([]);
  });
});

describe("nearestHoverPoint", () => {
  const twoWeekDomain: DateDomain = { start: "2026-08-01", end: "2026-08-15" };
  const seriesA: SeriesPoint[] = [
    { date: "2026-08-01", value: 0 },
    { date: "2026-08-15", value: 10 },
  ];
  const seriesB: SeriesPoint[] = [
    { date: "2026-08-01", value: 10 },
    { date: "2026-08-15", value: 0 },
  ];

  it("returns null when every series is empty", () => {
    expect(
      nearestHoverPoint(
        [[], []],
        twoWeekDomain,
        { min: 0, max: 10 },
        100,
        100,
        10,
        50,
        50,
      ),
    ).toBeNull();
  });

  it("ignores a single-point series — seriesToPath draws nothing for it, so it shouldn't be hoverable either", () => {
    const onePoint: SeriesPoint[] = [{ date: "2026-08-08", value: 5 }];
    const result = nearestHoverPoint(
      [onePoint],
      twoWeekDomain,
      { min: 0, max: 10 },
      100,
      100,
      10,
      50, // right on top of the single point's x
      50, // and its y
    );
    expect(result).toBeNull();
  });

  it("still finds a two-point series' point even when a single-point series is closer, since the single-point one is never a candidate", () => {
    const onePoint: SeriesPoint[] = [{ date: "2026-08-08", value: 5 }];
    const result = nearestHoverPoint(
      [onePoint, seriesA],
      twoWeekDomain,
      { min: 0, max: 10 },
      100,
      100,
      10,
      50,
      50,
    );
    expect(result?.seriesIndex).toBe(1);
  });

  it("finds the nearest point by x (time) distance within a single series", () => {
    const result = nearestHoverPoint(
      [seriesA],
      twoWeekDomain,
      { min: 0, max: 10 },
      100,
      100,
      10,
      // x=15 is close to the domain start (x=10) — nearest point should be
      // the first one, not the last.
      15,
      50,
    );
    expect(result?.seriesIndex).toBe(0);
    expect(result?.point).toEqual(seriesA[0]);
  });

  it("picks whichever series' point is physically closest to the cursor, not just nearest in time — the real 'nearest line' behavior this exists for", () => {
    // Both series have a point at the same x (domain start, x=10). seriesA's
    // point is at the bottom (value 0 -> y=90), seriesB's is at the top
    // (value 10 -> y=10). A cursor near the bottom should pick seriesA.
    const result = nearestHoverPoint(
      [seriesA, seriesB],
      twoWeekDomain,
      { min: 0, max: 10 },
      100,
      100,
      10,
      10,
      85, // near the bottom, close to seriesA's y=90
    );
    expect(result?.seriesIndex).toBe(0);
  });

  it("#46: hover position reflects the same-date jitter, so the tooltip lines up with what's actually drawn", () => {
    const clustered: SeriesPoint[] = [
      { date: "2026-08-01", value: 0 },
      { date: "2026-08-08", value: 5 },
      { date: "2026-08-08", value: 10 },
    ];
    // 2026-08-08 in twoWeekDomain (Aug 1 - Aug 15) -> real x = 10 + 7/14 *
    // 80 = 50; the two Aug-8 points jitter to 47.5/52.5 (same math as
    // seriesToPath's cluster test above). Hovering right at 52.5 should
    // land on the second (higher-value) point, not the first.
    const result = nearestHoverPoint(
      [clustered],
      twoWeekDomain,
      { min: 0, max: 10 },
      100,
      100,
      10,
      52.5,
      10, // value 10 -> y=10 (top)
    );
    expect(result?.point).toEqual(clustered[2]);
    expect(result?.x).toBeCloseTo(52.5, 1);
  });
});

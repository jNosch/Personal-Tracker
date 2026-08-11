import { describe, expect, it } from "vitest";
import {
  computeBodyweightMultiple,
  computeDelta,
  filterByRange,
  mondayTicks,
  nearestBodyweight,
  recentSessionRpe,
  type RpeReading,
  type SeriesPoint,
} from "./progressRange";

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

describe("nearestBodyweight", () => {
  const bw: SeriesPoint[] = [
    { date: "2026-01-01", value: 80 },
    { date: "2026-03-01", value: 82 },
    { date: "2026-07-01", value: 85 },
  ];

  it("returns null when there are no bodyweight entries at all", () => {
    expect(nearestBodyweight([], "2026-01-15")).toBeNull();
  });

  it("picks the closer entry by absolute date difference", () => {
    // 2026-01-15 is 14 days after 2026-01-01, 45 days before 2026-03-01.
    expect(nearestBodyweight(bw, "2026-01-15")).toBe(80);
  });

  it("matches either side of the target date, not just before it", () => {
    // 2026-06-01 is closer to 2026-07-01 (30 days) than 2026-03-01 (92 days).
    expect(nearestBodyweight(bw, "2026-06-01")).toBe(85);
  });

  it("returns an exact match when the date lines up", () => {
    expect(nearestBodyweight(bw, "2026-03-01")).toBe(82);
  });
});

describe("computeBodyweightMultiple", () => {
  const bw: SeriesPoint[] = [
    { date: "2026-01-01", value: 80 },
    { date: "2026-07-01", value: 100 },
  ];

  it("returns null when the (range-filtered) 1RM series is empty", () => {
    expect(computeBodyweightMultiple([], bw)).toBeNull();
  });

  it("returns null when there's no bodyweight data to match against", () => {
    expect(
      computeBodyweightMultiple([{ date: "2026-01-01", value: 160 }], []),
    ).toBeNull();
  });

  it("divides the latest 1RM point by the nearest bodyweight, rounded to one decimal", () => {
    // Latest point is 2026-07-05 — nearer 2026-07-01 (100kg) than 2026-01-01.
    expect(
      computeBodyweightMultiple(
        [
          { date: "2026-01-05", value: 140 },
          { date: "2026-07-05", value: 205 },
        ],
        bw,
      ),
    ).toBe(2.1); // 205 / 100 = 2.05 -> rounds to 2.1
  });

  it("uses only the latest point, not a first-vs-last comparison like computeDelta", () => {
    expect(
      computeBodyweightMultiple(
        [
          { date: "2026-01-05", value: 300 },
          { date: "2026-07-05", value: 200 },
        ],
        bw,
      ),
    ).toBe(2); // 200 / 100, ignores the earlier 300kg point entirely
  });
});

describe("recentSessionRpe", () => {
  const readings: RpeReading[] = [
    {
      sessionId: "s1",
      date: "2026-06-01",
      exerciseId: "squat",
      exerciseName: "Squat",
      rpe: 7,
    },
    {
      sessionId: "s1",
      date: "2026-06-01",
      exerciseId: "squat",
      exerciseName: "Squat",
      rpe: 9,
    },
    {
      sessionId: "s1",
      date: "2026-06-01",
      exerciseId: "bench",
      exerciseName: "Bench",
      rpe: 6,
    },
    {
      sessionId: "s2",
      date: "2026-06-08",
      exerciseId: "squat",
      exerciseName: "Squat",
      rpe: 8,
    },
    {
      sessionId: "s3",
      date: "2026-06-15",
      exerciseId: "deadlift",
      exerciseName: "Deadlift",
      rpe: 6,
    },
    {
      sessionId: "s3",
      date: "2026-06-15",
      exerciseId: "deadlift",
      exerciseName: "Deadlift",
      rpe: 8,
    },
    {
      sessionId: "s4",
      date: "2026-06-22",
      exerciseId: "squat",
      exerciseName: "Squat",
      rpe: 9.5,
    },
  ];

  it("returns an empty array with no readings", () => {
    expect(recentSessionRpe([], 3)).toEqual([]);
  });

  it("returns an empty array for a non-positive limit", () => {
    expect(recentSessionRpe(readings, 0)).toEqual([]);
  });

  it("averages per exercise within a session, rounded to one decimal, not blended across exercises", () => {
    // s1: Squat (7+9)/2=8, Bench stays 6 — two separate entries, not one
    // blended (7+9+6)/3 number.
    const result = recentSessionRpe(readings, 4);
    const s1 = result.find((r) => r.date === "2026-06-01")!;
    expect(s1.exercises).toEqual([
      { exerciseId: "bench", exerciseName: "Bench", avgRpe: 6 },
      { exerciseId: "squat", exerciseName: "Squat", avgRpe: 8 },
    ]);
  });

  it("returns the `limit` most recent sessions, oldest first", () => {
    // 4 sessions total, limit 3 -> drops s1 (oldest), keeps s2/s3/s4
    // ascending by date.
    expect(recentSessionRpe(readings, 3).map((r) => r.date)).toEqual([
      "2026-06-08",
      "2026-06-15",
      "2026-06-22",
    ]);
  });

  it("returns every session, still oldest-first, when there are fewer than the limit", () => {
    expect(recentSessionRpe(readings, 10).map((r) => r.date)).toEqual([
      "2026-06-01",
      "2026-06-08",
      "2026-06-15",
      "2026-06-22",
    ]);
  });

  it("sorts exercises within a session alphabetically by name", () => {
    const result = recentSessionRpe(readings, 4);
    const s1 = result.find((r) => r.date === "2026-06-01")!;
    expect(s1.exercises.map((e) => e.exerciseName)).toEqual(["Bench", "Squat"]);
  });

  it("groups by sessionId, not date — two sessions sharing a calendar day stay distinct", () => {
    const sameDay: RpeReading[] = [
      {
        sessionId: "a",
        date: "2026-06-01",
        exerciseId: "squat",
        exerciseName: "Squat",
        rpe: 6,
      },
      {
        sessionId: "b",
        date: "2026-06-01",
        exerciseId: "squat",
        exerciseName: "Squat",
        rpe: 10,
      },
    ];
    const result = recentSessionRpe(sameDay, 5);
    expect(result).toHaveLength(2);
    // sessionId survives onto the result — callers need a stable identity
    // to key a list on, since two entries can share an identical date.
    expect(new Set(result.map((r) => r.sessionId)).size).toBe(2);
  });

  it("carries the correct sessionId through onto each result", () => {
    const result = recentSessionRpe(readings, 4);
    expect(result.find((r) => r.date === "2026-06-08")?.sessionId).toBe("s2");
    expect(result.find((r) => r.date === "2026-06-15")?.sessionId).toBe("s3");
  });
});

describe("mondayTicks", () => {
  it("returns every Monday spanning a multi-week range", () => {
    // 2026-08-03 is a Monday.
    expect(mondayTicks("2026-08-01", "2026-08-20")).toEqual([
      "2026-08-03",
      "2026-08-10",
      "2026-08-17",
    ]);
  });

  it("includes the start date itself when it's already a Monday", () => {
    expect(mondayTicks("2026-08-03", "2026-08-03")).toEqual(["2026-08-03"]);
  });

  it("returns an empty array when no Monday falls in a short range", () => {
    // Tue 2026-08-04 through Thu 2026-08-06 — no Monday in between.
    expect(mondayTicks("2026-08-04", "2026-08-06")).toEqual([]);
  });

  it("returns an empty array for a single non-Monday day — the real case that broke the chart (a day's worth of same-day test data, a Friday)", () => {
    expect(mondayTicks("2026-08-07", "2026-08-07")).toEqual([]);
  });

  it("returns an empty array when start is after end", () => {
    expect(mondayTicks("2026-08-20", "2026-08-01")).toEqual([]);
  });
});

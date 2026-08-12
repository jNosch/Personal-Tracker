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

// Nearest bodyweight entry to a given date, by absolute date difference
// either side (#43) — same convention `app/log/actions.ts:126-133` already
// uses at session-save time, no distance/staleness check there either.
// `bodyweightSeries` is expected to be the *whole* table, not range-filtered
// (#43's resolved spec: the ratio badge only disappears when there's zero
// bodyweight data at all, not merely a distant match). Null when there's
// nothing to match against.
export function nearestBodyweight(
  bodyweightSeries: SeriesPoint[],
  date: string,
): number | null {
  if (bodyweightSeries.length === 0) return null;
  const target = new Date(`${date}T00:00:00Z`).getTime();
  let best = bodyweightSeries[0]!;
  let bestDiff = Math.abs(
    new Date(`${best.date}T00:00:00Z`).getTime() - target,
  );
  for (const p of bodyweightSeries) {
    const diff = Math.abs(new Date(`${p.date}T00:00:00Z`).getTime() - target);
    if (diff < bestDiff) {
      best = p;
      bestDiff = diff;
    }
  }
  return best.value;
}

// Current bodyweight-multiple ratio for one exercise (#43) — latest 1RM
// point in the (already range-filtered) series divided by the bodyweight
// nearest to that point's date. Current ratio only, not a "was X now Y"
// comparison (resolved spec) — computeDelta already covers "how much
// changed" in kg terms elsewhere. Null when there's no 1RM point in the
// filtered window (caller shows the same "not enough data yet" language
// computeDelta's null already gets) — a distinct case from "no bodyweight
// data at all," which the caller gates separately since that one hides the
// badge entirely rather than showing empty-state text.
export function computeBodyweightMultiple(
  oneRmSeries: SeriesPoint[],
  bodyweightSeries: SeriesPoint[],
): number | null {
  if (oneRmSeries.length === 0) return null;
  const latest = oneRmSeries[oneRmSeries.length - 1]!;
  const bw = nearestBodyweight(bodyweightSeries, latest.date);
  if (bw === null || bw === 0) return null;
  return Math.round((latest.value / bw) * 10) / 10;
}

// A session reading at or above this reads as near-maximal effort — the
// "you might need a deload" signal RpeBox exists to surface (#56), and the
// same bar Wave's redStreak deload trigger uses (#60). Not a resolved spec
// number, an implementation judgement call — shared here (not duplicated in
// ProgressCharts.tsx or schemes.ts) since both now read it.
export const HIGH_RPE_THRESHOLD = 9;

export interface RpeReading {
  sessionId: string;
  date: string; // ISO date
  exerciseId: string;
  exerciseName: string;
  // Which scheme prescribed this set — determines how the session's
  // reading is picked below (#60). Not narrowed to SchemeType here to avoid
  // a lib/-to-lib/ import just for a string union; callers already have the
  // real type from db/schema.ts's exerciseInDay.schemeType.
  schemeType: string;
  rpe: number;
  // Stamped at log time (schemes.ts's prescribeWave) on exactly the set
  // Wave's own "AMRAP, else heaviest main set" rule designates that week —
  // #60's redefinition of "the set that counts" for Wave, replacing the
  // flat all-sets average below. Always false for every non-wave scheme in
  // this ticket's scope (Ticket B gives Double Progression/Topset+Backoff
  // their own designation later).
  countsTowardRpeSignal: boolean;
}

export interface RpeTrendPoint {
  sessionId: string;
  date: string; // ISO date
  avgRpe: number;
}

export interface ExerciseRpeTrend {
  exerciseId: string;
  exerciseName: string;
  // That exercise's own last `limit` RPE-logged sessions, oldest first
  // (#56 follow-up: grouped by exercise, not by session — an exercise
  // trained only every Nth session in the rotation, e.g. SBD's Squat, would
  // otherwise show 0-1 readings inside a fixed "last 3 sessions of the
  // program" window instead of its own real recent trend). Matches how the
  // rest of this page reads time left-to-right/top-to-bottom, so a
  // climbing trend reads as climbing, not descending.
  readings: RpeTrendPoint[];
}

// Averages RPE per (exercise, session) — an exercise can log RPE on more
// than one set in the same session — then, per exercise, returns its own
// most recent `limit` sessions in chronological order. Grouped by
// sessionId, not date — two sessions can share a calendar day (same lesson
// as #46's same-day chart collapse: never key time-series grouping off
// date strings alone when a stable id exists). Purely a display aggregate,
// not an autoregulation input for any *other* progression math (#56's
// original scope) — Wave's own redStreak deload trigger (#60) reimplements
// the same "which set counts" rule independently in schemes.ts rather than
// reading this function's output, since updateWave only ever sees one
// session at a time and already has the config it needs.
//
// #60/#61: for a Wave or Top-set+Backoff session, the session's point is
// that session's countsTowardRpeSignal-flagged reading (Wave: AMRAP set,
// else the heaviest main set, stamped by prescribeWave; Top-set+Backoff:
// the top set, always, stamped by prescribeTopsetBackoff) rather than an
// average of every logged set — supplemental/back-off sets would otherwise
// dilute a brutal main/top set with easy accessory volume. A session with
// no flagged reading (every set logging RPE that session happens not to
// include the designated one — pre-#60/#61 historic rows are backfilled by
// migrations 0002/0005, see those files' comments, so they're not the
// reason a session would land here) contributes no point at all, rather
// than silently falling back to the old flat average — a reading under
// this box's "the set that counts" heading should mean what it says.
// Double Progression and Rep Accumulation keep the original flat
// all-sets-that-session average (#61 resolved Double Progression's own
// signal as that same flat average, so there's nothing to switch there;
// Rep Accumulation and Failure Sets remain out of #61's scope entirely).
export function recentExerciseRpeTrends(
  readings: RpeReading[],
  limit: number,
): ExerciseRpeTrend[] {
  if (limit <= 0) return [];
  // (exerciseId, sessionId) -> that session's readings for that exercise —
  // resolved to one point per (exercise, session) before grouping by
  // exercise, so multiple sets logging RPE the same session collapse into a
  // single trend point rather than each counting toward `limit` separately.
  const bySessionExercise = new Map<
    string,
    {
      exerciseId: string;
      exerciseName: string;
      sessionId: string;
      date: string;
      schemeType: string;
      values: number[];
      signalValues: number[];
    }
  >();
  for (const r of readings) {
    const key = `${r.exerciseId}:${r.sessionId}`;
    const existing = bySessionExercise.get(key);
    if (existing) {
      existing.values.push(r.rpe);
      if (r.countsTowardRpeSignal) existing.signalValues.push(r.rpe);
    } else
      bySessionExercise.set(key, {
        exerciseId: r.exerciseId,
        exerciseName: r.exerciseName,
        sessionId: r.sessionId,
        date: r.date,
        schemeType: r.schemeType,
        values: [r.rpe],
        signalValues: r.countsTowardRpeSignal ? [r.rpe] : [],
      });
  }
  const byExercise = new Map<
    string,
    { exerciseName: string; points: RpeTrendPoint[] }
  >();
  for (const s of bySessionExercise.values()) {
    const usesSignalSet =
      s.schemeType === "wave" || s.schemeType === "topset_backoff";
    const source = usesSignalSet ? s.signalValues : s.values;
    if (source.length === 0) continue; // signal-scheme session, nothing flagged
    const avgRpe =
      Math.round((source.reduce((sum, v) => sum + v, 0) / source.length) * 10) /
      10;
    const point: RpeTrendPoint = {
      sessionId: s.sessionId,
      date: s.date,
      avgRpe,
    };
    const existing = byExercise.get(s.exerciseId);
    if (existing) existing.points.push(point);
    else
      byExercise.set(s.exerciseId, {
        exerciseName: s.exerciseName,
        points: [point],
      });
  }
  return [...byExercise.entries()]
    .map(([exerciseId, e]) => ({
      exerciseId,
      exerciseName: e.exerciseName,
      readings: e.points
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
        .slice(0, limit)
        .reverse(),
    }))
    .sort((a, b) => a.exerciseName.localeCompare(b.exerciseName));
}

// Every Monday's ISO date within [startDate, endDate], inclusive of both
// endpoints — the chart's "rough" weekly axis labels, deliberately not tied
// to which days actually have a data point (that would misalign with an
// irregular logging cadence). UTC throughout so it never drifts a day
// depending on the caller's local timezone. Can return an empty array (a
// short range with no Monday in it, or a single non-Monday day) — callers
// needing an axis label regardless are responsible for their own fallback.
export function mondayTicks(startDate: string, endDate: string): string[] {
  if (startDate > endDate) return [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const day = start.getUTCDay(); // 0=Sun..6=Sat
  const daysToMonday = (8 - day) % 7; // 0 when start is already a Monday
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() + daysToMonday);
  const ticks: string[] = [];
  while (cursor <= end) {
    ticks.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 7);
  }
  return ticks;
}

// Scheme catalog: config shapes + defaults for the 5 progression schemes.
// First real occupant of lib/ (#24) — shared with Session Logging (#29),
// which owns the prescribe/update runtime logic these configs feed into.
// Config shapes are locked per issue: #8 (Double Progression), #16 (Wave),
// #17 (Rep Accumulation), #18 (Top-set + back-off), #19 (Failure Sets).
// SchemeType itself lives in db/schema.ts (SCHEME_TYPES) — reused here
// rather than redefined, since the DB column is the canonical source.
import { type SchemeType } from "../db/schema";
// Shared with the Progress page's RpeBox (#56/#60) — "what counts as a red
// reading" is one bar, not two independently-tuned ones.
import { HIGH_RPE_THRESHOLD } from "./progressRange";

export const SCHEME_CATALOG: {
  type: SchemeType;
  label: string;
  requiresTracksOneRm: boolean;
}[] = [
  {
    type: "double_progression",
    label: "Double Progression",
    requiresTracksOneRm: false,
  },
  { type: "wave", label: "Wave (5/3/1-style)", requiresTracksOneRm: true },
  {
    type: "rep_accumulation",
    label: "Rep Accumulation",
    requiresTracksOneRm: false,
  },
  {
    type: "topset_backoff",
    label: "Top-set + back-off",
    requiresTracksOneRm: true,
  },
  { type: "failure_sets", label: "Failure Sets", requiresTracksOneRm: false },
];

export interface DoubleProgressionConfig {
  repRangeLow: number;
  repRangeHigh: number;
  setCount: number;
  weightIncrement: number;
  // #61: percentage of currentWeightKg served for the one session right
  // after an RPE-deload suggestion is accepted (deloadPending, see
  // DoubleProgressionState) — e.g. 60 = 60% of the tracked working weight
  // for that single session. Real-world deloads resume unchanged
  // afterward rather than permanently stepping down (see #61's resolved
  // spec), so this never touches currentWeightKg itself.
  deloadCutPercentage: number;
}

export interface RepAccumulationConfig {
  targetTotalReps: number;
  setCount: number;
  weightIncrement: number;
}

export interface TopsetBackoffConfig {
  topSetRepRangeLow: number;
  topSetRepRangeHigh: number;
  weightIncrement: number;
  backoffPercentage: number;
  backoffSetCount: number;
  backoffRepTarget: number;
  // #61: same meaning as DoubleProgressionConfig's own field — see its
  // comment. Backoff sets aren't cut independently: they're already
  // derived as a percentage of the top set's (possibly cut) weight, so
  // cutting the top set alone scales the whole session down together.
  deloadCutPercentage: number;
}

export interface FailureSetsConfig {
  setCount: number;
}

export interface WaveWeekSet {
  percentageOfTrainingMax: number;
  repTarget: number | "AMRAP";
}

export interface WaveSupplementalConfig {
  setCount: number;
  repTarget: number;
  // Only meaningful for "bbb" (default 50) and "custom" (required there).
  // "fsl"/"ssl" ignore this — their percentage is pegged to that week's
  // first/second main-set percentage instead (#16).
  percentage?: number;
}

export interface WaveConfig {
  trainingMaxPercentage: number;
  deloadMode: "always" | "never" | "on_regression";
  // true = 5/3/1 preset, false = custom week table (#16).
  usePreset: boolean;
  weekTable: WaveWeekSet[][];
  supplementalSetType: "none" | "bbb" | "fsl" | "ssl" | "custom";
  // Optional: existing exercise-in-day rows from before this field existed
  // have none. prescribe() falls back to the classic per-type default
  // (buildSupplementalSets below) rather than requiring a migration.
  supplementalConfig?: WaveSupplementalConfig;
}

export type SchemeConfig =
  | { type: "double_progression"; config: DoubleProgressionConfig }
  | { type: "wave"; config: WaveConfig }
  | { type: "rep_accumulation"; config: RepAccumulationConfig }
  | { type: "topset_backoff"; config: TopsetBackoffConfig }
  | { type: "failure_sets"; config: FailureSetsConfig };

// The locked 5/3/1 preset week table (#16): 65/75/85% x 5/5/5+, 70/80/90% x
// 3/3/3+, 75/85/95% x 5/3/1+. Deload week isn't a 4th table row — it's
// applied per deloadMode at prescribe time (#29's concern, not stored here).
export const PRESET_5_3_1_WEEK_TABLE: WaveWeekSet[][] = [
  [
    { percentageOfTrainingMax: 65, repTarget: 5 },
    { percentageOfTrainingMax: 75, repTarget: 5 },
    { percentageOfTrainingMax: 85, repTarget: "AMRAP" },
  ],
  [
    { percentageOfTrainingMax: 70, repTarget: 3 },
    { percentageOfTrainingMax: 80, repTarget: 3 },
    { percentageOfTrainingMax: 90, repTarget: "AMRAP" },
  ],
  [
    { percentageOfTrainingMax: 75, repTarget: 5 },
    { percentageOfTrainingMax: 85, repTarget: 3 },
    { percentageOfTrainingMax: 95, repTarget: "AMRAP" },
  ],
];

// Every exercise-in-day always has exactly one scheme, defaulting to Double
// Progression (#8) — never a bare "no scheme" state.
export function defaultConfigFor(type: SchemeType): SchemeConfig {
  switch (type) {
    case "double_progression":
      return {
        type,
        config: {
          repRangeLow: 8,
          repRangeHigh: 12,
          setCount: 3,
          weightIncrement: 2.5,
          deloadCutPercentage: 60,
        },
      };
    case "wave":
      return {
        type,
        config: {
          trainingMaxPercentage: 90,
          deloadMode: "on_regression",
          usePreset: true,
          weekTable: PRESET_5_3_1_WEEK_TABLE,
          supplementalSetType: "none",
        },
      };
    case "rep_accumulation":
      return {
        type,
        config: { targetTotalReps: 50, setCount: 5, weightIncrement: 2.5 },
      };
    case "topset_backoff":
      return {
        type,
        config: {
          topSetRepRangeLow: 1,
          topSetRepRangeHigh: 3,
          weightIncrement: 2.5,
          backoffPercentage: 85,
          backoffSetCount: 3,
          backoffRepTarget: 5,
          deloadCutPercentage: 60,
        },
      };
    case "failure_sets":
      return { type, config: { setCount: 3 } };
  }
}

// --- prescribe/update runtime (#29) ---
//
// Every scheme's state starts as {} (see app/programs/actions.ts's
// addExerciseInDay/updateExerciseScheme) — there is no first-time-setup
// step. So every state field below is optional, and prescribe()/update()
// treat a missing value as "not yet bootstrapped" rather than an error:
// prescribe shows 0kg/blank, and whatever the user actually logs that first
// session seeds state going forward. Wave is the one exception — its
// training max is explicitly locked as manual-entry-only (#16), surfaced
// via the setTrainingMax action in app/log/actions.ts, never inferred from
// a logged set.

// #61: consecutive count of red (RPE >= HIGH_RPE_THRESHOLD on this scheme's
// own "set that counts", see updateDoubleProgression/updateTopsetBackoff)
// sessions just logged — same meaning/threshold as Wave's own redStreak
// (#60), resets to 0 on a non-red or missing-RPE session, and whenever
// deloadPending flips true (the only trigger here — unlike Wave there's no
// automatic on_regression/always path, so redStreak resetting on accept is
// the only reset-on-deload-start case that exists for these two schemes).
// Reaching 3 doesn't deload anything by itself — see deloadPending.
interface RedStreakState {
  redStreak?: number;
  // True for exactly one session: the one right after an RPE-deload
  // suggestion is accepted. prescribe() serves a cut-percentage weight for
  // that session (see deloadCutPercentage); update() then ignores whatever
  // was actually logged that session entirely and clears this flag,
  // resuming from the untouched pre-deload currentWeightKg/
  // currentRepTarget — mirrors updateWave's own inDeload branch, which
  // likewise never reads `sets` at all.
  deloadPending?: boolean;
}

export interface DoubleProgressionState extends RedStreakState {
  currentWeightKg?: number;
  currentRepTarget?: number;
}

export interface RepAccumulationState {
  currentWeightKg?: number;
}

export interface TopsetBackoffState extends RedStreakState {
  currentWeightKg?: number;
  currentRepTarget?: number;
}

// No-op scheme (#19) — genuinely has no state to carry.
export type FailureSetsState = Record<string, never>;

export interface WaveState {
  trainingMaxKg?: number;
  // Index into config.weekTable for the next occurrence, ignored while
  // inDeload is true.
  weekIndex?: number;
  inDeload?: boolean;
  // #60: consecutive count of red (RPE >= HIGH_RPE_THRESHOLD on the signal
  // set) sessions just logged, most recent unbroken run only — resets to 0
  // on a non-red or no-RPE-logged session (missing data doesn't get the
  // benefit of the doubt) and whenever inDeload flips true, for any reason.
  // Reaching 3 doesn't deload anything by itself — it only makes the Log
  // page's suggestion banner eligible to show; acceptRpeDeloadSuggestion is
  // the only thing that actually flips inDeload from this signal.
  redStreak?: number;
}

export type SchemeState =
  | DoubleProgressionState
  | RepAccumulationState
  | TopsetBackoffState
  | FailureSetsState
  | WaveState;

// What prescribe() hands the UI for one set. null weight/repTarget means
// "nothing to log" (Failure Sets only, #19) — the UI renders no input at
// all for those, not even an optional one.
export interface PrescribedSet {
  setNumber: number;
  prescribedWeightKg: number | null;
  repTarget: number | "AMRAP" | null;
  // Stamped statically here for schemes that designate specific sets (Wave's
  // AMRAP sets, every Rep Accumulation set, Top-set's top set). Double
  // Progression never designates anything here — its sets qualify via the
  // reps-≤10 fallback, resolved at save time once actual reps are known
  // (see resolveCountsTowardOneRm in lib/oneRm.ts), not at prescribe time.
  countsTowardOneRm: boolean;
  // #60: which set's RPE feeds RpeBox's Wave-row display and Wave's
  // redStreak deload trigger — the AMRAP set for that week, else the
  // heaviest main set (see pickWaveSignalSetNumber). Always false outside
  // Wave in this ticket's scope; a separate, independent flag from
  // countsTowardOneRm since "which set counts toward 1RM" and "which set's
  // RPE represents the week" aren't always the same set (e.g. a custom week
  // table with no AMRAP row still needs an RPE signal but has nothing that
  // counts toward 1RM that week).
  countsTowardRpeSignal: boolean;
}

// What update() needs from a session's actual results. actualWeightKg is
// read (not just repsAchieved) because it's also the bootstrap source for
// state that hasn't been set yet (see file-header note).
export interface LoggedSetInput {
  setNumber: number;
  repsAchieved: number | null;
  actualWeightKg: number | null;
  // #60: threaded through from app/log/actions.ts's SessionSetEntry — was
  // captured at log time long before this (#56) but never reached update()
  // until Wave's redStreak trigger needed it.
  rpe: number | null;
}

// Nearest-plate rounding for computed prescriptions (Wave's percentage
// math, Top-set's back-off percentage). 0.5kg isn't locked by any ticket —
// inferred as a reasonable default for microloaded plates; the value is
// always overridable at log time regardless. Exported for
// app/log/actions.ts's Wave training-max entry, which does the same
// trainingMaxPercentage% x 1RM math outside prescribe/update.
export function roundToNearest(value: number, increment: number): number {
  return Math.round(value / increment) * increment;
}

function prescribeDoubleProgression(
  config: DoubleProgressionConfig,
  state: DoubleProgressionState,
): PrescribedSet[] {
  const trackedWeight = state.currentWeightKg ?? 0;
  // #61: a pending deload cuts weight only, for exactly one session —
  // repTarget is untouched, and currentWeightKg itself (trackedWeight
  // above) is never modified here; update()'s deloadPending branch
  // restores prescribe()'s normal input unchanged on the very next call.
  const weight = state.deloadPending
    ? roundToNearest((config.deloadCutPercentage / 100) * trackedWeight, 0.5)
    : trackedWeight;
  const repTarget = state.currentRepTarget ?? config.repRangeLow;
  return Array.from({ length: config.setCount }, (_, i) => ({
    setNumber: i + 1,
    prescribedWeightKg: weight,
    repTarget,
    countsTowardOneRm: false,
    countsTowardRpeSignal: false,
  }));
}

// Every set hitting the current target climbs it by one; hitting it while
// already at the range's top bumps weight and resets to the bottom.
// Falling short (or an empty session) makes no change — retry identically
// next time. No plateau/deload logic beyond #61's RPE-triggered one below.
function updateDoubleProgression(
  config: DoubleProgressionConfig,
  state: DoubleProgressionState,
  sets: LoggedSetInput[],
): DoubleProgressionState {
  const currentWeightKg = state.currentWeightKg ?? sets[0]?.actualWeightKg ?? 0;
  const currentRepTarget = state.currentRepTarget ?? config.repRangeLow;

  // #61: the deload session just logged — ignore whatever was actually
  // performed entirely (mirrors updateWave's own inDeload branch, which
  // likewise never reads `sets`) and resume from the untouched pre-deload
  // state, same as if this session hadn't happened for progression
  // purposes.
  if (state.deloadPending) {
    return {
      currentWeightKg,
      currentRepTarget,
      deloadPending: false,
      redStreak: 0,
    };
  }

  // #61: "the set that counts" for Double Progression is every set's
  // average — its sets are structurally interchangeable (no designated
  // top/AMRAP set the way Wave or Top-set+Backoff have), so there's no
  // principled single set to elect. Any set missing RPE makes the whole
  // session's read non-red rather than averaging just what's present
  // (decided in chat: a partial average could tip red off 1 of 3 sets
  // logging RPE once, which isn't "3 consecutive hard weeks").
  const everySetHasRpe = sets.length > 0 && sets.every((s) => s.rpe !== null);
  const avgRpe = everySetHasRpe
    ? sets.reduce((sum, s) => sum + s.rpe!, 0) / sets.length
    : null;
  const isRed = avgRpe !== null && avgRpe >= HIGH_RPE_THRESHOLD;
  const newRedStreak = isRed ? (state.redStreak ?? 0) + 1 : 0;

  const allHitTarget =
    sets.length > 0 &&
    sets.every((s) => (s.repsAchieved ?? 0) >= currentRepTarget);
  if (!allHitTarget) {
    return { currentWeightKg, currentRepTarget, redStreak: newRedStreak };
  }
  if (currentRepTarget >= config.repRangeHigh) {
    return {
      currentWeightKg: currentWeightKg + config.weightIncrement,
      currentRepTarget: config.repRangeLow,
      redStreak: newRedStreak,
    };
  }
  return {
    currentWeightKg,
    currentRepTarget: currentRepTarget + 1,
    redStreak: newRedStreak,
  };
}

// #61: the Log page banner's Accept action for Double Progression — the
// only thing that turns a redStreak >= 3 suggestion into a real deload.
// Deliberately dumb/pure, same shape as Wave's acceptRpeDeloadSuggestion
// (#60): no eligibility check here (the caller, app/log/actions.ts's
// server action, re-reads current state and confirms redStreak >= 3
// right before calling this).
export function acceptDoubleProgressionDeloadSuggestion(
  state: DoubleProgressionState,
): DoubleProgressionState {
  return {
    currentWeightKg: state.currentWeightKg,
    currentRepTarget: state.currentRepTarget,
    deloadPending: true,
    redStreak: 0,
  };
}

// No individual per-set rep target — every set is "just perform a set at
// current_weight" (#17). All sets are program-designated toward 1RM
// regardless of position, since reps typically decline across sets and the
// already-locked "highest estimate wins" aggregation picks whichever one
// actually performed best that session.
function prescribeRepAccumulation(
  config: RepAccumulationConfig,
  state: RepAccumulationState,
): PrescribedSet[] {
  const weight = state.currentWeightKg ?? 0;
  return Array.from({ length: config.setCount }, (_, i) => ({
    setNumber: i + 1,
    prescribedWeightKg: weight,
    repTarget: null,
    countsTowardOneRm: true,
    countsTowardRpeSignal: false,
  }));
}

function updateRepAccumulation(
  config: RepAccumulationConfig,
  state: RepAccumulationState,
  sets: LoggedSetInput[],
): RepAccumulationState {
  const currentWeightKg = state.currentWeightKg ?? sets[0]?.actualWeightKg ?? 0;
  const totalReps = sets.reduce((sum, s) => sum + (s.repsAchieved ?? 0), 0);
  if (totalReps >= config.targetTotalReps) {
    return { currentWeightKg: currentWeightKg + config.weightIncrement };
  }
  return { currentWeightKg };
}

// Top set (set 1) climbs identically to Double Progression; back-off sets
// are always derived from the top set's *prescribed* weight (state, not
// whatever gets actually logged if overridden) with a fixed rep target, no
// independent state (#18).
function prescribeTopsetBackoff(
  config: TopsetBackoffConfig,
  state: TopsetBackoffState,
): PrescribedSet[] {
  const trackedWeight = state.currentWeightKg ?? 0;
  // #61: same one-session-only cut as Double Progression's own comment —
  // backoff sets aren't cut independently below, they're derived from
  // this (possibly cut) weight, so the whole session scales down together.
  const weight = state.deloadPending
    ? roundToNearest((config.deloadCutPercentage / 100) * trackedWeight, 0.5)
    : trackedWeight;
  const repTarget = state.currentRepTarget ?? config.topSetRepRangeLow;
  const backoffWeight = roundToNearest(
    (config.backoffPercentage / 100) * weight,
    0.5,
  );
  const topSet: PrescribedSet = {
    setNumber: 1,
    prescribedWeightKg: weight,
    repTarget,
    countsTowardOneRm: true,
    // #61: the top set is also this scheme's RPE signal set — feeds both
    // RpeBox's display and the redStreak trigger below, one shared
    // designation, always the same set regardless of deload state (unlike
    // Wave, Top-set+Backoff has no separate "recovery week" shape to
    // exclude — a deload here is just this same top set at a lighter
    // weight, still meaningfully the set worth reading RPE from).
    countsTowardRpeSignal: true,
  };
  const backoffSets: PrescribedSet[] = Array.from(
    { length: config.backoffSetCount },
    (_, i) => ({
      setNumber: i + 2,
      prescribedWeightKg: backoffWeight,
      repTarget: config.backoffRepTarget,
      countsTowardOneRm: false,
      countsTowardRpeSignal: false,
    }),
  );
  return [topSet, ...backoffSets];
}

function updateTopsetBackoff(
  config: TopsetBackoffConfig,
  state: TopsetBackoffState,
  sets: LoggedSetInput[],
): TopsetBackoffState {
  const topSet = sets.find((s) => s.setNumber === 1);
  const currentWeightKg = state.currentWeightKg ?? topSet?.actualWeightKg ?? 0;
  const currentRepTarget = state.currentRepTarget ?? config.topSetRepRangeLow;

  // #61: same "ignore the deload session entirely" shape as
  // updateDoubleProgression — see its own comment.
  if (state.deloadPending) {
    return {
      currentWeightKg,
      currentRepTarget,
      deloadPending: false,
      redStreak: 0,
    };
  }

  // #61: "the set that counts" is the top set only — pre-decided (unlike
  // Double Progression's averaged signal), since the top set is already
  // this scheme's one designated set (countsTowardOneRm above agrees).
  // Missing RPE on it -> non-red, same rule as Wave's own single-set
  // signal (#60).
  const isRed =
    topSet !== undefined &&
    topSet.rpe !== null &&
    topSet.rpe >= HIGH_RPE_THRESHOLD;
  const newRedStreak = isRed ? (state.redStreak ?? 0) + 1 : 0;

  const hitTarget =
    topSet !== undefined && (topSet.repsAchieved ?? 0) >= currentRepTarget;
  if (!hitTarget) {
    return { currentWeightKg, currentRepTarget, redStreak: newRedStreak };
  }
  if (currentRepTarget >= config.topSetRepRangeHigh) {
    return {
      currentWeightKg: currentWeightKg + config.weightIncrement,
      currentRepTarget: config.topSetRepRangeLow,
      redStreak: newRedStreak,
    };
  }
  return {
    currentWeightKg,
    currentRepTarget: currentRepTarget + 1,
    redStreak: newRedStreak,
  };
}

// #61: Top-set+Backoff's own Accept action — same shape as Double
// Progression's, see its comment.
export function acceptTopsetBackoffDeloadSuggestion(
  state: TopsetBackoffState,
): TopsetBackoffState {
  return {
    currentWeightKg: state.currentWeightKg,
    currentRepTarget: state.currentRepTarget,
    deloadPending: true,
    redStreak: 0,
  };
}

// Nothing tracked, nothing to prescribe beyond "how many sets" — no weight,
// no reps, no state (#19). The UI reads prescribedWeightKg/repTarget === null
// as "render no input, just a done mark."
function prescribeFailureSets(config: FailureSetsConfig): PrescribedSet[] {
  return Array.from({ length: config.setCount }, (_, i) => ({
    setNumber: i + 1,
    prescribedWeightKg: null,
    repTarget: null,
    countsTowardOneRm: false,
    countsTowardRpeSignal: false,
  }));
}

// The fixed deload week: 40/50/60% x 5/5/5, no AMRAP (#16). Not a row in
// weekTable — inserted here at prescribe time per deloadMode.
const DELOAD_WEEK: WaveWeekSet[] = [
  { percentageOfTrainingMax: 40, repTarget: 5 },
  { percentageOfTrainingMax: 50, repTarget: 5 },
  { percentageOfTrainingMax: 60, repTarget: 5 },
];

function buildSupplementalSets(
  config: WaveConfig,
  weekSets: WaveWeekSet[],
  trainingMaxKg: number,
  startSetNumber: number,
): PrescribedSet[] {
  if (config.supplementalSetType === "none") return [];

  // Classic defaults (#16) when no override is configured — see
  // WaveConfig.supplementalConfig's doc comment.
  const supp: WaveSupplementalConfig = config.supplementalConfig ?? {
    setCount: 5,
    repTarget: config.supplementalSetType === "bbb" ? 10 : 5,
  };

  let percentage: number;
  switch (config.supplementalSetType) {
    case "bbb":
      percentage = supp.percentage ?? 50;
      break;
    case "fsl":
      percentage = weekSets[0]!.percentageOfTrainingMax;
      break;
    case "ssl":
      percentage = (weekSets[1] ?? weekSets[0])!.percentageOfTrainingMax;
      break;
    case "custom":
      percentage = supp.percentage ?? 0;
      break;
  }

  const weight = roundToNearest((percentage / 100) * trainingMaxKg, 0.5);
  return Array.from({ length: supp.setCount }, (_, i) => ({
    setNumber: startSetNumber + i + 1,
    prescribedWeightKg: weight,
    repTarget: supp.repTarget,
    countsTowardOneRm: false,
    countsTowardRpeSignal: false,
  }));
}

// #60: "the set that counts" for a Wave week's RPE signal — the AMRAP set
// if that week has one, else the main set with the highest
// percentageOfTrainingMax (ties broken by the higher set number; heavier
// work is conventionally sequenced last, matching the preset's own
// ordering). Returns a 1-based setNumber, matching PrescribedSet/
// LoggedSetInput's own numbering. Never considers supplemental sets — they
// aren't part of weekSets, so they're structurally excluded already.
// Shared by prescribeWave (stamps the flag for later display, #56) and
// updateWave (reads it live for the redStreak trigger) — one rule, not two.
export function pickWaveSignalSetNumber(weekSets: WaveWeekSet[]): number {
  const amrapIndex = weekSets.findIndex((s) => s.repTarget === "AMRAP");
  if (amrapIndex !== -1) return amrapIndex + 1;
  let heaviestIndex = 0;
  for (let i = 1; i < weekSets.length; i++) {
    if (
      weekSets[i]!.percentageOfTrainingMax >=
      weekSets[heaviestIndex]!.percentageOfTrainingMax
    ) {
      heaviestIndex = i; // >=, not >, so a tie keeps the higher set number
    }
  }
  return heaviestIndex + 1;
}

function prescribeWave(config: WaveConfig, state: WaveState): PrescribedSet[] {
  const trainingMaxKg = state.trainingMaxKg ?? 0;
  const inDeload = state.inDeload ?? false;
  const weekIndex = state.weekIndex ?? 0;
  const weekSets = inDeload
    ? DELOAD_WEEK
    : (config.weekTable[weekIndex] ?? config.weekTable[0]!);
  // #60: never stamped during deload — DELOAD_WEEK has no AMRAP and isn't a
  // real training week, so it has nothing meaningful to signal.
  const signalSetNumber = inDeload ? -1 : pickWaveSignalSetNumber(weekSets);

  const mainSets: PrescribedSet[] = weekSets.map((s, i) => ({
    setNumber: i + 1,
    prescribedWeightKg: roundToNearest(
      (s.percentageOfTrainingMax / 100) * trainingMaxKg,
      0.5,
    ),
    repTarget: s.repTarget,
    // Every AMRAP set counts toward 1RM regardless of week or rep count
    // (#16 addendum) — without this, a low-percentage AMRAP set could log
    // >10 reps and silently miss the reps-≤10 fallback, undermining the
    // training-max recalculation below which depends on it.
    countsTowardOneRm: s.repTarget === "AMRAP",
    countsTowardRpeSignal: i + 1 === signalSetNumber,
  }));

  if (inDeload) return mainSets;
  return [
    ...mainSets,
    ...buildSupplementalSets(config, weekSets, trainingMaxKg, mainSets.length),
  ];
}

// Advances one prescribed occurrence per call, matching the app's
// one-update-per-logged-session model:
//  - mid-cycle week just logged -> advance to the next week index.
//  - last working week just logged -> recalc TM from its AMRAP set, then
//    either enter deload (per deloadMode) or roll straight into next
//    cycle's week 0.
//  - deload week just logged -> always roll into next cycle's week 0, no
//    recalculation (deload has no AMRAP to read, #16).
// #60's redStreak rides along on every branch above except the deload-week
// one — see that field's own doc comment on WaveState.
function updateWave(
  config: WaveConfig,
  state: WaveState,
  sets: LoggedSetInput[],
): WaveState {
  const trainingMaxKg = state.trainingMaxKg ?? 0;
  const weekIndex = state.weekIndex ?? 0;
  const inDeload = state.inDeload ?? false;

  if (inDeload) {
    return { trainingMaxKg, weekIndex: 0, inDeload: false, redStreak: 0 };
  }

  // #60: computed for every real working week, mid-cycle or not — the
  // suggestion has to become eligible the moment the 3rd red week is
  // logged, not wait for the end-of-cycle checkpoint below (custom week
  // tables, #16, can run longer than 3 weeks).
  const weekSets = config.weekTable[weekIndex] ?? config.weekTable[0]!;
  const signalSetNumber = pickWaveSignalSetNumber(weekSets);
  const signalSet = sets.find((s) => s.setNumber === signalSetNumber);
  // No RPE on the signal set — whether it wasn't logged at all or logged
  // with RPE left blank — breaks the streak rather than being skipped:
  // "3 consecutive" means 3 consecutive *confirmed* reads, not reads with
  // silent gaps papered over (decided in chat: logging RPE accurately is
  // the user's own job, a missing read is never assumed high).
  const isRed = (signalSet?.rpe ?? -Infinity) >= HIGH_RPE_THRESHOLD;
  const newRedStreak = isRed ? (state.redStreak ?? 0) + 1 : 0;

  const isLastWorkingWeek = weekIndex >= config.weekTable.length - 1;
  if (!isLastWorkingWeek) {
    return {
      trainingMaxKg,
      weekIndex: weekIndex + 1,
      inDeload: false,
      redStreak: newRedStreak,
    };
  }

  const amrapSetNumber = weekSets.findIndex((s) => s.repTarget === "AMRAP") + 1;
  const amrapLogged = sets.find((s) => s.setNumber === amrapSetNumber);
  let newTrainingMaxKg = trainingMaxKg;
  if (amrapLogged?.repsAchieved != null && amrapLogged.actualWeightKg != null) {
    const estimate = epley1Rm(
      amrapLogged.actualWeightKg,
      amrapLogged.repsAchieved,
    );
    newTrainingMaxKg = roundToNearest(
      (config.trainingMaxPercentage / 100) * estimate,
      0.5,
    );
  }

  const regressed = newTrainingMaxKg < trainingMaxKg;
  const shouldDeload =
    config.deloadMode === "always" ||
    (config.deloadMode === "on_regression" && regressed);

  if (shouldDeload) {
    return {
      trainingMaxKg: newTrainingMaxKg,
      weekIndex,
      inDeload: true,
      // Deloading now for another reason already — the streak that would
      // otherwise have suggested the same thing is moot (WaveState's
      // doc comment: resets whenever inDeload flips true, any trigger).
      redStreak: 0,
    };
  }
  return {
    trainingMaxKg: newTrainingMaxKg,
    weekIndex: 0,
    inDeload: false,
    redStreak: newRedStreak,
  };
}

// #60/#61: the one shared "is an RPE-deload suggestion currently live"
// rule, reused by every scheme that has one — each scheme's Log-page
// render check, its own accept server action's re-verification, and the
// Progress page's passive badge. Takes the two raw values rather than a
// full state object since the schemes don't share a field name for
// "already mid-deload" (Wave's inDeload vs. Double Progression/
// Top-set+Backoff's deloadPending) — reimplementing `(redStreak ?? 0) >= 3
// && !alreadyDeloading` independently at every call site was flagged as a
// duplication smell in #66's code review when there was only one scheme
// doing it; #61 adding two more made it worth actually fixing rather than
// tripling.
export function isRpeDeloadEligible(
  redStreak: number | undefined,
  alreadyDeloading: boolean | undefined,
): boolean {
  return (redStreak ?? 0) >= 3 && !alreadyDeloading;
}

// #61: pairs isRpeDeloadEligible with "which state fields does this scheme
// use" so callers don't need their own scheme.type switch + state cast —
// that dispatch shape (not just the eligibility formula) was still being
// reimplemented once per call site even after isRpeDeloadEligible existed
// (caught in code review). One place owns "wave uses inDeload, the other
// two use deloadPending"; every caller (Log page render, Progress page
// badge) becomes a single call. Rep Accumulation/Failure Sets have no
// deload concept (#61's own out-of-scope list) and fall through to false.
export function rpeDeloadEligibleForScheme(
  schemeType: string,
  schemeState: unknown,
): boolean {
  switch (schemeType) {
    case "wave": {
      const s = schemeState as WaveState;
      return isRpeDeloadEligible(s.redStreak, s.inDeload);
    }
    case "double_progression": {
      const s = schemeState as DoubleProgressionState;
      return isRpeDeloadEligible(s.redStreak, s.deloadPending);
    }
    case "topset_backoff": {
      const s = schemeState as TopsetBackoffState;
      return isRpeDeloadEligible(s.redStreak, s.deloadPending);
    }
    default:
      return false;
  }
}

// #60: the Log page banner's Accept action — the *only* thing that turns a
// redStreak >= 3 suggestion into a real deload. Deliberately dumb/pure: no
// eligibility check in here (the caller, app/log/actions.ts's server
// action, re-reads current state and confirms isRpeDeloadEligible right
// before calling this, guarding against a stale page suggesting something
// that's no longer true). trainingMaxKg/weekIndex carry through unchanged
// — same as every other deload-entry path, prescribeWave ignores
// weekIndex entirely while inDeload is true, and it's restored to week 0
// the moment the deload week itself gets logged (updateWave's inDeload
// branch above).
export function acceptRpeDeloadSuggestion(state: WaveState): WaveState {
  return {
    trainingMaxKg: state.trainingMaxKg,
    weekIndex: state.weekIndex,
    inDeload: true,
    redStreak: 0,
  };
}

/** state + config -> next occurrence's prescribed sets (#8). */
export function prescribe(
  scheme: SchemeConfig,
  state: unknown,
): PrescribedSet[] {
  switch (scheme.type) {
    case "double_progression":
      return prescribeDoubleProgression(
        scheme.config,
        (state ?? {}) as DoubleProgressionState,
      );
    case "wave":
      return prescribeWave(scheme.config, (state ?? {}) as WaveState);
    case "rep_accumulation":
      return prescribeRepAccumulation(
        scheme.config,
        (state ?? {}) as RepAccumulationState,
      );
    case "topset_backoff":
      return prescribeTopsetBackoff(
        scheme.config,
        (state ?? {}) as TopsetBackoffState,
      );
    case "failure_sets":
      return prescribeFailureSets(scheme.config);
  }
}

/** actual logged performance -> new state (#8). */
export function update(
  scheme: SchemeConfig,
  state: unknown,
  sets: LoggedSetInput[],
): SchemeState {
  switch (scheme.type) {
    case "double_progression":
      return updateDoubleProgression(
        scheme.config,
        (state ?? {}) as DoubleProgressionState,
        sets,
      );
    case "wave":
      return updateWave(scheme.config, (state ?? {}) as WaveState, sets);
    case "rep_accumulation":
      return updateRepAccumulation(
        scheme.config,
        (state ?? {}) as RepAccumulationState,
        sets,
      );
    case "topset_backoff":
      return updateTopsetBackoff(
        scheme.config,
        (state ?? {}) as TopsetBackoffState,
        sets,
      );
    case "failure_sets":
      return {};
  }
}

// Epley formula (#5): 1RM = weight x (1 + reps/30). Lives here (not
// oneRm.ts) because Wave's training-max recalculation needs it internally;
// re-exported from oneRm.ts as the single public entry point for the rest
// of the app.
export function epley1Rm(weightKg: number, reps: number): number {
  return weightKg * (1 + reps / 30);
}

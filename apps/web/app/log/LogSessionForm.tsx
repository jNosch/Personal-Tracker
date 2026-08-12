"use client";

// Session Logging (#29) — variant D from prototype/session-logging (#14's
// winning design): whole session on one page, sectioned by exercise, single
// save action at the bottom, compact monospace-leaning rows. Adapted from
// the prototype with real server actions instead of local-only state, plus
// the two runtime concerns the prototype didn't need to handle: Failure
// Sets rendering no reps input at all, and Wave's inline training-max entry
// when schemeState has none yet (#16).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  effectiveReps,
  effectiveWeight,
  loggedTotalReps,
} from "../../lib/logEntry";
import type { PrescribedSet } from "../../lib/schemes";
import type { SetStyle } from "../../lib/setStyles";
import {
  acceptWaveRpeDeloadSuggestion,
  logSession,
  setTrainingMax,
} from "./actions";

// #66: PrescribedSet itself stays untouched (style tags never reach the
// scheme engine, see setStyles.ts's file-header comment) — this is a
// display-only join done at the page.tsx layer, between prescribe()'s
// output and whatever's stored in exerciseInDay.setStyles for the current
// week.
type LogSetView = PrescribedSet & { style: SetStyle | null };

interface ExerciseView {
  exerciseInDayId: string;
  exerciseName: string;
  schemeType: string;
  sets: LogSetView[];
  needsTrainingMax: boolean;
  // #57: Rep Accumulation's whole-session-total target (undefined for
  // every other scheme) — the per-set label alone ("weight×—") doesn't say
  // what that total actually is.
  repAccumulationTargetTotalReps?: number;
  // #60: 3+ consecutive red weeks on this Wave exercise's own signal set —
  // an offer, not a command. needsTrainingMax always wins when both are
  // somehow true (can't happen in practice: redStreak only climbs once
  // sessions have already been logged against a real training max).
  suggestDeload: boolean;
}

interface SetEntryState {
  actualWeightKg: number | "";
  repsAchieved: number | "";
  rpe: number | "";
  isDone: boolean;
}

type EntryState = Record<string, Record<number, SetEntryState>>;

// actualWeightKg starts blank ("") rather than pre-copied from
// set.prescribedWeightKg — deliberately. Pre-copying it once means it goes
// stale the moment the prescription changes without this component
// remounting (e.g. setting Wave's training max updates the server's
// prescribe() output for the same day/exerciseInDayId, so the entries
// dictionary's keys still match and no crash occurs — but the copied-in
// numbers are now wrong). effectiveWeight below reads the live prescribed
// value from props every render instead, so "blank" always means
// "whatever's currently prescribed" rather than a frozen snapshot.
function initialEntryState(exercises: ExerciseView[]): EntryState {
  const state: EntryState = {};
  for (const ex of exercises) {
    state[ex.exerciseInDayId] = {};
    for (const set of ex.sets) {
      state[ex.exerciseInDayId]![set.setNumber] = {
        actualWeightKg: "",
        repsAchieved: "",
        rpe: "",
        isDone: true,
      };
    }
  }
  return state;
}

// effectiveWeight/effectiveReps/loggedTotalReps: pure pre-fill/aggregation
// logic, lives in lib/logEntry.ts (code-conventions.md's file-organization
// rule), imported above.

export default function LogSessionForm({
  programId,
  programName,
  dayTemplateId,
  dayLabel,
  exercises,
}: {
  programId: string;
  programName: string;
  dayTemplateId: string;
  dayLabel: string;
  exercises: ExerciseView[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<EntryState>(() =>
    initialEntryState(exercises),
  );
  const [isPending, startTransition] = useTransition();

  function updateSet(
    exerciseInDayId: string,
    setNumber: number,
    field: "actualWeightKg" | "repsAchieved" | "rpe",
    value: string,
  ) {
    setEntries((prev) => ({
      ...prev,
      [exerciseInDayId]: {
        ...prev[exerciseInDayId],
        [setNumber]: {
          ...prev[exerciseInDayId]![setNumber]!,
          [field]: value === "" ? "" : Number(value),
        },
      },
    }));
  }

  function toggleDone(exerciseInDayId: string, setNumber: number) {
    setEntries((prev) => ({
      ...prev,
      [exerciseInDayId]: {
        ...prev[exerciseInDayId],
        [setNumber]: {
          ...prev[exerciseInDayId]![setNumber]!,
          isDone: !prev[exerciseInDayId]![setNumber]!.isDone,
        },
      },
    }));
  }

  const blockedOnTrainingMax = exercises.some((ex) => ex.needsTrainingMax);

  function handleSave() {
    startTransition(async () => {
      const exerciseEntries = exercises.map((ex) => ({
        exerciseInDayId: ex.exerciseInDayId,
        sets: ex.sets.map((set) => {
          const entry = entries[ex.exerciseInDayId]![set.setNumber]!;
          const isFailureSet =
            set.prescribedWeightKg === null && set.repTarget === null;
          const weight = effectiveWeight(entry, set);
          const reps = effectiveReps(entry, set);
          return {
            setNumber: set.setNumber,
            actualWeightKg: isFailureSet ? null : weight === "" ? null : weight,
            repsAchieved: isFailureSet ? null : reps === "" ? null : reps,
            rpe: isFailureSet ? null : entry.rpe === "" ? null : entry.rpe,
            isDone: entry.isDone,
          };
        }),
      }));
      await logSession(programId, dayTemplateId, date, exerciseEntries);
      router.refresh();
    });
  }

  return (
    <div
      style={{
        padding: 28,
        fontFamily: "monospace",
        fontSize: 19,
        maxWidth: 900,
        margin: "0 auto",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 22,
        }}
      >
        <div>
          <span style={{ color: "#999" }}>{programName} — </span>
          <strong>{dayLabel}</strong>
        </div>
        <label>
          date{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              padding: "4px 8px",
              fontFamily: "monospace",
              fontSize: 17,
              border: "1px solid #ccc",
            }}
          />
        </label>
      </div>

      {exercises.map((ex) =>
        ex.needsTrainingMax ? (
          <TrainingMaxPrompt
            key={ex.exerciseInDayId}
            exerciseInDayId={ex.exerciseInDayId}
            exerciseName={ex.exerciseName}
            onSet={() => router.refresh()}
          />
        ) : (
          <div key={ex.exerciseInDayId} style={{ marginBottom: 26 }}>
            {ex.suggestDeload && (
              <RpeDeloadBanner
                exerciseInDayId={ex.exerciseInDayId}
                exerciseName={ex.exerciseName}
                onAccept={() => router.refresh()}
              />
            )}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                fontWeight: 700,
                marginBottom: 6,
                borderBottom: "1px solid #111",
                paddingBottom: 3,
              }}
            >
              <span>{ex.exerciseName}</span>
              {ex.repAccumulationTargetTotalReps !== undefined && (
                <span style={{ fontWeight: 400, fontSize: 15, color: "#666" }}>
                  target {ex.repAccumulationTargetTotalReps} reps · logged{" "}
                  {loggedTotalReps(ex.sets, entries[ex.exerciseInDayId] ?? {})}
                </span>
              )}
            </div>
            {ex.sets.map((set) => {
              const isFailureSet =
                set.prescribedWeightKg === null && set.repTarget === null;
              const entry = entries[ex.exerciseInDayId]![set.setNumber]!;
              return (
                <div
                  key={set.setNumber}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "5px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <span style={{ width: 24, color: "#666" }}>
                    {set.setNumber}
                    {set.countsTowardOneRm && "*"}
                  </span>
                  {isFailureSet ? (
                    <label
                      style={{ display: "flex", alignItems: "center", gap: 6 }}
                    >
                      <input
                        type="checkbox"
                        checked={entry.isDone}
                        onChange={() =>
                          toggleDone(ex.exerciseInDayId, set.setNumber)
                        }
                      />
                      done
                    </label>
                  ) : (
                    <>
                      <span style={{ width: 130, color: "#999" }}>
                        {set.prescribedWeightKg}×{set.repTarget ?? "—"}
                      </span>
                      <input
                        type="number"
                        value={effectiveWeight(entry, set)}
                        onChange={(e) =>
                          updateSet(
                            ex.exerciseInDayId,
                            set.setNumber,
                            "actualWeightKg",
                            e.target.value,
                          )
                        }
                        placeholder="kg"
                        style={inputStyle(74)}
                      />
                      <input
                        type="number"
                        value={effectiveReps(entry, set)}
                        onChange={(e) =>
                          updateSet(
                            ex.exerciseInDayId,
                            set.setNumber,
                            "repsAchieved",
                            e.target.value,
                          )
                        }
                        placeholder="reps"
                        style={inputStyle(68)}
                      />
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={entry.rpe}
                        onChange={(e) =>
                          updateSet(
                            ex.exerciseInDayId,
                            set.setNumber,
                            "rpe",
                            e.target.value,
                          )
                        }
                        placeholder="rpe"
                        style={inputStyle(58)}
                      />
                    </>
                  )}
                  {set.style && (
                    // #66: advisory only — see LogSetView's own comment.
                    // Pinned to the row's right edge (marginLeft: auto)
                    // rather than sitting inline before the inputs — a
                    // flagged set was pushing every input a few px right
                    // of an unflagged one, which is more distracting than
                    // useful for a label nobody needs to read to fill the
                    // inputs in.
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 15,
                        color: "#999",
                        fontStyle: "italic",
                      }}
                    >
                      {set.style === "rest_pause" ? "rest-pause" : "cluster"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        ),
      )}

      <div style={{ fontSize: 16, color: "#999", marginBottom: 17 }}>
        * counts toward 1RM
      </div>

      <button
        disabled={isPending || blockedOnTrainingMax}
        onClick={handleSave}
        style={{
          padding: "9px 24px",
          fontSize: 19,
          background: "#111",
          color: "#fff",
          border: "none",
          fontFamily: "monospace",
          cursor: blockedOnTrainingMax ? "not-allowed" : "pointer",
        }}
      >
        save session
      </button>
      {blockedOnTrainingMax && (
        <span style={{ fontSize: 16, color: "#999", marginLeft: 12 }}>
          set training max above first
        </span>
      )}
    </div>
  );
}

// Wave's training max has no other bootstrap path (#16) — shown inline,
// right where the exercise's sets would otherwise render, rather than a
// separate page/flow.
function TrainingMaxPrompt({
  exerciseInDayId,
  exerciseName,
  onSet,
}: {
  exerciseInDayId: string;
  exerciseName: string;
  onSet: () => void;
}) {
  const [oneRm, setOneRm] = useState("");
  const [isPending, startTransition] = useTransition();

  return (
    <div
      style={{
        marginBottom: 26,
        border: "1px dashed #ccc",
        borderRadius: 4,
        padding: 14,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 9 }}>{exerciseName}</div>
      <label style={{ fontSize: 17, color: "#666" }}>
        no training max set yet — enter current 1RM (kg){" "}
        <input
          type="number"
          value={oneRm}
          onChange={(e) => setOneRm(e.target.value)}
          style={inputStyle(88)}
        />
      </label>
      <button
        disabled={isPending || oneRm === ""}
        onClick={() =>
          startTransition(async () => {
            await setTrainingMax(exerciseInDayId, Number(oneRm));
            onSet();
          })
        }
        style={{
          marginLeft: 12,
          padding: "5px 14px",
          fontSize: 17,
          background: "#111",
          color: "#fff",
          border: "none",
          fontFamily: "monospace",
          cursor: "pointer",
        }}
      >
        set
      </button>
    </div>
  );
}

// #60: 3+ consecutive red (RPE >= 9 on the AMRAP-or-heaviest set) weeks on
// this Wave exercise — a suggestion, not an automatic deload. Sits above
// the exercise's normal sets rather than replacing them: declining costs
// nothing, the cycle just continues as prescribed below. Accept flips
// inDeload server-side (acceptWaveRpeDeloadSuggestion) so the *next*
// prescribe() for this exercise returns the deload week — this session's
// already-rendered sets are unaffected either way.
function RpeDeloadBanner({
  exerciseInDayId,
  exerciseName,
  onAccept,
}: {
  exerciseInDayId: string;
  exerciseName: string;
  onAccept: () => void;
}) {
  const [isPending, startTransition] = useTransition();

  return (
    <div
      style={{
        marginBottom: 10,
        border: "1px dashed #dc2626",
        borderRadius: 4,
        padding: 14,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
      }}
    >
      <span style={{ fontSize: 16 }}>
        <strong>{exerciseName}</strong> — 3 weeks of high RPE. Deload next?
      </span>
      <button
        disabled={isPending}
        onClick={() =>
          startTransition(async () => {
            await acceptWaveRpeDeloadSuggestion(exerciseInDayId);
            onAccept();
          })
        }
        style={{
          padding: "5px 14px",
          fontSize: 17,
          background: "#dc2626",
          color: "#fff",
          border: "none",
          fontFamily: "monospace",
          cursor: "pointer",
          flexShrink: 0,
        }}
      >
        deload next
      </button>
    </div>
  );
}

function inputStyle(width: number) {
  return {
    width,
    padding: 4,
    fontFamily: "monospace",
    fontSize: 17,
    border: "1px solid #ccc",
  } as const;
}

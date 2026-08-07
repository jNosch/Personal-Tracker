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
import type { PrescribedSet } from "../../lib/schemes";
import { logSession, setTrainingMax } from "./actions";

interface ExerciseView {
  exerciseInDayId: string;
  exerciseName: string;
  schemeType: string;
  sets: PrescribedSet[];
  needsTrainingMax: boolean;
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

// The displayed/submitted weight: whatever the user typed, or the current
// prescription if they haven't touched the field yet (issue #14's
// "pre-filled from the prescription, overridable").
function effectiveWeight(
  entry: SetEntryState,
  set: PrescribedSet,
): number | "" {
  return entry.actualWeightKg === ""
    ? (set.prescribedWeightKg ?? "")
    : entry.actualWeightKg;
}

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
          return {
            setNumber: set.setNumber,
            actualWeightKg: isFailureSet ? null : weight === "" ? null : weight,
            repsAchieved: isFailureSet
              ? null
              : entry.repsAchieved === ""
                ? null
                : entry.repsAchieved,
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
        padding: 20,
        fontFamily: "monospace",
        fontSize: 13,
        maxWidth: 620,
        margin: "0 auto",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: 16,
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
              padding: "2px 4px",
              fontFamily: "monospace",
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
          <div key={ex.exerciseInDayId} style={{ marginBottom: 18 }}>
            <div
              style={{
                fontWeight: 700,
                marginBottom: 4,
                borderBottom: "1px solid #111",
                paddingBottom: 2,
              }}
            >
              {ex.exerciseName}
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
                    gap: 8,
                    padding: "3px 0",
                    borderBottom: "1px solid #f0f0f0",
                  }}
                >
                  <span style={{ width: 16, color: "#666" }}>
                    {set.setNumber}
                    {set.countsTowardOneRm && "*"}
                  </span>
                  {isFailureSet ? (
                    <label
                      style={{ display: "flex", alignItems: "center", gap: 4 }}
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
                      <span style={{ width: 90, color: "#999" }}>
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
                        style={inputStyle(50)}
                      />
                      <input
                        type="number"
                        value={entry.repsAchieved}
                        onChange={(e) =>
                          updateSet(
                            ex.exerciseInDayId,
                            set.setNumber,
                            "repsAchieved",
                            e.target.value,
                          )
                        }
                        placeholder="reps"
                        style={inputStyle(46)}
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
                        style={inputStyle(40)}
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        ),
      )}

      <div style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>
        * counts toward 1RM
      </div>

      <button
        disabled={isPending || blockedOnTrainingMax}
        onClick={handleSave}
        style={{
          padding: "6px 16px",
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
        <span style={{ fontSize: 11, color: "#999", marginLeft: 8 }}>
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
        marginBottom: 18,
        border: "1px dashed #ccc",
        borderRadius: 4,
        padding: 10,
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 6 }}>{exerciseName}</div>
      <label style={{ fontSize: 12, color: "#666" }}>
        no training max set yet — enter current 1RM (kg){" "}
        <input
          type="number"
          value={oneRm}
          onChange={(e) => setOneRm(e.target.value)}
          style={inputStyle(60)}
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
          marginLeft: 8,
          padding: "3px 10px",
          fontSize: 12,
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

function inputStyle(width: number) {
  return {
    width,
    padding: 2,
    fontFamily: "monospace",
    border: "1px solid #ccc",
  } as const;
}

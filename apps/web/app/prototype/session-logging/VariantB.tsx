"use client";

// PROTOTYPE VARIANT B — "One-exercise-at-a-time wizard"
// Steps through exercises one at a time with Next/Back, ending on a review screen before
// saving. Less overwhelming than seeing the whole session at once; mirrors recalling a
// session exercise-by-exercise ("did squat, then bench, then curls").

import { useState } from "react";
import { PRESCRIBED_DAY, PRESCRIBED_EXERCISES, initialEntryState, type EntryState } from "./data";

export default function VariantB() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<EntryState>(initialEntryState());
  const [step, setStep] = useState(0); // 0..length-1 = exercises, length = review

  const isReview = step === PRESCRIBED_EXERCISES.length;
  const currentExercise = isReview ? null : PRESCRIBED_EXERCISES[step]!;

  function updateSet(exerciseId: string, setNumber: number, field: "actualWeightKg" | "repsAchieved" | "rpe", value: string) {
    setEntries((prev) => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [setNumber]: {
          ...prev[exerciseId]![setNumber]!,
          [field]: value === "" ? "" : Number(value),
        },
      },
    }));
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 480, margin: "0 auto" }}>
      <div style={{ marginBottom: 4, fontSize: 13, color: "#666" }}>{PRESCRIBED_DAY.programName}</div>
      <h1 style={{ fontSize: 20, marginBottom: 4 }}>{PRESCRIBED_DAY.dayLabel}</h1>
      <label style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 16 }}>
        Session date{" "}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ marginLeft: 8, padding: "2px 6px" }}
        />
      </label>

      {/* step indicator */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20 }}>
        {[...PRESCRIBED_EXERCISES.map((e) => e.exerciseName), "Review"].map((label, i) => (
          <div
            key={label}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= step ? "#111" : "#e5e5e5",
            }}
            title={label}
          />
        ))}
      </div>

      {!isReview && currentExercise && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 20 }}>
          <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>
            Exercise {step + 1} of {PRESCRIBED_EXERCISES.length}
          </div>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>{currentExercise.exerciseName}</h2>
          {currentExercise.sets.map((set) => {
            const entry = entries[currentExercise.exerciseId]![set.setNumber]!;
            return (
              <div key={set.setNumber} style={{ marginBottom: 14 }}>
                <div style={{ fontSize: 12, color: "#666", marginBottom: 4 }}>
                  Set {set.setNumber} — prescribed {set.prescribedWeightKg}kg × {set.repTarget}
                  {set.countsTowardOneRm && " ⭐"}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    value={entry.actualWeightKg}
                    onChange={(e) => updateSet(currentExercise.exerciseId, set.setNumber, "actualWeightKg", e.target.value)}
                    placeholder="kg"
                    style={{ width: 70, padding: 6 }}
                  />
                  <input
                    type="number"
                    value={entry.repsAchieved}
                    onChange={(e) => updateSet(currentExercise.exerciseId, set.setNumber, "repsAchieved", e.target.value)}
                    placeholder="reps"
                    style={{ width: 70, padding: 6 }}
                  />
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={entry.rpe}
                    onChange={(e) => updateSet(currentExercise.exerciseId, set.setNumber, "rpe", e.target.value)}
                    placeholder="RPE"
                    style={{ width: 70, padding: 6 }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isReview && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 20 }}>
          <h2 style={{ fontSize: 18, marginBottom: 16 }}>Review</h2>
          {PRESCRIBED_EXERCISES.map((ex) => (
            <div key={ex.exerciseId} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{ex.exerciseName}</div>
              {ex.sets.map((set) => {
                const entry = entries[ex.exerciseId]![set.setNumber]!;
                return (
                  <div key={set.setNumber} style={{ fontSize: 13, color: "#444" }}>
                    Set {set.setNumber}: {entry.actualWeightKg || "—"}kg × {entry.repsAchieved || "—"}
                    {entry.rpe !== "" && ` @ RPE ${entry.rpe}`}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
        <button
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #ccc", background: "#fff", cursor: "pointer" }}
        >
          Back
        </button>
        {!isReview ? (
          <button
            onClick={() => setStep((s) => s + 1)}
            style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#111", color: "#fff", cursor: "pointer" }}
          >
            Next
          </button>
        ) : (
          <button
            style={{ padding: "8px 16px", borderRadius: 6, border: "none", background: "#16a34a", color: "#fff", cursor: "pointer" }}
          >
            Save session
          </button>
        )}
      </div>
    </div>
  );
}

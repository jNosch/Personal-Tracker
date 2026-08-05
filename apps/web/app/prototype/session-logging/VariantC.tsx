"use client";

// PROTOTYPE VARIANT C — "Dense spreadsheet table"
// Every set across every exercise is one row in a single compact table, edited inline.
// Minimal chrome, high information density — suited to a power user backfilling several
// missed days of entry at once rather than reviewing one session leisurely.

import { useState } from "react";
import { PRESCRIBED_DAY, PRESCRIBED_EXERCISES, initialEntryState, type EntryState } from "./data";

export default function VariantC() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [entries, setEntries] = useState<EntryState>(initialEntryState());

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

  const rows = PRESCRIBED_EXERCISES.flatMap((ex) => ex.sets.map((set) => ({ ex, set })));

  return (
    <div style={{ padding: 24, fontFamily: "monospace", fontSize: 13, maxWidth: 780, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <div>
          <span style={{ color: "#666" }}>{PRESCRIBED_DAY.programName} — </span>
          <strong>{PRESCRIBED_DAY.dayLabel}</strong>
        </div>
        <label>
          date{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: "2px 4px", fontFamily: "monospace" }}
          />
        </label>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #111", textAlign: "left" }}>
            <th style={{ padding: "4px 8px 4px 0" }}>exercise</th>
            <th style={{ padding: "4px 8px" }}>#</th>
            <th style={{ padding: "4px 8px" }}>prescribed</th>
            <th style={{ padding: "4px 8px" }}>weight</th>
            <th style={{ padding: "4px 8px" }}>reps</th>
            <th style={{ padding: "4px 8px" }}>rpe</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ ex, set }, i) => {
            const entry = entries[ex.exerciseId]![set.setNumber]!;
            const isFirstSetOfExercise = set.setNumber === 1;
            return (
              <tr key={`${ex.exerciseId}-${set.setNumber}`} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "3px 8px 3px 0", color: isFirstSetOfExercise ? "#111" : "#ccc" }}>
                  {isFirstSetOfExercise ? ex.exerciseName : ""}
                </td>
                <td style={{ padding: "3px 8px" }}>
                  {set.setNumber}
                  {set.countsTowardOneRm && "*"}
                </td>
                <td style={{ padding: "3px 8px", color: "#999" }}>
                  {set.prescribedWeightKg}×{set.repTarget}
                </td>
                <td style={{ padding: "3px 8px" }}>
                  <input
                    type="number"
                    value={entry.actualWeightKg}
                    onChange={(e) => updateSet(ex.exerciseId, set.setNumber, "actualWeightKg", e.target.value)}
                    style={{ width: 50, padding: 2, fontFamily: "monospace", border: "1px solid #ccc" }}
                  />
                </td>
                <td style={{ padding: "3px 8px" }}>
                  <input
                    type="number"
                    value={entry.repsAchieved}
                    onChange={(e) => updateSet(ex.exerciseId, set.setNumber, "repsAchieved", e.target.value)}
                    style={{ width: 44, padding: 2, fontFamily: "monospace", border: "1px solid #ccc" }}
                  />
                </td>
                <td style={{ padding: "3px 8px" }}>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={entry.rpe}
                    onChange={(e) => updateSet(ex.exerciseId, set.setNumber, "rpe", e.target.value)}
                    style={{ width: 36, padding: 2, fontFamily: "monospace", border: "1px solid #ccc" }}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div style={{ marginTop: 6, fontSize: 11, color: "#999" }}>* counts toward 1RM</div>

      <button
        style={{
          marginTop: 16,
          padding: "6px 16px",
          background: "#111",
          color: "#fff",
          border: "none",
          fontFamily: "monospace",
          cursor: "pointer",
        }}
      >
        save
      </button>
    </div>
  );
}

"use client";

// PROTOTYPE VARIANT D — "Full session form, simplified" (synthesis of A + C)
// A's structure — whole session on one page, sectioned by exercise, single save action —
// with C's visual density: compact rows, minimal chrome, small monospace-leaning type
// instead of A's roomier card padding and full table headers.

import { useState } from "react";
import { PRESCRIBED_DAY, PRESCRIBED_EXERCISES, initialEntryState, type EntryState } from "./data";

export default function VariantD() {
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

  return (
    <div style={{ padding: 20, fontFamily: "monospace", fontSize: 13, maxWidth: 620, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 }}>
        <div>
          <span style={{ color: "#999" }}>{PRESCRIBED_DAY.programName} — </span>
          <strong>{PRESCRIBED_DAY.dayLabel}</strong>
        </div>
        <label>
          date{" "}
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ padding: "2px 4px", fontFamily: "monospace", border: "1px solid #ccc" }}
          />
        </label>
      </div>

      {PRESCRIBED_EXERCISES.map((ex) => (
        <div key={ex.exerciseId} style={{ marginBottom: 18 }}>
          <div style={{ fontWeight: 700, marginBottom: 4, borderBottom: "1px solid #111", paddingBottom: 2 }}>
            {ex.exerciseName}
          </div>
          {ex.sets.map((set) => {
            const entry = entries[ex.exerciseId]![set.setNumber]!;
            return (
              <div
                key={set.setNumber}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "3px 0", borderBottom: "1px solid #f0f0f0" }}
              >
                <span style={{ width: 16, color: "#666" }}>
                  {set.setNumber}
                  {set.countsTowardOneRm && "*"}
                </span>
                <span style={{ width: 90, color: "#999" }}>
                  {set.prescribedWeightKg}×{set.repTarget}
                </span>
                <input
                  type="number"
                  value={entry.actualWeightKg}
                  onChange={(e) => updateSet(ex.exerciseId, set.setNumber, "actualWeightKg", e.target.value)}
                  placeholder="kg"
                  style={{ width: 50, padding: 2, fontFamily: "monospace", border: "1px solid #ccc" }}
                />
                <input
                  type="number"
                  value={entry.repsAchieved}
                  onChange={(e) => updateSet(ex.exerciseId, set.setNumber, "repsAchieved", e.target.value)}
                  placeholder="reps"
                  style={{ width: 46, padding: 2, fontFamily: "monospace", border: "1px solid #ccc" }}
                />
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={entry.rpe}
                  onChange={(e) => updateSet(ex.exerciseId, set.setNumber, "rpe", e.target.value)}
                  placeholder="rpe"
                  style={{ width: 40, padding: 2, fontFamily: "monospace", border: "1px solid #ccc" }}
                />
              </div>
            );
          })}
        </div>
      ))}

      <div style={{ fontSize: 11, color: "#999", marginBottom: 12 }}>* counts toward 1RM</div>

      <button
        style={{
          padding: "6px 16px",
          background: "#111",
          color: "#fff",
          border: "none",
          fontFamily: "monospace",
          cursor: "pointer",
        }}
      >
        save session
      </button>
    </div>
  );
}

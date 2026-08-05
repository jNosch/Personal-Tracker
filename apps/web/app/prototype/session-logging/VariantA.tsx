"use client";

// PROTOTYPE VARIANT A — "Full session form"
// The whole day's exercises are laid out on one page, each as a card with its sets as
// rows in a mini-table. One "Save session" action at the bottom. Suited to entering a
// whole session's data in one sitting after training (this is retrospective entry, not
// live in-gym logging).

import { useState } from "react";
import { PRESCRIBED_DAY, PRESCRIBED_EXERCISES, initialEntryState, type EntryState } from "./data";

export default function VariantA() {
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
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto" }}>
      <div style={{ marginBottom: 4, fontSize: 13, color: "#666" }}>{PRESCRIBED_DAY.programName}</div>
      <h1 style={{ fontSize: 20, marginBottom: 12 }}>{PRESCRIBED_DAY.dayLabel}</h1>
      <label style={{ display: "block", fontSize: 13, color: "#666", marginBottom: 20 }}>
        Session date{" "}
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ marginLeft: 8, padding: "2px 6px" }}
        />
      </label>

      {PRESCRIBED_EXERCISES.map((ex) => (
        <div key={ex.exerciseId} style={{ border: "1px solid #e5e5e5", borderRadius: 8, padding: 16, marginBottom: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 12 }}>{ex.exerciseName}</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ color: "#666", textAlign: "left" }}>
                <th style={{ paddingBottom: 6 }}>Set</th>
                <th style={{ paddingBottom: 6 }}>Prescribed</th>
                <th style={{ paddingBottom: 6 }}>Weight (kg)</th>
                <th style={{ paddingBottom: 6 }}>Reps</th>
                <th style={{ paddingBottom: 6 }}>RPE</th>
              </tr>
            </thead>
            <tbody>
              {ex.sets.map((set) => {
                const entry = entries[ex.exerciseId]![set.setNumber]!;
                return (
                  <tr key={set.setNumber}>
                    <td style={{ padding: "6px 0" }}>
                      {set.setNumber}
                      {set.countsTowardOneRm && <span title="Counts toward 1RM"> ⭐</span>}
                    </td>
                    <td style={{ padding: "6px 0", color: "#666" }}>
                      {set.prescribedWeightKg}kg × {set.repTarget}
                    </td>
                    <td style={{ padding: "6px 4px" }}>
                      <input
                        type="number"
                        value={entry.actualWeightKg}
                        onChange={(e) => updateSet(ex.exerciseId, set.setNumber, "actualWeightKg", e.target.value)}
                        style={{ width: 64, padding: 4 }}
                      />
                    </td>
                    <td style={{ padding: "6px 4px" }}>
                      <input
                        type="number"
                        placeholder={set.repTarget === "AMRAP" ? "AMRAP" : String(set.repTarget)}
                        value={entry.repsAchieved}
                        onChange={(e) => updateSet(ex.exerciseId, set.setNumber, "repsAchieved", e.target.value)}
                        style={{ width: 56, padding: 4 }}
                      />
                    </td>
                    <td style={{ padding: "6px 4px" }}>
                      <input
                        type="number"
                        placeholder="—"
                        min={1}
                        max={10}
                        value={entry.rpe}
                        onChange={(e) => updateSet(ex.exerciseId, set.setNumber, "rpe", e.target.value)}
                        style={{ width: 48, padding: 4 }}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}

      <button
        style={{
          padding: "10px 20px",
          background: "#111",
          color: "#fff",
          border: "none",
          borderRadius: 6,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        Save session
      </button>
    </div>
  );
}

"use client";

// PROTOTYPE VARIANT C — "Dense grid overview + modal wizard"
// The whole program is one compact table (day × exercise × scheme), everything visible
// at a glance. Editing never happens inline — clicking a row (or "+ add") opens a modal
// wizard: pick/create an exercise, then pick + configure its scheme, then confirm.

import { useState } from "react";
import {
  EXERCISE_LIBRARY,
  SCHEME_CATALOG,
  sampleProgram,
  defaultConfigFor,
  type Exercise,
  type SchemeConfig,
  type SchemeType,
} from "./data";
import SchemeConfigFields from "./SchemeConfigFields";

let dayCounter = 100;
let exerciseCounter = 100;

interface ModalState {
  dayId: string;
  exerciseId: string | null; // null = adding new row
  exercisePick: string;
  isNewExercise: boolean;
  newName: string;
  newBw: boolean;
  newTracks1rm: boolean;
  scheme: SchemeConfig;
}

export default function VariantC() {
  const [library, setLibrary] = useState<Exercise[]>(EXERCISE_LIBRARY);
  const [program, setProgram] = useState(sampleProgram());
  const [modal, setModal] = useState<ModalState | null>(null);

  function addDay() {
    const id = `day${dayCounter++}`;
    setProgram((p) => ({ ...p, days: [...p.days, { id, label: `Day ${p.days.length + 1}`, exercises: [] }] }));
  }

  function openAddModal(dayId: string) {
    setModal({
      dayId,
      exerciseId: null,
      exercisePick: library[0]?.id ?? "",
      isNewExercise: false,
      newName: "",
      newBw: false,
      newTracks1rm: false,
      scheme: defaultConfigFor("double_progression"),
    });
  }

  function openEditModal(dayId: string, exerciseId: string, scheme: SchemeConfig) {
    setModal({
      dayId,
      exerciseId,
      exercisePick: exerciseId,
      isNewExercise: false,
      newName: "",
      newBw: false,
      newTracks1rm: false,
      scheme,
    });
  }

  function confirmModal() {
    if (!modal) return;
    let exerciseId = modal.exercisePick;
    if (modal.isNewExercise && modal.newName.trim()) {
      const id = `ex${exerciseCounter++}`;
      setLibrary((l) => [...l, { id, name: modal.newName.trim(), isBodyweightBased: modal.newBw, tracksOneRm: modal.newTracks1rm }]);
      exerciseId = id;
    }
    setProgram((p) => ({
      ...p,
      days: p.days.map((d) => {
        if (d.id !== modal.dayId) return d;
        if (modal.exerciseId) {
          // editing existing row
          return { ...d, exercises: d.exercises.map((x) => (x.exerciseId === modal.exerciseId ? { exerciseId, scheme: modal.scheme } : x)) };
        }
        return { ...d, exercises: [...d.exercises, { exerciseId, scheme: modal.scheme }] };
      }),
    }));
    setModal(null);
  }

  const rows = program.days.flatMap((day) => (day.exercises.length ? day.exercises.map((ex, i) => ({ day, ex, isFirst: i === 0 })) : [{ day, ex: null, isFirst: true }]));

  return (
    <div style={{ padding: 20, fontFamily: "monospace", fontSize: 13, maxWidth: 720, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 12 }}>
        <strong>{program.name}</strong>
        <button onClick={addDay} style={btnStyle}>
          + day
        </button>
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ borderBottom: "2px solid #111", textAlign: "left" }}>
            <th style={{ padding: "4px 8px 4px 0" }}>day</th>
            <th style={{ padding: "4px 8px" }}>exercise</th>
            <th style={{ padding: "4px 8px" }}>scheme</th>
            <th style={{ padding: "4px 8px" }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ day, ex, isFirst }, i) => {
            const def = ex ? library.find((e) => e.id === ex.exerciseId)! : null;
            const schemeLabel = ex ? SCHEME_CATALOG.find((s) => s.type === ex.scheme.type)!.label : "";
            return (
              <tr key={`${day.id}-${ex?.exerciseId ?? "empty"}-${i}`} style={{ borderBottom: "1px solid #eee" }}>
                <td style={{ padding: "3px 8px 3px 0", color: isFirst ? "#111" : "#ccc" }}>{isFirst ? day.label : ""}</td>
                <td style={{ padding: "3px 8px" }}>{def ? def.name : <span style={{ color: "#999" }}>—</span>}</td>
                <td style={{ padding: "3px 8px", color: "#666" }}>{schemeLabel}</td>
                <td style={{ padding: "3px 8px" }}>
                  {ex ? (
                    <button onClick={() => openEditModal(day.id, ex.exerciseId, ex.scheme)} style={linkBtn}>
                      edit
                    </button>
                  ) : (
                    <button onClick={() => openAddModal(day.id)} style={linkBtn}>
                      + add
                    </button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {program.days.map((day) =>
        day.exercises.length ? (
          <div key={day.id} style={{ marginTop: 4 }}>
            <button onClick={() => openAddModal(day.id)} style={linkBtn}>
              + add to {day.label}
            </button>
          </div>
        ) : null,
      )}

      {modal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 1000,
          }}
        >
          <div style={{ background: "#fff", borderRadius: 8, padding: 20, width: 380, fontFamily: "sans-serif", maxHeight: "80vh", overflowY: "auto" }}>
            <h2 style={{ fontSize: 16, marginBottom: 12 }}>{modal.exerciseId ? "Edit exercise" : "Add exercise"}</h2>

            {!modal.exerciseId && (
              <div style={{ marginBottom: 14 }}>
                <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 13 }}>
                  <label>
                    <input type="radio" checked={!modal.isNewExercise} onChange={() => setModal({ ...modal, isNewExercise: false })} /> existing
                  </label>
                  <label>
                    <input type="radio" checked={modal.isNewExercise} onChange={() => setModal({ ...modal, isNewExercise: true })} /> new
                  </label>
                </div>
                {!modal.isNewExercise ? (
                  <select value={modal.exercisePick} onChange={(e) => setModal({ ...modal, exercisePick: e.target.value })}>
                    {library.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div>
                    <input
                      type="text"
                      placeholder="Exercise name"
                      value={modal.newName}
                      onChange={(e) => setModal({ ...modal, newName: e.target.value })}
                      style={{ padding: 4, marginBottom: 6, display: "block" }}
                    />
                    <label style={{ fontSize: 12, marginRight: 12 }}>
                      <input type="checkbox" checked={modal.newBw} onChange={(e) => setModal({ ...modal, newBw: e.target.checked })} /> bodyweight-based
                    </label>
                    <label style={{ fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={modal.newTracks1rm}
                        onChange={(e) => setModal({ ...modal, newTracks1rm: e.target.checked })}
                      />{" "}
                      tracks 1RM
                    </label>
                  </div>
                )}
              </div>
            )}

            <div style={{ marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>Scheme</span>
              <select
                value={modal.scheme.type}
                onChange={(e) => setModal({ ...modal, scheme: defaultConfigFor(e.target.value as SchemeType) })}
              >
                {SCHEME_CATALOG.map((s) => (
                  <option key={s.type} value={s.type}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <SchemeConfigFields scheme={modal.scheme} onChange={(next) => setModal({ ...modal, scheme: next })} />

            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button onClick={confirmModal} style={btnStyle}>
                Confirm
              </button>
              <button onClick={() => setModal(null)} style={{ ...btnStyle, background: "#fff", color: "#111", border: "1px solid #ccc" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnStyle = {
  padding: "6px 14px",
  fontSize: 12,
  borderRadius: 5,
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
  fontFamily: "sans-serif",
};

const linkBtn = {
  fontSize: 11,
  color: "#2563eb",
  background: "none",
  border: "none",
  cursor: "pointer",
  padding: 0,
};

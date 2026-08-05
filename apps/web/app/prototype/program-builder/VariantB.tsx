"use client";

// PROTOTYPE VARIANT B — "Master-detail, three panes"
// Days in the left column, the selected day's exercises in the middle column, the
// selected exercise's scheme picker + config in the right column. Focused, one thing
// visible in depth at a time, no accordions to expand/collapse.

import { useState } from "react";
import {
  EXERCISE_LIBRARY,
  SCHEME_CATALOG,
  sampleProgram,
  defaultConfigFor,
  type Exercise,
  type SchemeType,
} from "./data";
import SchemeConfigFields from "./SchemeConfigFields";

let dayCounter = 100;
let exerciseCounter = 100;

export default function VariantB() {
  const [library, setLibrary] = useState<Exercise[]>(EXERCISE_LIBRARY);
  const [program, setProgram] = useState(sampleProgram());
  const [selectedDayId, setSelectedDayId] = useState(program.days[0]!.id);
  const [selectedExerciseId, setSelectedExerciseId] = useState<string | null>(
    program.days[0]!.exercises[0]?.exerciseId ?? null,
  );
  const [adding, setAdding] = useState(false);

  const selectedDay = program.days.find((d) => d.id === selectedDayId)!;
  const selectedExercise = selectedDay.exercises.find((e) => e.exerciseId === selectedExerciseId);
  const exerciseDef = selectedExercise ? library.find((e) => e.id === selectedExercise.exerciseId)! : null;

  function addDay() {
    const id = `day${dayCounter++}`;
    setProgram((p) => ({ ...p, days: [...p.days, { id, label: `Day ${p.days.length + 1}`, exercises: [] }] }));
    setSelectedDayId(id);
    setSelectedExerciseId(null);
  }

  function updateSelectedExerciseScheme(next: import("./data").SchemeConfig) {
    setProgram((p) => ({
      ...p,
      days: p.days.map((d) =>
        d.id !== selectedDayId
          ? d
          : { ...d, exercises: d.exercises.map((x) => (x.exerciseId === selectedExerciseId ? { ...x, scheme: next } : x)) },
      ),
    }));
  }

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "sans-serif" }}>
      {/* Column 1: days */}
      <div style={{ width: 200, borderRight: "1px solid #e5e5e5", padding: 16, flexShrink: 0, overflowY: "auto" }}>
        <div style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>{program.name}</div>
        <h2 style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>Days</h2>
        {program.days.map((d) => (
          <div
            key={d.id}
            onClick={() => {
              setSelectedDayId(d.id);
              setSelectedExerciseId(d.exercises[0]?.exerciseId ?? null);
            }}
            style={{
              padding: "6px 8px",
              borderRadius: 5,
              cursor: "pointer",
              fontSize: 13,
              marginBottom: 2,
              background: d.id === selectedDayId ? "#f0f0f0" : "transparent",
              fontWeight: d.id === selectedDayId ? 600 : 400,
            }}
          >
            {d.label}
          </div>
        ))}
        <button onClick={addDay} style={{ ...btnStyle, marginTop: 8, width: "100%" }}>
          + Add day
        </button>
      </div>

      {/* Column 2: exercises in selected day */}
      <div style={{ width: 220, borderRight: "1px solid #e5e5e5", padding: 16, flexShrink: 0, overflowY: "auto" }}>
        <h2 style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>{selectedDay.label}</h2>
        {selectedDay.exercises.map((ex) => {
          const def = library.find((e) => e.id === ex.exerciseId)!;
          return (
            <div
              key={ex.exerciseId}
              onClick={() => setSelectedExerciseId(ex.exerciseId)}
              style={{
                padding: "6px 8px",
                borderRadius: 5,
                cursor: "pointer",
                fontSize: 13,
                marginBottom: 2,
                background: ex.exerciseId === selectedExerciseId ? "#f0f0f0" : "transparent",
                fontWeight: ex.exerciseId === selectedExerciseId ? 600 : 400,
              }}
            >
              {def.name}
            </div>
          );
        })}
        {adding ? (
          <AddExerciseForm
            library={library}
            onCreateExercise={(ex) => setLibrary((l) => [...l, ex])}
            onAdd={(exerciseId) => {
              setProgram((p) => ({
                ...p,
                days: p.days.map((d) =>
                  d.id !== selectedDayId
                    ? d
                    : { ...d, exercises: [...d.exercises, { exerciseId, scheme: defaultConfigFor("double_progression") }] },
                ),
              }));
              setSelectedExerciseId(exerciseId);
              setAdding(false);
            }}
            onCancel={() => setAdding(false)}
          />
        ) : (
          <button onClick={() => setAdding(true)} style={{ ...btnStyle, marginTop: 8, width: "100%" }}>
            + Add exercise
          </button>
        )}
      </div>

      {/* Column 3: scheme detail */}
      <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
        {exerciseDef && selectedExercise ? (
          <>
            <h1 style={{ fontSize: 18, marginBottom: 12 }}>{exerciseDef.name}</h1>
            <div style={{ marginBottom: 16 }}>
              <span style={{ fontSize: 12, color: "#666", marginRight: 8 }}>Scheme</span>
              <select
                value={selectedExercise.scheme.type}
                onChange={(e) => updateSelectedExerciseScheme(defaultConfigFor(e.target.value as SchemeType))}
              >
                {SCHEME_CATALOG.map((s) => (
                  <option key={s.type} value={s.type} disabled={s.requiresOneRm && !exerciseDef.tracksOneRm}>
                    {s.label}
                    {s.requiresOneRm && !exerciseDef.tracksOneRm ? " (needs tracks_1rm)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <SchemeConfigFields scheme={selectedExercise.scheme} onChange={updateSelectedExerciseScheme} />
          </>
        ) : (
          <div style={{ color: "#999", fontSize: 13 }}>Select or add an exercise to configure its scheme.</div>
        )}
      </div>
    </div>
  );
}

function AddExerciseForm({
  library,
  onCreateExercise,
  onAdd,
  onCancel,
}: {
  library: Exercise[];
  onCreateExercise: (ex: Exercise) => void;
  onAdd: (exerciseId: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selected, setSelected] = useState(library[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [newBw, setNewBw] = useState(false);
  const [newTracks1rm, setNewTracks1rm] = useState(false);

  return (
    <div style={{ border: "1px dashed #ccc", borderRadius: 6, padding: 10, marginTop: 8, fontSize: 12 }}>
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <label>
          <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} /> existing
        </label>
        <label>
          <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} /> new
        </label>
      </div>
      {mode === "existing" ? (
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ marginBottom: 6, width: "100%" }}>
          {library.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>
      ) : (
        <div style={{ marginBottom: 6 }}>
          <input
            type="text"
            placeholder="name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ padding: 4, marginBottom: 4, width: "100%" }}
          />
          <label style={{ marginRight: 8 }}>
            <input type="checkbox" checked={newBw} onChange={(e) => setNewBw(e.target.checked)} /> bodyweight
          </label>
          <label>
            <input type="checkbox" checked={newTracks1rm} onChange={(e) => setNewTracks1rm(e.target.checked)} /> tracks 1RM
          </label>
        </div>
      )}
      <div style={{ display: "flex", gap: 6 }}>
        <button
          style={btnStyle}
          onClick={() => {
            if (mode === "existing") {
              onAdd(selected);
            } else if (newName.trim()) {
              const id = `ex${exerciseCounter++}`;
              onCreateExercise({ id, name: newName.trim(), isBodyweightBased: newBw, tracksOneRm: newTracks1rm });
              onAdd(id);
            }
          }}
        >
          Add
        </button>
        <button onClick={onCancel} style={{ ...btnStyle, background: "#fff", color: "#111", border: "1px solid #ccc" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const btnStyle = {
  padding: "6px 12px",
  fontSize: 12,
  borderRadius: 5,
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

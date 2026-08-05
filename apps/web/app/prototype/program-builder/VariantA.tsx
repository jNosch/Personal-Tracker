"use client";

// PROTOTYPE VARIANT A — "Single-page nested accordion"
// The whole program editor lives on one page: days stack vertically, each expandable to
// reveal its exercises, each exercise expandable inline to reveal its scheme picker and
// config. Everything happens in place, nothing navigates away.

import { useState } from "react";
import {
  EXERCISE_LIBRARY,
  SCHEME_CATALOG,
  OTHER_PROGRAMS,
  sampleProgram,
  defaultConfigFor,
  type Exercise,
  type DayTemplate,
  type SchemeType,
} from "./data";
import SchemeConfigFields from "./SchemeConfigFields";

let dayCounter = 100;
let exerciseCounter = 100;

export default function VariantA() {
  const [library, setLibrary] = useState<Exercise[]>(EXERCISE_LIBRARY);
  const [program, setProgram] = useState(sampleProgram());
  const [expandedDay, setExpandedDay] = useState<string | null>("day1");
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [addingToDay, setAddingToDay] = useState<string | null>(null);

  function addDay() {
    const id = `day${dayCounter++}`;
    setProgram((p) => ({ ...p, days: [...p.days, { id, label: `Day ${p.days.length + 1}`, exercises: [] }] }));
    setExpandedDay(id);
  }

  function removeDay(dayId: string) {
    setProgram((p) => ({ ...p, days: p.days.filter((d) => d.id !== dayId) }));
  }

  function updateDay(dayId: string, next: DayTemplate) {
    setProgram((p) => ({ ...p, days: p.days.map((d) => (d.id === dayId ? next : d)) }));
  }

  return (
    <div style={{ padding: 24, fontFamily: "sans-serif", maxWidth: 720, margin: "0 auto" }}>
      <ProgramSwitcher program={program} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", margin: "20px 0 12px" }}>
        <h2 style={{ fontSize: 16 }}>Days ({program.days.length})</h2>
        <button onClick={addDay} style={btnStyle}>
          + Add day
        </button>
      </div>

      {program.days.map((day) => (
        <div key={day.id} style={{ border: "1px solid #e5e5e5", borderRadius: 8, marginBottom: 10 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              cursor: "pointer",
              background: "#fafafa",
            }}
            onClick={() => setExpandedDay(expandedDay === day.id ? null : day.id)}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>
              {expandedDay === day.id ? "▾" : "▸"} {day.label}{" "}
              <span style={{ fontWeight: 400, color: "#999" }}>({day.exercises.length} exercises)</span>
            </span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeDay(day.id);
              }}
              style={{ fontSize: 11, color: "#dc2626", background: "none", border: "none", cursor: "pointer" }}
            >
              remove day
            </button>
          </div>

          {expandedDay === day.id && (
            <div style={{ padding: 14 }}>
              {day.exercises.map((ex) => {
                const exerciseDef = library.find((e) => e.id === ex.exerciseId)!;
                const key = `${day.id}-${ex.exerciseId}`;
                const schemeLabel = SCHEME_CATALOG.find((s) => s.type === ex.scheme.type)!.label;
                return (
                  <div key={key} style={{ border: "1px solid #eee", borderRadius: 6, marginBottom: 8 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        cursor: "pointer",
                      }}
                      onClick={() => setExpandedExercise(expandedExercise === key ? null : key)}
                    >
                      <span style={{ fontSize: 13 }}>
                        {expandedExercise === key ? "▾" : "▸"} <strong>{exerciseDef.name}</strong>{" "}
                        <span style={{ color: "#999" }}>— {schemeLabel}</span>
                      </span>
                    </div>
                    {expandedExercise === key && (
                      <div style={{ padding: "0 12px 12px" }}>
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ fontSize: 12, color: "#666", marginRight: 8 }}>Scheme</span>
                          <select
                            value={ex.scheme.type}
                            onChange={(e) => {
                              const type = e.target.value as SchemeType;
                              const next = { ...day, exercises: day.exercises.map((x) => (x.exerciseId === ex.exerciseId ? { ...x, scheme: defaultConfigFor(type) } : x)) };
                              updateDay(day.id, next);
                            }}
                          >
                            {SCHEME_CATALOG.map((s) => (
                              <option key={s.type} value={s.type} disabled={s.requiresOneRm && !exerciseDef.tracksOneRm}>
                                {s.label}
                                {s.requiresOneRm && !exerciseDef.tracksOneRm ? " (needs tracks_1rm)" : ""}
                              </option>
                            ))}
                          </select>
                        </div>
                        <SchemeConfigFields
                          scheme={ex.scheme}
                          onChange={(next) => {
                            const nextDay = {
                              ...day,
                              exercises: day.exercises.map((x) => (x.exerciseId === ex.exerciseId ? { ...x, scheme: next } : x)),
                            };
                            updateDay(day.id, nextDay);
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}

              {addingToDay === day.id ? (
                <AddExerciseForm
                  library={library}
                  onCreateExercise={(ex) => setLibrary((l) => [...l, ex])}
                  onAdd={(exerciseId) => {
                    updateDay(day.id, {
                      ...day,
                      exercises: [...day.exercises, { exerciseId, scheme: defaultConfigFor("double_progression") }],
                    });
                    setAddingToDay(null);
                  }}
                  onCancel={() => setAddingToDay(null)}
                />
              ) : (
                <button onClick={() => setAddingToDay(day.id)} style={btnStyle}>
                  + Add exercise
                </button>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ProgramSwitcher({ program }: { program: { name: string } }) {
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div>
          <div style={{ fontSize: 12, color: "#999" }}>Editing program</div>
          <h1 style={{ fontSize: 20 }}>{program.name}</h1>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button style={btnStyle}>Clone</button>
          <button style={btnStyle}>Archive</button>
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#999", marginTop: 4 }}>
        Other programs: {OTHER_PROGRAMS.map((p) => p.name).join(", ")} — <a href="#">new program</a>
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
    <div style={{ border: "1px dashed #ccc", borderRadius: 6, padding: 12, marginTop: 4 }}>
      <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 13 }}>
        <label>
          <input type="radio" checked={mode === "existing"} onChange={() => setMode("existing")} /> Existing exercise
        </label>
        <label>
          <input type="radio" checked={mode === "new"} onChange={() => setMode("new")} /> New exercise
        </label>
      </div>

      {mode === "existing" ? (
        <select value={selected} onChange={(e) => setSelected(e.target.value)} style={{ marginBottom: 8 }}>
          <optgroup label="Main lifts">
            {library
              .filter((ex) => ex.tracksOneRm)
              .map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
          </optgroup>
          <optgroup label="Isolation / supplement">
            {library
              .filter((ex) => !ex.tracksOneRm)
              .map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.name}
                </option>
              ))}
          </optgroup>
        </select>
      ) : (
        <div style={{ marginBottom: 8 }}>
          <input
            type="text"
            placeholder="Exercise name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            style={{ padding: 4, marginBottom: 6, display: "block" }}
          />
          <label style={{ fontSize: 12, marginRight: 12 }}>
            <input type="checkbox" checked={newBw} onChange={(e) => setNewBw(e.target.checked)} /> bodyweight-based
          </label>
          <label style={{ fontSize: 12 }}>
            <input type="checkbox" checked={newTracks1rm} onChange={(e) => setNewTracks1rm(e.target.checked)} /> tracks
            1RM
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

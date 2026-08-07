"use client";

// Program Creator (#24) — single-page nested accordion, variant A from
// prototype/program-builder (#15's winning design). Adapted from the
// prototype's VariantA.tsx: real server actions instead of local-only
// state, plus day/exercise reorder controls and a real Activate/Archive
// (both out of scope for the throwaway prototype).
import Link from "next/link";
import { useState, useTransition } from "react";
import type { SchemeConfig } from "../../../lib/schemes";
import { SCHEME_CATALOG, defaultConfigFor } from "../../../lib/schemes";
import {
  addDayTemplate,
  addExerciseInDay,
  archiveDayTemplate,
  archiveExerciseInDay,
  archiveProgram,
  createExercise,
  renameDayTemplate,
  renameProgram,
  reorderDayTemplate,
  reorderExerciseInDay,
  setActiveProgram,
  updateExerciseScheme,
} from "../actions";
import SchemeConfigFields from "./SchemeConfigFields";

interface Exercise {
  id: string;
  name: string;
  isBodyweightBased: boolean;
  tracksOneRm: boolean;
}

interface ExerciseInDayView {
  id: string;
  exercise: Exercise;
  scheme: SchemeConfig;
}

interface DayView {
  id: string;
  label: string;
  exercises: ExerciseInDayView[];
}

interface ProgramView {
  id: string;
  name: string;
  isActive: boolean;
  isArchived: boolean;
}

export default function ProgramEditor({
  program,
  days,
  exerciseLibrary,
}: {
  program: ProgramView;
  days: DayView[];
  exerciseLibrary: Exercise[];
}) {
  const [expandedDay, setExpandedDay] = useState<string | null>(
    days[0]?.id ?? null,
  );
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null);
  const [addingToDay, setAddingToDay] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div
      style={{
        padding: 24,
        fontFamily: "sans-serif",
        maxWidth: 720,
        margin: "0 auto",
        opacity: isPending ? 0.6 : 1,
      }}
    >
      <Link
        href="/programs"
        style={{
          display: "inline-block",
          fontSize: 14,
          fontWeight: 600,
          color: "#fff",
          marginBottom: 8,
        }}
      >
        ← All Programs
      </Link>

      <ProgramHeader
        program={program}
        onActivate={() => startTransition(() => setActiveProgram(program.id))}
        onArchive={() => startTransition(() => archiveProgram(program.id))}
        onRename={(name) =>
          startTransition(() => renameProgram(program.id, name))
        }
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          margin: "20px 0 12px",
        }}
      >
        <h2 style={{ fontSize: 16 }}>Days ({days.length})</h2>
        <button
          onClick={() =>
            startTransition(async () => {
              const day = await addDayTemplate(program.id);
              setExpandedDay(day.id);
            })
          }
          style={btnStyle}
        >
          + Add day
        </button>
      </div>

      {days.map((day, dayIndex) => (
        <div
          key={day.id}
          style={{
            border: "1px solid #e5e5e5",
            borderRadius: 8,
            marginBottom: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 14px",
              cursor: "pointer",
              background: "#fafafa",
            }}
            onClick={() =>
              setExpandedDay(expandedDay === day.id ? null : day.id)
            }
          >
            <DayLabel
              day={day}
              expanded={expandedDay === day.id}
              onRename={(label) =>
                startTransition(() =>
                  renameDayTemplate(program.id, day.id, label),
                )
              }
            />
            <div
              style={{ display: "flex", gap: 4, alignItems: "center" }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() =>
                  startTransition(() =>
                    reorderDayTemplate(program.id, day.id, "up"),
                  )
                }
                disabled={dayIndex === 0}
                style={iconBtnStyle}
              >
                ↑
              </button>
              <button
                onClick={() =>
                  startTransition(() =>
                    reorderDayTemplate(program.id, day.id, "down"),
                  )
                }
                disabled={dayIndex === days.length - 1}
                style={iconBtnStyle}
              >
                ↓
              </button>
              <button
                onClick={() =>
                  startTransition(() => archiveDayTemplate(program.id, day.id))
                }
                style={{
                  fontSize: 11,
                  color: "#dc2626",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                }}
              >
                remove day
              </button>
            </div>
          </div>

          {expandedDay === day.id && (
            <div style={{ padding: 14 }}>
              {day.exercises.map((ex, exIndex) => {
                const key = ex.id;
                const schemeLabel = SCHEME_CATALOG.find(
                  (s) => s.type === ex.scheme.type,
                )!.label;
                return (
                  <div
                    key={key}
                    style={{
                      border: "1px solid #eee",
                      borderRadius: 6,
                      marginBottom: 8,
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        padding: "8px 12px",
                        cursor: "pointer",
                      }}
                      onClick={() =>
                        setExpandedExercise(
                          expandedExercise === key ? null : key,
                        )
                      }
                    >
                      <span style={{ fontSize: 13 }}>
                        {expandedExercise === key ? "▾" : "▸"}{" "}
                        <strong>{ex.exercise.name}</strong>{" "}
                        <span style={{ color: "#999" }}>— {schemeLabel}</span>
                      </span>
                      <div
                        style={{ display: "flex", gap: 4 }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() =>
                            startTransition(() =>
                              reorderExerciseInDay(
                                program.id,
                                day.id,
                                ex.id,
                                "up",
                              ),
                            )
                          }
                          disabled={exIndex === 0}
                          style={iconBtnStyle}
                        >
                          ↑
                        </button>
                        <button
                          onClick={() =>
                            startTransition(() =>
                              reorderExerciseInDay(
                                program.id,
                                day.id,
                                ex.id,
                                "down",
                              ),
                            )
                          }
                          disabled={exIndex === day.exercises.length - 1}
                          style={iconBtnStyle}
                        >
                          ↓
                        </button>
                        <button
                          onClick={() =>
                            startTransition(() =>
                              archiveExerciseInDay(program.id, ex.id),
                            )
                          }
                          style={{
                            fontSize: 11,
                            color: "#dc2626",
                            background: "none",
                            border: "none",
                            cursor: "pointer",
                          }}
                        >
                          remove
                        </button>
                      </div>
                    </div>
                    {expandedExercise === key && (
                      <ExercisePanel
                        programId={program.id}
                        exerciseInDay={ex}
                        onSave={() => setExpandedExercise(null)}
                        pending={isPending}
                        startTransition={startTransition}
                      />
                    )}
                  </div>
                );
              })}

              {addingToDay === day.id ? (
                <AddExerciseForm
                  library={exerciseLibrary}
                  onAdd={(exerciseId) => {
                    startTransition(() =>
                      addExerciseInDay(program.id, day.id, exerciseId),
                    );
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

function ProgramHeader({
  program,
  onActivate,
  onArchive,
  onRename,
}: {
  program: ProgramView;
  onActivate: () => void;
  onArchive: () => void;
  onRename: (name: string) => void;
}) {
  return (
    <div style={{ marginTop: 12 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
        }}
      >
        <div>
          <div style={{ fontSize: 12, color: "#999" }}>
            {program.isArchived
              ? "Archived program"
              : program.isActive
                ? "Active program"
                : "Editing program"}
          </div>
          <input
            key={program.id}
            defaultValue={program.name}
            onBlur={(e) =>
              e.target.value !== program.name && onRename(e.target.value)
            }
            style={{
              fontSize: 20,
              fontWeight: 700,
              border: "none",
              background: "transparent",
              padding: 0,
              width: "100%",
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {!program.isArchived && !program.isActive && (
            <button onClick={onActivate} style={btnStyle}>
              Activate
            </button>
          )}
          {!program.isArchived && (
            <button
              onClick={onArchive}
              style={{
                ...btnStyle,
                background: "#fff",
                color: "#dc2626",
                border: "1px solid #dc2626",
              }}
            >
              Archive
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function DayLabel({
  day,
  expanded,
  onRename,
}: {
  day: DayView;
  expanded: boolean;
  onRename: (label: string) => void;
}) {
  return (
    <span
      style={{
        fontWeight: 600,
        fontSize: 14,
        color: "#111",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {expanded ? "▾" : "▸"}
      <input
        key={day.id}
        defaultValue={day.label}
        onClick={(e) => e.stopPropagation()}
        onBlur={(e) => e.target.value !== day.label && onRename(e.target.value)}
        style={{
          fontWeight: 600,
          fontSize: 14,
          color: "#111",
          border: "none",
          background: "transparent",
          padding: 0,
          width: 160,
        }}
      />
      <span style={{ fontWeight: 400, color: "#999" }}>
        ({day.exercises.length} exercises)
      </span>
    </span>
  );
}

function ExercisePanel({
  programId,
  exerciseInDay,
  onSave,
  pending,
  startTransition,
}: {
  programId: string;
  exerciseInDay: ExerciseInDayView;
  onSave: () => void;
  pending: boolean;
  startTransition: (fn: () => void | Promise<void>) => void;
}) {
  const [draft, setDraft] = useState<SchemeConfig>(exerciseInDay.scheme);

  return (
    <div style={{ padding: "0 12px 12px" }}>
      <div style={{ marginBottom: 8 }}>
        <span style={{ fontSize: 12, color: "#666", marginRight: 8 }}>
          Scheme
        </span>
        <select
          value={draft.type}
          onChange={(e) =>
            setDraft(defaultConfigFor(e.target.value as SchemeConfig["type"]))
          }
        >
          {SCHEME_CATALOG.map((s) => (
            <option
              key={s.type}
              value={s.type}
              disabled={
                s.requiresTracksOneRm && !exerciseInDay.exercise.tracksOneRm
              }
            >
              {s.label}
              {s.requiresTracksOneRm && !exerciseInDay.exercise.tracksOneRm
                ? " (needs tracks_1rm)"
                : ""}
            </option>
          ))}
        </select>
      </div>
      <SchemeConfigFields scheme={draft} onChange={setDraft} />
      <button
        disabled={pending}
        onClick={() => {
          startTransition(() =>
            updateExerciseScheme(programId, exerciseInDay.id, draft),
          );
          onSave();
        }}
        style={btnStyle}
      >
        Save changes
      </button>
    </div>
  );
}

function AddExerciseForm({
  library,
  onAdd,
  onCancel,
}: {
  library: Exercise[];
  onAdd: (exerciseId: string) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selected, setSelected] = useState(library[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [newBw, setNewBw] = useState(false);
  const [newTracks1rm, setNewTracks1rm] = useState(false);
  const [creating, setCreating] = useState(false);

  return (
    <div
      style={{
        border: "1px dashed #ccc",
        borderRadius: 6,
        padding: 12,
        marginTop: 4,
      }}
    >
      <div style={{ display: "flex", gap: 12, marginBottom: 8, fontSize: 13 }}>
        <label>
          <input
            type="radio"
            checked={mode === "existing"}
            onChange={() => setMode("existing")}
          />{" "}
          Existing exercise
        </label>
        <label>
          <input
            type="radio"
            checked={mode === "new"}
            onChange={() => setMode("new")}
          />{" "}
          New exercise
        </label>
      </div>

      {mode === "existing" ? (
        library.length === 0 ? (
          <p style={{ fontSize: 12, color: "#999", marginBottom: 8 }}>
            No exercises yet — create one below.
          </p>
        ) : (
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            style={{ marginBottom: 8 }}
          >
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
        )
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
            <input
              type="checkbox"
              checked={newBw}
              onChange={(e) => setNewBw(e.target.checked)}
            />{" "}
            bodyweight-based
          </label>
          <label style={{ fontSize: 12 }}>
            <input
              type="checkbox"
              checked={newTracks1rm}
              onChange={(e) => setNewTracks1rm(e.target.checked)}
            />{" "}
            tracks 1RM
          </label>
        </div>
      )}

      <div style={{ display: "flex", gap: 6 }}>
        <button
          disabled={creating}
          style={btnStyle}
          onClick={async () => {
            if (mode === "existing") {
              if (selected) onAdd(selected);
              return;
            }
            if (!newName.trim()) return;
            setCreating(true);
            try {
              const exercise = await createExercise(
                newName,
                newBw,
                newTracks1rm,
              );
              onAdd(exercise.id);
            } finally {
              setCreating(false);
            }
          }}
        >
          Add
        </button>
        <button
          onClick={onCancel}
          style={{
            ...btnStyle,
            background: "#fff",
            color: "#111",
            border: "1px solid #ccc",
          }}
        >
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

const iconBtnStyle = {
  padding: "2px 8px",
  fontSize: 14,
  lineHeight: 1,
  color: "#111",
  borderRadius: 4,
  border: "1px solid #ddd",
  background: "#fff",
  cursor: "pointer",
};

"use client";

// Renders the config inputs for whichever scheme type is selected. Ported
// from prototype/program-builder's SchemeConfigFields.tsx (variant A, the
// decided design, #15) — same shapes, now against lib/schemes' real types
// instead of prototype fixtures.
import {
  defaultConfigFor,
  type SchemeConfig,
  type WaveWeekSet,
} from "../../../lib/schemes";
import {
  setStyleAt,
  styleAt,
  validSetStylePositions,
  type SetStyle,
  type SetStyleEntry,
} from "../../../lib/setStyles";

const numInput = (value: number, onChange: (v: number) => void, width = 56) => (
  <input
    type="number"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    style={{ width, padding: 4 }}
  />
);

const labelStyle = {
  fontSize: 12,
  color: "#666",
  display: "block",
  marginBottom: 2,
};
const field = { marginBottom: 10 };

// #66: one 3-state toggle per set — none / rest-pause / cluster, cycled by
// click rather than two independent checkboxes, since the two styles are
// mutually exclusive by design (opposite-intensity execution styles for
// one set, not stackable modifiers — see setStyles.ts's own comment on
// SetStyleEntry).
function SetStyleChip({
  value,
  onChange,
}: {
  value: SetStyle | null;
  onChange: (next: SetStyle | null) => void;
}) {
  function cycle() {
    onChange(
      value === null ? "rest_pause" : value === "rest_pause" ? "cluster" : null,
    );
  }
  const label =
    value === "rest_pause" ? "RP" : value === "cluster" ? "CS" : "—";
  const title =
    value === "rest_pause"
      ? "Rest-pause — click to change"
      : value === "cluster"
        ? "Cluster set — click to change"
        : "No style tag — click to cycle";
  return (
    <button
      type="button"
      onClick={cycle}
      title={title}
      style={{
        width: 28,
        height: 22,
        fontSize: 11,
        borderRadius: 4,
        border: `1px solid ${value ? "#111" : "#ddd"}`,
        background: value ? "#111" : "#fff",
        color: value ? "#fff" : "#999",
        cursor: "pointer",
      }}
    >
      {label}
    </button>
  );
}

// Shared by every flat-set-list scheme (Double Progression, Rep
// Accumulation, Top-set+Backoff) — Wave renders its own chips inline per
// week/set instead, since its positions need a weekIndex the other schemes
// don't have (see setStyles.ts's SetStyleEntry comment). Renders nothing
// for Failure Sets: validSetStylePositions returns no positions for it, so
// `positions` is empty and there's nothing to render — no scheme-type
// branching needed here, the exclusion falls out of that function.
function SetStyleRow({
  scheme,
  setStyles,
  onSetStylesChange,
}: {
  scheme: SchemeConfig;
  setStyles: SetStyleEntry[];
  onSetStylesChange: (next: SetStyleEntry[]) => void;
}) {
  const positions = validSetStylePositions(scheme);
  if (positions.length === 0) return null;
  return (
    <div style={field}>
      <span style={labelStyle}>Set styles (rest-pause / cluster)</span>
      <div style={{ display: "flex", gap: 8 }}>
        {positions.map((p) => (
          <div key={p.setNumber} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#999", marginBottom: 2 }}>
              {p.setNumber}
            </div>
            <SetStyleChip
              value={styleAt(setStyles, p.weekIndex, p.setNumber)}
              onChange={(next) =>
                onSetStylesChange(
                  setStyleAt(setStyles, p.weekIndex, p.setNumber, next),
                )
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function SchemeConfigFields({
  scheme,
  onChange,
  setStyles,
  onSetStylesChange,
}: {
  scheme: SchemeConfig;
  onChange: (next: SchemeConfig) => void;
  setStyles: SetStyleEntry[];
  onSetStylesChange: (next: SetStyleEntry[]) => void;
}) {
  if (scheme.type === "double_progression") {
    const c = scheme.config;
    const set = (patch: Partial<typeof c>) =>
      onChange({ type: "double_progression", config: { ...c, ...patch } });
    return (
      <div>
        <div style={field}>
          <span style={labelStyle}>Rep range</span>
          {numInput(c.repRangeLow, (v) => set({ repRangeLow: v }), 44)} –{" "}
          {numInput(c.repRangeHigh, (v) => set({ repRangeHigh: v }), 44)}
        </div>
        <div style={field}>
          <span style={labelStyle}>Set count</span>
          {numInput(c.setCount, (v) => set({ setCount: v }))}
        </div>
        <div style={field}>
          <span style={labelStyle}>Weight increment (kg)</span>
          {numInput(c.weightIncrement, (v) => set({ weightIncrement: v }))}
        </div>
        <div style={field}>
          <span style={labelStyle}>
            RPE-deload cut %{" "}
            <span style={{ color: "#bbb" }}>
              (#61 — one session after 3 red weeks)
            </span>
          </span>
          {numInput(c.deloadCutPercentage, (v) =>
            set({ deloadCutPercentage: v }),
          )}
        </div>
        <SetStyleRow
          scheme={scheme}
          setStyles={setStyles}
          onSetStylesChange={onSetStylesChange}
        />
      </div>
    );
  }

  if (scheme.type === "rep_accumulation") {
    const c = scheme.config;
    const set = (patch: Partial<typeof c>) =>
      onChange({ type: "rep_accumulation", config: { ...c, ...patch } });
    return (
      <div>
        <div style={field}>
          <span style={labelStyle}>Target total reps</span>
          {numInput(c.targetTotalReps, (v) => set({ targetTotalReps: v }))}
        </div>
        <div style={field}>
          <span style={labelStyle}>Set count</span>
          {numInput(c.setCount, (v) => set({ setCount: v }))}
        </div>
        <div style={field}>
          <span style={labelStyle}>Weight increment (kg)</span>
          {numInput(c.weightIncrement, (v) => set({ weightIncrement: v }))}
        </div>
        <SetStyleRow
          scheme={scheme}
          setStyles={setStyles}
          onSetStylesChange={onSetStylesChange}
        />
      </div>
    );
  }

  if (scheme.type === "topset_backoff") {
    const c = scheme.config;
    const set = (patch: Partial<typeof c>) =>
      onChange({ type: "topset_backoff", config: { ...c, ...patch } });
    return (
      <div>
        <div style={field}>
          <span style={labelStyle}>Top set rep range</span>
          {numInput(
            c.topSetRepRangeLow,
            (v) => set({ topSetRepRangeLow: v }),
            44,
          )}{" "}
          –{" "}
          {numInput(
            c.topSetRepRangeHigh,
            (v) => set({ topSetRepRangeHigh: v }),
            44,
          )}
        </div>
        <div style={field}>
          <span style={labelStyle}>Weight increment (kg)</span>
          {numInput(c.weightIncrement, (v) => set({ weightIncrement: v }))}
        </div>
        <div style={{ ...field, borderTop: "1px solid #eee", paddingTop: 8 }}>
          <span style={{ ...labelStyle, fontWeight: 600 }}>Back-off sets</span>
        </div>
        <div style={field}>
          <span style={labelStyle}>% of top-set weight</span>
          {numInput(c.backoffPercentage, (v) => set({ backoffPercentage: v }))}
        </div>
        <div style={field}>
          <span style={labelStyle}>Set count</span>
          {numInput(c.backoffSetCount, (v) => set({ backoffSetCount: v }))}
        </div>
        <div style={field}>
          <span style={labelStyle}>Rep target</span>
          {numInput(c.backoffRepTarget, (v) => set({ backoffRepTarget: v }))}
        </div>
        <div style={{ ...field, borderTop: "1px solid #eee", paddingTop: 8 }}>
          <span style={labelStyle}>
            RPE-deload cut %{" "}
            <span style={{ color: "#bbb" }}>
              (#61 — one session after 3 red weeks)
            </span>
          </span>
          {numInput(c.deloadCutPercentage, (v) =>
            set({ deloadCutPercentage: v }),
          )}
        </div>
        <SetStyleRow
          scheme={scheme}
          setStyles={setStyles}
          onSetStylesChange={onSetStylesChange}
        />
      </div>
    );
  }

  if (scheme.type === "failure_sets") {
    const c = scheme.config;
    return (
      <div>
        <div style={field}>
          <span style={labelStyle}>Set count</span>
          {numInput(c.setCount, (v) =>
            onChange({ type: "failure_sets", config: { setCount: v } }),
          )}
        </div>
        <div style={{ fontSize: 12, color: "#999" }}>
          No weight, no reps, no tracking — just a &ldquo;done&rdquo; mark.
        </div>
      </div>
    );
  }

  // wave
  const c = scheme.config;
  const set = (patch: Partial<typeof c>) =>
    onChange({ type: "wave", config: { ...c, ...patch } });

  function updateWeek(weekIndex: number, nextWeek: WaveWeekSet[]) {
    const weekTable = c.weekTable.map((w, i) =>
      i === weekIndex ? nextWeek : w,
    );
    set({ weekTable });
  }
  function updateSet(
    weekIndex: number,
    setIndex: number,
    patch: Partial<WaveWeekSet>,
  ) {
    const week = c.weekTable[weekIndex]!;
    updateWeek(
      weekIndex,
      week.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
    );
  }
  function addSetToWeek(weekIndex: number) {
    updateWeek(weekIndex, [
      ...c.weekTable[weekIndex]!,
      { percentageOfTrainingMax: 70, repTarget: 5 },
    ]);
  }
  function addWeek() {
    set({
      weekTable: [
        ...c.weekTable,
        [{ percentageOfTrainingMax: 70, repTarget: 5 }],
      ],
    });
  }
  function removeWeek(weekIndex: number) {
    set({ weekTable: c.weekTable.filter((_, i) => i !== weekIndex) });
  }

  return (
    <div>
      <div style={field}>
        <span style={labelStyle}>Training max %</span>
        {numInput(c.trainingMaxPercentage, (v) =>
          set({ trainingMaxPercentage: v }),
        )}
      </div>
      <div style={field}>
        <span style={labelStyle}>Deload mode</span>
        <select
          value={c.deloadMode}
          onChange={(e) =>
            set({ deloadMode: e.target.value as typeof c.deloadMode })
          }
        >
          <option value="always">Always (every cycle)</option>
          <option value="never">Never</option>
          <option value="on_regression">On regression</option>
        </select>
      </div>
      <div style={field}>
        <span style={labelStyle}>Supplemental sets</span>
        <select
          value={c.supplementalSetType}
          onChange={(e) =>
            set({
              supplementalSetType: e.target
                .value as typeof c.supplementalSetType,
            })
          }
        >
          <option value="none">None</option>
          <option value="bbb">BBB</option>
          <option value="fsl">FSL</option>
          <option value="ssl">SSL</option>
          <option value="custom">Custom %</option>
        </select>
      </div>
      <div style={field}>
        <label
          style={{
            fontSize: 13,
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={c.usePreset}
            onChange={(e) => {
              const usePreset = e.target.checked;
              const preset = defaultConfigFor("wave");
              set({
                usePreset,
                weekTable:
                  usePreset && preset.type === "wave"
                    ? preset.config.weekTable
                    : c.weekTable,
              });
            }}
          />
          Use 5/3/1 preset week table
        </label>
      </div>

      {c.usePreset ? (
        // #66: the preset locks weekTable's own numbers (no editable
        // inputs — that's what "locked" means), but set-style chips still
        // need somewhere to attach. Without this branch, preset exercises
        // (the common case — this is the default) would have no week/set
        // list rendered at all and the feature would be silently
        // unusable for them.
        <div
          style={{ border: "1px solid #e5e5e5", borderRadius: 6, padding: 10 }}
        >
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
            5/3/1 preset weeks
          </div>
          {c.weekTable.map((week, wi) => (
            <div
              key={wi}
              style={{
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <div style={{ fontSize: 12, marginBottom: 4 }}>Week {wi + 1}</div>
              {week.map((s, si) => (
                <div
                  key={si}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <span style={{ width: 90, color: "#999", fontSize: 13 }}>
                    {s.percentageOfTrainingMax}% × {s.repTarget}
                  </span>
                  <SetStyleChip
                    value={styleAt(setStyles, wi, si + 1)}
                    onChange={(next) =>
                      onSetStylesChange(setStyleAt(setStyles, wi, si + 1, next))
                    }
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{ border: "1px solid #e5e5e5", borderRadius: 6, padding: 10 }}
        >
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>
            Custom week table
          </div>
          {c.weekTable.map((week, wi) => (
            <div
              key={wi}
              style={{
                marginBottom: 8,
                paddingBottom: 8,
                borderBottom: "1px solid #f0f0f0",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 12,
                  marginBottom: 4,
                }}
              >
                <span>Week {wi + 1}</span>
                <button
                  onClick={() => removeWeek(wi)}
                  style={{ fontSize: 11, cursor: "pointer" }}
                >
                  remove week
                </button>
              </div>
              {week.map((s, si) => (
                <div
                  key={si}
                  style={{
                    display: "flex",
                    gap: 6,
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  {numInput(
                    s.percentageOfTrainingMax,
                    (v) => updateSet(wi, si, { percentageOfTrainingMax: v }),
                    44,
                  )}
                  %
                  <input
                    type="text"
                    value={s.repTarget}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateSet(wi, si, {
                        repTarget:
                          raw.toUpperCase() === "AMRAP"
                            ? "AMRAP"
                            : Number(raw) || 0,
                      });
                    }}
                    placeholder="reps or AMRAP"
                    style={{ width: 80, padding: 4 }}
                  />
                  <SetStyleChip
                    value={styleAt(setStyles, wi, si + 1)}
                    onChange={(next) =>
                      onSetStylesChange(setStyleAt(setStyles, wi, si + 1, next))
                    }
                  />
                </div>
              ))}
              <button
                onClick={() => addSetToWeek(wi)}
                style={{ fontSize: 11, cursor: "pointer" }}
              >
                + add set
              </button>
            </div>
          ))}
          <button onClick={addWeek} style={{ fontSize: 12, cursor: "pointer" }}>
            + add week
          </button>
        </div>
      )}
    </div>
  );
}

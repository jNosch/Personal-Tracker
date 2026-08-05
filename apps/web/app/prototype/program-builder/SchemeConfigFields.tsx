"use client";

// PROTOTYPE SHARED COMPONENT — renders the config inputs for whichever scheme type is
// selected. Shared across all variants (like a low-level utility, not a layout) since
// the underlying config shapes are fixed regardless of how each variant navigates to them.

import type { SchemeConfig, SchemeType, WaveWeekSet } from "./data";
import { defaultConfigFor } from "./data";

const numInput = (value: number, onChange: (v: number) => void, width = 56) => (
  <input
    type="number"
    value={value}
    onChange={(e) => onChange(Number(e.target.value))}
    style={{ width, padding: 4 }}
  />
);

const label = { fontSize: 12, color: "#666", display: "block", marginBottom: 2 };
const field = { marginBottom: 10 };

export default function SchemeConfigFields({
  scheme,
  onChange,
}: {
  scheme: SchemeConfig;
  onChange: (next: SchemeConfig) => void;
}) {
  if (scheme.type === "double_progression") {
    const c = scheme.config;
    const set = (patch: Partial<typeof c>) => onChange({ type: "double_progression", config: { ...c, ...patch } });
    return (
      <div>
        <div style={field}>
          <span style={label}>Rep range</span>
          {numInput(c.repRangeLow, (v) => set({ repRangeLow: v }), 44)} –{" "}
          {numInput(c.repRangeHigh, (v) => set({ repRangeHigh: v }), 44)}
        </div>
        <div style={field}>
          <span style={label}>Set count</span>
          {numInput(c.setCount, (v) => set({ setCount: v }))}
        </div>
        <div style={field}>
          <span style={label}>Weight increment (kg)</span>
          {numInput(c.weightIncrement, (v) => set({ weightIncrement: v }))}
        </div>
      </div>
    );
  }

  if (scheme.type === "rep_accumulation") {
    const c = scheme.config;
    const set = (patch: Partial<typeof c>) => onChange({ type: "rep_accumulation", config: { ...c, ...patch } });
    return (
      <div>
        <div style={field}>
          <span style={label}>Target total reps</span>
          {numInput(c.targetTotalReps, (v) => set({ targetTotalReps: v }))}
        </div>
        <div style={field}>
          <span style={label}>Set count</span>
          {numInput(c.setCount, (v) => set({ setCount: v }))}
        </div>
        <div style={field}>
          <span style={label}>Weight increment (kg)</span>
          {numInput(c.weightIncrement, (v) => set({ weightIncrement: v }))}
        </div>
      </div>
    );
  }

  if (scheme.type === "topset_backoff") {
    const c = scheme.config;
    const set = (patch: Partial<typeof c>) => onChange({ type: "topset_backoff", config: { ...c, ...patch } });
    return (
      <div>
        <div style={field}>
          <span style={label}>Top set rep range</span>
          {numInput(c.topSetRepRangeLow, (v) => set({ topSetRepRangeLow: v }), 44)} –{" "}
          {numInput(c.topSetRepRangeHigh, (v) => set({ topSetRepRangeHigh: v }), 44)}
        </div>
        <div style={field}>
          <span style={label}>Weight increment (kg)</span>
          {numInput(c.weightIncrement, (v) => set({ weightIncrement: v }))}
        </div>
        <div style={{ ...field, borderTop: "1px solid #eee", paddingTop: 8 }}>
          <span style={{ ...label, fontWeight: 600 }}>Back-off sets</span>
        </div>
        <div style={field}>
          <span style={label}>% of top-set weight</span>
          {numInput(c.backoffPercentage, (v) => set({ backoffPercentage: v }))}
        </div>
        <div style={field}>
          <span style={label}>Set count</span>
          {numInput(c.backoffSetCount, (v) => set({ backoffSetCount: v }))}
        </div>
        <div style={field}>
          <span style={label}>Rep target</span>
          {numInput(c.backoffRepTarget, (v) => set({ backoffRepTarget: v }))}
        </div>
      </div>
    );
  }

  if (scheme.type === "failure_sets") {
    const c = scheme.config;
    return (
      <div>
        <div style={field}>
          <span style={label}>Set count</span>
          {numInput(c.setCount, (v) => onChange({ type: "failure_sets", config: { setCount: v } }))}
        </div>
        <div style={{ fontSize: 12, color: "#999" }}>No weight, no reps, no tracking — just a "done" mark.</div>
      </div>
    );
  }

  // wave
  const c = scheme.config;
  const set = (patch: Partial<typeof c>) => onChange({ type: "wave", config: { ...c, ...patch } });

  function updateWeek(weekIndex: number, nextWeek: WaveWeekSet[]) {
    const weekTable = c.weekTable.map((w, i) => (i === weekIndex ? nextWeek : w));
    set({ weekTable });
  }
  function updateSet(weekIndex: number, setIndex: number, patch: Partial<WaveWeekSet>) {
    const week = c.weekTable[weekIndex]!;
    updateWeek(
      weekIndex,
      week.map((s, i) => (i === setIndex ? { ...s, ...patch } : s)),
    );
  }
  function addSetToWeek(weekIndex: number) {
    updateWeek(weekIndex, [...c.weekTable[weekIndex]!, { percentageOfTrainingMax: 70, repTarget: 5 }]);
  }
  function addWeek() {
    set({ weekTable: [...c.weekTable, [{ percentageOfTrainingMax: 70, repTarget: 5 }]] });
  }
  function removeWeek(weekIndex: number) {
    set({ weekTable: c.weekTable.filter((_, i) => i !== weekIndex) });
  }

  return (
    <div>
      <div style={field}>
        <span style={label}>Training max %</span>
        {numInput(c.trainingMaxPercentage, (v) => set({ trainingMaxPercentage: v }))}
      </div>
      <div style={field}>
        <span style={label}>Deload mode</span>
        <select value={c.deloadMode} onChange={(e) => set({ deloadMode: e.target.value as typeof c.deloadMode })}>
          <option value="always">Always (every cycle)</option>
          <option value="never">Never</option>
          <option value="on_regression">On regression</option>
        </select>
      </div>
      <div style={field}>
        <span style={label}>Supplemental sets</span>
        <select
          value={c.supplementalSetType}
          onChange={(e) => set({ supplementalSetType: e.target.value as typeof c.supplementalSetType })}
        >
          <option value="none">None</option>
          <option value="bbb">BBB</option>
          <option value="fsl">FSL</option>
          <option value="ssl">SSL</option>
          <option value="custom">Custom %</option>
        </select>
      </div>
      <div style={field}>
        <label style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
          <input
            type="checkbox"
            checked={c.usePreset}
            onChange={(e) =>
              set({
                usePreset: e.target.checked,
                weekTable: e.target.checked ? defaultConfigFor("wave").config.weekTable! : c.weekTable,
              })
            }
          />
          Use 5/3/1 preset week table
        </label>
      </div>

      {!c.usePreset && (
        <div style={{ border: "1px solid #e5e5e5", borderRadius: 6, padding: 10 }}>
          <div style={{ fontSize: 12, color: "#666", marginBottom: 6 }}>Custom week table</div>
          {c.weekTable.map((week, wi) => (
            <div key={wi} style={{ marginBottom: 8, paddingBottom: 8, borderBottom: "1px solid #f0f0f0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span>Week {wi + 1}</span>
                <button onClick={() => removeWeek(wi)} style={{ fontSize: 11, cursor: "pointer" }}>
                  remove week
                </button>
              </div>
              {week.map((s, si) => (
                <div key={si} style={{ display: "flex", gap: 6, alignItems: "center", marginBottom: 4 }}>
                  {numInput(s.percentageOfTrainingMax, (v) => updateSet(wi, si, { percentageOfTrainingMax: v }), 44)}%
                  <input
                    type="text"
                    value={s.repTarget}
                    onChange={(e) => {
                      const raw = e.target.value;
                      updateSet(wi, si, { repTarget: raw.toUpperCase() === "AMRAP" ? "AMRAP" : Number(raw) || 0 });
                    }}
                    placeholder="reps or AMRAP"
                    style={{ width: 80, padding: 4 }}
                  />
                </div>
              ))}
              <button onClick={() => addSetToWeek(wi)} style={{ fontSize: 11, cursor: "pointer" }}>
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

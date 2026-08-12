// Per-set style tags (#66): lets the program creator mark an individual
// prescribed set as executed rest-pause or cluster style. Deliberately
// lives outside every scheme's own Config type (DoubleProgressionConfig,
// WaveConfig, ...) rather than adding fields to them — a set-style tag is
// pure metadata for the lifter to read, never an input to prescribe()/
// update() or the progression math (see this file's functions: none of
// them touch SchemeState or PrescribedSet). Keeping the two concerns in
// separate modules means the scheme engine stays exactly as it was before
// this ticket.
import type { SchemeConfig } from "./schemes";

export type SetStyle = "rest_pause" | "cluster";

// weekIndex is null for every scheme except Wave. Wave's sets vary week to
// week (week 1's set 3 and week 3's set 3 can be entirely different
// weight/rep targets), so a Wave entry means "week 3's AMRAP set", not
// "position 3, whichever week" — every other scheme has a stable set list
// session to session, so plain setNumber is enough there. Mutually
// exclusive style per set by construction (a single field, not two
// independent booleans) — rest-pause and cluster are opposite-intensity
// techniques for one set, not stackable modifiers.
export interface SetStyleEntry {
  weekIndex: number | null;
  setNumber: number;
  style: SetStyle;
}

interface SetStylePosition {
  weekIndex: number | null;
  setNumber: number;
}

// Every (weekIndex, setNumber) position a given scheme config can currently
// produce a set at — the addressable space set-style tags are allowed to
// attach to. Mirrors each prescribeX function's own setNumber assignment
// (1-based, top set before backoff sets for Top-set+Backoff) without
// calling prescribe() itself — this only needs the *shape* a config
// implies, not a live prescription against real state, since the program
// builder edits configs before any state/sessions exist.
//
// Failure Sets returns no positions at all: its PrescribedSet has no
// repTarget/weight (see schemes.ts's prescribeFailureSets) — nothing to
// attach "hit these reps, this style" to, and it's already an unconditional
// to-failure set, so neither technique adds anything meaningful.
export function validSetStylePositions(
  scheme: SchemeConfig,
): SetStylePosition[] {
  switch (scheme.type) {
    case "double_progression":
    case "rep_accumulation":
      return Array.from({ length: scheme.config.setCount }, (_, i) => ({
        weekIndex: null,
        setNumber: i + 1,
      }));
    case "topset_backoff":
      return [
        { weekIndex: null, setNumber: 1 },
        ...Array.from({ length: scheme.config.backoffSetCount }, (_, i) => ({
          weekIndex: null,
          setNumber: i + 2,
        })),
      ];
    case "wave":
      // DELOAD_WEEK is deliberately excluded — it isn't a weekTable row
      // (schemes.ts inserts it at prescribe time per deloadMode, not stored
      // in config), and a recovery week is never a cluster/rest-pause
      // candidate anyway.
      return scheme.config.weekTable.flatMap((week, weekIndex) =>
        week.map((_, i) => ({ weekIndex, setNumber: i + 1 })),
      );
    case "failure_sets":
      return [];
  }
}

// #66: drops any stored entry whose (weekIndex, setNumber) no longer
// matches a position the current config can produce — set count reduced, a
// Wave week removed from a custom table, usePreset toggled (preset/custom
// have different week/set shapes). Applied on save (app/programs/
// actions.ts's updateExerciseScheme), not on every read — a flag isn't
// silently invisible-then-restored by an unrelated later edit that happens
// to raise the count back up; it's gone for good once the position it
// named stops existing at save time.
export function pruneSetStyles(
  scheme: SchemeConfig,
  setStyles: SetStyleEntry[],
): SetStyleEntry[] {
  const valid = validSetStylePositions(scheme);
  return setStyles.filter((entry) =>
    valid.some(
      (p) => p.weekIndex === entry.weekIndex && p.setNumber === entry.setNumber,
    ),
  );
}

// Read the style tagged at one position, or null if untagged. Shared by
// the program-builder chips (reading the draft being edited) and the Log
// page (reading what's tagged for the set currently being logged).
export function styleAt(
  setStyles: SetStyleEntry[],
  weekIndex: number | null,
  setNumber: number,
): SetStyle | null {
  return (
    setStyles.find(
      (e) => e.weekIndex === weekIndex && e.setNumber === setNumber,
    )?.style ?? null
  );
}

// Returns a new array with that position set to `style` (replacing any
// existing entry there) or removed entirely when `style` is null — the
// program builder's chips are a 3-state toggle (none/rest-pause/cluster),
// so "set to none" has to be expressible as a real transition, not just
// "never call this".
export function setStyleAt(
  setStyles: SetStyleEntry[],
  weekIndex: number | null,
  setNumber: number,
  style: SetStyle | null,
): SetStyleEntry[] {
  const withoutPosition = setStyles.filter(
    (e) => !(e.weekIndex === weekIndex && e.setNumber === setNumber),
  );
  return style === null
    ? withoutPosition
    : [...withoutPosition, { weekIndex, setNumber, style }];
}

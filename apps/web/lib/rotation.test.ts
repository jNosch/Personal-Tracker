import { describe, expect, it } from "vitest";
import { nextDayPosition } from "./rotation";

describe("nextDayPosition", () => {
  it("advances to the next contiguous position, wrapping at the end", () => {
    expect(nextDayPosition([0, 1, 2], 0)).toBe(1);
    expect(nextDayPosition([0, 1, 2], 1)).toBe(2);
    expect(nextDayPosition([0, 1, 2], 2)).toBe(0);
  });

  it("skips a gap left by an archived day rather than landing on it", () => {
    // The real bug this was written to fix: positions 1 and 2 are active,
    // position 0 belongs to an archived day. Raw (position + 1) % count
    // arithmetic would compute (1 + 1) % 2 = 0 — a position no active day
    // occupies.
    expect(nextDayPosition([1, 2], 1)).toBe(2);
    expect(nextDayPosition([1, 2], 2)).toBe(1);
  });

  it("wraps a single active day back to itself", () => {
    expect(nextDayPosition([5], 5)).toBe(5);
  });

  it("falls back to the first active position when the logged day isn't active anymore", () => {
    expect(nextDayPosition([1, 2], 0)).toBe(1);
  });

  it("returns the logged position unchanged when there are no active days", () => {
    expect(nextDayPosition([], 3)).toBe(3);
  });
});

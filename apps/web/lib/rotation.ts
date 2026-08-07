// Rotation advance (#9): saving a session always advances the program's
// next_day_position to the next position in the active rotation, wrapping
// — regardless of what it previously pointed at. Walks the sorted list of
// *currently active* day positions rather than doing (position + 1) % count
// arithmetic directly: positions aren't contiguous once any day has ever
// been archived (archived days keep their position slot forever, see
// addDayTemplate in app/programs/actions.ts), so raw arithmetic can land on
// a position gap no active day occupies. Found live as a real bug against a
// program with an archived-day gap, not just reasoned about — see
// app/log/actions.ts's logSession.
export function nextDayPosition(
  activeDayPositions: number[],
  loggedDayPosition: number,
): number {
  const positions = [...activeDayPositions].sort((a, b) => a - b);
  if (positions.length === 0) return loggedDayPosition;
  const index = positions.indexOf(loggedDayPosition);
  const nextIndex = index === -1 ? 0 : (index + 1) % positions.length;
  return positions[nextIndex]!;
}

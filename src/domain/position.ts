/**
 * Position arithmetic for the item stream.
 *
 * Items keep integer `position` values with gaps (the seed uses step 1000),
 * so a new row can be placed between its neighbors without renumbering them.
 * When the gap is exhausted (two consecutive integers) there is no integer
 * room left; the client then signals this by returning `after + 1` — a
 * position that collides with the upper neighbor and makes the server
 * re-space the whole block in one statement (see docs/adr/0009-position-respace.md).
 */
export function insertPositionBetween(after: number | null, before: number | null): number {
  if (after === null && before === null) return 1000;
  if (after === null) return Math.max(0, before! - 1000);
  if (before === null) return after + 1000;
  const gap = before - after;
  if (gap >= 2) return after + Math.floor(gap / 2);
  // Gap exhausted: collide with the upper neighbor so the server re-spaces.
  return after + 1;
}

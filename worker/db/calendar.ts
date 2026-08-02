import type { CalendarWindow } from "../../shared/db.ts";
import { projectCalendar } from "../../src/domain/calendar.ts";
import type { D1Like } from "./d1-like.ts";
import { mapBlock, mapItem, type RawBlockRow, type RawItemRow } from "./mappers.ts";

/**
 * Loads every block and item and hands them to the domain projection
 * (src/domain/calendar.ts) — the single definition of the calendar window.
 * Two queries, fixed regardless of how wide the window is or how much data
 * exists.
 */
export async function loadCalendarWindow(db: D1Like, from: string, to: string): Promise<CalendarWindow> {
  const [{ results: blockRows }, { results: itemRows }] = await Promise.all([
    db.prepare("SELECT * FROM blocks").all<RawBlockRow>(),
    db.prepare("SELECT * FROM items").all<RawItemRow>(),
  ]);
  return projectCalendar(blockRows.map(mapBlock), itemRows.map(mapItem), from, to);
}

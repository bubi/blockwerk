import type { CalendarWindow } from "../../shared/db.ts";
import { projectCalendar } from "../../src/domain/calendar.ts";
import { mapItem, type RawItemRow } from "./mappers.ts";

/**
 * Loads every item and hands them to the domain projection
 * (src/domain/calendar.ts) — the single definition of the calendar window.
 * Blocks are deliberately not loaded: their date is assigned automatically
 * and is not a time statement, so they never appear in the calendar. One
 * query, fixed regardless of how wide the window is or how much data exists.
 */
export async function loadCalendarWindow(db: D1Database, from: string, to: string): Promise<CalendarWindow> {
  const { results: itemRows } = await db.prepare("SELECT * FROM items").all<RawItemRow>();
  return projectCalendar(itemRows.map(mapItem), from, to);
}

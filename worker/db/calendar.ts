import type { BlockRow, ItemRow } from "../../shared/db.ts";
import type { D1Like } from "./d1-like.ts";
import { mapBlock, mapItem, type RawBlockRow, type RawItemRow } from "./mappers.ts";

export interface CalendarWindow {
  blocks: BlockRow[];
  dueTasks: ItemRow[];
  events: ItemRow[];
}

/**
 * Every datierte object in [from, to] ('YYYY-MM-DD', inclusive): block
 * dates, task due dates, event dates. Three queries, fixed regardless of
 * how wide the window is or how much data falls inside it.
 */
export async function loadCalendarWindow(db: D1Like, from: string, to: string): Promise<CalendarWindow> {
  const { results: blockRows } = await db
    .prepare("SELECT * FROM blocks WHERE date >= ? AND date <= ? ORDER BY date ASC, id ASC")
    .bind(from, to)
    .all<RawBlockRow>();

  const { results: dueTaskRows } = await db
    .prepare(
      "SELECT * FROM items WHERE kind = 'task' AND due_date >= ? AND due_date <= ? ORDER BY due_date ASC, id ASC",
    )
    .bind(from, to)
    .all<RawItemRow>();

  const { results: eventRows } = await db
    .prepare(
      "SELECT * FROM items WHERE kind = 'event' AND event_date >= ? AND event_date <= ? ORDER BY event_date ASC, event_time ASC, id ASC",
    )
    .bind(from, to)
    .all<RawItemRow>();

  return {
    blocks: blockRows.map(mapBlock),
    dueTasks: dueTaskRows.map(mapItem),
    events: eventRows.map(mapItem),
  };
}

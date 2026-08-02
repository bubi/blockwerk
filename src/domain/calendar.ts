import type { BlockRow, CalendarWindow, ItemRow } from "../../shared/db.ts";

/**
 * The calendar projection — the single definition of which dated objects
 * appear in a window and in which order: blocks by their date, tasks by due
 * date, events by date/time, all `YYYY-MM-DD` inclusive. The worker builds
 * it from all loaded rows; the client can build it from data it already
 * holds (e.g. the month strip).
 */
export function projectCalendar(
  blocks: readonly BlockRow[],
  items: readonly ItemRow[],
  from: string,
  to: string,
): CalendarWindow {
  return {
    blocks: blocks
      .filter((block) => block.date >= from && block.date <= to)
      .sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)),
    dueTasks: items
      .filter(
        (item) =>
          item.kind === "task" &&
          item.dueDate !== null &&
          item.dueDate >= from &&
          item.dueDate <= to,
      )
      .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? "") || a.id.localeCompare(b.id)),
    events: items
      .filter(
        (item) =>
          item.kind === "event" &&
          item.eventDate !== null &&
          item.eventDate >= from &&
          item.eventDate <= to,
      )
      .sort(
        (a, b) =>
          (a.eventDate ?? "").localeCompare(b.eventDate ?? "") ||
          (a.eventTime ?? "").localeCompare(b.eventTime ?? "") ||
          a.id.localeCompare(b.id),
      ),
  };
}

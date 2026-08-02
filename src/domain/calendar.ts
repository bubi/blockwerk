import type { BlockRow, CalendarWindow, ItemRow } from "../../shared/db.ts";
import { addDays, fromISODate, toISODate } from "./dates.ts";

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

export interface LedgerDay {
  /** 'YYYY-MM-DD'. */
  date: string;
  /** 0 = Sunday … 6 = Saturday, for weekend/weekday styling. */
  weekday: number;
  blocks: BlockRow[];
  tasks: ItemRow[];
  events: ItemRow[];
}

/**
 * The month strip: every day of the `[from, to]` window (inclusive) with the
 * window's content grouped onto it — pure presentation over a CalendarWindow.
 */
export function monthLedger(window: CalendarWindow, from: string, to: string): LedgerDay[] {
  const days = new Map<string, LedgerDay>();
  let cursor = fromISODate(from);
  const end = fromISODate(to);
  while (cursor.getTime() <= end.getTime()) {
    const key = toISODate(cursor);
    days.set(key, { date: key, weekday: cursor.getDay(), blocks: [], tasks: [], events: [] });
    cursor = addDays(cursor, 1);
  }
  for (const block of window.blocks) days.get(block.date)?.blocks.push(block);
  for (const task of window.dueTasks) if (task.dueDate) days.get(task.dueDate)?.tasks.push(task);
  for (const event of window.events) if (event.eventDate) days.get(event.eventDate)?.events.push(event);
  return [...days.values()];
}

/** One display row of the calendar ledger: a full day, or a run of empty days. */
export type LedgerRow =
  | { type: "day"; day: LedgerDay }
  | { type: "gap"; from: string; count: number };

/**
 * The ledger's display order — the single definition of how a month is laid
 * out: every day with content is its own section, consecutive days without
 * content collapse into one gap row (which day they start at, how many). Pure
 * presentation over the month ledger, mirroring the prototype's `ledgerRows`.
 */
export function ledgerRows(days: readonly LedgerDay[]): LedgerRow[] {
  const rows: LedgerRow[] = [];
  let run: { from: string; count: number } | null = null;
  for (const day of days) {
    const load = day.blocks.length + day.tasks.length + day.events.length;
    if (load === 0) {
      if (run) run.count += 1;
      else run = { from: day.date, count: 1 };
      continue;
    }
    if (run) {
      rows.push({ type: "gap", ...run });
      run = null;
    }
    rows.push({ type: "day", day });
  }
  if (run) rows.push({ type: "gap", ...run });
  return rows;
}

/**
 * Whether an open task is past its due date — `dueDate` before `todayIso`.
 * ISO strings compare lexicographically, so no calendar arithmetic is needed.
 */
export function isOverdueTask(task: ItemRow, todayIso: string): boolean {
  return !task.done && task.dueDate !== null && task.dueDate < todayIso;
}

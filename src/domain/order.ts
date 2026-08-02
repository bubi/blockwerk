import type { BlockRow, ItemRow } from "../../shared/db.ts";

export interface BlockItemGroups {
  /** Note and ref items, in stream order. */
  notes: ItemRow[];
  tasks: ItemRow[];
  events: ItemRow[];
}

const GROUP_RANK: Record<ItemRow["kind"], number> = { note: 0, ref: 0, task: 1, event: 2 };

/**
 * The block's item order — the single definition of the rule in PROJECT.md:
 * notes and refs (position, id) → tasks (position, id) → events
 * (chronological by event_date/event_time, then position, id). Refs are
 * stream lines like notes and sort by position with them.
 *
 * Everything that needs a block's items in display order goes through this
 * function; nothing re-derives the rule in SQL (see docs/adr/0005).
 */
export function orderBlockItems(items: readonly ItemRow[]): ItemRow[] {
  return [...items].sort(compareBlockItems);
}

export function groupBlockItems(items: readonly ItemRow[]): BlockItemGroups {
  const groups: BlockItemGroups = { notes: [], tasks: [], events: [] };
  for (const item of orderBlockItems(items)) {
    if (item.kind === "note" || item.kind === "ref") groups.notes.push(item);
    else if (item.kind === "task") groups.tasks.push(item);
    else groups.events.push(item);
  }
  return groups;
}

function compareBlockItems(a: ItemRow, b: ItemRow): number {
  const group = GROUP_RANK[a.kind] - GROUP_RANK[b.kind];
  if (group !== 0) return group;
  if (a.kind === "event" && b.kind === "event") {
    return (
      (a.eventDate ?? "").localeCompare(b.eventDate ?? "") ||
      (a.eventTime ?? "").localeCompare(b.eventTime ?? "") ||
      a.position - b.position ||
      a.id.localeCompare(b.id)
    );
  }
  return a.position - b.position || a.id.localeCompare(b.id);
}

/** A page's blocks in display order — newest date first, id ascending on ties. */
export function orderPageBlocks(blocks: readonly BlockRow[]): BlockRow[] {
  return [...blocks].sort((a, b) => b.date.localeCompare(a.date) || a.id.localeCompare(b.id));
}

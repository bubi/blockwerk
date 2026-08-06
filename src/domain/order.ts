import type { BlockRow, ItemRow } from "../../shared/db.ts";

export interface BlockItemGroups {
  /** Note and ref items, in stream order. */
  notes: ItemRow[];
  tasks: ItemRow[];
  events: ItemRow[];
}

const GROUP_RANK: Record<ItemRow["kind"], number> = { note: 0, ref: 0, task: 1, event: 2 };

/**
 * The notes attached to each task (docs/adr/0014), sorted by position among
 * themselves — the single definition of the sibling order a task's notes are
 * shown in, in the block and in the task overview alike.
 */
export function taskChildrenByParent(items: readonly ItemRow[]): Map<string, ItemRow[]> {
  const byParent = new Map<string, ItemRow[]>();
  for (const item of items) {
    if (item.kind !== "note" || item.parentItemId === null) continue;
    const list = byParent.get(item.parentItemId);
    if (list) list.push(item);
    else byParent.set(item.parentItemId, [item]);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.position - b.position || a.id.localeCompare(b.id));
  }
  return byParent;
}

/**
 * The block's item order — the single definition of the rule in PROJECT.md:
 * notes and refs (position, id) → tasks (position, id) → events
 * (chronological by event_date/event_time, then position, id). Refs are
 * stream lines like notes and sort by position with them.
 *
 * A task's notes are not part of the notes group: they sit directly under
 * their task, each followed by its own notes, position-sorted (docs/adr/0014).
 * The three groups stay three.
 *
 * Everything that needs a block's items in display order goes through this
 * function; nothing re-derives the rule in SQL (see docs/adr/0005).
 */
export function orderBlockItems(items: readonly ItemRow[]): ItemRow[] {
  const children = taskChildrenByParent(items);
  const ordered: ItemRow[] = [];
  for (const item of [...items].sort(compareBlockItems)) {
    if (item.parentItemId !== null) continue;
    ordered.push(item);
    if (item.kind === "task") ordered.push(...(children.get(item.id) ?? []));
  }
  return ordered;
}

export function groupBlockItems(items: readonly ItemRow[]): BlockItemGroups {
  const groups: BlockItemGroups = { notes: [], tasks: [], events: [] };
  for (const item of orderBlockItems(items)) {
    if (item.parentItemId !== null) continue;
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

/**
 * A page's blocks in display order — newest date first, then newest
 * creation first, then id, so two blocks with the same date and the same
 * created_at still order deterministically (the same lesson as items: no
 * unique secondary key, and the id is the final tiebreak).
 */
export function orderPageBlocks(blocks: readonly BlockRow[]): BlockRow[] {
  return [...blocks].sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      b.createdAt - a.createdAt ||
      a.id.localeCompare(b.id),
  );
}

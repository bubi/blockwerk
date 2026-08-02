import type { ItemRow } from "../../shared/db.ts";
import { orderBlockItems } from "../../src/domain/order.ts";
import { mapItem, type RawItemRow } from "./mappers.ts";

interface NewItemBase {
  id: string;
  blockId: string;
  position: number;
}

/**
 * A discriminated union, not a flat object: which fields are meaningful
 * depends on `kind` (see the items CHECK constraints in
 * migrations/0001_initial.sql), so this makes it a type error to set e.g.
 * a due date on a note. A note's `parentItemId` links it to a task
 * (docs/adr/0014); the handler validates that the parent is a task and is
 * itself a top-level row.
 */
export type NewItemInput =
  | (NewItemBase & { kind: "note"; text: string; heading: 1 | 2 | null; parentItemId?: string | null })
  | (NewItemBase & { kind: "task"; text: string; done?: boolean; dueDate: string | null; assigneeSpaceId: string | null })
  | (NewItemBase & { kind: "event"; text: string; eventDate: string | null; eventTime: string | null })
  | (NewItemBase & { kind: "ref"; refBlockId: string | null });

export interface ItemPatch {
  text?: string;
  position?: number;
  heading?: 1 | 2 | null;
  done?: boolean;
  dueDate?: string | null;
  assigneeSpaceId?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  refBlockId?: string | null;
}

export function buildItemRow(input: NewItemInput, position: number, now: number): ItemRow {
  const base: ItemRow = {
    id: input.id,
    blockId: input.blockId,
    kind: input.kind,
    position,
    text: "",
    heading: null,
    done: false,
    dueDate: null,
    assigneeSpaceId: null,
    eventDate: null,
    eventTime: null,
    refBlockId: null,
    parentItemId: null,
    createdAt: now,
    updatedAt: now,
  };
  return input.kind === "note"
    ? { ...base, text: input.text, heading: input.heading, parentItemId: input.parentItemId ?? null }
    : input.kind === "task"
      ? { ...base, text: input.text, done: input.done ?? false, dueDate: input.dueDate, assigneeSpaceId: input.assigneeSpaceId }
      : input.kind === "event"
        ? { ...base, text: input.text, eventDate: input.eventDate, eventTime: input.eventTime }
        : { ...base, refBlockId: input.refBlockId };
}

async function insertItemRow(db: D1Database, row: ItemRow): Promise<void> {
  await db
    .prepare(
      `INSERT INTO items
        (id, block_id, kind, position, text, heading, done, due_date, assignee_space_id, event_date, event_time, ref_block_id, parent_item_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      row.id,
      row.blockId,
      row.kind,
      row.position,
      row.text,
      row.heading,
      row.done ? 1 : 0,
      row.dueDate,
      row.assigneeSpaceId,
      row.eventDate,
      row.eventTime,
      row.refBlockId,
      row.parentItemId,
      row.createdAt,
      row.updatedAt,
    )
    .run();
}

export async function createItem(db: D1Database, input: NewItemInput, now: number): Promise<ItemRow> {
  const row = buildItemRow(input, input.position, now);
  await insertItemRow(db, row);
  return row;
}

export async function getItem(db: D1Database, id: string): Promise<ItemRow | null> {
  const row = await db.prepare("SELECT * FROM items WHERE id = ?").bind(id).first<RawItemRow>();
  return row ? mapItem(row) : null;
}

export async function updateItem(db: D1Database, id: string, patch: ItemPatch, now: number): Promise<ItemRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  const set = (column: string, value: unknown) => {
    sets.push(`${column} = ?`);
    values.push(value);
  };

  if (patch.text !== undefined) set("text", patch.text);
  if (patch.position !== undefined) set("position", patch.position);
  if (patch.heading !== undefined) set("heading", patch.heading);
  if (patch.done !== undefined) set("done", patch.done ? 1 : 0);
  if (patch.dueDate !== undefined) set("due_date", patch.dueDate);
  if (patch.assigneeSpaceId !== undefined) set("assignee_space_id", patch.assigneeSpaceId);
  if (patch.eventDate !== undefined) set("event_date", patch.eventDate);
  if (patch.eventTime !== undefined) set("event_time", patch.eventTime);
  if (patch.refBlockId !== undefined) set("ref_block_id", patch.refBlockId);
  set("updated_at", now);
  values.push(id);

  const result = await db.prepare(`UPDATE items SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  if (result.meta.changes === 0) return null;
  return getItem(db, id);
}

export async function deleteItem(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

// ============================================================
// Ordered insertion with block re-spacing
// ============================================================

export async function listBlockItems(db: D1Database, blockId: string): Promise<ItemRow[]> {
  const { results } = await db.prepare("SELECT * FROM items WHERE block_id = ?").bind(blockId).all<RawItemRow>();
  return results.map(mapItem);
}

export interface ItemCreateResult {
  row: ItemRow;
  /**
   * Every item's position in the block after a re-space (including the new
   * row), or null when no re-space was needed. The client applies these so
   * its local order matches the server's truth (docs/adr/0009).
   */
  respaced: Record<string, number> | null;
}

/**
 * Creates an item where the client asked for it, keeping the block's order
 * intact. The client inserts at the midpoint of a gap; when that position
 * already exists (the gap was exhausted) the whole block is re-spaced in ONE
 * statement — step 1000, display order preserved, the new row right before
 * the item it collided with. The re-space is a single UPDATE ... CASE, so a
 * large block still costs one query, not one per row.
 */
export async function createItemWithRespace(db: D1Database, input: NewItemInput, now: number): Promise<ItemCreateResult> {
  const blockItems = await listBlockItems(db, input.blockId);
  const collides = blockItems.some((item) => item.position === input.position);
  if (!collides) {
    return { row: await createItem(db, input, now), respaced: null };
  }

  const ordered = orderBlockItems(blockItems);
  const insertIndex = ordered.findIndex((item) => item.position >= input.position);
  const index = insertIndex === -1 ? ordered.length : insertIndex;

  const respaced: Record<string, number> = {};
  const params: unknown[] = [];
  let sql = "UPDATE items SET position = CASE id";
  // The new row lands at 1000 * (index + 1); items at/after the insert point
  // shift up by one step so it fits between its display neighbors.
  ordered.forEach((item, positionIndex) => {
    const position = 1000 * (positionIndex < index ? positionIndex + 1 : positionIndex + 2);
    respaced[item.id] = position;
    sql += " WHEN ? THEN ?";
    params.push(item.id, position);
  });
  sql += " ELSE position END WHERE block_id = ?";
  params.push(input.blockId);
  await db.prepare(sql).bind(...params).run();

  const rowPosition = 1000 * (index + 1);
  respaced[input.id] = rowPosition;
  const row = buildItemRow(input, rowPosition, now);
  await insertItemRow(db, row);
  return { row, respaced };
}

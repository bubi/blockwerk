import type { ItemRow } from "../../shared/db.ts";
import type { D1Like } from "./d1-like.ts";
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
 * a due date on a note.
 */
export type NewItemInput =
  | (NewItemBase & { kind: "note"; text: string; heading: 1 | 2 | null })
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

export async function createItem(db: D1Like, input: NewItemInput, now: number): Promise<ItemRow> {
  const base: ItemRow = {
    id: input.id,
    blockId: input.blockId,
    kind: input.kind,
    position: input.position,
    text: "",
    heading: null,
    done: false,
    dueDate: null,
    assigneeSpaceId: null,
    eventDate: null,
    eventTime: null,
    refBlockId: null,
    createdAt: now,
    updatedAt: now,
  };
  const row: ItemRow =
    input.kind === "note"
      ? { ...base, text: input.text, heading: input.heading }
      : input.kind === "task"
        ? { ...base, text: input.text, done: input.done ?? false, dueDate: input.dueDate, assigneeSpaceId: input.assigneeSpaceId }
        : input.kind === "event"
          ? { ...base, text: input.text, eventDate: input.eventDate, eventTime: input.eventTime }
          : { ...base, refBlockId: input.refBlockId };

  await db
    .prepare(
      `INSERT INTO items
        (id, block_id, kind, position, text, heading, done, due_date, assignee_space_id, event_date, event_time, ref_block_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
      now,
      now,
    )
    .run();
  return row;
}

export async function getItem(db: D1Like, id: string): Promise<ItemRow | null> {
  const row = await db.prepare("SELECT * FROM items WHERE id = ?").bind(id).first<RawItemRow>();
  return row ? mapItem(row) : null;
}

export async function updateItem(db: D1Like, id: string, patch: ItemPatch, now: number): Promise<ItemRow | null> {
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

export async function deleteItem(db: D1Like, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM items WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

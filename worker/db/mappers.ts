import type { BlockRow, ItemRow, PageRow, SpaceRow, TemplateRow } from "../../shared/db.ts";

/** Raw row shapes as they come back from D1 — snake_case, SQLite's 0/1 booleans, JSON-as-TEXT. */

export interface RawSpaceRow {
  id: string;
  name: string;
  kind: string;
  short: string;
  email: string | null;
  created_at: number;
  updated_at: number;
}

export interface RawPageRow {
  id: string;
  space_id: string;
  title: string;
  created_at: number;
  updated_at: number;
}

export interface RawTemplateRow {
  id: string;
  label: string;
  hue: string;
  seed: string;
  created_at: number;
  updated_at: number;
}

export interface RawBlockRow {
  id: string;
  page_id: string;
  template_id: string | null;
  title: string;
  date: string;
  created_at: number;
  updated_at: number;
}

export interface RawItemRow {
  id: string;
  block_id: string;
  kind: string;
  position: number;
  text: string;
  heading: number | null;
  done: number;
  due_date: string | null;
  event_date: string | null;
  event_time: string | null;
  assignee_space_id: string | null;
  ref_block_id: string | null;
  created_at: number;
  updated_at: number;
}

export function mapSpace(row: RawSpaceRow): SpaceRow {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as SpaceRow["kind"],
    short: row.short,
    email: row.email,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapPage(row: RawPageRow): PageRow {
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapTemplate(row: RawTemplateRow): TemplateRow {
  return {
    id: row.id,
    label: row.label,
    hue: row.hue,
    seed: JSON.parse(row.seed) as string[],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapBlock(row: RawBlockRow): BlockRow {
  return {
    id: row.id,
    pageId: row.page_id,
    templateId: row.template_id,
    title: row.title,
    date: row.date,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function mapItem(row: RawItemRow): ItemRow {
  return {
    id: row.id,
    blockId: row.block_id,
    kind: row.kind as ItemRow["kind"],
    position: row.position,
    text: row.text,
    heading: row.heading as ItemRow["heading"],
    done: row.done === 1,
    dueDate: row.due_date,
    assigneeSpaceId: row.assignee_space_id,
    eventDate: row.event_date,
    eventTime: row.event_time,
    refBlockId: row.ref_block_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

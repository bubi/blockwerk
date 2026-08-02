import type { BlockRow, ItemRow } from "../../shared/db.ts";

/** Builds a fully-populated ItemRow; only test files import this. */
export function item(overrides: Partial<ItemRow> & { id: string; kind: ItemRow["kind"] }): ItemRow {
  return {
    blockId: "block",
    position: 1000,
    text: "",
    heading: null,
    done: false,
    dueDate: null,
    assigneeSpaceId: null,
    eventDate: null,
    eventTime: null,
    refBlockId: null,
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

/** Builds a fully-populated BlockRow; only test files import this. */
export function block(overrides: Partial<BlockRow> & { id: string }): BlockRow {
  return {
    pageId: "page",
    templateId: null,
    title: "",
    date: "2026-08-01",
    createdAt: 1_700_000_000_000,
    updatedAt: 1_700_000_000_000,
    ...overrides,
  };
}

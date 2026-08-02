import type { BlockRow, PageRow, SpaceRow, TemplateRow } from "../shared/db.ts";
import type { CalendarResponse, ItemWriteResponse, MirrorTask, PageResponse, SpacesResponse } from "../shared/api.ts";
import {
  blockPatchSchema,
  blockWriteSchema,
  itemKindRuleViolations,
  itemPatchSchema,
  itemWriteSchema,
  pagePatchSchema,
  pageWriteSchema,
  spacePatchSchema,
  spaceWriteSchema,
  templatePatchSchema,
  templateWriteSchema,
  type ItemPatch,
  type ItemWrite,
} from "../shared/schemas.ts";
import { NotFoundError, ValidationError } from "./errors.ts";
import {
  createBlock,
  createItemWithRespace,
  createPage,
  createSpace,
  createTemplate,
  deleteBlock,
  deleteItem,
  deletePage,
  deleteSpace,
  deleteTemplate,
  getBlock,
  getItem,
  getPage,
  getSpace,
  getTemplate,
  listPages,
  listSpaces,
  listTemplates,
  loadCalendarWindow,
  loadMirror,
  loadPageBlocks,
  updateBlock,
  updateItem,
  updatePage,
  updateSpace,
  updateTemplate,
} from "./db/index.ts";

export type EntityName = "space" | "page" | "block" | "item" | "template";

function logWrite(method: "PUT" | "PATCH" | "DELETE", entity: string, id: string, email: string) {
  console.log(`${method} ${entity}/${id} by ${email}`);
}

function immutable(field: string): ValidationError {
  return new ValidationError([{ path: field, code: "immutable" }], `Field '${field}' cannot be changed`);
}

function assertRow<T>(row: T | null): T {
  if (row === null) throw new Error("database update returned no row");
  return row;
}

// ============================================================
// Reads
// ============================================================

export async function getSpaces(db: D1Database): Promise<SpacesResponse> {
  const spaces = await listSpaces(db);
  const pages = await listPages(db);
  const templates = await listTemplates(db);

  const pagesBySpace = new Map<string, PageRow[]>();
  for (const page of pages) {
    const list = pagesBySpace.get(page.spaceId);
    if (list) list.push(page);
    else pagesBySpace.set(page.spaceId, [page]);
  }

  return {
    spaces: spaces.map((space) => ({ ...space, pages: pagesBySpace.get(space.id) ?? [] })),
    templates,
  };
}

export async function getPageDetail(db: D1Database, id: string): Promise<PageResponse> {
  const page = await getPage(db, id);
  if (!page) throw new NotFoundError(`Page '${id}' does not exist`);
  const blocks = await loadPageBlocks(db, id);
  return { page, blocks };
}

export async function getMirror(db: D1Database, spaceId: string): Promise<MirrorTask[]> {
  const space = await getSpace(db, spaceId);
  if (!space) throw new NotFoundError(`Space '${spaceId}' does not exist`);
  return loadMirror(db, spaceId);
}

export async function getCalendar(db: D1Database, from: string, to: string): Promise<CalendarResponse> {
  return loadCalendarWindow(db, from, to);
}

// ============================================================
// Reference checks — the DB foreign keys would also reject these, but that
// would surface as a raw driver error; an explicit check turns it into a
// 400 with the offending field path. `null` is always a valid value.
// ============================================================

type ReferenceKind = "space" | "page" | "block" | "template";

const getters: Record<ReferenceKind, (db: D1Database, id: string) => Promise<unknown | null>> = {
  space: getSpace,
  page: getPage,
  block: getBlock,
  template: getTemplate,
};

async function ensureExists(db: D1Database, kind: ReferenceKind, id: string, field: string): Promise<void> {
  const row = await getters[kind](db, id);
  if (!row) {
    throw new ValidationError([{ path: field, code: "not_found" }], `${kind} '${id}' does not exist`);
  }
}

async function checkItemRefs(db: D1Database, input: { assigneeSpaceId: string | null; refBlockId: string | null }) {
  if (input.assigneeSpaceId !== null) {
    await ensureExists(db, "space", input.assigneeSpaceId, "assigneeSpaceId");
  }
  if (input.refBlockId !== null) {
    await ensureExists(db, "block", input.refBlockId, "refBlockId");
  }
}

// ============================================================
// Writes — space
// ============================================================

export async function putSpace(db: D1Database, id: string, body: unknown, now: number, email: string): Promise<SpaceRow> {
  const input = spaceWriteSchema.parse(body);
  logWrite("PUT", "space", id, email);
  const existing = await getSpace(db, id);
  if (existing) return assertRow(await updateSpace(db, id, input, now));
  return createSpace(db, { ...input, id }, now);
}

export async function patchSpace(db: D1Database, id: string, body: unknown, now: number, email: string): Promise<SpaceRow> {
  const patch = spacePatchSchema.parse(body);
  logWrite("PATCH", "space", id, email);
  const existing = await getSpace(db, id);
  if (!existing) throw new NotFoundError(`Space '${id}' does not exist`);
  return assertRow(await updateSpace(db, id, patch, now));
}

// ============================================================
// Writes — page
// ============================================================

export async function putPage(db: D1Database, id: string, body: unknown, now: number, email: string): Promise<PageRow> {
  const input = pageWriteSchema.parse(body);
  logWrite("PUT", "page", id, email);
  const existing = await getPage(db, id);
  if (existing) {
    if (input.spaceId !== existing.spaceId) throw immutable("spaceId");
    return assertRow(await updatePage(db, id, { title: input.title }, now));
  }
  await ensureExists(db, "space", input.spaceId, "spaceId");
  return createPage(db, { ...input, id }, now);
}

export async function patchPage(db: D1Database, id: string, body: unknown, now: number, email: string): Promise<PageRow> {
  const patch = pagePatchSchema.parse(body);
  logWrite("PATCH", "page", id, email);
  const existing = await getPage(db, id);
  if (!existing) throw new NotFoundError(`Page '${id}' does not exist`);
  return assertRow(await updatePage(db, id, patch, now));
}

// ============================================================
// Writes — block
// ============================================================

export async function putBlock(db: D1Database, id: string, body: unknown, now: number, email: string): Promise<BlockRow> {
  const input = blockWriteSchema.parse(body);
  logWrite("PUT", "block", id, email);
  const existing = await getBlock(db, id);
  if (existing) {
    if (input.pageId !== existing.pageId) throw immutable("pageId");
    if (input.templateId !== null) await ensureExists(db, "template", input.templateId, "templateId");
    return assertRow(await updateBlock(db, id, { templateId: input.templateId, title: input.title, date: input.date }, now));
  }
  await ensureExists(db, "page", input.pageId, "pageId");
  if (input.templateId !== null) await ensureExists(db, "template", input.templateId, "templateId");
  return createBlock(db, { ...input, id }, now);
}

export async function patchBlock(db: D1Database, id: string, body: unknown, now: number, email: string): Promise<BlockRow> {
  const patch = blockPatchSchema.parse(body);
  logWrite("PATCH", "block", id, email);
  const existing = await getBlock(db, id);
  if (!existing) throw new NotFoundError(`Block '${id}' does not exist`);
  if (patch.templateId !== undefined && patch.templateId !== null) {
    await ensureExists(db, "template", patch.templateId, "templateId");
  }
  return assertRow(await updateBlock(db, id, patch, now));
}

// ============================================================
// Writes — template
// ============================================================

export async function putTemplate(
  db: D1Database,
  id: string,
  body: unknown,
  now: number,
  email: string,
): Promise<TemplateRow> {
  const input = templateWriteSchema.parse(body);
  logWrite("PUT", "template", id, email);
  const existing = await getTemplate(db, id);
  if (existing) return assertRow(await updateTemplate(db, id, input, now));
  return createTemplate(db, { ...input, id }, now);
}

export async function patchTemplate(
  db: D1Database,
  id: string,
  body: unknown,
  now: number,
  email: string,
): Promise<TemplateRow> {
  const patch = templatePatchSchema.parse(body);
  logWrite("PATCH", "template", id, email);
  const existing = await getTemplate(db, id);
  if (!existing) throw new NotFoundError(`Template '${id}' does not exist`);
  return assertRow(await updateTemplate(db, id, patch, now));
}

// ============================================================
// Writes — item
// ============================================================

/** All mutable content fields of an item, in the db layer's patch shape. */
function contentPatch(input: ItemWrite): ItemPatch {
  return {
    text: input.text,
    position: input.position,
    heading: input.heading,
    done: input.done,
    dueDate: input.dueDate,
    assigneeSpaceId: input.assigneeSpaceId,
    eventDate: input.eventDate,
    eventTime: input.eventTime,
    refBlockId: input.refBlockId,
  };
}

export async function putItem(db: D1Database, id: string, body: unknown, now: number, email: string): Promise<ItemWriteResponse> {
  const input = itemWriteSchema.parse(body);
  logWrite("PUT", "item", id, email);
  const existing = await getItem(db, id);
  if (existing) {
    if (input.kind !== existing.kind) throw immutable("kind");
    if (input.blockId !== existing.blockId) throw immutable("blockId");
    await checkItemRefs(db, input);
    return { row: assertRow(await updateItem(db, id, contentPatch(input), now)), respaced: null };
  }
  await ensureExists(db, "block", input.blockId, "blockId");
  await checkItemRefs(db, input);
  return createItemWithRespace(db, toNewItemInput(input, id), now);
}

function toNewItemInput(input: ItemWrite, id: string) {
  switch (input.kind) {
    case "note":
      return {
        id,
        blockId: input.blockId,
        kind: "note" as const,
        position: input.position,
        text: input.text,
        heading: input.heading,
      };
    case "task":
      return {
        id,
        blockId: input.blockId,
        kind: "task" as const,
        position: input.position,
        text: input.text,
        done: input.done,
        dueDate: input.dueDate,
        assigneeSpaceId: input.assigneeSpaceId,
      };
    case "event":
      return {
        id,
        blockId: input.blockId,
        kind: "event" as const,
        position: input.position,
        text: input.text,
        eventDate: input.eventDate,
        eventTime: input.eventTime,
      };
    case "ref":
      return {
        id,
        blockId: input.blockId,
        kind: "ref" as const,
        position: input.position,
        refBlockId: input.refBlockId,
      };
  }
}

export async function patchItem(db: D1Database, id: string, body: unknown, now: number, email: string): Promise<ItemWriteResponse> {
  const patch = itemPatchSchema.parse(body);
  logWrite("PATCH", "item", id, email);
  const existing = await getItem(db, id);
  if (!existing) throw new NotFoundError(`Item '${id}' does not exist`);

  const violations = itemKindRuleViolations({ kind: existing.kind, ...patch });
  if (violations.length > 0) {
    throw new ValidationError(violations.map(({ path, code }) => ({ path, code })), "Fields conflict with the item's kind");
  }

  if (patch.assigneeSpaceId !== undefined && patch.assigneeSpaceId !== null) {
    await ensureExists(db, "space", patch.assigneeSpaceId, "assigneeSpaceId");
  }
  if (patch.refBlockId !== undefined && patch.refBlockId !== null) {
    await ensureExists(db, "block", patch.refBlockId, "refBlockId");
  }
  return { row: assertRow(await updateItem(db, id, patch, now)), respaced: null };
}

// ============================================================
// Writes — delete
// ============================================================

export async function deleteEntity(
  db: D1Database,
  entity: EntityName,
  id: string,
  email: string,
): Promise<boolean> {
  logWrite("DELETE", entity, id, email);
  switch (entity) {
    case "space":
      return deleteSpace(db, id);
    case "page":
      return deletePage(db, id);
    case "block":
      return deleteBlock(db, id);
    case "item":
      return deleteItem(db, id);
    case "template":
      return deleteTemplate(db, id);
  }
}

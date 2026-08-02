import type { BlockRow, ItemKind, ItemRow, PageRow, SpaceKind, SpaceRow, TemplateRow } from "../../shared/db.ts";
import type { BlockPatch, ItemPatch, PagePatch, SpacePatch, TemplatePatch } from "../../shared/schemas.ts";
import { asClientError, type ApiClient } from "./client.ts";
import type { Dispatch } from "./reducer.ts";
import type { OptimisticWrite } from "./state.ts";

/**
 * The glue between the pure reducer and the HTTP client: apply the optimistic
 * write, send the request, then dispatch confirmation or a rollback. Called
 * by the future UI — no React here.
 */

export interface Operations {
  loadSpaces(): Promise<void>;
  loadPage(pageId: string): Promise<void>;
  loadMirror(spaceId: string): Promise<void>;
  loadCalendar(from: string, to: string): Promise<void>;

  createSpace(input: SpaceCreateInput): Promise<void>;
  updateSpace(id: string, patch: SpacePatch): Promise<void>;
  deleteSpace(id: string): Promise<void>;

  createPage(input: PageCreateInput): Promise<void>;
  updatePage(id: string, patch: PagePatch): Promise<void>;
  deletePage(id: string): Promise<void>;

  createBlock(input: BlockCreateInput): Promise<void>;
  updateBlock(id: string, patch: BlockPatch): Promise<void>;
  deleteBlock(id: string): Promise<void>;

  createItem(input: ItemCreateInput): Promise<void>;
  updateItem(id: string, patch: ItemPatch): Promise<void>;
  deleteItem(id: string): Promise<void>;

  createTemplate(input: TemplateCreateInput): Promise<void>;
  updateTemplate(id: string, patch: TemplatePatch): Promise<void>;
  deleteTemplate(id: string): Promise<void>;
}

export interface SpaceCreateInput {
  id: string;
  name: string;
  kind: SpaceKind;
  short: string;
}

export interface PageCreateInput {
  id: string;
  spaceId: string;
  title: string;
}

export interface BlockCreateInput {
  id: string;
  pageId: string;
  templateId?: string | null;
  title: string;
  date: string;
}

export interface ItemCreateInput {
  id: string;
  blockId: string;
  kind: ItemKind;
  position: number;
  text?: string;
  heading?: 1 | 2 | null;
  done?: boolean;
  dueDate?: string | null;
  assigneeSpaceId?: string | null;
  eventDate?: string | null;
  eventTime?: string | null;
  refBlockId?: string | null;
}

export interface TemplateCreateInput {
  id: string;
  label: string;
  hue: string;
  seed?: string[];
}

export function createOperations(client: ApiClient, dispatch: Dispatch): Operations {
  const loadSpaces = async () => {
    dispatch({ type: "spacesLoadStarted" });
    try {
      const data = await client.getSpaces();
      dispatch({
        type: "spacesLoaded",
        spaces: data.spaces,
        pages: data.spaces.flatMap((space) => space.pages),
        templates: data.templates,
      });
    } catch (err) {
      dispatch({ type: "spacesLoadFailed", error: asClientError(err) });
    }
  };

  const loadPage = async (pageId: string) => {
    dispatch({ type: "pageLoadStarted", pageId });
    try {
      const data = await client.getPage(pageId);
      dispatch({ type: "pageLoaded", page: data.page, blocks: data.blocks });
    } catch (err) {
      dispatch({ type: "pageLoadFailed", pageId, error: asClientError(err) });
    }
  };

  const loadMirror = async (spaceId: string) => {
    dispatch({ type: "mirrorLoadStarted", spaceId });
    try {
      const tasks = await client.getMirror(spaceId);
      dispatch({ type: "mirrorLoaded", spaceId, tasks });
    } catch (err) {
      dispatch({ type: "mirrorLoadFailed", spaceId, error: asClientError(err) });
    }
  };

  const loadCalendar = async (from: string, to: string) => {
    dispatch({ type: "calendarLoadStarted" });
    try {
      const window = await client.getCalendar(from, to);
      dispatch({ type: "calendarLoaded", blocks: window.blocks, dueTasks: window.dueTasks, events: window.events });
    } catch (err) {
      dispatch({ type: "calendarLoadFailed", error: asClientError(err) });
    }
  };

  let opSeq = 0;
  const opKey = (entity: string, id: string, change: string) => `${entity}:${id}:${change}:${++opSeq}`;

  const runWrite = async (op: OptimisticWrite, send: () => Promise<unknown>) => {
    dispatch({ type: "writeOptimistic", op, now: Date.now() });
    try {
      await send();
      dispatch({ type: "writeConfirmed", opKey: op.opKey });
    } catch (err) {
      dispatch({ type: "writeFailed", opKey: op.opKey, error: asClientError(err), now: Date.now() });
    }
  };

  return {
    loadSpaces,
    loadPage,
    loadMirror,
    loadCalendar,

    createSpace: (input) =>
      runWrite({ opKey: opKey("space", input.id, "put"), entity: "space", id: input.id, change: "put", row: toSpaceRow(input) }, () =>
        client.put("space", input.id, toSpaceBody(input)),
      ),
    updateSpace: (id, patch) =>
      runWrite({ opKey: opKey("space", id, "patch"), entity: "space", id, change: "patch", patch }, () => client.patch("space", id, patch)),
    deleteSpace: (id) =>
      runWrite({ opKey: opKey("space", id, "delete"), entity: "space", id, change: "delete" }, () => client.delete("space", id)),

    createPage: (input) =>
      runWrite({ opKey: opKey("page", input.id, "put"), entity: "page", id: input.id, change: "put", row: toPageRow(input) }, () =>
        client.put("page", input.id, toPageBody(input)),
      ),
    updatePage: (id, patch) =>
      runWrite({ opKey: opKey("page", id, "patch"), entity: "page", id, change: "patch", patch }, () => client.patch("page", id, patch)),
    deletePage: (id) =>
      runWrite({ opKey: opKey("page", id, "delete"), entity: "page", id, change: "delete" }, () => client.delete("page", id)),

    createBlock: (input) =>
      runWrite({ opKey: opKey("block", input.id, "put"), entity: "block", id: input.id, change: "put", row: toBlockRow(input) }, () =>
        client.put("block", input.id, toBlockBody(input)),
      ),
    updateBlock: (id, patch) =>
      runWrite({ opKey: opKey("block", id, "patch"), entity: "block", id, change: "patch", patch }, () => client.patch("block", id, patch)),
    deleteBlock: (id) =>
      runWrite({ opKey: opKey("block", id, "delete"), entity: "block", id, change: "delete" }, () => client.delete("block", id)),

    createItem: (input) =>
      runWrite({ opKey: opKey("item", input.id, "put"), entity: "item", id: input.id, change: "put", row: toItemRow(input) }, () =>
        client.put("item", input.id, toItemBody(input)),
      ),
    updateItem: (id, patch) =>
      runWrite({ opKey: opKey("item", id, "patch"), entity: "item", id, change: "patch", patch }, () => client.patch("item", id, patch)),
    deleteItem: (id) =>
      runWrite({ opKey: opKey("item", id, "delete"), entity: "item", id, change: "delete" }, () => client.delete("item", id)),

    createTemplate: (input) =>
      runWrite(
        { opKey: opKey("template", input.id, "put"), entity: "template", id: input.id, change: "put", row: toTemplateRow(input) },
        () => client.put("template", input.id, toTemplateBody(input)),
      ),
    updateTemplate: (id, patch) =>
      runWrite({ opKey: opKey("template", id, "patch"), entity: "template", id, change: "patch", patch }, () =>
        client.patch("template", id, patch),
      ),
    deleteTemplate: (id) =>
      runWrite({ opKey: opKey("template", id, "delete"), entity: "template", id, change: "delete" }, () => client.delete("template", id)),
  };
}

// ============================================================
// Optimistic row building (id + client timestamp) and API bodies
// ============================================================

function now(): number {
  return Date.now();
}

function toSpaceRow(input: SpaceCreateInput): SpaceRow {
  const ts = now();
  return { id: input.id, name: input.name, kind: input.kind, short: input.short, createdAt: ts, updatedAt: ts };
}

function toPageRow(input: PageCreateInput): PageRow {
  const ts = now();
  return { id: input.id, spaceId: input.spaceId, title: input.title, createdAt: ts, updatedAt: ts };
}

function toBlockRow(input: BlockCreateInput): BlockRow {
  const ts = now();
  return {
    id: input.id,
    pageId: input.pageId,
    templateId: input.templateId ?? null,
    title: input.title,
    date: input.date,
    createdAt: ts,
    updatedAt: ts,
  };
}

function toItemRow(input: ItemCreateInput): ItemRow {
  const ts = now();
  return {
    id: input.id,
    blockId: input.blockId,
    kind: input.kind,
    position: input.position,
    text: input.text ?? "",
    heading: input.heading ?? null,
    done: input.done ?? false,
    dueDate: input.dueDate ?? null,
    assigneeSpaceId: input.assigneeSpaceId ?? null,
    eventDate: input.eventDate ?? null,
    eventTime: input.eventTime ?? null,
    refBlockId: input.refBlockId ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
}

function toTemplateRow(input: TemplateCreateInput): TemplateRow {
  const ts = now();
  return { id: input.id, label: input.label, hue: input.hue, seed: input.seed ?? [], createdAt: ts, updatedAt: ts };
}

function toSpaceBody(input: SpaceCreateInput) {
  return { name: input.name, kind: input.kind, short: input.short };
}

function toPageBody(input: PageCreateInput) {
  return { spaceId: input.spaceId, title: input.title };
}

function toBlockBody(input: BlockCreateInput) {
  return { pageId: input.pageId, templateId: input.templateId ?? null, title: input.title, date: input.date };
}

function toItemBody(input: ItemCreateInput) {
  return {
    blockId: input.blockId,
    kind: input.kind,
    position: input.position,
    text: input.text ?? "",
    heading: input.heading ?? null,
    done: input.done ?? false,
    dueDate: input.dueDate ?? null,
    assigneeSpaceId: input.assigneeSpaceId ?? null,
    eventDate: input.eventDate ?? null,
    eventTime: input.eventTime ?? null,
    refBlockId: input.refBlockId ?? null,
  };
}

function toTemplateBody(input: TemplateCreateInput) {
  return { label: input.label, hue: input.hue, seed: input.seed ?? [] };
}

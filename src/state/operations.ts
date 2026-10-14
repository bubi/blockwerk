import { readDraft, writeDraft } from "../domain/drafts.ts";
import type { PageResponse } from "../../shared/api.ts";
import type {
  BlockRow,
  ItemKind,
  ItemRow,
  PageRow,
  SpaceKind,
  SpaceRow,
  TemplateRow,
} from "../../shared/db.ts";
import type {
  BlockPatch,
  ItemPatch,
  PagePatch,
  SpacePatch,
  TemplatePatch,
} from "../../shared/schemas.ts";
import { asClientError, type ApiClient } from "./client.ts";
import type { Action, Dispatch } from "./reducer.ts";
import type { AppState, OptimisticWrite } from "./state.ts";

/**
 * The glue between the pure reducer and the HTTP client: apply the optimistic
 * write, send the request, then dispatch confirmation or a rollback. Called
 * by the future UI — no React here.
 */

export interface Operations {
  loadSpaces(): Promise<void>;
  loadCatalog(): Promise<void>;
  loadPage(pageId: string): Promise<PageResponse | undefined>;
  loadCalendar(from: string, to: string): Promise<void>;
  /** Loads the task overview (all open tasks + next days' events). */
  loadOverview(today: string): Promise<void>;
  /** Searches across all blocks and items; a blank query resets the view. */
  search(query: string): Promise<void>;
  /** Resets the search view and discards any in-flight request. */
  clearSearch(): void;

  createSpace(input: SpaceCreateInput): Promise<boolean>;
  updateSpace(id: string, patch: SpacePatch): Promise<boolean>;
  deleteSpace(id: string): Promise<boolean>;

  createPage(input: PageCreateInput): Promise<boolean>;
  updatePage(id: string, patch: PagePatch): Promise<boolean>;
  deletePage(id: string): Promise<boolean>;

  createBlock(input: BlockCreateInput): Promise<boolean>;
  updateBlock(id: string, patch: BlockPatch): Promise<boolean>;
  deleteBlock(id: string): Promise<boolean>;

  createItem(input: ItemCreateInput): Promise<boolean>;
  updateItem(id: string, patch: ItemPatch): Promise<boolean>;
  deleteItem(id: string): Promise<boolean>;
  /** Moves an item into another block (Feature 2, docs/adr/0017). */
  mergeItems(items: readonly ItemRow[]): Promise<boolean>;
  moveItem(id: string, blockId: string, position: number): Promise<boolean>;

  createTemplate(input: TemplateCreateInput): Promise<boolean>;
  updateTemplate(id: string, patch: TemplatePatch): Promise<boolean>;
  deleteTemplate(id: string): Promise<boolean>;

  flushWrites(): void;
  undoLast(): Promise<boolean>;
  updateUndoRevision(id: string): void;
  convertItem(id: string, kind: "note" | "task" | "event"): Promise<boolean>;

  /** Dismisses a visible error notification. */
  dismissNotification(id: string): void;
}

export interface SpaceCreateInput {
  id: string;
  name: string;
  kind: SpaceKind;
  short: string;
  email?: string | null;
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
  /** The task a note belongs to (docs/adr/0014); notes only, immutable. */
  parentItemId?: string | null;
  /** A note's list marker (`*` or `-`), like heading a marker on the note. */
  listMark?: "*" | "-" | null;
}

export interface TemplateCreateInput {
  id: string;
  label: string;
  hue: string;
  seed?: string[];
}

export function createOperations(
  client: ApiClient,
  dispatch: Dispatch,
  getState?: () => AppState,
): Operations {
  const versions = new Map<string, number>();
  const version = (id: string) =>
    versions.get(id) ?? getState?.().items.get(id)?.updatedAt;
  const readStable = async <T>(read: () => Promise<T>): Promise<T> => {
    for (;;) {
      flushWrites();
      await writeQueue;
      const sequence = opSeq;
      const data = await read();
      if (sequence === opSeq) return data;
    }
  };
  const loadSpaces = async () => {
    dispatch({ type: "spacesLoadStarted" });
    try {
      const data = await client.getSpaces();
      dispatch({
        type: "spacesLoaded",
        spaces: data.spaces,
        pages: data.spaces.flatMap((space) => space.pages),
        templates: data.templates,
        meSpaceId: data.meSpaceId,
      });
    } catch (err) {
      dispatch({ type: "spacesLoadFailed", error: asClientError(err) });
    }
  };

  const loadPage = async (pageId: string) => {
    dispatch({ type: "pageLoadStarted", pageId });
    try {
      const data = await readStable(() => client.getPage(pageId));
      for (const block of data.blocks)
        for (const item of block.items)
          if (!getState?.().pending.size) versions.set(item.id, item.updatedAt);
      dispatch({ type: "pageLoaded", page: data.page, blocks: data.blocks });
      return data;
    } catch (err) {
      dispatch({ type: "pageLoadFailed", pageId, error: asClientError(err) });
    }
  };

  const loadOverview = async (today: string) => {
    dispatch({ type: "overviewLoadStarted" });
    try {
      const response = await readStable(() => client.getOverview(today));
      dispatch({ type: "overviewLoaded", response });
    } catch (err) {
      dispatch({ type: "overviewLoadFailed", error: asClientError(err) });
    }
  };

  const loadCalendar = async (from: string, to: string) => {
    dispatch({ type: "calendarLoadStarted" });
    try {
      const window = await readStable(() => client.getCalendar(from, to));
      dispatch({
        type: "calendarLoaded",
        dueTasks: window.dueTasks,
        events: window.events,
      });
    } catch (err) {
      dispatch({ type: "calendarLoadFailed", error: asClientError(err) });
    }
  };

  let opSeq = 0;
  const opKey = (entity: string, id: string, change: string) =>
    `${entity}:${id}:${change}:${++opSeq}`;

  // Search is a live view: each keystroke may fire a request, and responses
  // can arrive out of order. Only the request for the newest query may touch
  // the state — older responses are dropped by the sequence guard below.
  let searchSeq = 0;
  const search = async (rawQuery: string) => {
    const query = rawQuery.trim();
    if (query === "") {
      searchSeq++;
      dispatch({ type: "searchCleared" });
      return;
    }
    const seq = ++searchSeq;
    dispatch({ type: "searchLoadStarted", query });
    try {
      const response = await client.search(query);
      if (seq !== searchSeq) return;
      dispatch({ type: "searchLoaded", response });
    } catch (err) {
      if (seq !== searchSeq) return;
      dispatch({ type: "searchLoadFailed", query, error: asClientError(err) });
    }
  };

  const clearSearch = () => {
    searchSeq++;
    dispatch({ type: "searchCleared" });
  };

  let writeQueue: Promise<unknown> = Promise.resolve();

  const patches = new Map<
    string,
    {
      patch: ItemPatch;
      ops: OptimisticWrite[];
      resolve: Array<(ok: boolean) => void>;
      timer: ReturnType<typeof setTimeout>;
    }
  >();
  const flushWrites = () => {
    for (const [id, batch] of patches) {
      clearTimeout(batch.timer);
      patches.delete(id);
      const task = writeQueue.then(async () => {
        try {
          const expected = version(id);
          const result =
            expected === undefined
              ? await client.patchItem(id, batch.patch)
              : await client.patchItem(id, batch.patch, expected);
          versions.set(id, result.row.updatedAt);
          if (readDraft(`item-${id}`)?.value === result.row.text)
            writeDraft(`item-${id}`, {
              value: "",
              mode: null,
              mentionId: null,
              refTarget: "",
            });
          for (const op of batch.ops)
            dispatch(confirmedAction(op.opKey, result));
          batch.resolve.forEach((resolve) => resolve(true));
        } catch (error) {
          for (const op of batch.ops)
            dispatch({
              type: "writeFailed",
              opKey: op.opKey,
              error: asClientError(error),
              now: Date.now(),
            });
          batch.resolve.forEach((resolve) => resolve(false));
        }
      });
      writeQueue = task;
    }
  };

  const runWrite = (op: OptimisticWrite, send: () => Promise<unknown>) => {
    flushWrites();
    if (op.entity === "item" && !versions.has(op.id)) {
      const current = getState?.().items.get(op.id);
      if (current) versions.set(op.id, current.updatedAt);
    }
    dispatch({ type: "writeOptimistic", op, now: Date.now() });
    const result = writeQueue.then(async () => {
      try {
        const result = await send();
        if (result && typeof result === "object" && "row" in result) {
          const row = (result as { row: ItemRow }).row;
          if (row?.id && typeof row.updatedAt === "number")
            versions.set(row.id, row.updatedAt);
        }
        dispatch(confirmedAction(op.opKey, result));
        return true;
      } catch (err) {
        dispatch({
          type: "writeFailed",
          opKey: op.opKey,
          error: asClientError(err),
          now: Date.now(),
        });
        return false;
      }
    });
    writeQueue = result;
    return result;
  };

  return {
    flushWrites,
    loadSpaces,
    loadCatalog: async () => {
      if (!client.getCatalog) return;
      try {
        const data = await readStable(() => client.getCatalog!());
        dispatch({ type: "catalogLoaded", ...data });
      } catch (error) {
        dispatch({
          type: "operationFailed",
          entity: "block",
          id: "catalog",
          error: asClientError(error),
        });
      }
    },
    loadPage,
    loadOverview,
    loadCalendar,
    search,
    clearSearch,

    createSpace: (input) =>
      runWrite(
        {
          opKey: opKey("space", input.id, "put"),
          entity: "space",
          id: input.id,
          change: "put",
          row: toSpaceRow(input),
        },
        () => client.put("space", input.id, toSpaceBody(input)),
      ),
    updateSpace: (id, patch) =>
      runWrite(
        {
          opKey: opKey("space", id, "patch"),
          entity: "space",
          id,
          change: "patch",
          patch,
        },
        () => client.patch("space", id, patch),
      ),
    deleteSpace: (id) =>
      runWrite(
        {
          opKey: opKey("space", id, "delete"),
          entity: "space",
          id,
          change: "delete",
        },
        () => client.delete("space", id),
      ),

    createPage: (input) =>
      runWrite(
        {
          opKey: opKey("page", input.id, "put"),
          entity: "page",
          id: input.id,
          change: "put",
          row: toPageRow(input),
        },
        () => client.put("page", input.id, toPageBody(input)),
      ),
    updatePage: (id, patch) =>
      runWrite(
        {
          opKey: opKey("page", id, "patch"),
          entity: "page",
          id,
          change: "patch",
          patch,
        },
        () => client.patch("page", id, patch),
      ),
    deletePage: (id) =>
      runWrite(
        {
          opKey: opKey("page", id, "delete"),
          entity: "page",
          id,
          change: "delete",
        },
        () => client.delete("page", id),
      ),

    createBlock: (input) =>
      runWrite(
        {
          opKey: opKey("block", input.id, "put"),
          entity: "block",
          id: input.id,
          change: "put",
          row: toBlockRow(input),
        },
        () => client.put("block", input.id, toBlockBody(input)),
      ),
    updateBlock: (id, patch) =>
      runWrite(
        {
          opKey: opKey("block", id, "patch"),
          entity: "block",
          id,
          change: "patch",
          patch,
        },
        () => client.patch("block", id, patch),
      ),
    deleteBlock: (id) =>
      runWrite(
        {
          opKey: opKey("block", id, "delete"),
          entity: "block",
          id,
          change: "delete",
        },
        () => client.delete("block", id),
      ),

    createItem: (input) =>
      runWrite(
        {
          opKey: opKey("item", input.id, "put"),
          entity: "item",
          id: input.id,
          change: "put",
          row: toItemRow(input),
        },
        () => client.putItem(input.id, toItemBody(input)),
      ),
    updateItem: (id, patch) => {
      if (!versions.has(id)) {
        const current = getState?.().items.get(id);
        if (current) versions.set(id, current.updatedAt);
      }
      const op: OptimisticWrite = {
        opKey: opKey("item", id, "patch"),
        entity: "item",
        id,
        change: "patch",
        patch,
      };
      dispatch({ type: "writeOptimistic", op, now: Date.now() });
      const old = patches.get(id);
      if (old) clearTimeout(old.timer);
      return new Promise<boolean>((resolve) => {
        patches.set(id, {
          patch: { ...old?.patch, ...patch },
          ops: [...(old?.ops ?? []), op],
          resolve: [...(old?.resolve ?? []), resolve],
          timer: setTimeout(flushWrites, getState ? 180 : 0),
        });
      });
    },
    deleteItem: (id) =>
      runWrite(
        {
          opKey: opKey("item", id, "delete"),
          entity: "item",
          id,
          change: "delete",
        },
        () =>
          version(id) === undefined
            ? client.delete("item", id)
            : client.delete("item", id, version(id)),
      ),
    updateUndoRevision: (id) => {
      const updatedAt = versions.get(id);
      if (updatedAt !== undefined)
        dispatch({ type: "undoRevisionUpdated", id, updatedAt });
    },
    undoLast: () => {
      flushWrites();
      const task = writeQueue.then(async () => {
        const undo = getState?.().undoHistory.at(-1);
        if (!undo || !client.restoreItems) return false;
        try {
          const result = await client.restoreItems(
            undo.rows.map((row) => ({
              id: row.id,
              createdAt: row.createdAt,
              updatedAt: row.updatedAt,
              data: toItemBody(row),
            })),
            undo.expectedUpdatedAt,
          );
          for (const row of result.rows) versions.set(row.id, row.updatedAt);
          dispatch({ type: "itemsRestored", rows: result.rows });
          return true;
        } catch (error) {
          dispatch({
            type: "operationFailed",
            entity: "item",
            id: undo.rows[0]!.id,
            error: asClientError(error),
          });
          return false;
        }
      });
      writeQueue = task;
      return task;
    },
    convertItem: (id, kind) => {
      flushWrites();
      const task = writeQueue.then(async () => {
        const original = getState?.().items.get(id);
        if (!original || !client.convertItem) return false;
        try {
          const result = await client.convertItem(
            id,
            kind,
            version(id) ?? original.updatedAt,
          );
          versions.set(id, result.row.updatedAt);
          dispatch({
            type: "recordUndo",
            undo: {
              rows: [original],
              expectedUpdatedAt: result.row.updatedAt,
              label: "Eintrag umwandeln",
            },
          });
          dispatch({ type: "itemsMerged", row: result.row, deletedIds: [] });
          return true;
        } catch (error) {
          dispatch({
            type: "operationFailed",
            entity: "item",
            id,
            error: asClientError(error),
          });
          return false;
        }
      });
      writeQueue = task;
      return task;
    },
    mergeItems: (items) => {
      flushWrites();
      const task = writeQueue.then(async () => {
        try {
          if (!client.mergeItems) throw new Error("Merge API unavailable");
          const result = await client.mergeItems(
            items.map((item) => ({
              id: item.id,
              updatedAt: version(item.id) ?? item.updatedAt,
            })),
          );
          versions.set(result.row.id, result.row.updatedAt);
          dispatch({
            type: "recordUndo",
            undo: {
              rows: [...items],
              expectedUpdatedAt: result.row.updatedAt,
              label: "Notizen zusammenfassen",
            },
          });
          dispatch({ type: "itemsMerged", ...result });
          return true;
        } catch (err) {
          dispatch({
            type: "operationFailed",
            entity: "item",
            id: items[0]!.id,
            error: asClientError(err),
          });
          return false;
        }
      });
      writeQueue = task;
      return task;
    },
    moveItem: (id, blockId, position) =>
      runWrite(
        {
          opKey: opKey("item", id, "move"),
          entity: "item",
          id,
          change: "move",
          blockId,
          position,
        },
        () =>
          version(id) === undefined
            ? client.moveItem(id, { blockId, position })
            : client.moveItem(
                id,
                { blockId, position, append: true },
                version(id),
              ),
      ),

    createTemplate: (input) =>
      runWrite(
        {
          opKey: opKey("template", input.id, "put"),
          entity: "template",
          id: input.id,
          change: "put",
          row: toTemplateRow(input),
        },
        () => client.put("template", input.id, toTemplateBody(input)),
      ),
    updateTemplate: (id, patch) =>
      runWrite(
        {
          opKey: opKey("template", id, "patch"),
          entity: "template",
          id,
          change: "patch",
          patch,
        },
        () => client.patch("template", id, patch),
      ),
    deleteTemplate: (id) =>
      runWrite(
        {
          opKey: opKey("template", id, "delete"),
          entity: "template",
          id,
          change: "delete",
        },
        () => client.delete("template", id),
      ),

    dismissNotification: (id) => dispatch({ type: "dismissNotification", id }),
  };
}

// ============================================================
// Optimistic row building (id + client timestamp) and API bodies
// ============================================================

/**
 * A confirmed item write may carry the block's re-spaced positions (the
 * server's answer to an exhausted position gap). The confirmation action
 * forwards them so the reducer can bring the local order in line.
 */
function confirmedAction(
  opKey: string,
  result: unknown,
): Extract<Action, { type: "writeConfirmed" }> {
  const respaced = extractRespaced(result);
  const row =
    result && typeof result === "object" && "row" in result
      ? (result as { row: ItemRow }).row
      : null;
  if (row?.id)
    return {
      type: "writeConfirmed",
      opKey,
      respaced: respaced ?? undefined,
      row,
    };
  return respaced === null
    ? { type: "writeConfirmed", opKey }
    : { type: "writeConfirmed", opKey, respaced };
}

function extractRespaced(result: unknown): Record<string, number> | null {
  if (typeof result === "object" && result !== null && "row" in result) {
    const respaced = (result as { respaced?: unknown }).respaced;
    if (respaced !== null && typeof respaced === "object")
      return respaced as Record<string, number>;
  }
  return null;
}

function now(): number {
  return Date.now();
}

function toSpaceRow(input: SpaceCreateInput): SpaceRow {
  const ts = now();
  return {
    id: input.id,
    name: input.name,
    kind: input.kind,
    short: input.short,
    email: input.email ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
}

function toPageRow(input: PageCreateInput): PageRow {
  const ts = now();
  return {
    id: input.id,
    spaceId: input.spaceId,
    title: input.title,
    createdAt: ts,
    updatedAt: ts,
  };
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
    parentItemId: input.parentItemId ?? null,
    listMark: input.listMark ?? null,
    createdAt: ts,
    updatedAt: ts,
  };
}

function toTemplateRow(input: TemplateCreateInput): TemplateRow {
  const ts = now();
  return {
    id: input.id,
    label: input.label,
    hue: input.hue,
    seed: input.seed ?? [],
    createdAt: ts,
    updatedAt: ts,
  };
}

function toSpaceBody(input: SpaceCreateInput) {
  return {
    name: input.name,
    kind: input.kind,
    short: input.short,
    email: input.email ?? null,
  };
}

function toPageBody(input: PageCreateInput) {
  return { spaceId: input.spaceId, title: input.title };
}

function toBlockBody(input: BlockCreateInput) {
  return {
    pageId: input.pageId,
    templateId: input.templateId ?? null,
    title: input.title,
    date: input.date,
  };
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
    parentItemId: input.parentItemId ?? null,
    listMark: input.listMark ?? null,
  };
}

function toTemplateBody(input: TemplateCreateInput) {
  return { label: input.label, hue: input.hue, seed: input.seed ?? [] };
}

import type {
  ApiBlock,
  OverviewResponse,
  SearchResponse,
} from "../../shared/api.ts";
import type {
  BlockRow,
  ItemRow,
  PageRow,
  SpaceRow,
  TemplateRow,
} from "../../shared/db.ts";
import type {
  AppState,
  ClientError,
  DeleteWrite,
  EntityName,
  EntityRow,
  OptimisticWrite,
  PendingOperation,
  UndoPlan,
  ViewStatus,
  UserUndo,
} from "./state.ts";

export type Dispatch = (action: Action) => void;

export type Action =
  // ---- loads (per view: started / loaded / failed, data kept on reload) ----
  | { type: "spacesLoadStarted" }
  | {
      type: "spacesLoaded";
      spaces: SpaceRow[];
      pages: PageRow[];
      templates: TemplateRow[];
      meSpaceId: string | null;
    }
  | { type: "spacesLoadFailed"; error: ClientError }
  | { type: "pageLoadStarted"; pageId: string }
  | { type: "pageLoaded"; page: PageRow; blocks: ApiBlock[] }
  | { type: "pageLoadFailed"; pageId: string; error: ClientError }
  | { type: "calendarLoadStarted" }
  | { type: "calendarLoaded"; dueTasks: ItemRow[]; events: ItemRow[] }
  | { type: "calendarLoadFailed"; error: ClientError }
  | { type: "overviewLoadStarted" }
  | { type: "overviewLoaded"; response: OverviewResponse }
  | { type: "overviewLoadFailed"; error: ClientError }
  | { type: "searchLoadStarted"; query: string }
  | { type: "searchLoaded"; response: SearchResponse }
  | { type: "searchLoadFailed"; query: string; error: ClientError }
  | { type: "searchCleared" }
  // ---- optimistic writes ----
  | { type: "writeOptimistic"; op: OptimisticWrite; now: number }
  | { type: "writeConfirmed"; opKey: string; respaced?: Record<string, number>; row?: ItemRow }
  | { type: "writeFailed"; opKey: string; error: ClientError; now: number }
  | { type: "undoRevisionUpdated"; id: string; updatedAt: number }
  | { type: "recordUndo"; undo: UserUndo }
  | { type: "itemsRestored"; rows: ItemRow[] }
  | { type: "catalogLoaded"; blocks: BlockRow[]; pages: PageRow[]; items: ItemRow[] }
  | { type: "itemsMerged"; row: ItemRow; deletedIds: string[] }
  | { type: "operationFailed"; entity: EntityName; id: string; error: ClientError }
  | { type: "dismissNotification"; id: string };

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "spacesLoadStarted":
      return { ...state, spacesView: { status: "loading" } };
    case "spacesLoaded":
      return {
        ...state,
        spaces: mapOf(action.spaces),
        pages: mapOf(action.pages),
        templates: mapOf(action.templates),
        meSpaceId: action.meSpaceId,
        spacesView: { status: "loaded" },
      };
    case "spacesLoadFailed":
      return {
        ...state,
        spacesView: { status: "failed", error: action.error },
      };
    case "pageLoadStarted":
      return {
        ...state,
        pageViews: setView(state.pageViews, action.pageId, {
          status: "loading",
        }),
      };
    case "pageLoaded":
      return applyPageLoaded(state, action);
    case "pageLoadFailed":
      return {
        ...state,
        pageViews: setView(state.pageViews, action.pageId, {
          status: "failed",
          error: action.error,
        }),
      };
    case "calendarLoadStarted":
      return { ...state, calendarView: { status: "loading" } };
    case "calendarLoaded":
      return {
        ...state,
        items: mergeRows(state.items, [...action.dueTasks, ...action.events]),
        calendarView: { status: "loaded" },
      };
    case "calendarLoadFailed":
      return {
        ...state,
        calendarView: { status: "failed", error: action.error },
      };
    case "overviewLoadStarted":
      return { ...state, overviewView: { status: "loading" } };
    case "overviewLoaded":
      return applyOverviewLoaded(state, action);
    case "overviewLoadFailed":
      return {
        ...state,
        overviewView: { status: "failed", error: action.error },
      };
    case "searchLoadStarted":
      return {
        ...state,
        // Keep the previous results while the new query loads, so live
        // search does not flicker on every keystroke.
        search: {
          query: action.query,
          results: state.search.results,
          view: { status: "loading" },
        },
      };
    case "searchLoaded":
      return {
        ...state,
        search: {
          query: action.response.query,
          results: action.response,
          view: { status: "loaded" },
        },
      };
    case "searchLoadFailed":
      return {
        ...state,
        search: {
          query: action.query,
          results: null,
          view: { status: "failed", error: action.error },
        },
      };
    case "searchCleared":
      return {
        ...state,
        search: { query: "", results: null, view: { status: "idle" } },
      };
    case "writeOptimistic":
      return applyWrite(state, action.op, action.now);
    case "catalogLoaded": return overlayPending({ ...state, blocks: mergeRows(state.blocks, action.blocks), pages: mergeRows(state.pages, action.pages), items: mergeRows(state.items, action.items) });
    case "undoRevisionUpdated": {
      const last = state.undoHistory.at(-1);
      if (!last || last.label !== "Eintrag umwandeln" || last.rows[0]?.id !== action.id) return state;
      return { ...state, undoHistory: [...state.undoHistory.slice(0, -1), { ...last, expectedUpdatedAt: action.updatedAt }] };
    }
    case "recordUndo": return { ...state, undoHistory: [...state.undoHistory.slice(-9), action.undo] };
    case "itemsRestored": return { ...state, items: mergeRows(state.items, action.rows), undoHistory: state.undoHistory.slice(0, -1) };
    case "itemsMerged": {
      const items = new Map(state.items);
      for (const id of action.deletedIds) items.delete(id);
      items.set(action.row.id, action.row);
      return { ...state, items };
    }
    case "operationFailed":
      return { ...state, notifications: [...state.notifications, { id: `failed-${Date.now()}`, kind: "error", entity: action.entity, entityId: action.id, error: action.error, createdAt: Date.now() }] };
    case "writeConfirmed":
      return confirmWrite(state, action.opKey, action.respaced, action.row);
    case "writeFailed":
      return failWrite(state, action.opKey, action.error, action.now);
    case "dismissNotification":
      return {
        ...state,
        notifications: state.notifications.filter(
          (notification) => notification.id !== action.id,
        ),
      };
  }
}

// ============================================================
// Loads
// ============================================================

function applyPageLoaded(
  state: AppState,
  action: Extract<Action, { type: "pageLoaded" }>,
): AppState {
  const { page, blocks } = action;
  const returned = new Set(blocks.map((entry) => entry.id));

  // Replace this page's block subtree: drop blocks no longer returned (and
  // their items), then merge the returned ones.
  const dropped = [...state.blocks.values()].filter(
    (entry) => entry.pageId === page.id && !returned.has(entry.id),
  );
  const droppedIds = new Set(dropped.map((entry) => entry.id));

  const blocksMap = new Map(state.blocks);
  const itemsMap = new Map(state.items);
  for (const droppedBlock of dropped) blocksMap.delete(droppedBlock.id);
  for (const [id, item] of itemsMap)
    if (droppedIds.has(item.blockId) || returned.has(item.blockId)) itemsMap.delete(id);
  for (const entry of blocks) {
    blocksMap.set(entry.id, entry);
    for (const item of entry.items) itemsMap.set(item.id, item);
  }

  return overlayPending({
    ...state,
    pages: setMap(state.pages, page.id, page),
    blocks: blocksMap,
    items: itemsMap,
    pageViews: setView(state.pageViews, page.id, { status: "loaded" }),
  });
}

function applyOverviewLoaded(
  state: AppState,
  action: Extract<Action, { type: "overviewLoaded" }>,
): AppState {
  const { tasks, events, notes, blocks, pages } = action.response;
  return {
    ...state,
    items: mergeRows(state.items, [...tasks, ...events, ...notes]),
    blocks: mergeRows(state.blocks, blocks),
    pages: mergeRows(state.pages, pages),
    overviewView: { status: "loaded" },
  };
}

// ============================================================
// Optimistic writes
// ============================================================

function applyWrite(
  state: AppState,
  op: OptimisticWrite,
  now: number,
): AppState {
  const existing = getRow(state, op.entity, op.id);
  switch (op.change) {
    case "put": {
      const undo: UndoPlan = existing
        ? {
            remove: [],
            restore: [{ entity: op.entity, id: op.id, row: existing }],
          }
        : { remove: [{ entity: op.entity, id: op.id }], restore: [] };
      return addPending(setRow(state, op.entity, op.row), op, undo);
    }
    case "patch": {
      // A patch to a row we do not know would be a programming error; the
      // server would 404. Ignore it locally — nothing to show, nothing to undo.
      if (!existing) return state;
      // `existing` and `op.patch` are correlated per `op.entity`; the merged
      // spread is the entity's row, so the cast is structural, not a lie.
      const merged = { ...existing, ...op.patch, updatedAt: now } as EntityRow;
      const undo: UndoPlan = {
        remove: [],
        restore: [{ entity: op.entity, id: op.id, row: existing }],
      };
      return addPending(setRow(state, op.entity, merged), op, undo);
    }
    case "move": {
      // The item moves to another block (Feature 2, docs/adr/0017); identity,
      // kind and text stay. The undo restores block and position.
      const item = state.items.get(op.id);
      if (!item) return state;
      const undo: UndoPlan = {
        remove: [],
        restore: [{ entity: "item", id: op.id, row: item }],
      };
      const moved = {
        ...item,
        blockId: op.blockId,
        position: op.position,
        updatedAt: now,
      };
      return addPending(setRow(state, "item", moved), op, undo);
    }
    case "delete":
      return applyDelete(state, op);
  }
}

function applyDelete(state: AppState, op: DeleteWrite): AppState {
  switch (op.entity) {
    case "item":
      return deleteItem(state, op);
    case "block":
      return deleteBlock(state, op);
    case "page":
      return deletePage(state, op);
    case "space":
      return deleteSpace(state, op);
    case "template":
      return deleteTemplate(state, op);
  }
}

function deleteItem(
  state: AppState,
  op: Extract<DeleteWrite, { entity: "item" }>,
): AppState {
  const existing = state.items.get(op.id);
  if (!existing) return state;

  // Deleting a task takes its notes with it — the server's ON DELETE
  // CASCADE (docs/adr/0014), mirrored optimistically so the children do not
  // linger until the next reload.
  let next = removeRow(state, "item", op.id);
  const restore: UndoPlan["restore"] = [
    { entity: "item", id: op.id, row: existing },
  ];
  if (existing.kind === "task") {
    for (const item of state.items.values()) {
      if (item.parentItemId !== op.id) continue;
      next = removeRow(next, "item", item.id);
      restore.push({ entity: "item", id: item.id, row: item });
    }
  }

  const undo: UndoPlan = { remove: [], restore };
  return addPending(next, op, undo);
}

function deleteBlock(
  state: AppState,
  op: Extract<DeleteWrite, { entity: "block" }>,
): AppState {
  const block = state.blocks.get(op.id);
  if (!block) return state;

  const removedItems = [...state.items.values()].filter(
    (item) => item.blockId === op.id,
  );
  const restore: UndoPlan["restore"] = [];
  const itemsMap = new Map(state.items);
  for (const [id, item] of itemsMap) {
    if (item.kind === "ref" && item.refBlockId === op.id) {
      restore.push({ entity: "item", id, row: item });
      itemsMap.set(id, { ...item, refBlockId: null });
    }
  }
  for (const item of removedItems) itemsMap.delete(item.id);
  for (const item of removedItems)
    restore.push({ entity: "item", id: item.id, row: item });

  const blocksMap = new Map(state.blocks);
  blocksMap.delete(op.id);

  const undo: UndoPlan = { remove: [], restore };
  return addPending({ ...state, blocks: blocksMap, items: itemsMap }, op, undo);
}

function deletePage(
  state: AppState,
  op: Extract<DeleteWrite, { entity: "page" }>,
): AppState {
  const page = state.pages.get(op.id);
  if (!page) return state;

  const removedBlocks = [...state.blocks.values()].filter(
    (block) => block.pageId === op.id,
  );
  const removedItems = [...state.items.values()].filter((item) =>
    removedBlocks.some((block) => block.id === item.blockId),
  );

  const restore: UndoPlan["restore"] = [
    { entity: "page", id: op.id, row: page },
    ...removedBlocks.map((entry) => ({
      entity: "block" as const,
      id: entry.id,
      row: entry,
    })),
    ...removedItems.map((entry) => ({
      entity: "item" as const,
      id: entry.id,
      row: entry,
    })),
  ];

  const pagesMap = new Map(state.pages);
  const blocksMap = new Map(state.blocks);
  const itemsMap = new Map(state.items);
  pagesMap.delete(op.id);
  for (const entry of removedBlocks) blocksMap.delete(entry.id);
  for (const entry of removedItems) itemsMap.delete(entry.id);

  // A deleted page leaves no view state behind.
  const pageViews = new Map(state.pageViews);
  pageViews.delete(op.id);

  const undo: UndoPlan = { remove: [], restore };
  return addPending(
    {
      ...state,
      pages: pagesMap,
      blocks: blocksMap,
      items: itemsMap,
      pageViews,
    },
    op,
    undo,
  );
}

function deleteSpace(
  state: AppState,
  op: Extract<DeleteWrite, { entity: "space" }>,
): AppState {
  const space = state.spaces.get(op.id);
  if (!space) return state;

  const removedPages = [...state.pages.values()].filter(
    (page) => page.spaceId === op.id,
  );
  const removedBlockIds = new Set(
    [...state.blocks.values()]
      .filter((block) => removedPages.some((page) => page.id === block.pageId))
      .map((block) => block.id),
  );
  const removedBlocks = [...state.blocks.values()].filter((block) =>
    removedBlockIds.has(block.id),
  );
  const removedItems = [...state.items.values()].filter((item) =>
    removedBlockIds.has(item.blockId),
  );

  const restore: UndoPlan["restore"] = [
    { entity: "space", id: op.id, row: space },
    ...removedPages.map((entry) => ({
      entity: "page" as const,
      id: entry.id,
      row: entry,
    })),
    ...removedBlocks.map((entry) => ({
      entity: "block" as const,
      id: entry.id,
      row: entry,
    })),
    ...removedItems.map((entry) => ({
      entity: "item" as const,
      id: entry.id,
      row: entry,
    })),
  ];

  const itemsMap = new Map(state.items);
  // Foreign tasks keep their row and only lose the assignment — the server's
  // ON DELETE SET NULL, mirrored locally.
  for (const [id, item] of itemsMap) {
    if (
      item.kind === "task" &&
      item.assigneeSpaceId === op.id &&
      !removedBlockIds.has(item.blockId)
    ) {
      restore.push({ entity: "item", id, row: item });
      itemsMap.set(id, { ...item, assigneeSpaceId: null });
    }
  }

  const spacesMap = new Map(state.spaces);
  const pagesMap = new Map(state.pages);
  const blocksMap = new Map(state.blocks);
  spacesMap.delete(op.id);
  for (const entry of removedPages) pagesMap.delete(entry.id);
  for (const entry of removedBlocks) blocksMap.delete(entry.id);
  for (const entry of removedItems) itemsMap.delete(entry.id);

  const undo: UndoPlan = { remove: [], restore };
  return addPending(
    {
      ...state,
      spaces: spacesMap,
      pages: pagesMap,
      blocks: blocksMap,
      items: itemsMap,
    },
    op,
    undo,
  );
}

function deleteTemplate(
  state: AppState,
  op: Extract<DeleteWrite, { entity: "template" }>,
): AppState {
  const template = state.templates.get(op.id);
  if (!template) return state;

  const restore: UndoPlan["restore"] = [
    { entity: "template", id: op.id, row: template },
  ];
  const blocksMap = new Map(state.blocks);
  for (const [id, block] of blocksMap) {
    if (block.templateId === op.id) {
      restore.push({ entity: "block", id, row: block });
      blocksMap.set(id, { ...block, templateId: null });
    }
  }

  const templatesMap = new Map(state.templates);
  templatesMap.delete(op.id);

  const undo: UndoPlan = { remove: [], restore };
  return addPending(
    { ...state, templates: templatesMap, blocks: blocksMap },
    op,
    undo,
  );
}

function addPending(
  state: AppState,
  op: OptimisticWrite,
  undo: UndoPlan,
): AppState {
  const pending = new Map(state.pending);
  const latestWrites = new Map(state.latestWrites);
  latestWrites.set(`${op.entity}:${op.id}`, op.opKey);
  const entry: PendingOperation = {
    opKey: op.opKey,
    entity: op.entity,
    id: op.id,
    change: op.change,
    undo,
    write: op,
  };
  pending.set(op.opKey, entry);
  return { ...state, pending, latestWrites };
}

function confirmWrite(
  state: AppState,
  opKey: string,
  respaced?: Record<string, number>,
  row?: ItemRow,
): AppState {
  const pending = new Map(state.pending);
  const original = pending.get(opKey);
  if (original?.entity === "item" && original.change === "delete") state = { ...state, undoHistory: [...state.undoHistory.slice(-9), { rows: original.undo.restore.filter(entry => entry.entity === "item").map(entry => entry.row as ItemRow), label: "Zeile entfernen" }] };
  if (!pending.delete(opKey)) return state;
  const failedWrites = new Map(state.failedWrites);
  const key = original ? `${original.entity}:${original.id}` : "";
  const failed = failedWrites.get(key);
  if (original && (!failed || original.write.change !== "patch" || (failed.change === "patch" && Object.keys(failed.patch).every(field => field in (original.write as { patch: object }).patch)))) failedWrites.delete(key);
  state = { ...state, failedWrites };
  if (row) {
    let baseline = row;
    for (const [key, entry] of pending) {
      if (entry.entity !== "item" || entry.id !== row.id) continue;
      pending.set(key, { ...entry, undo: { ...entry.undo, restore: [{ entity: "item", id: row.id, row: baseline }] } });
      if (entry.write.entity === "item" && entry.write.change === "patch") baseline = { ...baseline, ...entry.write.patch };
    }
    state = overlayPending({ ...state, pending, items: setMap(state.items, row.id, row) });
  }
  if (!respaced) return { ...state, pending };

  // A re-spaced block: adopt the server's positions. Only the position field
  // is touched, so concurrent optimistic edits to other fields are kept.
  const items = new Map(state.items);
  for (const [id, position] of Object.entries(respaced)) {
    const row = items.get(id);
    if (row) items.set(id, { ...row, position });
  }
  return { ...state, pending, items };
}

function failWrite(
  state: AppState,
  opKey: string,
  error: ClientError,
  now: number,
): AppState {
  const op = state.pending.get(opKey);
  if (!op) return state;

  let next = state;
  const pending = new Map(state.pending);
  pending.delete(opKey);
  // A late failure must never erase a later optimistic or confirmed edit.
  const latest = state.latestWrites.get(`${op.entity}:${op.id}`) === opKey;
  const keepDraft = op.write.change === "patch" && "text" in op.write.patch;
  if (latest) {
    for (const entry of op.undo.remove) next = removeRow(next, entry.entity, entry.id);
    for (const entry of op.undo.restore) {
      const current = getRow(next, entry.entity, entry.id);
      const row = keepDraft && current && entry.id === op.id && "text" in current ? { ...entry.row, text: current.text } as EntityRow : entry.row;
      next = setRow(next, entry.entity, row);
    }
  }
  // Rebase later rollback snapshots so a second failure cannot resurrect
  // the failed edit. Each pending patch keeps only its own contribution.
  for (const [key, later] of pending) {
    const restore = later.undo.restore.map((entry) => {
      const base = op.undo.restore.find((old) => old.entity === entry.entity && old.id === entry.id);
      return base ? { ...entry, row: base.row } : entry;
    });
    pending.set(key, { ...later, undo: { ...later.undo, restore } });
  }

  const notification = {
    id: opKey,
    kind: "error" as const,
    entity: op.entity,
    entityId: op.id,
    error,
    createdAt: now,
  };
  return {
    ...next,
    pending,
    notifications: [...next.notifications, notification],
    failedWrites: new Map(state.failedWrites).set(`${op.entity}:${op.id}`, op.write),
  };
}

// ============================================================
// Map helpers
// ============================================================

function mapOf<Row extends { id: string }>(
  rows: readonly Row[],
): Map<string, Row> {
  return new Map(rows.map((row) => [row.id, row]));
}

function setMap<Key, Value>(
  map: Map<Key, Value>,
  key: Key,
  value: Value,
): Map<Key, Value> {
  const next = new Map(map);
  next.set(key, value);
  return next;
}

function setView(
  map: Map<string, ViewStatus>,
  key: string,
  status: ViewStatus,
): Map<string, ViewStatus> {
  return setMap(map, key, status);
}

function mergeRows<Row extends { id: string }>(
  map: Map<string, Row>,
  rows: readonly Row[],
): Map<string, Row> {
  const next = new Map(map);
  for (const row of rows) next.set(row.id, row);
  return next;
}

function getRow(
  state: AppState,
  entity: EntityName,
  id: string,
): EntityRow | undefined {
  switch (entity) {
    case "space":
      return state.spaces.get(id);
    case "page":
      return state.pages.get(id);
    case "block":
      return state.blocks.get(id);
    case "item":
      return state.items.get(id);
    case "template":
      return state.templates.get(id);
  }
}

function setRow(state: AppState, entity: EntityName, row: EntityRow): AppState {
  switch (entity) {
    case "space":
      return {
        ...state,
        spaces: setMap(state.spaces, row.id, row as SpaceRow),
      };
    case "page":
      return { ...state, pages: setMap(state.pages, row.id, row as PageRow) };
    case "block":
      return {
        ...state,
        blocks: setMap(state.blocks, row.id, row as BlockRow),
      };
    case "item":
      return { ...state, items: setMap(state.items, row.id, row as ItemRow) };
    case "template":
      return {
        ...state,
        templates: setMap(state.templates, row.id, row as TemplateRow),
      };
  }
}

function removeRow(state: AppState, entity: EntityName, id: string): AppState {
  switch (entity) {
    case "space":
      return { ...state, spaces: without(state.spaces, id) };
    case "page":
      return { ...state, pages: without(state.pages, id) };
    case "block":
      return { ...state, blocks: without(state.blocks, id) };
    case "item":
      return { ...state, items: without(state.items, id) };
    case "template":
      return { ...state, templates: without(state.templates, id) };
  }
}

function without<Value>(
  map: Map<string, Value>,
  id: string,
): Map<string, Value> {
  const next = new Map(map);
  next.delete(id);
  return next;
}

function overlayPending(state: AppState): AppState {
  let next = state;
  for (const pending of state.pending.values()) {
    const op = pending.write;
    if (op.change === "delete") {
      next = removeRow(next, op.entity, op.id);
      for (const entry of pending.undo.restore)
        if (entry.entity === "item" && entry.id !== op.id && (entry.row as ItemRow).parentItemId === op.id)
          next = removeRow(next, "item", entry.id);
    } else if (op.change === "put") next = setRow(next, op.entity, op.row);
    else {
      const current = getRow(next, op.entity, op.id);
      if (current) next = setRow(next, op.entity, {
        ...current, ...(op.change === "patch" ? op.patch : { blockId: op.blockId, position: op.position }),
      } as EntityRow);
    }
  }
  return next;
}

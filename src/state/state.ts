import type { ApiErrorBody } from "../../shared/api.ts";
import type { SearchResponse } from "../../shared/api.ts";
import type { BlockRow, ItemRow, PageRow, SpaceRow, TemplateRow } from "../../shared/db.ts";
import type { BlockPatch, ItemPatch, PagePatch, SpacePatch, TemplatePatch } from "../../shared/schemas.ts";

/**
 * The normalized application state. Every row lives exactly once in one of
 * the five maps; views (block stream, task overview, calendar) are derived by
 * selectors.ts and never stored. A task appears in two views by referring to
 * the same row in `items` — never as a copy.
 */

export type EntityName = "space" | "page" | "block" | "item" | "template";

export type EntityRow = SpaceRow | PageRow | BlockRow | ItemRow | TemplateRow;
export type EntityPatch = SpacePatch | PagePatch | BlockPatch | TemplatePatch | ItemPatch;

/** A write error classified by the API client: a network failure (retryable)
 * or an HTTP response (4xx/5xx, not retryable). */
export type ClientError =
  | { kind: "network"; message: string }
  | { kind: "http"; status: number; body: ApiErrorBody | null }
  | { kind: "unexpected"; message: string };

/** Load state of one view. Data is never cleared on reload or failure. */
export type ViewStatus =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "loaded" }
  | { status: "failed"; error: ClientError };

/** One row to restore during a rollback. */
export interface UndoEntry {
  entity: EntityName;
  id: string;
  row: EntityRow;
}

export interface UndoPlan {
  /** Ids of rows to remove from their maps (only for a rolled-back create). */
  remove: Array<{ entity: EntityName; id: string }>;
  /** Rows to set back into their maps (previous values for update/delete). */
  restore: UndoEntry[];
}

export interface PendingOperation {
  opKey: string;
  entity: EntityName;
  id: string;
  change: "put" | "patch" | "delete";
  /** What `writeFailed` must undo. Transient — dropped on confirmation. */
  undo: UndoPlan;
}

/** A visible error after a rolled-back write. The UI renders these; they are
 * never silent. */
export interface UiNotification {
  id: string;
  kind: "error";
  entity: EntityName;
  entityId: string;
  error: ClientError;
  createdAt: number;
}

/**
 * The search view for one query. Self-contained: the hits carry only the
 * fields a result row shows and are never merged into the normalized maps —
 * a search is a transient navigation aid, not a data load.
 */
export interface SearchView {
  /** The trimmed query the current results (or error) belong to. */
  query: string;
  results: SearchResponse | null;
  view: ViewStatus;
}

export interface AppState {
  spaces: Map<string, SpaceRow>;
  pages: Map<string, PageRow>;
  blocks: Map<string, BlockRow>;
  items: Map<string, ItemRow>;
  templates: Map<string, TemplateRow>;

  spacesView: ViewStatus;
  pageViews: Map<string, ViewStatus>;
  calendarView: ViewStatus;
  overviewView: ViewStatus;
  search: SearchView;

  /** Optimistic writes in flight, with their rollback plans. */
  pending: Map<string, PendingOperation>;

  notifications: UiNotification[];
}

export function initialState(): AppState {
  return {
    spaces: new Map(),
    pages: new Map(),
    blocks: new Map(),
    items: new Map(),
    templates: new Map(),
    spacesView: { status: "idle" },
    pageViews: new Map(),
    calendarView: { status: "idle" },
    overviewView: { status: "idle" },
    search: { query: "", results: null, view: { status: "idle" } },
    pending: new Map(),
    notifications: [],
  };
}

/**
 * One optimistic write: the intent (what to apply and to which row) plus a
 * unique `opKey`. The reducer derives the undo plan from the current state.
 * Discriminated per entity so `row`/`patch` always match `entity`.
 */
export type OptimisticWrite =
  | EntityWrite<"space", SpaceRow, SpacePatch>
  | EntityWrite<"page", PageRow, PagePatch>
  | EntityWrite<"block", BlockRow, BlockPatch>
  | EntityWrite<"item", ItemRow, ItemPatch>
  | EntityWrite<"template", TemplateRow, TemplatePatch>;

export type EntityWrite<Entity extends EntityName, Row extends EntityRow, Patch extends EntityPatch> =
  | { opKey: string; entity: Entity; id: string; change: "put"; row: Row }
  | { opKey: string; entity: Entity; id: string; change: "patch"; patch: Patch }
  | { opKey: string; entity: Entity; id: string; change: "delete" };

/** The delete members of `OptimisticWrite`, for the reducer's cascade logic. */
export type DeleteWrite =
  | { opKey: string; entity: "space"; id: string; change: "delete" }
  | { opKey: string; entity: "page"; id: string; change: "delete" }
  | { opKey: string; entity: "block"; id: string; change: "delete" }
  | { opKey: string; entity: "item"; id: string; change: "delete" }
  | { opKey: string; entity: "template"; id: string; change: "delete" };

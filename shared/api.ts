import type { BlockRow, CalendarWindow, ItemRow, PageRow, SpaceRow, TemplateRow } from "./db.ts";

/**
 * The error contract for the whole API. Defined here so client and worker
 * share one shape: a machine-readable body with a coarse top-level code and,
 * for validation failures, per-field path + code — never a raw validation dump.
 */
export type ApiErrorCode =
  | "validation"
  | "bad_request"
  | "not_found"
  | "method_not_allowed"
  | "internal";

export interface ApiFieldIssue {
  /** Dot-joined field path, e.g. "dueDate". */
  path: string;
  /** Stable machine code, e.g. "invalid_date", "heading_only_on_note". */
  code: string;
}

export interface ApiErrorBody {
  error: {
    code: ApiErrorCode;
    message?: string;
    issues?: ApiFieldIssue[];
  };
}

// ============================================================
// Read response shapes
// ============================================================

export interface ApiBlock extends BlockRow {
  items: ItemRow[];
}

export interface SpaceWithPages extends SpaceRow {
  pages: PageRow[];
}

export interface SpacesResponse {
  spaces: SpaceWithPages[];
  templates: TemplateRow[];
  /** The person space whose email matches the caller's Access email (docs/adr/0013). */
  meSpaceId: string | null;
}

export interface PageResponse {
  page: PageRow;
  blocks: ApiBlock[];
}

/**
 * The response of the overview route (docs/adr/0011): every open task, every
 * event within the next days, and the blocks/pages behind them — the data
 * load the "Heute" view and a person's assigned-tasks view render from. The
 * worker loads it with a fixed number of queries; the per-person workload is
 * derived client-side in src/domain/overview.ts, never by a per-person query.
 */
export interface OverviewResponse {
  tasks: ItemRow[];
  events: ItemRow[];
  blocks: BlockRow[];
  pages: PageRow[];
}

/** A block hit in the search response, with the context a result row shows. */
export interface SearchBlockHit {
  block: Pick<BlockRow, "id" | "title" | "date">;
  templateLabel: string | null;
  page: Pick<PageRow, "id" | "title">;
  space: Pick<SpaceRow, "id" | "name">;
}

/** An item hit in the search response, with the context a result row shows. */
export interface SearchItemHit {
  item: Pick<ItemRow, "id" | "kind" | "text">;
  block: Pick<BlockRow, "id" | "title">;
  page: Pick<PageRow, "id" | "title">;
  space: Pick<SpaceRow, "id" | "name">;
}

/**
 * The response of the search route. The client renders it as-is; the hits
 * carry only the fields a result row shows and are never merged into the
 * normalized state (a search is a transient view, not a data load).
 */
export interface SearchResponse {
  query: string;
  blocks: SearchBlockHit[];
  items: SearchItemHit[];
}

/**
 * The response of an item write (PUT/PATCH). `row` is the stored item;
 * `respaced` carries every item's position in the block when the server had
 * to re-space it (exhausted position gap) so the client's local order can
 * follow the server's truth — null when nothing was re-spaced.
 */
export interface ItemWriteResponse {
  row: ItemRow;
  respaced: Record<string, number> | null;
}

/** The calendar route returns the same shape the domain projection builds. */
export type CalendarResponse = CalendarWindow;

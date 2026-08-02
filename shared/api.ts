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
}

export interface PageResponse {
  page: PageRow;
  blocks: ApiBlock[];
}

export interface MirrorTask {
  item: ItemRow;
  block: Pick<BlockRow, "id" | "pageId" | "title" | "date">;
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

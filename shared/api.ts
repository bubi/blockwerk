import type { BlockRow, ItemRow, PageRow, SpaceRow, TemplateRow } from "./db.ts";

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

export interface CalendarResponse {
  blocks: BlockRow[];
  dueTasks: ItemRow[];
  events: ItemRow[];
}

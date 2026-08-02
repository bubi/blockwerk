/**
 * The slice of the D1Database surface the data access layer actually uses:
 * prepare, bind, first, all, run, batch. Kept narrow on purpose so a real
 * `D1Database` (from `Cloudflare.Env`) and the local `node:sqlite` shim used
 * by tests (see `testing/sqlite-d1.ts`) both satisfy it structurally, with
 * no cast at either call site.
 */
export interface D1LikeMeta {
  changes: number;
}

export interface D1LikeResult<T = unknown> {
  results: T[];
  success: boolean;
  meta: D1LikeMeta;
}

export interface D1LikeStatement {
  bind(...values: unknown[]): D1LikeStatement;
  first<T = unknown>(colName?: string): Promise<T | null>;
  all<T = unknown>(): Promise<D1LikeResult<T>>;
  run<T = unknown>(): Promise<D1LikeResult<T>>;
}

export interface D1Like {
  prepare(query: string): D1LikeStatement;
  batch<T = unknown>(statements: D1LikeStatement[]): Promise<D1LikeResult<T>[]>;
}

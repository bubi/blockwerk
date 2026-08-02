import { DatabaseSync, type SQLInputValue, type StatementSync } from "node:sqlite";
import type { D1Like, D1LikeResult, D1LikeStatement } from "../d1-like.ts";

function toResult<T>(rows: T[], changes: number | bigint): D1LikeResult<T> {
  return { results: rows, success: true, meta: { changes: Number(changes) } };
}

// D1's `.bind(...values: unknown[])` is untyped; node:sqlite requires
// SQLInputValue. The data access layer only ever binds ids, text, numbers
// and null, so this cast just bridges the two APIs, it doesn't widen what
// callers may pass.
function bindStatement(stmt: StatementSync, values: SQLInputValue[]): D1LikeStatement {
  return {
    bind(...nextValues) {
      return bindStatement(stmt, nextValues as SQLInputValue[]);
    },
    async first<T>(colName?: string) {
      const row = stmt.get(...values);
      if (row === undefined) return null;
      return (colName !== undefined ? row[colName] : row) as T;
    },
    async all<T>() {
      return toResult(stmt.all(...values) as T[], 0);
    },
    async run<T>() {
      const { changes } = stmt.run(...values);
      return toResult([] as T[], changes);
    },
  };
}

/**
 * Wraps a `node:sqlite` database as the minimal D1-shaped surface the data
 * access layer uses. Foreign keys are OFF by default in SQLite (D1 enforces
 * them itself), so the caller MUST turn them on before this wrapper is
 * trusted to test deletion rules — see `openMigratedSqliteD1` below.
 */
export function wrapSqliteAsD1(db: DatabaseSync): D1Like {
  return {
    prepare(query) {
      return bindStatement(db.prepare(query), []);
    },
    async batch<T>(statements: D1LikeStatement[]) {
      db.exec("BEGIN");
      try {
        const results: D1LikeResult<T>[] = [];
        for (const statement of statements) results.push(await statement.run<T>());
        db.exec("COMMIT");
        return results;
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
    },
  };
}

export function openSqliteD1(): { db: DatabaseSync; d1: D1Like } {
  const db = new DatabaseSync(":memory:");
  db.exec("PRAGMA foreign_keys = ON");
  return { db, d1: wrapSqliteAsD1(db) };
}

import { readFileSync, readdirSync } from "node:fs";
import type { D1Like } from "../d1-like.ts";
import { openSqliteD1 } from "./sqlite-d1.ts";

const migrationsDir = new URL("../../../migrations/", import.meta.url);

/**
 * Stage 1 (local, default `npm test`): a fresh in-memory `node:sqlite`
 * database, migrated from scratch on every call. There is no shared
 * snapshot to reset between tests here, so each call is its own isolated
 * database — write tests so they don't depend on which stage supplies
 * isolation (see worker/db/*.test.ts).
 */
export async function getTestDb(): Promise<D1Like> {
  const { db, d1 } = openSqliteD1();
  const files = readdirSync(migrationsDir.pathname)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  for (const file of files) {
    db.exec(readFileSync(new URL(file, migrationsDir).pathname, "utf8"));
  }
  return d1;
}

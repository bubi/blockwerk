import type { PageRow } from "../../shared/db.ts";
import type { D1Like } from "./d1-like.ts";
import { mapPage, type RawPageRow } from "./mappers.ts";

export interface NewPageInput {
  id: string;
  spaceId: string;
  title: string;
}

export interface PagePatch {
  title?: string;
}

export async function createPage(db: D1Like, input: NewPageInput, now: number): Promise<PageRow> {
  await db
    .prepare("INSERT INTO pages (id, space_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)")
    .bind(input.id, input.spaceId, input.title, now, now)
    .run();
  return { ...input, createdAt: now, updatedAt: now };
}

export async function getPage(db: D1Like, id: string): Promise<PageRow | null> {
  const row = await db.prepare("SELECT * FROM pages WHERE id = ?").bind(id).first<RawPageRow>();
  return row ? mapPage(row) : null;
}

export async function listPages(db: D1Like): Promise<PageRow[]> {
  const { results } = await db
    .prepare("SELECT * FROM pages ORDER BY space_id ASC, id ASC")
    .all<RawPageRow>();
  return results.map(mapPage);
}

export async function updatePage(db: D1Like, id: string, patch: PagePatch, now: number): Promise<PageRow | null> {
  const result = await db
    .prepare("UPDATE pages SET title = COALESCE(?, title), updated_at = ? WHERE id = ?")
    .bind(patch.title ?? null, now, id)
    .run();
  if (result.meta.changes === 0) return null;
  return getPage(db, id);
}

/** Cascades its blocks and their items — see docs/adr/0001-task-spiegel.md. */
export async function deletePage(db: D1Like, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM pages WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

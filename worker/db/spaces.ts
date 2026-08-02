import type { SpaceRow } from "../../shared/db.ts";
import { mapSpace, type RawSpaceRow } from "./mappers.ts";

export interface NewSpaceInput {
  id: string;
  name: string;
  kind: SpaceRow["kind"];
  short: string;
  email?: string | null;
}

export interface SpacePatch {
  name?: string;
  kind?: SpaceRow["kind"];
  short?: string;
  email?: string | null;
}

export async function createSpace(db: D1Database, input: NewSpaceInput, now: number): Promise<SpaceRow> {
  await db
    .prepare("INSERT INTO spaces (id, name, kind, short, email, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(input.id, input.name, input.kind, input.short, input.email ?? null, now, now)
    .run();
  return { ...input, email: input.email ?? null, createdAt: now, updatedAt: now };
}

export async function getSpace(db: D1Database, id: string): Promise<SpaceRow | null> {
  const row = await db.prepare("SELECT * FROM spaces WHERE id = ?").bind(id).first<RawSpaceRow>();
  return row ? mapSpace(row) : null;
}

export async function listSpaces(db: D1Database): Promise<SpaceRow[]> {
  const { results } = await db.prepare("SELECT * FROM spaces ORDER BY id ASC").all<RawSpaceRow>();
  return results.map(mapSpace);
}

export async function updateSpace(
  db: D1Database,
  id: string,
  patch: SpacePatch,
  now: number,
): Promise<SpaceRow | null> {
  const sets: string[] = [];
  const values: unknown[] = [];
  if (patch.name !== undefined) {
    sets.push("name = ?");
    values.push(patch.name);
  }
  if (patch.kind !== undefined) {
    sets.push("kind = ?");
    values.push(patch.kind);
  }
  if (patch.short !== undefined) {
    sets.push("short = ?");
    values.push(patch.short);
  }
  if (patch.email !== undefined) {
    sets.push("email = ?");
    values.push(patch.email);
  }
  sets.push("updated_at = ?");
  values.push(now, id);

  const result = await db.prepare(`UPDATE spaces SET ${sets.join(", ")} WHERE id = ?`).bind(...values).run();
  if (result.meta.changes === 0) return null;
  return getSpace(db, id);
}

/**
 * Cascades pages/blocks/items and nulls assignee_space_id elsewhere — see
 * docs/adr/0001-task-spiegel.md.
 */
export async function deleteSpace(db: D1Database, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM spaces WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

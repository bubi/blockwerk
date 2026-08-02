import type { TemplateRow } from "../../shared/db.ts";
import type { D1Like } from "./d1-like.ts";
import { mapTemplate, type RawTemplateRow } from "./mappers.ts";

export interface NewTemplateInput {
  id: string;
  label: string;
  hue: string;
  seed: string[];
}

export interface TemplatePatch {
  label?: string;
  hue?: string;
  seed?: string[];
}

export async function createTemplate(db: D1Like, input: NewTemplateInput, now: number): Promise<TemplateRow> {
  await db
    .prepare("INSERT INTO templates (id, label, hue, seed, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(input.id, input.label, input.hue, JSON.stringify(input.seed), now, now)
    .run();
  return { ...input, createdAt: now, updatedAt: now };
}

export async function getTemplate(db: D1Like, id: string): Promise<TemplateRow | null> {
  const row = await db.prepare("SELECT * FROM templates WHERE id = ?").bind(id).first<RawTemplateRow>();
  return row ? mapTemplate(row) : null;
}

export async function listTemplates(db: D1Like): Promise<TemplateRow[]> {
  const { results } = await db.prepare("SELECT * FROM templates ORDER BY id ASC").all<RawTemplateRow>();
  return results.map(mapTemplate);
}

export async function updateTemplate(
  db: D1Like,
  id: string,
  patch: TemplatePatch,
  now: number,
): Promise<TemplateRow | null> {
  const result = await db
    .prepare(
      "UPDATE templates SET label = COALESCE(?, label), hue = COALESCE(?, hue), seed = COALESCE(?, seed), updated_at = ? WHERE id = ?",
    )
    .bind(patch.label ?? null, patch.hue ?? null, patch.seed ? JSON.stringify(patch.seed) : null, now, id)
    .run();
  if (result.meta.changes === 0) return null;
  return getTemplate(db, id);
}

/** Blocks keep their content and fall back to "Ohne Template" — see docs/adr/0001-task-spiegel.md. */
export async function deleteTemplate(db: D1Like, id: string): Promise<boolean> {
  const result = await db.prepare("DELETE FROM templates WHERE id = ?").bind(id).run();
  return result.meta.changes > 0;
}

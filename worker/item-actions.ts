import { z } from "zod";
import { idString, itemWriteSchema } from "../shared/schemas.ts";
import { ConflictError, NotFoundError, ValidationError } from "./errors.ts";
import { getItem, buildItemRow } from "./db/items.ts";
import { toNewItemInput } from "./handlers.ts";

const undoSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            id: idString,
            createdAt: z.number().int(),
            updatedAt: z.number().int(),
            data: z.unknown(),
          })
          .strict(),
      )
      .min(1)
      .max(1000),
    expectedUpdatedAt: z.number().int().optional(),
  })
  .strict();
const columns =
  "id, block_id, kind, position, text, heading, done, due_date, assignee_space_id, event_date, event_time, ref_block_id, parent_item_id, list_mark, created_at, updated_at";

export async function restoreItems(db: D1Database, body: unknown, now: number) {
  const input = undoSchema.parse(body);
  if (new Set(input.items.map((row) => row.id)).size !== input.items.length)
    throw new ValidationError([{ path: "items", code: "duplicate" }]);
  const rows = input.items.map((item) => ({
    ...buildItemRow(
      toNewItemInput(itemWriteSchema.parse(item.data), item.id),
      itemWriteSchema.parse(item.data).position,
      Math.max(now, item.updatedAt + 1),
    ),
    createdAt: item.createdAt,
  }));
  const values = (row: (typeof rows)[number]) => [
    row.id,
    row.blockId,
    row.kind,
    row.position,
    row.text,
    row.heading,
    row.done ? 1 : 0,
    row.dueDate,
    row.assigneeSpaceId,
    row.eventDate,
    row.eventTime,
    row.refBlockId,
    row.parentItemId,
    row.listMark,
    row.createdAt,
    row.updatedAt,
  ];
  const statements: D1PreparedStatement[] = [];
  const [first] = rows;
  if (input.expectedUpdatedAt !== undefined && first) {
    const existing = await getItem(db, first.id);
    if (
      !existing ||
      existing.updatedAt !== input.expectedUpdatedAt ||
      existing.blockId !== first.blockId ||
      existing.parentItemId !== first.parentItemId
    )
      throw new ConflictError();
    if (
      first.kind !== "task" &&
      (await db
        .prepare("SELECT id FROM items WHERE parent_item_id = ? LIMIT 1")
        .bind(first.id)
        .first())
    )
      throw new ConflictError();
    statements.push(
      db
        .prepare(
          `UPDATE items SET ${columns
            .split(", ")
            .slice(1)
            .map((column) => `${column} = ?`)
            .join(", ")} WHERE id = ? AND updated_at = ?`,
        )
        .bind(...values(first).slice(1), first.id, input.expectedUpdatedAt),
    );
    // Failed compare-and-swap must abort the whole transaction, including inserts.
    statements.push(
      db
        .prepare(
          "INSERT INTO items (id, block_id, kind, position, created_at, updated_at) SELECT ?, ?, 'invalid', 0, 0, 0 WHERE changes() = 0",
        )
        .bind(first.id, first.blockId),
    );
  }
  const inserts = rows
    .slice(input.expectedUpdatedAt === undefined ? 0 : 1)
    .sort(
      (a, b) =>
        Number(a.parentItemId !== null) - Number(b.parentItemId !== null),
    );
  const parents = new Map(rows.map((row) => [row.id, row]));
  const outsideParentIds = [
    ...new Set(
      inserts.flatMap((row) =>
        row.parentItemId && !parents.has(row.parentItemId)
          ? [row.parentItemId]
          : [],
      ),
    ),
  ];
  if (outsideParentIds.length) {
    const result = await db
      .prepare(
        "SELECT id, kind, block_id AS blockId FROM items WHERE id IN (SELECT value FROM json_each(?))",
      )
      .bind(JSON.stringify(outsideParentIds))
      .all<{ id: string; kind: string; blockId: string }>();
    for (const row of inserts)
      if (row.parentItemId && !parents.has(row.parentItemId)) {
        const parent = result.results.find(
          (entry) => entry.id === row.parentItemId,
        );
        if (!parent || parent.kind !== "task" || parent.blockId !== row.blockId)
          throw new ValidationError([
            { path: "parentItemId", code: "invalid_parent" },
          ]);
      }
  }
  for (const row of inserts)
    if (row.parentItemId && parents.has(row.parentItemId)) {
      const parent = parents.get(row.parentItemId)!;
      if (parent.kind !== "task" || parent.blockId !== row.blockId)
        throw new ValidationError([
          { path: "parentItemId", code: "invalid_parent" },
        ]);
    }
  // Bulk JSON insert keeps large task undo below D1's per-request query budget.
  // Bound each SQL parameter to 1 MiB, including multi-byte note text.
  let chunk: unknown[][] = [];
  let bytes = 2;
  const flush = () => {
    if (!chunk.length) return;
    statements.push(
      db
        .prepare(
          `INSERT INTO items (${columns}) SELECT ${columns
            .split(", ")
            .map((_, index) => `json_extract(value, '$[${index}]')`)
            .join(", ")} FROM json_each(?)`,
        )
        .bind(JSON.stringify(chunk)),
    );
    chunk = [];
    bytes = 2;
  };
  for (const row of inserts) {
    const entry = values(row);
    const size = new TextEncoder().encode(JSON.stringify(entry)).length + 1;
    if (bytes + size > 1024 * 1024) flush();
    chunk.push(entry);
    bytes += size;
  }
  flush();
  try {
    await db.batch(statements);
  } catch {
    throw new ConflictError();
  }
  return { rows };
}

export async function convertItem(
  db: D1Database,
  id: string,
  body: unknown,
  now: number,
) {
  const input = z
    .object({
      kind: z.enum(["note", "task", "event"]),
      updatedAt: z.number().int(),
    })
    .strict()
    .parse(body);
  const existing = await getItem(db, id);
  if (!existing) throw new NotFoundError();
  if (existing.kind === input.kind) return { row: existing, respaced: null };
  if (
    existing.updatedAt !== input.updatedAt ||
    existing.parentItemId !== null ||
    existing.kind === "ref"
  )
    throw new ConflictError();
  if (
    input.kind !== "task" &&
    (await db
      .prepare("SELECT id FROM items WHERE parent_item_id = ? LIMIT 1")
      .bind(id)
      .first())
  )
    throw new ValidationError(
      [{ path: "kind", code: "has_child_notes" }],
      "Diese Aufgabe hat eigene Notizen. Bitte diese zuerst verschieben oder entfernen.",
    );
  const result = await db
    .prepare(
      "UPDATE items SET kind = ?, heading = NULL, list_mark = NULL, done = 0, due_date = NULL, event_date = NULL, event_time = NULL, assignee_space_id = NULL, ref_block_id = NULL, updated_at = ? WHERE id = ? AND updated_at = ?",
    )
    .bind(
      input.kind,
      Math.max(now, existing.updatedAt + 1),
      id,
      input.updatedAt,
    )
    .run();
  if (result.meta.changes !== 1) throw new ConflictError();
  return { row: await getItem(db, id), respaced: null };
}

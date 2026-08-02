import { z } from "zod";
import type { ItemKind } from "./db.ts";

/**
 * Validation schemas used at the system boundary. Both worker and client
 * import these, so the rules live once and the client can rely on the same
 * truth the worker enforces.
 */

/** 'YYYY-MM-DD' — real calendar dates only, not just the shape. */
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
/** 'HH:MM', 24h, zero-padded. */
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

function isRealDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day!));
  return (
    date.getUTCFullYear() === year! &&
    date.getUTCMonth() === month! - 1 &&
    date.getUTCDate() === day!
  );
}

/**
 * Custom, stable issue codes for the API's per-field error contract
 * (docs/adr/0005). Zod's classic surface narrows `code` to its built-in
 * union; the runtime accepts any string, so we widen at this one spot.
 */
function addCustomIssue<T>(
  ctx: { addIssue: (issue: string | T) => void },
  code: string,
  path: string[],
  message: string,
): void {
  ctx.addIssue({ code, path, message } as unknown as string | T);
}

export const dateString = z.string().superRefine((value, ctx) => {
  if (!DATE_RE.test(value)) {
    addCustomIssue(ctx, "invalid_date", [], "Expected a date in YYYY-MM-DD format");
    return;
  }
  if (!isRealDate(value)) {
    addCustomIssue(ctx, "invalid_date", [], "Not a real calendar date");
  }
});

export const timeString = z.string().superRefine((value, ctx) => {
  if (!TIME_RE.test(value)) {
    addCustomIssue(ctx, "invalid_time", [], "Expected a time in HH:MM format");
  }
});

/** Identifiers (entity ids, parent references) — non-empty, bounded. */
export const idString = z.string().min(1).max(128);

// ============================================================
// space
// ============================================================

export const spaceWriteSchema = z
  .object({
    name: z.string().min(1).max(200),
    kind: z.enum(["person", "topic"]),
    short: z.string().min(1).max(10),
  })
  .strict();

export const spacePatchSchema = z
  .object({
    name: z.string().min(1).max(200),
    kind: z.enum(["person", "topic"]),
    short: z.string().min(1).max(10),
  })
  .strict()
  .partial();

// ============================================================
// page
// ============================================================

export const pageWriteSchema = z
  .object({
    spaceId: idString,
    title: z.string().min(1).max(200),
  })
  .strict();

export const pagePatchSchema = z
  .object({
    title: z.string().min(1).max(200),
  })
  .strict()
  .partial();

// ============================================================
// block
// ============================================================

export const blockWriteSchema = z
  .object({
    pageId: idString,
    templateId: idString.nullable().default(null),
    title: z.string().min(1).max(200),
    date: dateString,
  })
  .strict();

export const blockPatchSchema = z
  .object({
    templateId: idString.nullable(),
    title: z.string().min(1).max(200),
    date: dateString,
  })
  .strict()
  .partial();

// ============================================================
// template
// ============================================================

export const templateWriteSchema = z
  .object({
    label: z.string().min(1).max(200),
    hue: z.string().min(1).max(50),
    seed: z.array(z.string()).max(500).default([]),
  })
  .strict();

export const templatePatchSchema = z
  .object({
    label: z.string().min(1).max(200),
    hue: z.string().min(1).max(50),
    seed: z.array(z.string()).max(500),
  })
  .strict()
  .partial();

// ============================================================
// item
// ============================================================

/**
 * The fields of an item that depend on `kind`, plus `kind` itself. This is
 * the shared input for the cross-field rules below — every rule mirrors one
 * CHECK constraint from migrations/0001_initial.sql, so a body that would
 * violate the schema is rejected at the boundary, never stored.
 */
export interface ItemKindFields {
  kind: ItemKind;
  heading?: unknown;
  done?: unknown;
  dueDate?: unknown;
  eventDate?: unknown;
  eventTime?: unknown;
  assigneeSpaceId?: unknown;
  refBlockId?: unknown;
}

export interface ItemRuleViolation {
  path: string;
  code: string;
  message: string;
}

export function itemKindRuleViolations(item: ItemKindFields): ItemRuleViolation[] {
  const violations: ItemRuleViolation[] = [];
  if (item.heading != null && item.kind !== "note") {
    violations.push({
      path: "heading",
      code: "heading_only_on_note",
      message: "heading is only allowed when kind is 'note'",
    });
  }
  if (item.done === true && item.kind !== "task") {
    violations.push({
      path: "done",
      code: "done_only_on_task",
      message: "done is only allowed when kind is 'task'",
    });
  }
  if (item.dueDate != null && item.kind !== "task") {
    violations.push({
      path: "dueDate",
      code: "due_date_only_on_task",
      message: "dueDate is only allowed when kind is 'task'",
    });
  }
  if (item.assigneeSpaceId != null && item.kind !== "task") {
    violations.push({
      path: "assigneeSpaceId",
      code: "assignee_only_on_task",
      message: "assigneeSpaceId is only allowed when kind is 'task'",
    });
  }
  if (item.eventDate != null && item.kind !== "event") {
    violations.push({
      path: "eventDate",
      code: "event_date_only_on_event",
      message: "eventDate is only allowed when kind is 'event'",
    });
  }
  if (item.eventTime != null && item.kind !== "event") {
    violations.push({
      path: "eventTime",
      code: "event_time_only_on_event",
      message: "eventTime is only allowed when kind is 'event'",
    });
  }
  if (item.refBlockId != null && item.kind !== "ref") {
    violations.push({
      path: "refBlockId",
      code: "ref_block_only_on_ref",
      message: "refBlockId is only allowed when kind is 'ref'",
    });
  }
  return violations;
}

export const itemWriteSchema = z
  .object({
    blockId: idString,
    kind: z.enum(["note", "task", "event", "ref"]),
    position: z.number().int().min(0),
    text: z.string().max(10_000).default(""),
    heading: z.union([z.literal(1), z.literal(2), z.null()]).default(null),
    done: z.boolean().default(false),
    dueDate: dateString.nullable().default(null),
    eventDate: dateString.nullable().default(null),
    eventTime: timeString.nullable().default(null),
    assigneeSpaceId: idString.nullable().default(null),
    refBlockId: idString.nullable().default(null),
  })
  .strict()
  .superRefine((item, ctx) => {
    for (const violation of itemKindRuleViolations(item)) {
      addCustomIssue(ctx, violation.code, [violation.path], violation.message);
    }
  });

/**
 * PATCH body for an item: any subset of the mutable fields. `blockId` and
 * `kind` are deliberately absent — they are set at creation and immutable.
 * Cross-field rules are checked against the stored row's kind (see handlers).
 */
export const itemPatchSchema = z
  .object({
    position: z.number().int().min(0),
    text: z.string().max(10_000),
    heading: z.union([z.literal(1), z.literal(2), z.null()]),
    done: z.boolean(),
    dueDate: dateString.nullable(),
    eventDate: dateString.nullable(),
    eventTime: timeString.nullable(),
    assigneeSpaceId: idString.nullable(),
    refBlockId: idString.nullable(),
  })
  .strict()
  .partial();

// ============================================================
// calendar query params
// ============================================================

export const calendarParamsSchema = z
  .object({
    from: dateString,
    to: dateString,
  })
  .strict()
  .superRefine((params, ctx) => {
    if (params.from > params.to) {
      addCustomIssue(ctx, "from_after_to", ["from"], "from must not be after to");
    }
  });

// ============================================================
// search query params
// ============================================================

export const searchParamsSchema = z
  .object({
    q: z.string().trim().min(1).max(200),
  })
  .strict();

// ============================================================
// inferred payload types
// ============================================================

export type SpaceWrite = z.infer<typeof spaceWriteSchema>;
export type SpacePatch = z.infer<typeof spacePatchSchema>;
export type PageWrite = z.infer<typeof pageWriteSchema>;
export type PagePatch = z.infer<typeof pagePatchSchema>;
export type BlockWrite = z.infer<typeof blockWriteSchema>;
export type BlockPatch = z.infer<typeof blockPatchSchema>;
export type TemplateWrite = z.infer<typeof templateWriteSchema>;
export type TemplatePatch = z.infer<typeof templatePatchSchema>;
export type ItemWrite = z.infer<typeof itemWriteSchema>;
export type ItemPatch = z.infer<typeof itemPatchSchema>;

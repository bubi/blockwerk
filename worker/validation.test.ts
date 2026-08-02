import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  blockPatchSchema,
  blockWriteSchema,
  calendarParamsSchema,
  dateString,
  itemKindRuleViolations,
  itemPatchSchema,
  itemWriteSchema,
  pagePatchSchema,
  spacePatchSchema,
  spaceWriteSchema,
  timeString,
} from "../shared/schemas.ts";
import { zodToFieldIssues } from "./errors.ts";

function issues(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return result.error.issues;
}

function issueCodes(schema: z.ZodType, input: unknown) {
  return issues(schema, input).map((issue) => `${issue.path.join(".")}=${issue.code}`);
}

/** The API-level representation of a validation failure (docs/adr/0005). */
function mappedIssues(schema: z.ZodType, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected validation to fail");
  return zodToFieldIssues(result.error).map((issue) => `${issue.path}=${issue.code}`);
}

describe("dateString / timeString", () => {
  it("accepts valid dates", () => {
    expect(dateString.safeParse("2026-08-01").success).toBe(true);
    expect(dateString.safeParse("2024-02-29").success).toBe(true);
  });

  it("rejects malformed dates with the invalid_date code", () => {
    for (const bad of ["2026-13-01", "2026-02-30", "2026-8-01", "abc", "20260801", "2026-08-1"]) {
      expect(issueCodes(dateString, bad)).toEqual(["=invalid_date"]);
    }
  });

  it("accepts only zero-padded 24h times", () => {
    expect(timeString.safeParse("14:00").success).toBe(true);
    expect(timeString.safeParse("00:00").success).toBe(true);
    expect(timeString.safeParse("23:59").success).toBe(true);
    for (const bad of ["24:00", "9:30", "14:60", "14:00:00"]) {
      expect(issueCodes(timeString, bad)).toEqual(["=invalid_time"]);
    }
  });
});

describe("spaceWriteSchema", () => {
  it("rejects an unknown kind value", () => {
    expect(issueCodes(spaceWriteSchema, { name: "X", kind: "group", short: "X" })).toEqual(["kind=invalid_value"]);
  });

  it("rejects unknown keys instead of silently dropping them", () => {
    expect(mappedIssues(spaceWriteSchema, { name: "X", kind: "person", short: "X", role: "admin" })).toEqual([
      "role=unrecognized_keys",
    ]);
  });

  it("accepts a valid space", () => {
    expect(spaceWriteSchema.safeParse({ name: "X", kind: "person", short: "XY" }).success).toBe(true);
  });
});

describe("itemWriteSchema", () => {
  it("applies defaults for absent fields", () => {
    const parsed = itemWriteSchema.parse({ blockId: "b", kind: "note", position: 1000, heading: 1 });
    expect(parsed).toMatchObject({
      blockId: "b",
      kind: "note",
      position: 1000,
      text: "",
      heading: 1,
      done: false,
      dueDate: null,
      eventDate: null,
      eventTime: null,
      assigneeSpaceId: null,
      refBlockId: null,
    });
  });

  it("accepts every kind with its own fields", () => {
    expect(itemWriteSchema.safeParse({ blockId: "b", kind: "note", position: 1, heading: 2 }).success).toBe(true);
    expect(
      itemWriteSchema.safeParse({ blockId: "b", kind: "task", position: 1, text: "t", done: true, dueDate: "2026-08-01", assigneeSpaceId: "p" })
        .success,
    ).toBe(true);
    expect(
      itemWriteSchema.safeParse({ blockId: "b", kind: "event", position: 1, text: "e", eventDate: "2026-08-01", eventTime: "14:00" })
        .success,
    ).toBe(true);
    expect(itemWriteSchema.safeParse({ blockId: "b", kind: "ref", position: 1, refBlockId: "target" }).success).toBe(true);
  });

  it("cannot smuggle kind-specific fields onto the wrong kind", () => {
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "note", position: 1, dueDate: "2026-08-01" })).toEqual([
      "dueDate=due_date_only_on_task",
    ]);
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "task", position: 1, heading: 1 })).toEqual([
      "heading=heading_only_on_note",
    ]);
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "note", position: 1, done: true })).toEqual(["done=done_only_on_task"]);
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "note", position: 1, assigneeSpaceId: "p" })).toEqual([
      "assigneeSpaceId=assignee_only_on_task",
    ]);
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "task", position: 1, eventDate: "2026-08-01" })).toEqual([
      "eventDate=event_date_only_on_event",
    ]);
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "task", position: 1, eventTime: "14:00" })).toEqual([
      "eventTime=event_time_only_on_event",
    ]);
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "task", position: 1, refBlockId: "x" })).toEqual([
      "refBlockId=ref_block_only_on_ref",
    ]);
  });

  it("rejects malformed dates, times, and positions inside items", () => {
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "task", position: 1, dueDate: "2026-13-01" })).toEqual([
      "dueDate=invalid_date",
    ]);
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "event", position: 1, eventTime: "25:00" })).toEqual([
      "eventTime=invalid_time",
    ]);
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "note", position: -1 })).toEqual(["position=too_small"]);
  });

  it("rejects an unknown kind field", () => {
    expect(issueCodes(itemWriteSchema, { blockId: "b", kind: "checklist", position: 1 })).toEqual(["kind=invalid_value"]);
  });
});

describe("itemPatchSchema", () => {
  it("accepts a partial body without applying defaults", () => {
    const parsed = itemPatchSchema.parse({ done: true });
    expect(parsed).toEqual({ done: true });
  });

  it("rejects the immutable blockId and kind fields", () => {
    expect(mappedIssues(itemPatchSchema, { kind: "note" })).toEqual(["kind=unrecognized_keys"]);
    expect(mappedIssues(itemPatchSchema, { blockId: "other" })).toEqual(["blockId=unrecognized_keys"]);
  });

  it("rejects malformed values", () => {
    expect(issueCodes(itemPatchSchema, { heading: 3 })).toEqual(["heading=invalid_union"]);
    expect(issueCodes(itemPatchSchema, { dueDate: "2026-02-30" })).toEqual(["dueDate=invalid_date"]);
  });
});

describe("itemKindRuleViolations (used by the PATCH handler against the stored kind)", () => {
  it("flags kind-conflicting fields", () => {
    expect(itemKindRuleViolations({ kind: "task", heading: 1 })).toEqual([
      expect.objectContaining({ path: "heading", code: "heading_only_on_note" }),
    ]);
    expect(itemKindRuleViolations({ kind: "note", dueDate: "2026-08-01" })).toEqual([
      expect.objectContaining({ path: "dueDate", code: "due_date_only_on_task" }),
    ]);
  });

  it("accepts fields that match the kind", () => {
    expect(itemKindRuleViolations({ kind: "note", heading: 1, done: false })).toEqual([]);
    expect(itemKindRuleViolations({ kind: "task", dueDate: "2026-08-01", assigneeSpaceId: "p" })).toEqual([]);
    expect(itemKindRuleViolations({ kind: "event", eventDate: "2026-08-01", eventTime: "14:00" })).toEqual([]);
    expect(itemKindRuleViolations({ kind: "ref", refBlockId: "t" })).toEqual([]);
  });
});

describe("block / page patches", () => {
  it("blockWriteSchema validates the date and allows a null template", () => {
    expect(blockWriteSchema.safeParse({ pageId: "p", templateId: null, title: "T", date: "2026-08-01" }).success).toBe(true);
    expect(issueCodes(blockWriteSchema, { pageId: "p", title: "T", date: "2026-08-32" })).toEqual(["date=invalid_date"]);
  });

  it("blockPatchSchema allows un-templateing via null", () => {
    expect(blockPatchSchema.safeParse({ templateId: null }).success).toBe(true);
  });

  it("pagePatchSchema only knows the title", () => {
    expect(mappedIssues(pagePatchSchema, { spaceId: "other" })).toEqual(["spaceId=unrecognized_keys"]);
  });
});

describe("calendarParamsSchema", () => {
  it("requires both bounds and rejects a reversed window", () => {
    expect(issueCodes(calendarParamsSchema, { from: "2026-08-10" })).toEqual(["to=invalid_type"]);
    expect(issueCodes(calendarParamsSchema, { from: "2026-08-11", to: "2026-08-10" })).toEqual(["from=from_after_to"]);
  });

  it("accepts a valid window", () => {
    expect(calendarParamsSchema.safeParse({ from: "2026-08-01", to: "2026-08-31" }).success).toBe(true);
  });
});

describe("zodToFieldIssues", () => {
  it("maps a ZodError to per-field path + code", () => {
    const result = itemWriteSchema.safeParse({ blockId: "b", kind: "note", position: 1, heading: 3, dueDate: "2026-13-01" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(zodToFieldIssues(result.error)).toEqual([
        { path: "heading", code: "invalid_union" },
        { path: "dueDate", code: "invalid_date" },
      ]);
    }
  });

  it("reports unrecognized keys at the offending key", () => {
    const result = spacePatchSchema.safeParse({ role: "admin" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(zodToFieldIssues(result.error)).toEqual([{ path: "role", code: "unrecognized_keys" }]);
    }
  });

  it("preserves custom rule codes", () => {
    const result = itemWriteSchema.safeParse({ blockId: "b", kind: "task", position: 1, heading: 1 });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(zodToFieldIssues(result.error)).toEqual([{ path: "heading", code: "heading_only_on_note" }]);
    }
  });
});

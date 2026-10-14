import { describe, expect, it } from "vitest";
import { item } from "./fixtures.ts";
import {
  inlineMergeItems,
  insertedCommand,
  slashStartsCommand,
} from "./inlineCommands.ts";

describe("inline commands", () => {
  it("recognizes inserted commands at text boundaries without consuming existing text", () => {
    expect(insertedCommand("Existing ", "Existing /merge")).toEqual({
      start: 9,
      query: "merge",
    });
    expect(insertedCommand("Text", "Text/")).toEqual({ start: 4, query: "" });
    expect(insertedCommand("", "/task")).toEqual({ start: 0, query: "task" });
    expect(insertedCommand("A B", "A /B")).toEqual({ start: 2, query: "" });
    expect(insertedCommand("Original", "/merge")).toBeNull();
  });
  it("leaves URLs, paths, deletions and ordinary slash text alone", () => {
    for (const [before, after] of [
      ["https:", "https:/"],
      ["foo", "foo/bar"],
      ["A/B", "AB"],
      ["", "/not a command"],
    ])
      expect(insertedCommand(before!, after!)).toBeNull();
  });
  const a = item({ id: "a", kind: "note" });
  const b = item({ id: "b", kind: "note" });
  const c = item({ id: "c", kind: "note" });
  it("uses the explicit selection and never quietly removes an incompatible selected row", () => {
    const task = item({ id: "t", kind: "task" });
    expect(
      inlineMergeItems(
        [a, task, b],
        ["a", "t", "b"],
        new Set(["a", "t", "b"]),
        "b",
      ).map((row) => row.id),
    ).toEqual(["a", "t", "b"]);
  });
  it("offers only an adjacent pair, preferring the following note and respecting boundaries", () => {
    expect(
      inlineMergeItems([a, b, c], ["a", "b", "c"], new Set(), "b").map(
        (row) => row.id,
      ),
    ).toEqual(["b", "c"]);
    expect(
      inlineMergeItems([a, b, c], ["a", "b", "c"], new Set(), "c").map(
        (row) => row.id,
      ),
    ).toEqual(["b", "c"]);
    const heading = item({ id: "h", kind: "note", heading: 1 });
    expect(
      inlineMergeItems([a, heading, b], ["a", "h", "b"], new Set(), "b").map(
        (row) => row.id,
      ),
    ).toEqual(["b"]);
  });
});

it("keyboard commands open within ordinary text but leave existing URL/path syntax alone", () => {
  expect(slashStartsCommand("Existing", 8)).toBe(true);
  expect(slashStartsCommand("Existing", 3)).toBe(true);
  expect(slashStartsCommand("https:", 6)).toBe(false);
  expect(slashStartsCommand("src/foo", 7)).toBe(false);
  expect(slashStartsCommand("src/foo ", 8)).toBe(true);
});

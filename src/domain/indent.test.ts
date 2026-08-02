import { describe, expect, it } from "vitest";
import { item } from "./fixtures.ts";
import { computeIndentation } from "./indent.ts";

describe("computeIndentation", () => {
  it("indents nothing before the first heading", () => {
    const rows = computeIndentation([item({ id: "n1", kind: "note" }), item({ id: "n2", kind: "note" })]);
    expect(rows.map((row) => row.indent)).toEqual([false, false]);
  });

  it("indents rows under a heading, but not the heading itself", () => {
    const rows = computeIndentation([
      item({ id: "h", kind: "note", heading: 1, text: "Agenda" }),
      item({ id: "n1", kind: "note" }),
      item({ id: "n2", kind: "note" }),
    ]);
    expect(rows.map((row) => ({ id: row.item.id, indent: row.indent }))).toEqual([
      { id: "h", indent: false },
      { id: "n1", indent: true },
      { id: "n2", indent: true },
    ]);
  });

  it("keeps indenting across several headings until the next one", () => {
    const rows = computeIndentation([
      item({ id: "h1", kind: "note", heading: 1, text: "Teilnehmer" }),
      item({ id: "n1", kind: "note" }),
      item({ id: "h2", kind: "note", heading: 2, text: "Agenda" }),
      item({ id: "n2", kind: "note" }),
      item({ id: "n3", kind: "note" }),
    ]);
    expect(rows.map((row) => row.indent)).toEqual([false, true, false, true, true]);
  });

  it("indents ref rows like notes under a heading", () => {
    const rows = computeIndentation([
      item({ id: "h", kind: "note", heading: 1, text: "Quellen" }),
      item({ id: "r", kind: "ref", refBlockId: "target" }),
    ]);
    expect(rows.map((row) => ({ id: row.item.id, indent: row.indent }))).toEqual([
      { id: "h", indent: false },
      { id: "r", indent: true },
    ]);
  });
});

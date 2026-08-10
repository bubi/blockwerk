import { describe, expect, it } from "vitest";
import type { ItemRow } from "../../shared/db.ts";
import { item } from "./fixtures.ts";
import { canMergeNotes, mergeNotesToList } from "./merge.ts";

function note(id: string, text: string, extra: Partial<ItemRow> = {}): ItemRow {
  return item({ id, kind: "note", text, ...extra });
}

describe("mergeNotesToList", () => {
  it("merges two plain notes into one list, keeping the first row's identity", () => {
    const a = note("n1", "Kapazitäten prüfen");
    const b = note("n2", "Interviewwelle planen");
    const result = mergeNotesToList([a, b]);
    expect(result).toEqual({
      keepId: "n1",
      listMark: "*",
      text: "• Kapazitäten prüfen\n• Interviewwelle planen",
      deleteIds: ["n2"],
    });
  });

  it("carries an existing list mark over and does not double-mark", () => {
    const a = note("n1", "• erster Punkt", { listMark: "*" });
    const b = note("n2", "zweiter Punkt");
    const result = mergeNotesToList([a, b]);
    expect(result).toEqual({
      keepId: "n1",
      listMark: "*",
      text: "• erster Punkt\n• zweiter Punkt",
      deleteIds: ["n2"],
    });
  });

  it("normalizes lines of another marker to the chosen display mark", () => {
    const a = note("n1", "- alter Strich");
    const b = note("n2", "neu");
    const result = mergeNotesToList([a, b]);
    expect(result).toEqual({
      keepId: "n1",
      listMark: "*",
      text: "• alter Strich\n• neu",
      deleteIds: ["n2"],
    });
  });

  it("keeps a multi-line note's lines and drops blank lines", () => {
    const a = note("n1", "erste Zeile\n\nzweite Zeile");
    const b = note("n2", "dritte");
    const result = mergeNotesToList([a, b]);
    expect(result).toEqual({
      keepId: "n1",
      listMark: "*",
      text: "• erste Zeile\n• zweite Zeile\n• dritte",
      deleteIds: ["n2"],
    });
  });

  it("uses a dash list when the first row is a dash list point", () => {
    const a = note("n1", "- erster", { listMark: "-" });
    const b = note("n2", "zweiter");
    const result = mergeNotesToList([a, b]);
    expect(result).toEqual({
      keepId: "n1",
      listMark: "-",
      text: "- erster\n- zweiter",
      deleteIds: ["n2"],
    });
  });
});

describe("canMergeNotes", () => {
  it("needs at least two rows", () => {
    expect(canMergeNotes([note("n1", "eins")])).toBe(false);
    expect(canMergeNotes([note("n1", "eins"), note("n2", "zwei")])).toBe(true);
  });

  it("locks a task in the selection", () => {
    const task = item({ id: "t1", kind: "task", text: "Aufgabe" });
    expect(canMergeNotes([task, note("n1", "eins")])).toBe(false);
  });

  it("locks an event and a ref", () => {
    const event = item({ id: "e1", kind: "event", text: "Termin" });
    const ref = item({ id: "r1", kind: "ref", text: "Verweis" });
    expect(canMergeNotes([note("n1", "eins"), event])).toBe(false);
    expect(canMergeNotes([ref, note("n1", "eins")])).toBe(false);
  });

  it("locks a heading", () => {
    const heading = note("h1", "Titel", { heading: 1 });
    expect(canMergeNotes([heading, note("n1", "eins")])).toBe(false);
  });

  it("locks a task's own note", () => {
    const child = note("c1", "kindnotiz", { parentItemId: "t1" });
    expect(canMergeNotes([child, note("n1", "eins")])).toBe(false);
  });

  it("returns null from mergeNotesToList when locked", () => {
    const task = item({ id: "t1", kind: "task", text: "Aufgabe" });
    expect(mergeNotesToList([task, note("n1", "eins")])).toBeNull();
  });
});

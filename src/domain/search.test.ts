import { describe, expect, it } from "vitest";
import { block, item } from "./fixtures.ts";
import { SEARCH_LIMIT, searchMatches } from "./search.ts";

describe("searchMatches", () => {
  it("matches block titles and item text as a case-insensitive substring", () => {
    const blocks = [
      block({ id: "b1", title: "Quartalsplanung Q3" }),
      block({ id: "b2", title: "Interview Nordbau" }),
    ];
    const items = [
      item({ id: "i1", blockId: "b1", kind: "task", text: "Kapazitätsplan für Q3" }),
      item({ id: "i2", blockId: "b2", kind: "note", text: "Amira, Herr Voss" }),
    ];

    const result = searchMatches(blocks, items, "Q3");
    expect(result.blocks.map((b) => b.id)).toEqual(["b1"]);
    expect(result.items.map((i) => i.id)).toEqual(["i1"]);

    // Case does not matter.
    expect(searchMatches(blocks, items, "nordbau").blocks.map((b) => b.id)).toEqual(["b2"]);
    expect(searchMatches(blocks, items, "AMIRA").items.map((i) => i.id)).toEqual(["i2"]);
  });

  it("orders blocks newest date first, items by their block's date then stream position", () => {
    const blocks = [
      block({ id: "old", date: "2026-07-01", title: "Absatz alte Notiz" }),
      block({ id: "new", date: "2026-08-02", title: "Absatz neue Notiz" }),
    ];
    const items = [
      item({ id: "late-old", blockId: "old", position: 5000, kind: "note", text: "Hinter Absatz" }),
      item({ id: "early-new", blockId: "new", position: 1000, kind: "note", text: "Vorne Absatz" }),
      item({ id: "late-new", blockId: "new", position: 2000, kind: "note", text: "Hinter Absatz" }),
    ];

    const result = searchMatches(blocks, items, "absatz");
    expect(result.blocks.map((b) => b.id)).toEqual(["new", "old"]);
    expect(result.items.map((i) => i.id)).toEqual(["early-new", "late-new", "late-old"]);
  });

  it("returns an empty result for a blank query and ignores leading/trailing whitespace", () => {
    const blocks = [block({ id: "b1", title: "Anything" })];
    const items = [item({ id: "i1", blockId: "b1", kind: "note", text: "Anything" })];

    expect(searchMatches(blocks, items, "")).toEqual({ blocks: [], items: [] });
    expect(searchMatches(blocks, items, "   ")).toEqual({ blocks: [], items: [] });
    expect(searchMatches(blocks, items, " anything ").blocks.map((b) => b.id)).toEqual(["b1"]);
  });

  it("caps each group at SEARCH_LIMIT", () => {
    const blocks = Array.from({ length: SEARCH_LIMIT + 5 }, (_, i) =>
      block({ id: `b${i}`, title: `Treffer ${i}` }),
    );
    const items = Array.from({ length: SEARCH_LIMIT + 5 }, (_, i) =>
      item({ id: `i${i}`, blockId: `b${i}`, kind: "note", text: `Trefferzeile ${i}` }),
    );

    const result = searchMatches(blocks, items, "treffer");
    expect(result.blocks).toHaveLength(SEARCH_LIMIT);
    expect(result.items).toHaveLength(SEARCH_LIMIT);
  });
});

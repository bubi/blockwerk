import { describe, expect, it } from "vitest";
import { itemLink, readLink } from "./links.ts";
describe("stable content links", () => {
  it("roundtrips IDs without treating special characters as parameters", () => {
    expect(readLink(itemLink("block & one", "item#two"))).toEqual({
      blockId: "block & one",
      itemId: "item#two",
    });
  });
  it("ignores empty and oversized link targets", () => {
    expect(readLink("#item=x")).toBeNull();
    expect(readLink(`#block=${"x".repeat(129)}`)).toBeNull();
  });
});

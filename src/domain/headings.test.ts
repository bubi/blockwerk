import { describe, expect, it } from "vitest";
import { detectHeading } from "./headings.ts";

describe("detectHeading", () => {
  it("detects # and ## at the line start", () => {
    expect(detectHeading("# Agenda")).toEqual({ heading: 1, text: "Agenda" });
    expect(detectHeading("## Unterpunkt")).toEqual({ heading: 2, text: "Unterpunkt" });
  });

  it("caps a longer hash run at level 2, like the prototype", () => {
    expect(detectHeading("### Titel")).toEqual({ heading: 2, text: "Titel" });
  });

  it("keeps a hash in the middle of a line as text", () => {
    expect(detectHeading("foo # bar")).toBeNull();
    expect(detectHeading("ein # im Satz")).toBeNull();
  });

  it("requires whitespace after the hashes", () => {
    expect(detectHeading("#foo")).toBeNull();
    expect(detectHeading("##foo")).toBeNull();
  });

  it("returns null for plain lines", () => {
    expect(detectHeading("ganz normal")).toBeNull();
    expect(detectHeading("")).toBeNull();
  });

  it("collapses leading whitespace between hashes and text", () => {
    expect(detectHeading("#   foo")).toEqual({ heading: 1, text: "foo" });
  });
});

import { describe, expect, it } from "vitest";
import { deriveShort } from "./naming.ts";

describe("deriveShort", () => {
  it("uses the first letters of the first two words", () => {
    expect(deriveShort("Lena Brandt")).toBe("LB");
    expect(deriveShort("Roadmap Q3")).toBe("RQ");
  });

  it("falls back to a single letter for one-word names", () => {
    expect(deriveShort("Tomas")).toBe("T");
  });

  it("trims surrounding whitespace", () => {
    expect(deriveShort("  Amira  Sy  ")).toBe("AS");
  });

  it("falls back to ?? for an empty name", () => {
    expect(deriveShort("   ")).toBe("??");
  });
});

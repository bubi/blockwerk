import { describe, expect, it } from "vitest";
import { fromISODate, toISODate } from "./formatDate.ts";

describe("toISODate", () => {
  it("pads month and day to two digits", () => {
    expect(toISODate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("formats a date without padding needed", () => {
    expect(toISODate(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("fromISODate", () => {
  it("parses an ISO date back to local midnight", () => {
    const date = fromISODate("2026-01-05");
    expect(date.getFullYear()).toBe(2026);
    expect(date.getMonth()).toBe(0);
    expect(date.getDate()).toBe(5);
  });

  it("throws on malformed input", () => {
    expect(() => fromISODate("5.1.2026")).toThrow();
  });

  it("round-trips through toISODate", () => {
    const original = "2026-08-01";
    expect(toISODate(fromISODate(original))).toBe(original);
  });
});

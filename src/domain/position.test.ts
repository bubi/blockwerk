import { describe, expect, it } from "vitest";
import { insertPositionBetween } from "./position.ts";

describe("insertPositionBetween", () => {
  it("places a new row at the midpoint between its neighbors", () => {
    expect(insertPositionBetween(1000, 4000)).toBe(2500);
    expect(insertPositionBetween(1000, 3000)).toBe(2000);
    expect(insertPositionBetween(1000, 2001)).toBe(1500);
  });

  it("appends below the lower neighbor when there is no upper neighbor", () => {
    expect(insertPositionBetween(7000, null)).toBe(8000);
    expect(insertPositionBetween(null, null)).toBe(1000);
  });

  it("places a row before the upper neighbor when there is no lower neighbor", () => {
    expect(insertPositionBetween(null, 2000)).toBe(1000);
  });

  it("collides with the upper neighbor once the gap is exhausted, so the server re-spaces", () => {
    expect(insertPositionBetween(1000, 1001)).toBe(1001);
  });
});

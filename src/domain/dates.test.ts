import { describe, expect, it } from "vitest";
import {
  addDays,
  dayNumber,
  formatMonthYear,
  formatShort,
  fromISODate,
  monthName,
  parseDateWord,
  relativeLabel,
  toISODate,
  weekdayShort,
} from "./dates.ts";

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

describe("addDays", () => {
  it("crosses month and year boundaries", () => {
    expect(toISODate(addDays(new Date(2026, 11, 30), 2))).toBe("2027-01-01");
    expect(toISODate(addDays(new Date(2026, 0, 1), -1))).toBe("2025-12-31");
  });
});

describe("formatShort", () => {
  it("renders weekday abbreviation and day.month", () => {
    expect(formatShort("2026-08-10")).toBe("Mo 10.8.");
    expect(formatShort("2026-01-15")).toBe("Do 15.1.");
  });
});

describe("weekdayShort / dayNumber", () => {
  it("labels weekday indices and reads the day of month", () => {
    expect(weekdayShort(1)).toBe("Mo");
    expect(weekdayShort(7)).toBe("");
    expect(dayNumber("2026-08-10")).toBe(10);
  });
});

describe("monthName / formatMonthYear", () => {
  it("names the month in German and formats the headline", () => {
    expect(monthName(0)).toBe("Januar");
    expect(monthName(7)).toBe("August");
    expect(formatMonthYear(2026, 7)).toBe("August 2026");
  });
});

describe("relativeLabel", () => {
  const today = new Date(2026, 7, 10);

  it("names today, tomorrow, and yesterday", () => {
    expect(relativeLabel("2026-08-10", today)).toBe("heute");
    expect(relativeLabel("2026-08-11", today)).toBe("morgen");
    expect(relativeLabel("2026-08-09", today)).toBe("gestern");
  });

  it("labels overdue and upcoming days at the boundaries", () => {
    expect(relativeLabel("2026-08-07", today)).toBe("3 T überfällig");
    expect(relativeLabel("2026-08-13", today)).toBe("in 3 T");
    expect(relativeLabel("2026-08-06", today)).toBe("4 T überfällig");
  });
});

describe("parseDateWord", () => {
  const today = new Date(2026, 0, 15); // Thursday, 2026-01-15

  it("parses heute, morgen, übermorgen and its ASCII spelling", () => {
    expect(toISODate(parseDateWord("heute", today)!)).toBe("2026-01-15");
    expect(toISODate(parseDateWord("morgen", today)!)).toBe("2026-01-16");
    expect(toISODate(parseDateWord("übermorgen", today)!)).toBe("2026-01-17");
    expect(toISODate(parseDateWord("uebermorgen", today)!)).toBe("2026-01-17");
  });

  it("parses weekday abbreviations as the next such day", () => {
    expect(toISODate(parseDateWord("mo", today)!)).toBe("2026-01-19");
    expect(toISODate(parseDateWord("fr", today)!)).toBe("2026-01-16");
    expect(toISODate(parseDateWord("so", today)!)).toBe("2026-01-18");
  });

  it("parses day.month with an optional year", () => {
    expect(toISODate(parseDateWord("25.8.", today)!)).toBe("2026-08-25");
    expect(toISODate(parseDateWord("25.08.2026", today)!)).toBe("2026-08-25");
    expect(toISODate(parseDateWord("25.8.27", today)!)).toBe("2027-08-25");
  });

  it("uses the current year for a yearless date in January — no rollover", () => {
    expect(toISODate(parseDateWord("25.12.", today)!)).toBe("2026-12-25");
  });

  it("crosses the year boundary for a weekday at New Year", () => {
    const newYearsEve = new Date(2026, 11, 31); // Thursday
    expect(toISODate(parseDateWord("mo", newYearsEve)!)).toBe("2027-01-04");
  });

  it("returns null for unsupported input", () => {
    expect(parseDateWord("whatever", today)).toBeNull();
    expect(parseDateWord("", today)).toBeNull();
    expect(parseDateWord("25", today)).toBeNull();
  });
});

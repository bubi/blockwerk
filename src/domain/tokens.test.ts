import { describe, expect, it } from "vitest";
import type { SpaceRow } from "../../shared/db.ts";
import { parseTokens } from "./tokens.ts";

const TODAY = new Date(2026, 7, 10);

function person(id: string, name: string): Pick<SpaceRow, "id" | "name" | "kind"> {
  return { id, name, kind: "person" };
}

describe("parseTokens", () => {
  const people = [person("lena", "Lena Brandt"), person("tomas", "Tomas Kirsch"), person("amira", "Amira Sy")];

  it("matches @Person on the first name", () => {
    const result = parseTokens("@lena Termin vorbereiten", people, TODAY);
    expect(result).toEqual({ text: "Termin vorbereiten", assigneeId: "lena", dueDate: null, eventTime: null });
  });

  it("matches @Person on the last name", () => {
    const result = parseTokens("Bericht @brandt", people, TODAY);
    expect(result).toEqual({ text: "Bericht", assigneeId: "lena", dueDate: null, eventTime: null });
  });

  it("resolves an ambiguous prefix to the first matching person", () => {
    const ambiguous = [person("lena", "Lena Brandt"), person("lukas", "Lukas Braun")];
    const result = parseTokens("@l Hallo", ambiguous, TODAY);
    expect(result.assigneeId).toBe("lena");
  });

  it("never assigns to a topic, and leaves unmatched @ tokens in the text", () => {
    const withTopic = [person("lena", "Lena Brandt"), { id: "feed", name: "Kundenfeedback", kind: "topic" as const }];
    const result = parseTokens("@kunden Plan", withTopic, TODAY);
    expect(result.assigneeId).toBeNull();
    expect(result.text).toBe("@kunden Plan");

    const none = parseTokens("@zzz Text", withTopic, TODAY);
    expect(none.assigneeId).toBeNull();
    expect(none.text).toBe("@zzz Text");
  });

  it("normalizes a one-digit time to HH:MM", () => {
    const result = parseTokens("Standup 9:30", people, TODAY);
    expect(result.eventTime).toBe("09:30");
    expect(result.text).toBe("Standup");
  });

  it("keeps a padded time as-is", () => {
    expect(parseTokens("Call 14:00", people, TODAY).eventTime).toBe("14:00");
  });

  it("parses !datum word forms", () => {
    expect(parseTokens("Bericht !heute", people, TODAY).dueDate).toBe("2026-08-10");
    expect(parseTokens("Bericht !morgen", people, TODAY).dueDate).toBe("2026-08-11");
    expect(parseTokens("Bericht !25.8.", people, TODAY).dueDate).toBe("2026-08-25");
    expect(parseTokens("Bericht !25.08.2026", people, TODAY).dueDate).toBe("2026-08-25");
    expect(parseTokens("Bericht !mo", people, TODAY).dueDate).toBe("2026-08-17");
  });

  it("extracts all tokens at once and collapses whitespace", () => {
    const result = parseTokens("  @lena   Bericht   !25.8.   9:30 ", people, TODAY);
    expect(result).toEqual({
      text: "Bericht",
      assigneeId: "lena",
      dueDate: "2026-08-25",
      eventTime: "09:30",
    });
  });

  it("leaves unrecognized ! tokens in the text", () => {
    const result = parseTokens("Text !foo", people, TODAY);
    expect(result.dueDate).toBeNull();
    expect(result.text).toBe("Text !foo");
  });
});

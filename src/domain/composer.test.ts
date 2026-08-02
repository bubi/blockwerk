import { describe, expect, it } from "vitest";
import type { SpaceRow } from "../../shared/db.ts";
import { COMPOSER_COMMANDS, composeItem, matchComposerCommands } from "./composer.ts";

const TODAY = new Date(2026, 7, 10);

const people: Pick<SpaceRow, "id" | "name" | "kind">[] = [
  { id: "lena", name: "Lena Brandt", kind: "person" },
  { id: "tomas", name: "Tomas Kirsch", kind: "person" },
  { id: "amira", name: "Amira Sy", kind: "person" },
];

function commit(mode: Parameters<typeof composeItem>[0]["mode"], raw: string, refBlockId: string | null = null) {
  return composeItem({ mode, raw, refBlockId, spaces: people, today: TODAY });
}

describe("matchComposerCommands", () => {
  it("returns every command for an empty filter", () => {
    expect(matchComposerCommands("")).toHaveLength(COMPOSER_COMMANDS.length);
  });

  it("filters by key or label prefix", () => {
    expect(matchComposerCommands("ta").map((command) => command.key)).toEqual(["task"]);
    expect(matchComposerCommands("t").map((command) => command.key)).toEqual(["task", "event"]);
    expect(matchComposerCommands("Über").map((command) => command.key)).toEqual(["heading"]);
    expect(matchComposerCommands("v").map((command) => command.key)).toEqual(["ref"]);
  });
});

describe("composeItem", () => {
  it("builds a task with assignee, due date, and time parsed from the tokens", () => {
    expect(commit("task", "Protokoll @tomas !morgen")).toEqual({
      kind: "task",
      text: "Protokoll",
      done: false,
      dueDate: "2026-08-11",
      assigneeSpaceId: "tomas",
    });
  });

  it("builds an event and defaults its date to today when no !datum is given", () => {
    expect(commit("event", "Call 14:00")).toEqual({
      kind: "event",
      text: "Call",
      eventDate: "2026-08-10",
      eventTime: "14:00",
    });
    expect(commit("event", "Follow-up !12.8. 10:30")).toEqual({
      kind: "event",
      text: "Follow-up",
      eventDate: "2026-08-12",
      eventTime: "10:30",
    });
  });

  it("builds a heading (level 1) and strips a leading # if present", () => {
    expect(commit("heading", "# Agenda")).toEqual({ kind: "note", text: "Agenda", heading: 1 });
    expect(commit("heading", "Agenda")).toEqual({ kind: "note", text: "Agenda", heading: 1 });
  });

  it("builds a note and turns a leading # into a heading, like typing it directly", () => {
    expect(commit("note", "# Agenda")).toEqual({ kind: "note", text: "Agenda", heading: 1 });
    expect(commit("note", "einfacher Text")).toEqual({ kind: "note", text: "einfacher Text", heading: null });
  });

  it("keeps an unmatched @ token in a note's text but strips it from a task", () => {
    expect(commit("note", "mail @lena")).toEqual({ kind: "note", text: "mail @lena", heading: null });
    expect(commit("task", "mail @lena")).toEqual({ kind: "task", text: "mail", done: false, dueDate: null, assigneeSpaceId: "lena" });
  });

  it("builds a ref from the chosen target block", () => {
    expect(commit("ref", "anything", "b2")).toEqual({ kind: "ref", text: "", refBlockId: "b2" });
  });

  it("returns null when there is nothing to commit", () => {
    expect(commit("task", "   ")).toBeNull();
    expect(commit("task", "@lena")).toBeNull();
    expect(commit("ref", "text", null)).toBeNull();
  });
});

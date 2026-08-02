import type { SpaceRow } from "../../shared/db.ts";
import { toISODate } from "./dates.ts";
import { detectHeading } from "./headings.ts";
import { parseTokens } from "./tokens.ts";

/**
 * The composer's command model and the pure translation from (mode, raw
 * input) into an item's fields. Components only render this result — the
 * slash-menu matching and the token parsing live here (PROJECT.md: no parser
 * logic in components).
 */

export type ComposerCommandKey = "task" | "event" | "heading" | "note" | "ref";

export interface ComposerCommand {
  key: ComposerCommandKey;
  label: string;
  hint: string;
}

export const COMPOSER_COMMANDS: readonly ComposerCommand[] = [
  { key: "task", label: "Task", hint: "@Person und !datum werden erkannt" },
  { key: "event", label: "Termin", hint: "!datum und 14:00 werden erkannt" },
  { key: "heading", label: "Überschrift", hint: "oder einfach # am Zeilenanfang" },
  { key: "note", label: "Notiz", hint: "einfache Textzeile" },
  { key: "ref", label: "Verweis", hint: "auf einen anderen Block zeigen" },
];

export function commandLabel(key: ComposerCommandKey): string {
  return COMPOSER_COMMANDS.find((command) => command.key === key)?.label ?? "";
}

export function commandHint(key: ComposerCommandKey): string {
  return COMPOSER_COMMANDS.find((command) => command.key === key)?.hint ?? "";
}

/** Filters the command list by the typed prefix after "/" (prototype rule). */
export function matchComposerCommands(filter: string): ComposerCommand[] {
  const query = filter.toLowerCase();
  if (query === "") return [...COMPOSER_COMMANDS];
  return COMPOSER_COMMANDS.filter(
    (command) => command.label.toLowerCase().startsWith(query) || command.key.startsWith(query),
  );
}

/** The item fields a composer command produces; BlockCard adds id/blockId/position. */
export type ComposerItemFields =
  | { kind: "note"; text: string; heading: 1 | 2 | null }
  | { kind: "task"; text: string; done: boolean; dueDate: string | null; assigneeSpaceId: string | null }
  | { kind: "event"; text: string; eventDate: string | null; eventTime: string | null }
  | { kind: "ref"; text: string; refBlockId: string };

export function composeItem(input: {
  mode: ComposerCommandKey;
  raw: string;
  refBlockId: string | null;
  spaces: readonly Pick<SpaceRow, "id" | "name" | "kind">[];
  today: Date;
}): ComposerItemFields | null {
  if (input.mode === "ref") {
    if (!input.refBlockId) return null;
    return { kind: "ref", text: "", refBlockId: input.refBlockId };
  }

  const raw = input.raw.trim();
  if (!raw) return null;
  // The token guard mirrors the prototype: an input that is nothing but
  // tokens (e.g. just "@lena") commits nothing.
  const tokens = parseTokens(raw, input.spaces, input.today);
  if (!tokens.text) return null;

  switch (input.mode) {
    case "task":
      return { kind: "task", text: tokens.text, done: false, dueDate: tokens.dueDate, assigneeSpaceId: tokens.assigneeId };
    case "event":
      return { kind: "event", text: tokens.text, eventDate: tokens.dueDate ?? toISODate(input.today), eventTime: tokens.eventTime };
    case "heading": {
      const detected = detectHeading(raw);
      return { kind: "note", text: detected ? detected.text : raw, heading: 1 };
    }
    case "note": {
      const detected = detectHeading(raw);
      return { kind: "note", text: detected ? detected.text : raw, heading: detected ? detected.heading : null };
    }
  }
}

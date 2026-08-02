import type { SpaceRow } from "../../shared/db.ts";
import { parseDateWord, toISODate } from "./dates.ts";

export interface ParsedComposerTokens {
  /** The remaining text with tokens removed and whitespace collapsed. */
  text: string;
  /** The matched person's id, or null. */
  assigneeId: string | null;
  /** 'YYYY-MM-DD', or null. */
  dueDate: string | null;
  /** 'HH:MM', zero-padded, or null. */
  eventTime: string | null;
}

/** Matches a time token like `14:00` or `9:30` (normalized to `09:30`). */
const TIME_RE = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;

/**
 * Extracts the composer tokens from raw input — `@Person`, `!datum`, and a
 * time `HH:MM` — and returns the cleaned text plus the recognized fields.
 *
 * Only the first occurrence of each token is recognized. An ambiguous
 * `@name` (several people share the prefix) resolves to the first matching
 * person, in the order of `spaces` (prototype behavior).
 */
export function parseTokens(
  raw: string,
  spaces: readonly Pick<SpaceRow, "id" | "name" | "kind">[],
  today: Date,
): ParsedComposerTokens {
  let text = raw;
  let assigneeId: string | null = null;
  let dueDate: string | null = null;
  let eventTime: string | null = null;

  const at = text.match(/@([\p{L}]+)/u);
  if (at) {
    const query = at[1]!.toLowerCase();
    const hit = spaces.find(
      (space) =>
        space.kind === "person" &&
        (space.name.toLowerCase().startsWith(query) ||
          space.name.toLowerCase().split(" ").some((part) => part.startsWith(query))),
    );
    if (hit) {
      assigneeId = hit.id;
      text = text.replace(at[0], "").trim();
    }
  }

  const time = text.match(TIME_RE);
  if (time) {
    eventTime = `${time[1]!.padStart(2, "0")}:${time[2]!}`;
    text = text.replace(time[0], "").trim();
  }

  const bang = text.match(/!(\S+)/);
  if (bang) {
    const date = parseDateWord(bang[1]!, today);
    if (date) {
      dueDate = toISODate(date);
      text = text.replace(bang[0], "").trim();
    }
  }

  return { text: text.replace(/\s{2,}/g, " ").trim(), assigneeId, dueDate, eventTime };
}

export interface DetectedHeading {
  heading: 1 | 2;
  text: string;
}

/**
 * '#' and '##' at the very start of a line mark heading level 1 and 2; like
 * the prototype, a longer '#' run is capped at level 2. A hash anywhere
 * else in the line stays plain text — the regex is anchored to the start.
 */
const HEAD_RE = /^(#{1,3})\s+(.*)$/;

/** Returns the heading level and the text after the hashes, or null if the line is no heading. */
export function detectHeading(raw: string): DetectedHeading | null {
  const match = HEAD_RE.exec(raw);
  if (!match) return null;
  return { heading: Math.min(match[1]!.length, 2) as 1 | 2, text: match[2]! };
}

export type ListMark = "*" | "-";

/**
 * How a list marker renders in the text: `*` is a footnote asterisk and
 * reads badly as a bullet, so it appears as a dot; `-` stays a dash. The
 * trigger for a list point is either, the display is uniform per list.
 */
export function listDisplayMark(mark: ListMark): string {
  return mark === "*" ? "• " : "- ";
}

/**
 * `*` or `-` at the very start of a line, followed by whitespace, makes a
 * list point. The marker is kept on the item (like a heading); the text is
 * the rest of the line. A marker anywhere else stays plain text.
 */
const LIST_RE = /^([*-])\s+(.*)$/;

export function detectListMark(
  raw: string,
): { mark: ListMark; text: string } | null {
  const match = LIST_RE.exec(raw);
  if (!match) return null;
  return { mark: match[1] as ListMark, text: match[2]! };
}

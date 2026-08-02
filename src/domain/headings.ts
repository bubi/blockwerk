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

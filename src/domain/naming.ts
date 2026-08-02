/**
 * The short code (Kürzel) of a space, derived from its name: the first
 * letters of the first two words, upper-cased. One source of truth — the
 * same derivation creates a space and renders its badge.
 */
export function deriveShort(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase() || "??"
  );
}

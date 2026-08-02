import type { ItemRow } from "../../shared/db.ts";

export interface IndentedRow {
  item: ItemRow;
  /** True when the row sits under a heading and must be rendered indented. */
  indent: boolean;
}

/**
 * Pure presentation: which note/ref rows stand under a heading. Rows before
 * the first heading are not indented, a heading row itself is never
 * indented, and every following note/ref row until the next heading is.
 * Display-only — there is no tree structure in the data (PROJECT.md).
 */
export function computeIndentation(notes: readonly ItemRow[]): IndentedRow[] {
  let underHeading = false;
  return notes.map((item) => {
    const isHeading = item.kind === "note" && item.heading !== null;
    const indent = isHeading ? false : underHeading;
    if (isHeading) underHeading = true;
    return { item, indent };
  });
}

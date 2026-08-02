import type { ItemRow } from "../../shared/db.ts";
import { computeIndentation, type IndentedRow } from "./indent.ts";
import { groupBlockItems } from "./order.ts";

/**
 * The block's display model — the composition of everything the UI must not
 * re-derive itself. This is the whole body of the prototype's BlockCard logic
 * (grouping, heading indentation, display order) as pure domain code; a
 * component only renders the result. `order` is the row sequence for display
 * and, later, for keyboard navigation.
 */
export interface BlockSection {
  /** Note and ref rows in stream order, each with its heading indentation. */
  notes: IndentedRow[];
  tasks: ItemRow[];
  events: ItemRow[];
  /** Ids of all rows in display order (notes → tasks → events). */
  order: string[];
}

export function buildBlockView(items: readonly ItemRow[]): BlockSection {
  const { notes, tasks, events } = groupBlockItems(items);
  return {
    notes: computeIndentation(notes),
    tasks,
    events,
    order: [...notes.map((row) => row.id), ...tasks.map((row) => row.id), ...events.map((row) => row.id)],
  };
}

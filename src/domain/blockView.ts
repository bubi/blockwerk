import type { ItemRow } from "../../shared/db.ts";
import { computeIndentation, type IndentedRow } from "./indent.ts";
import { groupBlockItems, orderBlockItems, taskChildrenByParent } from "./order.ts";

/**
 * The block's display model — the composition of everything the UI must not
 * re-derive itself. This is the whole body of the prototype's BlockCard logic
 * (grouping, heading indentation, display order) as pure domain code; a
 * component only renders the result. `order` is the row sequence for display
 * and for keyboard navigation.
 */
export interface BlockSection {
  /** Note and ref rows in stream order, each with its heading indentation. */
  notes: IndentedRow[];
  /** Tasks in display order; each one's notes sit in `taskNotes`. */
  tasks: ItemRow[];
  /** The notes attached to each task (docs/adr/0014), position-sorted. */
  taskNotes: Map<string, ItemRow[]>;
  events: ItemRow[];
  /** Ids of all rows in display order (notes → tasks with their notes → events). */
  order: string[];
}

export function buildBlockView(items: readonly ItemRow[]): BlockSection {
  const { notes, tasks, events } = groupBlockItems(items);
  return {
    notes: computeIndentation(notes),
    tasks,
    taskNotes: taskChildrenByParent(items),
    events,
    order: orderBlockItems(items).map((row) => row.id),
  };
}

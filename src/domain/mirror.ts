import type { MirrorTask } from "../../shared/api.ts";
import type { ItemRow } from "../../shared/db.ts";

export interface MirrorGroup {
  block: MirrorTask["block"];
  tasks: ItemRow[];
}

/** Groups a person's mirrored tasks by their source block, first-seen order. */
export function groupMirrorTasks(tasks: readonly MirrorTask[]): MirrorGroup[] {
  const groups: MirrorGroup[] = [];
  const byBlockId = new Map<string, MirrorGroup>();
  for (const task of tasks) {
    let group = byBlockId.get(task.block.id);
    if (!group) {
      group = { block: task.block, tasks: [] };
      byBlockId.set(task.block.id, group);
      groups.push(group);
    }
    group.tasks.push(task.item);
  }
  return groups;
}

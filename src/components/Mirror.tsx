import type { SpaceWithPages } from "../../shared/api.ts";
import type { ItemPatch } from "../../shared/schemas.ts";
import type { MirrorGroup } from "../domain/mirror.ts";
import { formatShort } from "../domain/dates.ts";
import { ItemRow } from "./ItemRow.tsx";
import styles from "./Mirror.module.css";

interface MirrorProps {
  space: SpaceWithPages;
  groups: MirrorGroup[];
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onJumpToBlock: (blockId: string) => void;
}

export function Mirror({ space, groups, onPatchItem, onJumpToBlock }: MirrorProps) {
  return (
    <div className={styles.mirror}>
      <div className={styles.head}>
        <h3>{space.name}</h3>
        <p>Offene Aufgaben, die {space.name} zugewiesen sind. Abhaken wirkt auch am Ursprungsort.</p>
      </div>

      {groups.length === 0 && <p className={styles.empty}>Keine offenen Aufgaben zugewiesen.</p>}

      {groups.map((group) => (
        <section key={group.block.id} className={styles.group}>
          <button
            type="button"
            className={styles.source}
            onClick={() => onJumpToBlock(group.block.id)}
            aria-label={`Zum Ursprungsblock „${group.block.title || "ohne Titel"}" springen`}
          >
            <span className={styles.date}>{formatShort(group.block.date)}</span>
            <span className={styles.title}>{group.block.title || "Ohne Titel"}</span>
          </button>
          <ul className={styles.items}>
            {group.tasks.map((task) => (
              <ItemRow key={task.id} item={task} onPatch={onPatchItem} onJumpToBlock={onJumpToBlock} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

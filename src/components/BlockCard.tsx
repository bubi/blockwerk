import type { BlockPatch, ItemPatch } from "../../shared/schemas.ts";
import type { BlockRow, SpaceRow, TemplateRow } from "../../shared/db.ts";
import type { BlockView } from "../state/selectors.ts";
import { ItemRow } from "./ItemRow.tsx";
import styles from "./BlockCard.module.css";

interface BlockCardProps {
  block: BlockView;
  template: TemplateRow;
  spacesById: ReadonlyMap<string, SpaceRow>;
  blocksById: ReadonlyMap<string, BlockRow>;
  pulse?: boolean;
  onPatchBlock: (id: string, patch: BlockPatch) => void;
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onJumpToBlock: (blockId: string) => void;
}

export function BlockCard({ block, template, spacesById, blocksById, pulse, onPatchBlock, onPatchItem, onJumpToBlock }: BlockCardProps) {
  const doneCount = block.sections.tasks.filter((task) => task.done).length;
  const eventCount = block.sections.events.length;

  return (
    <article
      className={`${styles.block} hue-${template.hue} ${pulse ? styles.pulse : ""}`}
      id={`blk-${block.id}`}
      data-block-id={block.id}
    >
      <header className={styles.head}>
        <div className={styles.top}>
          <span className={styles.pill}>{template.label}</span>
          <label className={styles.datefield}>
            <span className="sr-only">Blockdatum</span>
            <input
              type="date"
              value={block.date}
              onChange={(event) => event.target.value && onPatchBlock(block.id, { date: event.target.value })}
            />
          </label>
          {block.sections.tasks.length > 0 && (
            <span className={styles.meta}>
              {doneCount}/{block.sections.tasks.length} Tasks
            </span>
          )}
          {eventCount > 0 && (
            <span className={styles.meta}>
              {eventCount} {eventCount === 1 ? "Termin" : "Termine"}
            </span>
          )}
        </div>
        <input
          className={styles.title}
          value={block.title}
          onChange={(event) => onPatchBlock(block.id, { title: event.target.value })}
          aria-label="Blocktitel"
          placeholder="Titel"
        />
      </header>

      <ul className={styles.items}>
        {block.sections.notes.map(({ item, indent }) => (
          <ItemRow
            key={item.id}
            item={item}
            indent={indent}
            targetBlock={item.refBlockId ? (blocksById.get(item.refBlockId) ?? null) : null}
            onPatch={onPatchItem}
            onJumpToBlock={onJumpToBlock}
          />
        ))}
        {block.sections.notes.length === 0 && <li className={styles.empty}>Noch keine Notizen</li>}
      </ul>

      {block.sections.tasks.length > 0 && (
        <section className={styles.group}>
          <h4 className={styles.grouphead}>
            Tasks <span>{doneCount}/{block.sections.tasks.length}</span>
          </h4>
          <ul className={styles.items}>
            {block.sections.tasks.map((task) => (
              <ItemRow
                key={task.id}
                item={task}
                assignee={task.assigneeSpaceId ? (spacesById.get(task.assigneeSpaceId) ?? null) : null}
                onPatch={onPatchItem}
                onJumpToBlock={onJumpToBlock}
              />
            ))}
          </ul>
        </section>
      )}

      {eventCount > 0 && (
        <section className={styles.group}>
          <h4 className={styles.grouphead}>
            Folgetermine <span>{eventCount}</span>
          </h4>
          <ul className={styles.items}>
            {block.sections.events.map((event) => (
              <ItemRow key={event.id} item={event} onPatch={onPatchItem} onJumpToBlock={onJumpToBlock} />
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

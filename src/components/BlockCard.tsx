import { Fragment, useRef, useState } from "react";
import type { BlockRow, SpaceRow, TemplateRow } from "../../shared/db.ts";
import type { BlockPatch, ItemPatch } from "../../shared/schemas.ts";
import type { ComposerItemFields } from "../domain/composer.ts";
import { newItemId } from "../domain/ids.ts";
import { insertPositionBetween } from "../domain/position.ts";
import type { ItemCreateInput } from "../state/operations.ts";
import type { BlockView } from "../state/selectors.ts";
import { Composer } from "./Composer.tsx";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import { GrowingTextarea } from "./GrowingTextarea.tsx";
import { ItemRow } from "./ItemRow.tsx";
import styles from "./BlockCard.module.css";

interface BlockCardProps {
  block: BlockView;
  template: TemplateRow;
  meSpaceId: string | null;
  spaces: readonly Pick<SpaceRow, "id" | "name" | "kind">[];
  spacesById: ReadonlyMap<string, SpaceRow>;
  blocksById: ReadonlyMap<string, BlockRow>;
  pulse?: boolean;
  today: Date;
  onPatchBlock: (id: string, patch: BlockPatch) => void;
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onCreateItem: (input: ItemCreateInput) => void;
  onDeleteItem: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onJumpToBlock: (blockId: string) => void;
}

/**
 * Renders one block. It owns no selection state — the two keyboard modes are
 * decided by which element holds focus (docs/adr/0008). It only keeps the DOM
 * references needed to move focus imperatively (arrow navigation, focus after
 * insert/delete).
 */
export function BlockCard({
  block,
  template,
  meSpaceId,
  spaces,
  spacesById,
  blocksById,
  pulse,
  today,
  onPatchBlock,
  onPatchItem,
  onCreateItem,
  onDeleteItem,
  onDeleteBlock,
  onJumpToBlock,
}: BlockCardProps) {
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const inputRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const doneCount = block.sections.tasks.filter((task) => task.done).length;
  const eventCount = block.sections.events.length;

  const registerRow = (id: string, el: HTMLLIElement | null) => {
    if (el) rowRefs.current.set(id, el);
    else rowRefs.current.delete(id);
  };
  const registerInput = (id: string, el: HTMLTextAreaElement | null) => {
    if (el) inputRefs.current.set(id, el);
    else inputRefs.current.delete(id);
  };

  const nav = (itemId: string, dir: -1 | 1) => {
    const order = block.sections.order;
    const next = order[order.indexOf(itemId) + dir];
    if (next === undefined) return;
    rowRefs.current.get(next)?.focus();
  };

  const focusInput = (itemId: string) => {
    window.setTimeout(() => {
      const el = inputRefs.current.get(itemId);
      if (el) {
        el.focus();
        el.setSelectionRange(el.value.length, el.value.length);
      }
    }, 0);
  };

  const insertAfter = (itemId: string) => {
    // Enter in a task's field: a note under the task (docs/adr/0014).
    if (block.sections.tasks.some((task) => task.id === itemId)) {
      addTaskNote(itemId);
      return;
    }
    // A task's note: Enter creates the next note of the same task. The
    // position only orders it among its siblings — display groups children
    // under the task, it never reads the raw gap to the task. (A list point
    // never reaches this path: its Enter is a soft break inside the row.)
    for (const [parentId, siblings] of block.sections.taskNotes) {
      const index = siblings.findIndex((note) => note.id === itemId);
      if (index === -1) continue;
      const after = siblings[index] ?? null;
      const before = siblings[index + 1] ?? null;
      const id = newItemId();
      onCreateItem({
        id,
        blockId: block.id,
        kind: "note",
        position: insertPositionBetween(
          after ? after.position : null,
          before ? before.position : null,
        ),
        text: "",
        heading: null,
        parentItemId: parentId,
      });
      focusInput(id);
      return;
    }

    const notes = block.sections.notes;
    const index = notes.findIndex((row) => row.item.id === itemId);
    const after = notes[index]?.item ?? null;
    const before = notes[index + 1]?.item ?? null;
    const id = newItemId();
    onCreateItem({
      id,
      blockId: block.id,
      kind: "note",
      position: insertPositionBetween(
        after ? after.position : null,
        before ? before.position : null,
      ),
      text: "",
      heading: null,
    });
    focusInput(id);
  };

  /** The task row's "+": creates the first note of the task, like Enter. */
  const addTaskNote = (taskId: string) => {
    const siblings = block.sections.taskNotes.get(taskId) ?? [];
    const after = siblings[siblings.length - 1] ?? null;
    const id = newItemId();
    onCreateItem({
      id,
      blockId: block.id,
      kind: "note",
      position: insertPositionBetween(after ? after.position : null, null),
      text: "",
      heading: null,
      parentItemId: taskId,
    });
    focusInput(id);
  };

  /**
   * Click into the empty notes area (Bug 4): a first editable note is
   * created and the cursor lands in it. The whole area is the click target,
   * not just the placeholder line.
   */
  const addFirstNote = () => {
    const id = newItemId();
    const first = block.items[0] ?? null;
    onCreateItem({
      id,
      blockId: block.id,
      kind: "note",
      position: insertPositionBetween(null, first ? first.position : null),
      text: "",
      heading: null,
    });
    focusInput(id);
  };

  /** The row directly before `itemId` in display order, for focus after a delete. */
  const displayPrevId = (itemId: string) => {
    const order = block.sections.order;
    const index = order.indexOf(itemId);
    return index > 0 ? (order[index - 1] ?? null) : null;
  };

  const deleteRow = (itemId: string, prevId: string | null) => {
    const order = block.sections.order;
    const focusId = prevId ?? order[order.indexOf(itemId) + 1] ?? null;
    onDeleteItem(itemId);
    if (focusId !== null) focusInput(focusId);
  };

  const createComposerItem = (fields: ComposerItemFields) => {
    const lastPosition = block.items.reduce(
      (max, item) => Math.max(max, item.position),
      0,
    );
    onCreateItem({
      id: newItemId(),
      blockId: block.id,
      kind: fields.kind,
      position: insertPositionBetween(lastPosition || null, null),
      text: fields.text,
      heading: fields.kind === "note" ? fields.heading : null,
      done: fields.kind === "task" ? fields.done : undefined,
      dueDate: fields.kind === "task" ? fields.dueDate : null,
      assigneeSpaceId: fields.kind === "task" ? fields.assigneeSpaceId : null,
      eventDate: fields.kind === "event" ? fields.eventDate : null,
      eventTime: fields.kind === "event" ? fields.eventTime : null,
      refBlockId: fields.kind === "ref" ? fields.refBlockId : null,
    });
  };

  return (
    <article
      className={`${styles.block} hue-${template.hue} ${pulse ? styles.pulse : ""}`}
      id={`blk-${block.id}`}
      data-block-id={block.id}
    >
      <header className={styles.head}>
        <div className={`${styles.top} typdot`}>
          <span className="badge badge--type">{template.label}</span>
          <label className={styles.datefield}>
            <span className="sr-only">Blockdatum</span>
            <input
              type="date"
              value={block.date}
              onChange={(event) =>
                event.target.value &&
                onPatchBlock(block.id, { date: event.target.value })
              }
            />
          </label>
          <button
            type="button"
            className={`${styles.kill} label`}
            onClick={() => setConfirmDelete(true)}
            aria-label="Block entfernen"
          >
            Löschen
          </button>
        </div>
        <GrowingTextarea
          className={styles.title}
          value={block.title}
          onChange={(value) => onPatchBlock(block.id, { title: value })}
          ariaLabel="Blocktitel"
          placeholder="Titel"
          onKeyDown={(event) => {
            if (event.key === "Enter") event.preventDefault();
          }}
        />
      </header>

      <ul className={styles.items}>
        {block.sections.notes.map(({ item, indent }, index) => (
          <ItemRow
            key={item.id}
            item={item}
            indent={indent}
            prevId={index > 0 ? block.sections.notes[index - 1]!.item.id : null}
            targetBlock={
              item.refBlockId ? (blocksById.get(item.refBlockId) ?? null) : null
            }
            onPatch={onPatchItem}
            onJumpToBlock={onJumpToBlock}
            onInsertAfter={insertAfter}
            onDeleteRow={deleteRow}
            onNav={nav}
            onRowRef={(el) => registerRow(item.id, el)}
            onInputRef={(el) => registerInput(item.id, el)}
          />
        ))}
        {block.sections.notes.length === 0 && (
          <li>
            <button
              type="button"
              className={styles.emptyNote}
              onClick={addFirstNote}
            >
              Noch keine Notizen — Klick legt die erste Zeile an
            </button>
          </li>
        )}
      </ul>

      {block.sections.tasks.length > 0 && (
        <section className={styles.group}>
          <h4 className={`${styles.grouphead} label`}>
            Tasks{" "}
            <span className="badge badge--quiet">
              {doneCount}/{block.sections.tasks.length}
            </span>
          </h4>
          <ul className={styles.items}>
            {block.sections.tasks.map((task) => (
              <Fragment key={task.id}>
                <ItemRow
                  item={task}
                  prevId={displayPrevId(task.id)}
                  assignee={
                    task.assigneeSpaceId
                      ? (spacesById.get(task.assigneeSpaceId) ?? null)
                      : null
                  }
                  meSpaceId={meSpaceId}
                  onPatch={onPatchItem}
                  onJumpToBlock={onJumpToBlock}
                  onInsertAfter={insertAfter}
                  onAddNote={addTaskNote}
                  onDeleteRow={deleteRow}
                  onNav={nav}
                  onRowRef={(el) => registerRow(task.id, el)}
                  onInputRef={(el) => registerInput(task.id, el)}
                />
                {(block.sections.taskNotes.get(task.id) ?? []).map((note) => (
                  <ItemRow
                    key={note.id}
                    item={note}
                    isChild
                    prevId={displayPrevId(note.id)}
                    onPatch={onPatchItem}
                    onJumpToBlock={onJumpToBlock}
                    onInsertAfter={insertAfter}
                    onDeleteRow={deleteRow}
                    onNav={nav}
                    onRowRef={(el) => registerRow(note.id, el)}
                    onInputRef={(el) => registerInput(note.id, el)}
                  />
                ))}
              </Fragment>
            ))}
          </ul>
        </section>
      )}

      {eventCount > 0 && (
        <section className={styles.group}>
          <h4 className={`${styles.grouphead} label`}>
            Folgetermine{" "}
            <span className="badge badge--quiet">{eventCount}</span>
          </h4>
          <ul className={styles.items}>
            {block.sections.events.map((event, index) => (
              <ItemRow
                key={event.id}
                item={event}
                prevId={index > 0 ? block.sections.events[index - 1]!.id : null}
                onPatch={onPatchItem}
                onJumpToBlock={onJumpToBlock}
                onDeleteRow={deleteRow}
                onNav={nav}
                onRowRef={(el) => registerRow(event.id, el)}
                onInputRef={(el) => registerInput(event.id, el)}
              />
            ))}
          </ul>
        </section>
      )}

      <Composer
        blockId={block.id}
        spaces={spaces}
        blocks={[...blocksById.values()]}
        today={today}
        onCreateItem={createComposerItem}
      />

      {confirmDelete && (
        <ConfirmDialog
          message={
            <>
              „{block.title || "ohne Titel"}“ mit allen Zeilen löschen? Verweise
              von außen verlieren ihr Ziel.
            </>
          }
          onConfirm={() => {
            onDeleteBlock(block.id);
            setConfirmDelete(false);
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </article>
  );
}

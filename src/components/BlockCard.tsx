import { Fragment, useRef, useState } from "react";
import type {
  BlockRow,
  ItemRow as ItemRowRow,
  SpaceRow,
  TemplateRow,
} from "../../shared/db.ts";
import type { BlockPatch, ItemPatch } from "../../shared/schemas.ts";
import type {
  ComposerCommandKey,
  ComposerItemFields,
} from "../domain/composer.ts";
import { newItemId } from "../domain/ids.ts";
import { itemLink } from "../domain/links.ts";
import { inlineMergeItems } from "../domain/inlineCommands.ts";
import { ItemCommandMenu } from "./ItemCommandMenu.tsx";
import { canMergeNotes } from "../domain/merge.ts";
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
  /** The current space's open Jour-Fix themes (Feature 2). */
  jfxThemes?: readonly ItemRowRow[];
  onPatchBlock: (id: string, patch: BlockPatch) => void;
  references: readonly ItemRowRow[];
  onEditItem: (id: string) => void;
  onPatchItem: (id: string, patch: ItemPatch) => void;
  onCreateItem: (input: ItemCreateInput) => void | Promise<boolean>;
  onDeleteItem: (id: string) => void;
  onDeleteBlock: (id: string) => void;
  onJumpToBlock: (blockId: string) => void;
  /** A "/jfx" theme goes to the target space's Jour-Fix block. */
  onCreateJourFix?: (
    text: string,
    personSpaceId: string | null,
  ) => void | boolean | Promise<boolean>;
  /** Moves a Jour-Fix theme into this block (Feature 2). */
  onRunItemCommand: (
    id: string,
    command: ComposerCommandKey,
    targetId?: string,
  ) => Promise<boolean>;
  onMergeItems: (items: readonly ItemRowRow[]) => Promise<boolean>;
  onMoveTheme: (
    itemId: string,
    targetBlockId: string,
  ) => void | boolean | Promise<boolean>;
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
  jfxThemes = [],
  onPatchBlock,
  onPatchItem,
  onEditItem,
  references,
  onCreateItem,
  onDeleteItem,
  onDeleteBlock,
  onJumpToBlock,
  onCreateJourFix,
  onMoveTheme,
  onRunItemCommand,
  onMergeItems,
}: BlockCardProps) {
  const rowRefs = useRef(new Map<string, HTMLLIElement>());
  const inputRefs = useRef(new Map<string, HTMLTextAreaElement>());
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** The range selection (Shift+↑/↓, Feature 1) as its two ends in display
   * order — the one piece of owned block state (docs/adr/0008 addition). */
  const [selection, setSelection] = useState<{
    anchor: string;
    focus: string;
  } | null>(null);
  /** The "Themen aus dem Jour Fix übernehmen" picker (Feature 2). */
  const [jfxOpen, setJfxOpen] = useState(false);
  const [jfxSelected, setJfxSelected] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const [commandContext, setCommandContext] = useState<{
    id: string;
    caret: { start: number; end: number } | null;
    query: string;
  } | null>(null);
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

  // The selected rows' ids in display order (the range between the two ends).
  const selectedIds = new Set<string>();
  if (selection) {
    const order = block.sections.order;
    const from = order.indexOf(selection.anchor);
    const to = order.indexOf(selection.focus);
    if (from !== -1 && to !== -1) {
      const [lo, hi] = from < to ? [from, to] : [to, from];
      for (let i = lo; i <= hi; i++) selectedIds.add(order[i]!);
    }
  }
  const composerMergeItems = inlineMergeItems(
    block.items,
    block.sections.order,
    selectedIds,
    activeItemId ?? block.sections.notes.at(-1)?.item.id ?? "",
  );
  const mergeLocked = !canMergeNotes(composerMergeItems);
  const mergeHint = mergeLocked
    ? composerMergeItems.length < 2
      ? "Mindestens zwei benachbarte Notizen erforderlich. / öffnet Befehle auch direkt in jeder Zeile."
      : "Nur Notizen zusammenfassen — keine Aufgaben, Termine, Verweise oder Überschriften."
    : `${composerMergeItems.length} ${selectedIds.size > 1 ? "markierte" : "benachbarte"} Notizen zu Punkten bündeln`;

  const openCommands = (
    id: string,
    caret: { start: number; end: number } | null,
    query = "",
  ) => {
    if (!selectedIds.has(id)) setSelection(null);
    setCommandContext({ id, caret, query });
  };
  const closeCommands = (restore = true, focusId = commandContext?.id) => {
    const caret = commandContext?.caret;
    setCommandContext(null);
    if (restore && focusId)
      requestAnimationFrame(() => {
        const input = inputRefs.current.get(focusId);
        if (caret && input) {
          input.focus();
          input.setSelectionRange(caret.start, caret.end);
        } else
          (
            rowRefs.current.get(focusId) ??
            document.querySelector<HTMLElement>(
              `[data-block-id="${block.id}"] [aria-label="Neue Zeile"]`,
            )
          )?.focus();
      });
  };
  const commandMenu = (item: ItemRowRow) => {
    if (commandContext?.id !== item.id) return null;
    const candidates = inlineMergeItems(
      block.items,
      block.sections.order,
      selectedIds,
      item.id,
    );
    return (
      <ItemCommandMenu
        key={item.id}
        item={item}
        initialQuery={commandContext.query}
        mergeItems={candidates}
        selected={selectedIds.size > 1}
        hasChildren={(block.sections.taskNotes.get(item.id)?.length ?? 0) > 0}
        blocks={[...blocksById.values()]}
        spaces={spaces}
        onClose={closeCommands}
        onLiteral={
          commandContext.caret
            ? (text) => {
                const { start, end } = commandContext.caret!;
                onPatchItem(item.id, {
                  text: item.text.slice(0, start) + text + item.text.slice(end),
                });
                setCommandContext(null);
                requestAnimationFrame(() => {
                  const input = inputRefs.current.get(item.id);
                  input?.focus();
                  input?.setSelectionRange(
                    start + text.length,
                    start + text.length,
                  );
                });
              }
            : undefined
        }
        onRun={async (key, target) => {
          const success =
            key === "merge"
              ? canMergeNotes(candidates) && (await onMergeItems(candidates))
              : await onRunItemCommand(item.id, key, target);
          if (success) {
            setSelection(null);
            closeCommands(true, key === "merge" ? candidates[0]!.id : item.id);
          }
          return success;
        }}
      />
    );
  };

  const nav = (itemId: string, dir: -1 | 1) => {
    const order = block.sections.order;
    const next = order[order.indexOf(itemId) + dir];
    if (next === undefined) return;
    setSelection(null);
    rowRefs.current.get(next)?.focus();
  };

  const extendNav = (itemId: string, dir: -1 | 1) => {
    const order = block.sections.order;
    const next = order[order.indexOf(itemId) + dir];
    if (next === undefined) return;
    setSelection((previous) => ({
      anchor: previous?.anchor ?? itemId,
      focus: next,
    }));
    rowRefs.current.get(next)?.focus();
  };

  const mergeSelected = async () => {
    if (!canMergeNotes(composerMergeItems)) return;
    const keepId = composerMergeItems[0]!.id;
    if (await onMergeItems(composerMergeItems)) {
      setSelection(null);
      focusInput(keepId);
    }
  };

  const toggleJfxTheme = (itemId: string) => {
    setJfxSelected((previous) => {
      const next = new Set(previous);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  };

  const takeOverThemes = async () => {
    const failed = new Set<string>();
    for (const itemId of jfxSelected)
      if ((await onMoveTheme(itemId, block.id)) === false) failed.add(itemId);
    setJfxSelected(failed);
    setJfxOpen(failed.size > 0);
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
    const removed = new Set([
      itemId,
      ...block.items
        .filter((item) => item.parentItemId === itemId)
        .map((item) => item.id),
    ]);
    const index = order.indexOf(itemId);
    const before = order.slice(0, index).filter((id) => !removed.has(id));
    const focusId =
      (prevId && !removed.has(prevId) ? prevId : before.at(-1)) ??
      order.slice(index + 1).find((id) => !removed.has(id)) ??
      null;
    onDeleteItem(itemId);
    if (focusId !== null) focusInput(focusId);
    else
      window.setTimeout(
        () => document.getElementById(`composer-${block.id}`)?.focus(),
        0,
      );
  };

  const createComposerItem = (fields: ComposerItemFields) => {
    const lastPosition = block.items.reduce(
      (max, item) => Math.max(max, item.position),
      0,
    );
    return onCreateItem({
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
      onFocusCapture={(event) => {
        const row = (event.target as HTMLElement).closest<HTMLElement>(
          "[data-item-id]",
        );
        if (row) setActiveItemId(row.dataset.itemId ?? null);
      }}
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
          readOnly={block.title === "Jour Fix" || block.id.startsWith("b-jfx-")}
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
            onOpenCommands={openCommands}
            commandMenu={commandMenu(item)}
            indent={indent}
            prevId={index > 0 ? block.sections.notes[index - 1]!.item.id : null}
            targetBlock={
              item.refBlockId ? (blocksById.get(item.refBlockId) ?? null) : null
            }
            onPatch={onPatchItem}
            onEdit={onEditItem}
            onJumpToBlock={onJumpToBlock}
            onInsertAfter={insertAfter}
            onDeleteRow={deleteRow}
            onNav={nav}
            onExtendSelect={extendNav}
            onClearSelection={() => setSelection(null)}
            selected={selectedIds.has(item.id)}
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
                  onOpenCommands={openCommands}
                  commandMenu={commandMenu(task)}
                  prevId={displayPrevId(task.id)}
                  assignee={
                    task.assigneeSpaceId
                      ? (spacesById.get(task.assigneeSpaceId) ?? null)
                      : null
                  }
                  meSpaceId={meSpaceId}
                  onPatch={onPatchItem}
                  onEdit={onEditItem}
                  onJumpToBlock={onJumpToBlock}
                  onInsertAfter={insertAfter}
                  onAddNote={addTaskNote}
                  onDeleteRow={deleteRow}
                  onNav={nav}
                  onExtendSelect={extendNav}
                  onClearSelection={() => setSelection(null)}
                  selected={selectedIds.has(task.id)}
                  onRowRef={(el) => registerRow(task.id, el)}
                  onInputRef={(el) => registerInput(task.id, el)}
                />
                {(block.sections.taskNotes.get(task.id) ?? []).map((note) => (
                  <ItemRow
                    key={note.id}
                    item={note}
                    onOpenCommands={openCommands}
                    commandMenu={commandMenu(note)}
                    isChild
                    prevId={displayPrevId(note.id)}
                    onPatch={onPatchItem}
                    onEdit={onEditItem}
                    onJumpToBlock={onJumpToBlock}
                    onInsertAfter={insertAfter}
                    onDeleteRow={deleteRow}
                    onNav={nav}
                    onExtendSelect={extendNav}
                    onClearSelection={() => setSelection(null)}
                    selected={selectedIds.has(note.id)}
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
                onOpenCommands={openCommands}
                commandMenu={commandMenu(event)}
                prevId={index > 0 ? block.sections.events[index - 1]!.id : null}
                onPatch={onPatchItem}
                onEdit={onEditItem}
                onJumpToBlock={onJumpToBlock}
                onDeleteRow={deleteRow}
                onNav={nav}
                onExtendSelect={extendNav}
                onClearSelection={() => setSelection(null)}
                selected={selectedIds.has(event.id)}
                onRowRef={(el) => registerRow(event.id, el)}
                onInputRef={(el) => registerInput(event.id, el)}
              />
            ))}
          </ul>
        </section>
      )}

      {jfxThemes.length > 0 && (
        <div className={styles.jfxover}>
          <button
            type="button"
            className={`${styles.jfxbtn} label`}
            onClick={() => setJfxOpen((open) => !open)}
            aria-expanded={jfxOpen}
          >
            Themen aus dem Jour Fix übernehmen
          </button>
          {jfxOpen && (
            <div className={styles.jfxpanel}>
              <ul className={styles.jfxlist}>
                {jfxThemes.map((theme) => (
                  <li key={theme.id}>
                    <label className={styles.jfxrow}>
                      <input
                        type="checkbox"
                        checked={jfxSelected.has(theme.id)}
                        onChange={() => toggleJfxTheme(theme.id)}
                      />
                      <span>{theme.text || "Thema"}</span>
                    </label>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn"
                disabled={jfxSelected.size === 0}
                onClick={takeOverThemes}
              >
                Übernehmen
              </button>
            </div>
          )}
        </div>
      )}

      <Composer
        blockId={block.id}
        spaces={spaces}
        blocks={[...blocksById.values()]}
        today={today}
        mergeLocked={mergeLocked}
        mergeHint={mergeHint}
        onMergeSelected={mergeSelected}
        onCreateJourFix={onCreateJourFix}
        onCreateItem={createComposerItem}
      />

      <div className="block-links">
        <a href={itemLink(block.id)}>Direktlink zum Block</a>
      </div>
      {references.some(
        (ref) => ref.refBlockId === block.id && ref.blockId !== block.id,
      ) && (
        <details className="backlinks">
          <summary>Verweise auf diesen Block</summary>
          <ul>
            {references
              .filter(
                (ref) =>
                  ref.refBlockId === block.id && ref.blockId !== block.id,
              )
              .map((ref) => (
                <li key={ref.id}>
                  <a href={itemLink(ref.blockId, ref.id)}>
                    {blocksById.get(ref.blockId)?.title || "Ohne Titel"}
                  </a>
                </li>
              ))}
          </ul>
        </details>
      )}
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

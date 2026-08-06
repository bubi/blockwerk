import { useLayoutEffect, useRef, useState } from "react";
import type { BlockRow, ItemRow, SpaceRow } from "../../shared/db.ts";
import type { ItemPatch } from "../../shared/schemas.ts";
import { formatShort, fromISODate, relativeLabel } from "../domain/dates.ts";
import {
  detectHeading,
  detectListMark,
  listDisplayMark,
} from "../domain/headings.ts";
import { GrowingTextarea } from "./GrowingTextarea.tsx";
import styles from "./ItemRow.module.css";

interface ItemRowProps {
  item: ItemRow;
  /** Note/ref rows under a heading are rendered indented (display only). */
  indent?: boolean;
  /** A task's own note (docs/adr/0014): rendered indented under its task. */
  isChild?: boolean;
  assignee?: Pick<SpaceRow, "short"> | null;
  /** The "me" space (docs/adr/0013) — own tasks get the "eigen" badge. */
  meSpaceId?: string | null;
  /** The ref's target block, when it still exists. */
  targetBlock?: Pick<BlockRow, "id" | "title" | "date"> | null;
  /** The row before this one in display order — where focus returns after a delete. */
  prevId?: string | null;
  onPatch: (id: string, patch: ItemPatch) => void;
  onJumpToBlock: (blockId: string) => void;
  /** Enter in a note's field inserts a new note directly below it. */
  onInsertAfter?: (itemId: string) => void;
  /** The task's "+": adds a note under the task (docs/adr/0014). */
  onAddNote?: (taskId: string) => void;
  onDeleteRow?: (itemId: string, prevId: string | null) => void;
  /** Arrow keys move the row selection through the block's display order. */
  onNav?: (itemId: string, dir: -1 | 1) => void;
  onRowRef?: (el: HTMLLIElement | null) => void;
  onInputRef?: (el: HTMLTextAreaElement | null) => void;
}

const KIND_LABEL: Record<ItemRow["kind"], string> = {
  note: "Notiz",
  task: "Aufgabe",
  event: "Termin",
  ref: "Verweis",
};

/**
 * Two keyboard modes, decided by which element holds focus — no state, no
 * second copy of "where am I" (docs/adr/0008):
 *
 *  - Row selected (the <li> has focus): arrow keys move through all rows in
 *    display order, Space toggles a task (or enters the field), Enter enters
 *    the field, Backspace/Delete removes the row.
 *  - Cursor in the field (the <input> has focus): arrow keys leave the field
 *    and select the neighbor row, Escape returns to the row, Enter inserts a
 *    new note directly below, Backspace in an empty note first demotes a
 *    heading and only then deletes the row.
 *
 * Space is the reason the split is structural: on the row it toggles, inside
 * the field it types.
 */
export function ItemRow({
  item,
  indent,
  isChild,
  assignee,
  meSpaceId,
  targetBlock,
  prevId,
  onPatch,
  onJumpToBlock,
  onInsertAfter,
  onAddNote,
  onDeleteRow,
  onNav,
  onRowRef,
  onInputRef,
}: ItemRowProps) {
  const rowRef = useRef<HTMLLIElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const isHeading = item.kind === "note" && item.heading !== null;

  // Where the caret should land after the next render — used by the list
  // soft break. A layout effect places it synchronously before paint, so a
  // keystroke right after Enter lands where it belongs (the same pattern
  // the composer uses for its mention pick).
  const [pendingCaret, setPendingCaret] = useState<number | null>(null);
  useLayoutEffect(() => {
    if (pendingCaret === null) return;
    const el = inputRef.current;
    if (el) {
      el.setSelectionRange(pendingCaret, pendingCaret);
      setPendingCaret(null);
    }
  }, [pendingCaret]);

  const focusRow = () => rowRef.current?.focus();
  const focusField = () => {
    const el = inputRef.current;
    if (el) {
      el.focus();
      el.setSelectionRange(el.value.length, el.value.length);
    }
  };

  const rowKeys = (event: React.KeyboardEvent<HTMLLIElement>) => {
    const inField = event.target === inputRef.current;

    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!inField) {
        event.preventDefault();
        onNav?.(item.id, event.key === "ArrowDown" ? 1 : -1);
        return;
      }
      // In a text field the cursor walks the text first; only when the
      // selection is empty and the cursor sits at the start (up) or end
      // (down) of the field does the arrow move the selection to the
      // neighbor row. Otherwise the field itself moves the cursor.
      const el = inputRef.current;
      if (el && el.selectionStart === el.selectionEnd) {
        const atEdge =
          event.key === "ArrowDown"
            ? el.selectionStart === el.value.length
            : el.selectionStart === 0;
        if (atEdge) {
          event.preventDefault();
          onNav?.(item.id, event.key === "ArrowDown" ? 1 : -1);
          return;
        }
      }
      return;
    }

    if (inField) {
      if (event.key === "Escape") {
        event.preventDefault();
        focusRow();
        return;
      }
      // A list point's Enter is a line break within the row: another bullet
      // of the same marker joins the text, no new block line is created.
      // On an empty trailing bullet it leaves the list instead. For the
      // other rows Enter never creates a line break — not even with Shift
      // (Shift+Enter stays deliberately unassigned); note and task rows
      // route it to onInsertAfter, and events just swallow it.
      if (event.key === "Enter") {
        event.preventDefault();
        if (item.kind === "note" && item.listMark !== null) {
          const caret = inputRef.current?.selectionStart ?? item.text.length;
          // Enter on an empty trailing bullet: the empty point goes.
          if (
            caret === item.text.length &&
            /(?:^|\n)(?:[*-]|•) ?$/.test(item.text)
          ) {
            const next = item.text.replace(/(?:^|\n)(?:[*-]|•) ?$/, "");
            onPatch(
              item.id,
              next === "" ? { text: "", listMark: null } : { text: next },
            );
            return;
          }
          const insert = `\n${listDisplayMark(item.listMark)}`;
          const next =
            item.text.slice(0, caret) + insert + item.text.slice(caret);
          onPatch(item.id, { text: next });
          // Land the cursor after the fresh marker so the next bullet can be
          // typed right away.
          setPendingCaret(caret + insert.length);
          return;
        }
        if (item.kind === "note" || item.kind === "task")
          onInsertAfter?.(item.id);
        return;
      }
      if (item.kind === "note") {
        if (event.key === "Backspace" && item.text === "") {
          if (isHeading) {
            // First step: back to normal text, second Backspace deletes.
            event.preventDefault();
            onPatch(item.id, { heading: null });
            return;
          }
          if (item.listMark !== null) {
            // Same two-step as a heading: the marker goes first.
            event.preventDefault();
            onPatch(item.id, { listMark: null });
            return;
          }
          if (onDeleteRow) {
            event.preventDefault();
            onDeleteRow(item.id, prevId ?? null);
            return;
          }
        }
      }
      return;
    }

    if (event.key === " ") {
      event.preventDefault();
      if (item.kind === "task") onPatch(item.id, { done: !item.done });
      else focusField();
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (item.kind === "ref" && targetBlock) onJumpToBlock(targetBlock.id);
      else focusField();
      return;
    }
    if (event.key === "Backspace" || event.key === "Delete") {
      event.preventDefault();
      onDeleteRow?.(item.id, prevId ?? null);
    }
  };

  const handleTextChange = (value: string) => {
    if (
      item.kind === "note" &&
      item.heading === null &&
      item.listMark === null
    ) {
      const detected = detectHeading(value);
      if (detected) {
        onPatch(item.id, { heading: detected.heading, text: detected.text });
        return;
      }
      const list = detectListMark(value);
      if (list) {
        // The marker stays in the text as its display form: a list point is
        // multi-line text, and each line carries its marker (Enter inserts
        // the next one inline). `*` appears as a dot (listDisplayMark).
        onPatch(item.id, {
          listMark: list.mark,
          text: listDisplayMark(list.mark) + list.text,
        });
        return;
      }
    }
    onPatch(item.id, { text: value });
  };

  const kindClass =
    styles[`kind${item.kind[0]!.toUpperCase() + item.kind.slice(1)}`];
  const rowClass = [
    styles.item,
    kindClass,
    indent ? styles.indented : "",
    isChild ? styles.child : "",
    item.done ? styles.done : "",
    isHeading ? styles.heading : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li
      ref={(el) => {
        rowRef.current = el;
        onRowRef?.(el);
      }}
      className={rowClass}
      data-item-id={item.id}
      data-heading={item.heading ?? undefined}
      tabIndex={-1}
      onKeyDown={rowKeys}
    >
      <GrowingTextarea
        ref={(el) => {
          inputRef.current = el;
          onInputRef?.(el);
        }}
        className={isHeading ? styles.headingInput : styles.text}
        value={item.text}
        onChange={(value) =>
          isHeading
            ? onPatch(item.id, { text: value })
            : handleTextChange(value)
        }
        ariaLabel={isHeading ? "Überschrift" : KIND_LABEL[item.kind]}
        placeholder={
          isHeading
            ? "Überschrift"
            : item.kind === "event"
              ? "Termin"
              : item.kind === "task"
                ? "Aufgabe"
                : "Notiz"
        }
      />

      {isHeading && (
        <button
          type="button"
          className={styles.hmark}
          tabIndex={-1}
          onClick={() => onPatch(item.id, { heading: null })}
          aria-label="In normalen Text umwandeln"
          title="In normalen Text umwandeln"
        >
          {item.heading === 1 ? "#" : "##"}
        </button>
      )}

      {item.kind === "task" && (
        <button
          type="button"
          role="checkbox"
          aria-checked={item.done}
          aria-label={`${item.text || "Aufgabe"} — ${item.done ? "wieder öffnen" : "als erledigt markieren"}`}
          className={item.done ? "check check--done" : "check"}
          tabIndex={-1}
          onClick={() => onPatch(item.id, { done: !item.done })}
        >
          <span aria-hidden="true" />
        </button>
      )}

      {item.kind === "task" && item.dueDate && (
        <DueChip dueDate={item.dueDate} />
      )}
      {item.kind === "task" && assignee && (
        <span
          className={`badge ${item.assigneeSpaceId !== null && item.assigneeSpaceId === meSpaceId ? "badge--own" : "badge--quiet"}`}
        >
          {assignee.short}
        </span>
      )}

      {item.kind === "task" && onAddNote && (
        <button
          type="button"
          className={styles.noteAdd}
          tabIndex={-1}
          onClick={() => onAddNote(item.id)}
          aria-label={`Notiz zu „${item.text || "Aufgabe"}" hinzufügen`}
          title="Notiz hinzufügen"
        >
          +
        </button>
      )}

      {item.kind === "event" && (
        <span className="badge badge--time">{item.eventTime ?? "—"}</span>
      )}

      {item.kind === "ref" &&
        (targetBlock ? (
          <button
            type="button"
            className={styles.refLink}
            tabIndex={-1}
            onClick={() => onJumpToBlock(targetBlock.id)}
            aria-label={`Zum Block „${targetBlock.title || "ohne Titel"}" springen`}
          >
            <span className={styles.refDate}>
              {formatShort(targetBlock.date)}
            </span>
            {targetBlock.title || "Ohne Titel"}
          </button>
        ) : (
          <span className={styles.refGone}>Ziel entfernt</span>
        ))}

      {onDeleteRow && (
        <button
          type="button"
          className={styles.kill}
          tabIndex={-1}
          onClick={() => onDeleteRow(item.id, prevId ?? null)}
          aria-label="Zeile entfernen"
          title="Zeile entfernen"
        >
          ×
        </button>
      )}
    </li>
  );
}

function DueChip({ dueDate }: { dueDate: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const late = fromISODate(dueDate).getTime() < today.getTime();
  return (
    <span className={late ? styles.dueLate : styles.due}>
      {relativeLabel(dueDate, today)}
    </span>
  );
}

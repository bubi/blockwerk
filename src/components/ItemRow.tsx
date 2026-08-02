import type { BlockRow, ItemRow, SpaceRow } from "../../shared/db.ts";
import type { ItemPatch } from "../../shared/schemas.ts";
import { formatShort, fromISODate, relativeLabel } from "../domain/dates.ts";
import styles from "./ItemRow.module.css";

interface ItemRowProps {
  item: ItemRow;
  /** Note/ref rows under a heading are rendered indented (display only). */
  indent?: boolean;
  assignee?: Pick<SpaceRow, "short"> | null;
  /** The ref's target block, when it still exists. */
  targetBlock?: Pick<BlockRow, "id" | "title" | "date"> | null;
  onPatch: (id: string, patch: ItemPatch) => void;
  onJumpToBlock: (blockId: string) => void;
}

const KIND_LABEL: Record<ItemRow["kind"], string> = {
  note: "Notiz",
  task: "Aufgabe",
  event: "Termin",
  ref: "Verweis",
};

export function ItemRow({ item, indent, assignee, targetBlock, onPatch, onJumpToBlock }: ItemRowProps) {
  const kindClass = styles[`kind${item.kind[0]!.toUpperCase() + item.kind.slice(1)}`];
  const rowClass = [styles.item, kindClass, indent ? styles.indented : "", item.done ? styles.done : ""].filter(Boolean).join(" ");

  if (item.kind === "note" && item.heading !== null) {
    return (
      <li className={`${rowClass} ${styles.heading}`} data-item-id={item.id}>
        <span className={styles.hmark} aria-hidden="true">
          {item.heading === 1 ? "#" : "##"}
        </span>
        <input
          className={styles.headingInput}
          value={item.text}
          onChange={(event) => onPatch(item.id, { text: event.target.value })}
          aria-label="Überschrift"
          placeholder="Überschrift"
        />
      </li>
    );
  }

  return (
    <li className={rowClass} data-item-id={item.id}>
      {item.kind === "task" && (
        <button
          type="button"
          role="checkbox"
          aria-checked={item.done}
          aria-label={`${item.text || "Aufgabe"} — ${item.done ? "wieder öffnen" : "als erledigt markieren"}`}
          className={item.done ? styles.checkDone : styles.check}
          onClick={() => onPatch(item.id, { done: !item.done })}
        >
          <span aria-hidden="true" />
        </button>
      )}

      <input
        className={styles.text}
        value={item.text}
        onChange={(event) => onPatch(item.id, { text: event.target.value })}
        aria-label={KIND_LABEL[item.kind]}
        placeholder={item.kind === "event" ? "Termin" : item.kind === "task" ? "Aufgabe" : "Notiz"}
      />

      {item.kind === "task" && item.dueDate && <DueChip dueDate={item.dueDate} />}
      {item.kind === "task" && assignee && <span className={styles.who}>{assignee.short}</span>}

      {item.kind === "event" && (
        <span className={styles.eventTime}>{item.eventTime ?? "—"}</span>
      )}

      {item.kind === "ref" &&
        (targetBlock ? (
          <button
            type="button"
            className={styles.refLink}
            onClick={() => onJumpToBlock(targetBlock.id)}
            aria-label={`Zum Block „${targetBlock.title || "ohne Titel"}" springen`}
          >
            <span className={styles.refDate}>{formatShort(targetBlock.date)}</span>
            {targetBlock.title || "Ohne Titel"}
          </button>
        ) : (
          <span className={styles.refGone}>Ziel entfernt</span>
        ))}
    </li>
  );
}

function DueChip({ dueDate }: { dueDate: string }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const late = fromISODate(dueDate).getTime() < today.getTime();
  return <span className={late ? styles.dueLate : styles.due}>{relativeLabel(dueDate, today)}</span>;
}

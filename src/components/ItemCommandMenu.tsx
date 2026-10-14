import { useId, useState } from "react";
import type { BlockRow, ItemRow, SpaceRow } from "../../shared/db.ts";
import {
  matchComposerCommands,
  type ComposerCommandKey,
} from "../domain/composer.ts";
import { canMergeNotes } from "../domain/merge.ts";
import styles from "./ItemCommandMenu.module.css";

export function ItemCommandMenu({
  item,
  initialQuery,
  mergeItems,
  selected,
  hasChildren,
  blocks,
  spaces,
  onRun,
  onClose,
  onLiteral,
}: {
  item: ItemRow;
  initialQuery: string;
  mergeItems: readonly ItemRow[];
  selected: boolean;
  hasChildren: boolean;
  blocks: readonly BlockRow[];
  spaces: readonly Pick<SpaceRow, "id" | "name" | "kind">[];
  onRun: (key: ComposerCommandKey, target?: string) => Promise<boolean>;
  onClose: (restoreFocus?: boolean) => void;
  onLiteral?: (text: string) => void;
}) {
  const id = useId();
  const [query, setQuery] = useState(initialQuery);
  const [index, setIndex] = useState(0);
  const [targetCommand, setTargetCommand] = useState<"ref" | "jfx" | null>(
    null,
  );
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const commands = matchComposerCommands(query);
  const active = Math.min(index, Math.max(0, commands.length - 1));
  const reason = (key: ComposerCommandKey) => {
    if (key === "merge")
      return canMergeNotes(mergeItems)
        ? ""
        : "Mindestens zwei benachbarte normale Notizen erforderlich. Aufgaben, Termine und Überschriften bleiben getrennt.";
    if (item.parentItemId !== null && key !== "note")
      return "Kindnotizen bleiben bei ihrer Aufgabe. Bitte eine normale Zeile wählen.";
    if (hasChildren && key !== "task")
      return "Diese Aufgabe hat eigene Notizen. Bitte diese zuerst verschieben.";
    if (key === "jfx" && item.kind !== "note")
      return "Jour Fix übernimmt eine bestehende Notiz. Erst mit /note umwandeln.";
    return "";
  };
  const run = async (key: ComposerCommandKey, targetId?: string) => {
    if (saving || reason(key)) return;
    if ((key === "ref" || key === "jfx") && targetId === undefined) {
      setTargetCommand(key);
      setTarget("");
      return;
    }
    setSaving(true);
    setFailed(false);
    try {
      if (!(await onRun(key, targetId))) setFailed(true);
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className={styles.menu}
      role="region"
      aria-label="Befehle für aktuelle Zeile"
      onBlur={(event) => {
        if (
          !saving &&
          event.relatedTarget &&
          !event.currentTarget.contains(event.relatedTarget as Node)
        )
          onClose(false);
      }}
    >
      <div className={styles.top}>
        <input
          autoFocus
          aria-label="Zeilenbefehl"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={!targetCommand}
          aria-controls={id}
          aria-activedescendant={
            commands[active] && !targetCommand
              ? `${id}-${commands[active]!.key}`
              : undefined
          }
          value={`/${query}`}
          disabled={saving}
          onChange={(event) => {
            setQuery(event.target.value.replace(/^\//, ""));
            setIndex(0);
            setTargetCommand(null);
          }}
          onKeyDown={(event) => {
            if (event.nativeEvent.isComposing) return;
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
            if (event.key === "Enter") {
              event.preventDefault();
              if (event.shiftKey) onLiteral?.(`/${query}`);
              else if (targetCommand) void run(targetCommand, target);
              else if (commands[active]) void run(commands[active]!.key);
            }
            if (
              ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key) &&
              commands.length
            ) {
              event.preventDefault();
              setIndex(
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? commands.length - 1
                    : (active +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        commands.length) %
                      commands.length,
              );
            }
          }}
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => onClose()}
          aria-label="Befehle schließen"
        >
          Schließen
        </button>
      </div>
      {targetCommand ? (
        <div className={styles.target}>
          <label>
            {targetCommand === "ref" ? "Zielblock" : "Jour-Fix-Ablage"}
            <select
              value={target}
              disabled={saving}
              onChange={(event) => setTarget(event.target.value)}
            >
              <option value="">
                {targetCommand === "ref"
                  ? "Zielblock wählen"
                  : "Aktueller Bereich"}
              </option>
              {targetCommand === "ref"
                ? blocks
                    .filter((block) => block.id !== item.blockId)
                    .map((block) => (
                      <option key={block.id} value={block.id}>
                        {block.title || "Ohne Titel"} · {block.date}
                      </option>
                    ))
                : spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
            </select>
          </label>
          <button
            type="button"
            disabled={saving || (targetCommand === "ref" && !target)}
            onClick={() => void run(targetCommand, target)}
          >
            {targetCommand === "ref"
              ? "In Verweis umwandeln"
              : "In Jour Fix verschieben"}
          </button>
        </div>
      ) : (
        <ul id={id} role="listbox" aria-label="Zeilenbefehle">
          {commands.map((command, option) => (
            <li key={command.key} role="presentation">
              <button
                type="button"
                role="option"
                id={`${id}-${command.key}`}
                aria-selected={active === option}
                aria-disabled={saving || !!reason(command.key)}
                className={active === option ? styles.active : undefined}
                onClick={() => void run(command.key)}
              >
                <strong>/{command.key}</strong>
                <span>
                  {reason(command.key) ||
                    (command.key === "merge"
                      ? `${mergeItems.length} ${selected ? "markierte" : "benachbarte"} Notizen zusammenfassen`
                      : command.key === "jfx"
                        ? "Diese Notiz verschieben, Text und ID erhalten"
                        : "Aktuelle Zeile umwandeln, Text und ID erhalten")}
                </span>
              </button>
              {command.key === "merge" && canMergeNotes(mergeItems) && (
                <p className={styles.preview}>
                  {mergeItems
                    .map((row) => row.text || "Leere Notiz")
                    .join(" · ")}
                </p>
              )}
            </li>
          ))}
          {!commands.length && (
            <li className={styles.empty}>
              Kein passender Befehl. Escape schließt das Menü.
            </li>
          )}
        </ul>
      )}
      {failed && (
        <p role="alert">
          Befehl nicht gespeichert. Die Zeilen bleiben erhalten. Bitte Meldung
          prüfen und erneut versuchen.
        </p>
      )}
      {saving && <p role="status">Wird gespeichert…</p>}
      {onLiteral && (
        <button
          type="button"
          className={styles.literal}
          disabled={saving}
          onClick={() => onLiteral(`/${query}`)}
        >
          Als Text einfügen · Shift+Enter
        </button>
      )}
    </div>
  );
}

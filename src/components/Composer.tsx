import { useRef, useState } from "react";
import type { BlockRow, SpaceRow } from "../../shared/db.ts";
import {
  commandHint,
  commandLabel,
  composeItem,
  matchComposerCommands,
  type ComposerCommandKey,
  type ComposerItemFields,
} from "../domain/composer.ts";
import { formatShort } from "../domain/dates.ts";
import styles from "./Composer.module.css";

interface ComposerProps {
  blockId: string;
  spaces: readonly Pick<SpaceRow, "id" | "name" | "kind">[];
  /** Every block in the loaded view — ref targets, excluding the block itself. */
  blocks: readonly BlockRow[];
  today: Date;
  onCreateItem: (fields: ComposerItemFields) => void;
}

/**
 * The per-block input for new rows. Its draft (value, chosen mode, menu
 * selection, ref target) is the one genuinely-rendered state of the
 * interaction; everything else runs through the domain (slash matching,
 * token parsing — see docs/adr/0008).
 *
 * "/" opens a listbox of commands; typing filters it, arrow keys move the
 * selection, Enter or Tab picks, Escape cancels. The chosen mode is shown as
 * a chip; Backspace in the empty field discards it. For a Verweis the target
 * block is chosen from a select instead of free text.
 */
export function Composer({ blockId, spaces, blocks, today, onCreateItem }: ComposerProps) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<ComposerCommandKey | null>(null);
  const [selected, setSelected] = useState(0);
  const [refTarget, setRefTarget] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const menu = matchComposerCommands(value.startsWith("/") ? value.slice(1) : "");
  const menuOpen = value.startsWith("/") && menu.length > 0;
  const menuId = `composer-menu-${blockId}`;

  const pick = (key: ComposerCommandKey) => {
    setMode(key);
    setValue("");
    setSelected(0);
    inputRef.current?.focus();
  };

  const commit = () => {
    if (mode === "ref") {
      if (!refTarget) return;
      onCreateItem({ kind: "ref", text: "", refBlockId: refTarget });
      setRefTarget("");
      setMode(null);
      return;
    }
    const fields = composeItem({ mode: mode ?? "note", raw: value, refBlockId: null, spaces, today });
    if (!fields) return;
    onCreateItem(fields);
    setValue("");
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (menuOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((current) => (current + 1) % menu.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelected((current) => (current - 1 + menu.length) % menu.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pick(menu[selected]!.key);
        return;
      }
    }
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (value.startsWith("/")) {
        setValue("");
        setSelected(0);
        return;
      }
      setMode(null);
      setValue("");
      setRefTarget("");
      return;
    }
    if (event.key === "Backspace" && value === "" && mode) {
      setMode(null);
    }
  };

  return (
    <div className={styles.composer}>
      <div className={styles.row}>
        {mode && (
          <button
            type="button"
            className={styles.chip}
            onClick={() => setMode(null)}
            title="Modus verwerfen"
            aria-label="Modus verwerfen"
          >
            {commandLabel(mode)}
            <span aria-hidden="true">×</span>
          </button>
        )}

        {mode === "ref" ? (
          <select
            className={styles.select}
            autoFocus
            value={refTarget}
            onChange={(event) => setRefTarget(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && refTarget) {
                event.preventDefault();
                commit();
              }
            }}
            aria-label="Zielblock"
          >
            <option value="">Block wählen…</option>
            {blocks
              .filter((block) => block.id !== blockId)
              .map((block) => (
                <option key={block.id} value={block.id}>
                  {block.title || "Ohne Titel"} — {formatShort(block.date)}
                </option>
              ))}
          </select>
        ) : (
          <input
            ref={inputRef}
            className={styles.input}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              setSelected(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={mode ? commandHint(mode) : "/ für Befehle, # für eine Überschrift"}
            aria-label="Neue Zeile"
            role={menuOpen ? "combobox" : undefined}
            aria-expanded={menuOpen}
            aria-controls={menuOpen ? menuId : undefined}
            aria-activedescendant={menuOpen ? `${menuId}-option-${menu[selected]!.key}` : undefined}
          />
        )}

        <button type="button" className={styles.go} onClick={commit}>
          Hinzufügen
        </button>
      </div>

      {menuOpen && (
        <ul className={styles.menu} id={menuId} role="listbox" aria-label="Befehl wählen">
          {menu.map((command, index) => (
            <li key={command.key}>
              <button
                type="button"
                id={`${menuId}-option-${command.key}`}
                role="option"
                aria-selected={index === selected}
                className={index === selected ? styles.optionSelected : styles.option}
                onMouseEnter={() => setSelected(index)}
                onClick={() => pick(command.key)}
              >
                <span className={styles.command}>/{command.key}</span>
                <span className={styles.hint}>{command.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

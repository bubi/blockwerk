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
import { deriveShort } from "../domain/naming.ts";
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
 * selection, ref target, picked mention) is the one genuinely-rendered state
 * of the interaction; everything else runs through the domain (slash matching,
 * token parsing — see docs/adr/0008).
 *
 * "/" opens a listbox of commands; typing filters it, arrow keys move the
 * selection, Enter or Tab picks, Escape cancels. The chosen mode is shown as
 * a chip; Backspace in the empty field discards it. For a Verweis the target
 * block is chosen from a select instead of free text.
 *
 * "@" opens a list of people while the caret sits right behind "@word";
 * typing filters it and the same keys pick — Enter or Tab inserts the person
 * and remembers their **space id** (docs/adr/0013), so a shared first name
 * cannot resolve to the wrong person. Typed "@Name" without a menu selection
 * still falls back to the text parser.
 */
export function Composer({ blockId, spaces, blocks, today, onCreateItem }: ComposerProps) {
  const [value, setValue] = useState("");
  const [mode, setMode] = useState<ComposerCommandKey | null>(null);
  const [selected, setSelected] = useState(0);
  const [refTarget, setRefTarget] = useState("");
  const [caret, setCaret] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionId, setMentionId] = useState<string | null>(null);
  const [mentionSuppressed, setMentionSuppressed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const menu = matchComposerCommands(value.startsWith("/") ? value.slice(1) : "");
  const menuOpen = value.startsWith("/") && menu.length > 0;
  const menuId = `composer-menu-${blockId}`;

  // The @-mention: only while the caret sits right behind "@word".
  const before = value.slice(0, caret);
  const at = mode === "ref" ? null : before.match(/@([\p{L}]*)$/u);
  const query = at ? at[1]!.toLowerCase() : "";
  const people = spaces.filter((space) => space.kind === "person");
  const mentions = at
    ? people.filter((person) => !query || person.name.toLowerCase().split(" ").some((part) => part.startsWith(query)))
    : [];
  const mentionOpen = !mentionSuppressed && mentions.length > 0;
  const mentionClamped = Math.min(mentionIndex, Math.max(0, mentions.length - 1));
  const mentionId_ = `composer-mention-${blockId}`;

  const pick = (key: ComposerCommandKey) => {
    setMode(key);
    setValue("");
    setSelected(0);
    setCaret(0);
    setMentionId(null);
    inputRef.current?.focus();
  };

  const pickMention = (person: Pick<SpaceRow, "id" | "name">) => {
    if (!at) return;
    const first = person.name.split(" ")[0]!;
    const start = caret - at[0].length;
    const next = `${value.slice(0, start)}@${first} ${value.slice(caret)}`;
    const pos = start + first.length + 2;
    setValue(next);
    setCaret(pos);
    setMentionId(person.id);
    setMentionIndex(0);
    inputRef.current?.focus();
    window.requestAnimationFrame(() => {
      if (inputRef.current) inputRef.current.setSelectionRange(pos, pos);
    });
  };

  const commit = () => {
    if (mode === "ref") {
      if (!refTarget) return;
      onCreateItem({ kind: "ref", text: "", refBlockId: refTarget });
      setRefTarget("");
      setMode(null);
      return;
    }
    const fields = composeItem({ mode: mode ?? "note", raw: value, refBlockId: null, spaces, today, mentionId });
    if (!fields) return;
    onCreateItem(fields);
    setValue("");
    setCaret(0);
    setMentionId(null);
    setMentionSuppressed(false);
  };

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setValue(event.target.value);
    setCaret(event.target.selectionStart ?? 0);
    setSelected(0);
    setMentionIndex(0);
    setMentionSuppressed(false);
  };

  const syncCaret = (event: React.SyntheticEvent<HTMLInputElement>) => {
    setCaret(event.currentTarget.selectionStart ?? 0);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (mentionOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((current) => (current + 1) % mentions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex((current) => (current - 1 + mentions.length) % mentions.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        pickMention(mentions[mentionClamped]!);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setMentionSuppressed(true);
        return;
      }
    }
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
            id={`composer-${blockId}`}
            className={styles.input}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onKeyUp={syncCaret}
            onClick={syncCaret}
            placeholder={mode ? commandHint(mode) : "/ für Befehle, @ für Personen, # für eine Überschrift"}
            aria-label="Neue Zeile"
            role={menuOpen || mentionOpen ? "combobox" : undefined}
            aria-expanded={menuOpen || mentionOpen}
            aria-controls={menuOpen ? menuId : mentionOpen ? mentionId_ : undefined}
            aria-activedescendant={
              mentionOpen
                ? `${mentionId_}-option-${mentionClamped}`
                : menuOpen
                  ? `${menuId}-option-${menu[selected]!.key}`
                  : undefined
            }
          />
        )}

        <button type="button" className={styles.go} onClick={commit}>
          Hinzufügen
        </button>
      </div>

      {mentionOpen && (
        <ul className={styles.menu} id={mentionId_} role="listbox" aria-label="Person wählen">
          {mentions.map((person, index) => (
            <li key={person.id}>
              <button
                type="button"
                id={`${mentionId_}-option-${index}`}
                role="option"
                aria-selected={index === mentionClamped}
                className={index === mentionClamped ? styles.optionSelected : styles.option}
                onMouseEnter={() => setMentionIndex(index)}
                onClick={() => pickMention(person)}
              >
                <span className={styles.personBadge}>{deriveShort(person.name)}</span>
                <span className={styles.hint}>{person.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {menuOpen && !mentionOpen && (
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

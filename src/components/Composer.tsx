import { useLayoutEffect, useEffect, useRef, useState } from "react";
import type { BlockRow, SpaceRow } from "../../shared/db.ts";
import {
  commandHint,
  commandLabel,
  composeItem,
  matchComposerCommands,
  type ComposerCommandKey,
  type ComposerItemFields,
} from "../domain/composer.ts";
import { readDraft, writeDraft } from "../domain/drafts.ts";
import { formatShort } from "../domain/dates.ts";
import { deriveShort } from "../domain/naming.ts";
import { parseTokens } from "../domain/tokens.ts";
import { GrowingTextarea } from "./GrowingTextarea.tsx";
import styles from "./Composer.module.css";

interface ComposerProps {
  blockId: string;
  spaces: readonly Pick<SpaceRow, "id" | "name" | "kind">[];
  /** Every block in the loaded view — ref targets, excluding the block itself. */
  blocks: readonly BlockRow[];
  today: Date;
  /** "Zu einer Liste zusammenfassen" (Feature 1): why the action is locked,
   * or the enabled hint. The Composer only renders these; BlockCard decides. */
  mergeLocked?: boolean;
  mergeHint?: string;
  onMergeSelected?: () => void;
  /** Hide the merge command — for composers without a block's row selection
   * (e.g. the person's task bar, Feature 3). */
  showMergeCommand?: boolean;
  /** A "/jfx" theme: create it in the Jour-Fix block of the mentioned person
   * (or the current space) instead of this block (Feature 2, docs/adr/0017). */
  onCreateJourFix?: (
    text: string,
    personSpaceId: string | null,
  ) => void | boolean | Promise<boolean>;
  autoFocus?: boolean;
  initialMode?: ComposerCommandKey;
  onCreateItem: (
    fields: ComposerItemFields,
  ) => void | boolean | Promise<boolean>;
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
export function Composer({
  blockId,
  spaces,
  blocks,
  today,
  mergeLocked = true,
  mergeHint,
  onMergeSelected,
  showMergeCommand = true,
  onCreateJourFix,
  onCreateItem,
  initialMode,
  autoFocus,
}: ComposerProps) {
  const [value, setValue] = useState(() => readDraft(blockId)?.value ?? "");
  const [mode, setMode] = useState<ComposerCommandKey | null>(
    () => readDraft(blockId)?.mode ?? initialMode ?? null,
  );
  const [selected, setSelected] = useState(0);
  const [refTarget, setRefTarget] = useState(
    () => readDraft(blockId)?.refTarget ?? "",
  );
  const [caret, setCaret] = useState(0);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionId, setMentionId] = useState<string | null>(
    () => readDraft(blockId)?.mentionId ?? null,
  );
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    writeDraft(blockId, { value, mode, mentionId, refTarget });
  }, [blockId, value, mode, mentionId, refTarget]);
  const [mentionSuppressed, setMentionSuppressed] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Keep the DOM caret in sync with the caret state after every render. A
   * controlled input resets its caret when the value changes, so after a
   * pick the desired position must be re-applied — synchronously, before
   * paint. This is what makes `pickMention` deterministic: the next
   * keystroke lands exactly where the pick put the caret, with no rAF
   * timing to race against.
   */
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (
      el &&
      el.selectionStart === el.selectionEnd &&
      el.selectionStart !== caret
    )
      el.setSelectionRange(caret, caret);
  });

  const menu = matchComposerCommands(
    value.startsWith("/") ? value.slice(1) : "",
  ).filter((command) => showMergeCommand || command.key !== "merge");
  const menuOpen = value.startsWith("/") && menu.length > 0;
  const menuId = `composer-menu-${blockId}`;

  // The @-mention: only while the caret sits right behind "@word".
  const before = value.slice(0, caret);
  const at = mode === "ref" ? null : before.match(/@([\p{L}]*)$/u);
  const query = at ? at[1]!.toLowerCase() : "";
  const people = spaces.filter((space) => space.kind === "person");
  const mentions = at
    ? people.filter(
        (person) =>
          !query ||
          person.name
            .toLowerCase()
            .split(" ")
            .some((part) => part.startsWith(query)),
      )
    : [];
  const mentionOpen = !mentionSuppressed && mentions.length > 0;
  const mentionClamped = Math.min(
    mentionIndex,
    Math.max(0, mentions.length - 1),
  );
  const mentionId_ = `composer-mention-${blockId}`;

  const pick = (key: ComposerCommandKey) => {
    if (key === "merge") {
      // The merge acts on the range selection immediately — no text input
      // follows (Feature 1). Locked means the reason is shown in the menu.
      if (!mergeLocked) onMergeSelected?.();
      setValue("");
      setSelected(0);
      setCaret(0);
      setMode(null);
      inputRef.current?.focus();
      return;
    }
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
    setMentionSuppressed(true);
    setMentionIndex(0);
    inputRef.current?.focus();
  };

  const commit = async () => {
    if (saving) return;
    const tokens = parseTokens(value, spaces, today);
    const fields = composeItem({
      mode: mode === "jfx" ? "note" : (mode ?? "note"),
      raw: value,
      refBlockId: refTarget || null,
      spaces,
      today,
      mentionId,
    });
    if (!fields) return;
    setSaving(true);
    try {
      const result =
        mode === "jfx"
          ? await onCreateJourFix?.(tokens.text, mentionId ?? tokens.assigneeId)
          : await onCreateItem(fields);
      if (result === false) return;
      const stored = readDraft(blockId);
      if (stored?.value === value && stored.refTarget === refTarget)
        writeDraft(blockId, {
          value: "",
          mode: null,
          mentionId: null,
          refTarget: "",
        });
      setValue("");
      setCaret(0);
      setMentionId(null);
      setMentionSuppressed(false);
      setRefTarget("");
      if (mode === "jfx" || mode === "ref") setMode(initialMode ?? null);
    } finally {
      setSaving(false);
    }
  };

  const onChange = (value: string) => {
    setValue(value);
    setCaret(inputRef.current?.selectionStart ?? 0);
    setSelected(0);
    setMentionIndex(0);
    setMentionSuppressed(false);
  };

  const syncCaret = (event: React.SyntheticEvent<HTMLTextAreaElement>) => {
    setCaret(event.currentTarget.selectionStart ?? 0);
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (mentionOpen) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setMentionIndex((current) => (current + 1) % mentions.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setMentionIndex(
          (current) => (current - 1 + mentions.length) % mentions.length,
        );
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
            className={`${styles.chip} badge badge--own`}
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
          <GrowingTextarea
            autoFocus={autoFocus}
            disabled={saving}
            ref={inputRef}
            id={`composer-${blockId}`}
            className={styles.input}
            value={value}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onKeyUp={syncCaret}
            onSelect={syncCaret}
            onClick={syncCaret}
            placeholder={
              mode
                ? commandHint(mode)
                : "/ für Befehle, @ für Personen, # für eine Überschrift"
            }
            ariaLabel="Neue Zeile"
            combobox
            ariaExpanded={menuOpen || mentionOpen}
            ariaControls={
              menuOpen ? menuId : mentionOpen ? mentionId_ : undefined
            }
            ariaActiveDescendant={
              mentionOpen
                ? `${mentionId_}-option-${mentionClamped}`
                : menuOpen
                  ? `${menuId}-option-${menu[selected]!.key}`
                  : undefined
            }
          />
        )}

        <button
          type="button"
          className={`${styles.go} label`}
          onClick={() => void commit()}
          disabled={saving}
        >
          {saving ? "Wird gespeichert…" : "Hinzufügen"}
        </button>
      </div>

      {mentionOpen && (
        <ul
          className={styles.menu}
          id={mentionId_}
          role="listbox"
          aria-label="Person wählen"
        >
          {mentions.map((person, index) => (
            <li key={person.id}>
              <button
                type="button"
                id={`${mentionId_}-option-${index}`}
                role="option"
                aria-selected={index === mentionClamped}
                className={`${styles.option} ${styles.optionAt} ${index === mentionClamped ? styles.optionSelected : ""}`}
                onMouseEnter={() => setMentionIndex(index)}
                onClick={() => pickMention(person)}
              >
                <span className="sbadge">{deriveShort(person.name)}</span>
                <span className={styles.hint}>{person.name}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {menuOpen && !mentionOpen && (
        <ul
          className={styles.menu}
          id={menuId}
          role="listbox"
          aria-label="Befehl wählen"
        >
          {menu.map((command, index) => {
            const mergeItem = command.key === "merge";
            const locked = mergeItem && mergeLocked;
            return (
              <li key={command.key}>
                <button
                  type="button"
                  id={`${menuId}-option-${command.key}`}
                  role="option"
                  aria-selected={index === selected}
                  aria-disabled={locked}
                  disabled={locked}
                  className={
                    index === selected ? styles.optionSelected : styles.option
                  }
                  onMouseEnter={() => setSelected(index)}
                  onClick={() => pick(command.key)}
                >
                  <span className={styles.command}>/{command.key}</span>
                  <span className={styles.hint}>
                    {mergeItem ? (mergeHint ?? command.hint) : command.hint}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

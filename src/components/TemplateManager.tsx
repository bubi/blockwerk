import { useState } from "react";
import type { TemplateRow } from "../../shared/db.ts";
import type { TemplatePatch } from "../../shared/schemas.ts";
import { TEMPLATE_HUES } from "../domain/templates.ts";
import styles from "./TemplateManager.module.css";

interface TemplateManagerProps {
  templates: TemplateRow[];
  onCreate: () => void;
  onUpdate: (id: string, patch: TemplatePatch) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

/**
 * The template manager (from the prototype): one card per template with its
 * label, hue and seed lines. Seed lines are plain text, one per line — a "#"
 * at the start makes a heading in new blocks. Deletion asks inline, never in
 * a browser dialog.
 */
export function TemplateManager({ templates, onCreate, onUpdate, onDelete, onClose }: TemplateManagerProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div
      className={styles.overlay}
      onClick={onClose}
      onKeyDown={(event) => {
        if (event.key === "Escape") onClose();
      }}
    >
      <div
        className={styles.sheet}
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-label="Templates bearbeiten"
      >
        <header className={styles.sheethead}>
          <h2>Templates</h2>
          <button type="button" className={styles.sheetclose} onClick={onClose} aria-label="Schließen">
            ×
          </button>
        </header>
        <p className={styles.sheetnote}>
          Jede Zeile im Feld wird zu einer Notizzeile im neuen Block. Ein <strong>#</strong> davor macht daraus eine
          Überschrift.
        </p>

        <div className={styles.tpllist}>
          {templates.map((template) => (
            <section key={template.id} data-template-id={template.id} className={`${styles.tplcard} hue-${template.hue}`}>
              <div className={styles.tplrow}>
                <input
                  className={styles.tplname}
                  value={template.label}
                  onChange={(event) => onUpdate(template.id, { label: event.target.value })}
                  aria-label="Name des Templates"
                />
                <select
                  className={styles.tplhue}
                  value={template.hue}
                  onChange={(event) => onUpdate(template.id, { hue: event.target.value })}
                  aria-label="Farbe"
                >
                  {TEMPLATE_HUES.map((hue) => (
                    <option key={hue.key} value={hue.key}>
                      {hue.name}
                    </option>
                  ))}
                </select>
                {confirmId === template.id ? (
                  <span className={styles.tplconfirm}>
                    <button
                      type="button"
                      className={styles.sdel}
                      onClick={() => {
                        onDelete(template.id);
                        setConfirmId(null);
                      }}
                    >
                      Löschen
                    </button>
                    <button type="button" className={styles.scancel} onClick={() => setConfirmId(null)}>
                      Abbrechen
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.tplkill}
                    onClick={() => setConfirmId(template.id)}
                    aria-label={`${template.label} entfernen`}
                  >
                    Entfernen
                  </button>
                )}
              </div>
              <textarea
                className={styles.tplseed}
                rows={Math.max(3, template.seed.length + 1)}
                value={template.seed.join("\n")}
                onChange={(event) =>
                  onUpdate(template.id, {
                    seed: event.target.value
                      .split("\n")
                      .filter((line, index, lines) => line.trim() !== "" || index < lines.length - 1),
                  })
                }
                placeholder={"# Teilnehmer\n# Agenda"}
                aria-label="Vorbelegte Zeilen"
              />
            </section>
          ))}
        </div>

        <button type="button" className={styles.newbtn} onClick={onCreate}>
          Template hinzufügen
        </button>
      </div>
    </div>
  );
}

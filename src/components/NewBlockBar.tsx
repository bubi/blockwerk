import { useState } from "react";
import type { TemplateRow } from "../../shared/db.ts";
import styles from "./NewBlockBar.module.css";

interface NewBlockBarProps {
  templates: TemplateRow[];
  onCreateBlock: (templateId: string | null) => void;
  onManageTemplates: () => void;
}

/**
 * The "Block anlegen" bar (from the prototype). Opens a menu of templates —
 * picking one creates a block for today with the template's seed lines.
 * "Ohne Template" creates a bare block (also the only option when the
 * database has no templates yet). The "Templates bearbeiten…" entry opens
 * the template manager.
 */
export function NewBlockBar({ templates, onCreateBlock, onManageTemplates }: NewBlockBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.newbar}>
      <button
        type="button"
        className={styles.newbtn}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Block anlegen
      </button>
      {open && (
        <div
          className={styles.tmenu}
          role="menu"
          aria-label="Template wählen"
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
          }}
        >
          {templates.map((template) => (
            <button
              key={template.id}
              type="button"
              role="menuitem"
              className={`${styles.titem} hue-${template.hue}`}
              onClick={() => {
                onCreateBlock(template.id);
                setOpen(false);
              }}
            >
              <span className={styles.tlabel}>{template.label}</span>
              <span className={styles.tseed}>{template.seed.length ? `${template.seed.length} Zeilen` : "leer"}</span>
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className={styles.titem}
            onClick={() => {
              onCreateBlock(null);
              setOpen(false);
            }}
          >
            <span className={styles.tlabel}>Ohne Template</span>
            <span className={styles.tseed}>leer</span>
          </button>
          <button
            type="button"
            role="menuitem"
            className={styles.tmanage}
            onClick={() => {
              setOpen(false);
              onManageTemplates();
            }}
          >
            Templates bearbeiten…
          </button>
        </div>
      )}
    </div>
  );
}

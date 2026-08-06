import { useState } from "react";
import type { TemplateRow } from "../../shared/db.ts";
import styles from "./NewBlockBar.module.css";

interface NewBlockBarProps {
  templates: TemplateRow[];
  onCreateBlock: (templateId: string | null) => void;
  onManageTemplates: () => void;
}

/**
 * The "Block anlegen" bar: a divider line with a centered plus (Bug 6).
 * The plus opens a menu of templates — picking one creates a block for today
 * with the template's seed lines. The plus is a hover control like the other
 * row controls: on touch (hover: none) it is always visible, because creating
 * a block is the main function and must never be hidden there. "Ohne
 * Template" creates a bare block (also the only option when the database has
 * no templates yet). The "Templates bearbeiten…" entry opens the manager.
 */
export function NewBlockBar({
  templates,
  onCreateBlock,
  onManageTemplates,
}: NewBlockBarProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.newbar}>
      <div className={styles.rule}>
        <button
          type="button"
          className={styles.plus}
          onClick={() => setOpen((current) => !current)}
          aria-label="Block anlegen"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          +
        </button>
      </div>
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
              className={`${styles.titem} typdot hue-${template.hue}`}
              onClick={() => {
                onCreateBlock(template.id);
                setOpen(false);
              }}
            >
              <span className={styles.tlabel}>{template.label}</span>
              <span className={`${styles.tseed} label label--muted`}>
                {template.seed.length
                  ? `${template.seed.length} Zeilen`
                  : "leer"}
              </span>
            </button>
          ))}
          <button
            type="button"
            role="menuitem"
            className={`${styles.titem} typdot`}
            onClick={() => {
              onCreateBlock(null);
              setOpen(false);
            }}
          >
            <span className={styles.tlabel}>Ohne Template</span>
            <span className={`${styles.tseed} label label--muted`}>leer</span>
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

import { useRef, useState } from "react";
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
 * no templates yet). The "Vorlagen bearbeiten…" entry opens the manager.
 */
export function NewBlockBar({
  templates,
  onCreateBlock,
  onManageTemplates,
}: NewBlockBarProps) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.newbar}>
      <div className={styles.rule}>
        <button
          ref={trigger}
          type="button"
          className={styles.plus}
          onClick={() => setOpen((current) => !current)}
          aria-label="Block anlegen"
          aria-haspopup="menu"
          aria-expanded={open}
        >
          Block anlegen
        </button>
      </div>
      {open && (
        <div
          className={styles.tmenu}
          role="menu"
          aria-label="Vorlage wählen"
          onKeyDown={(event) => {
            const elements = Array.from(
              event.currentTarget.querySelectorAll<HTMLButtonElement>(
                '[role="menuitem"]',
              ),
            );
            const index = elements.indexOf(
              document.activeElement as HTMLButtonElement,
            );
            if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
              event.preventDefault();
              const next =
                event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? elements.length - 1
                    : (index +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        elements.length) %
                      elements.length;
              elements[next]?.focus();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              trigger.current?.focus();
            }
          }}
        >
          {templates.map((template) => (
            <button
              autoFocus={templates[0]?.id === template.id}
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
            autoFocus={templates.length === 0}
            className={`${styles.titem} typdot`}
            onClick={() => {
              onCreateBlock(null);
              setOpen(false);
            }}
          >
            <span className={styles.tlabel}>Ohne Vorlage</span>
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
            Vorlagen bearbeiten…
          </button>
        </div>
      )}
    </div>
  );
}

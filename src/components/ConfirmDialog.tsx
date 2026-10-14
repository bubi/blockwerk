import { useEffect, useRef, type ReactNode } from "react";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  /** What happens on delete — shown above the buttons so the user knows. */
  message: ReactNode;
  ariaLabel?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A modal confirmation for destructive actions (delete space/block/page/
 * template). A custom overlay dialog — never a browser dialog. Escape or a
 * click on the backdrop cancels; the focus lands on "Abbrechen" so Enter
 * does not delete by accident.
 */
export function ConfirmDialog({ message, confirmLabel = "Löschen", onConfirm, onCancel, ariaLabel = "Löschen bestätigen" }: ConfirmDialogProps) {
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const controller = new AbortController();
    const focusables = () => Array.from(dialog.current?.querySelectorAll<HTMLElement>('button, input, select, textarea, a[href], [tabindex="0"]') ?? []);
    const focusIn = (event: FocusEvent) => {
      if (dialog.current && !dialog.current.contains(event.target as Node)) focusables().at(-1)?.focus();
    };
    document.addEventListener("focusin", focusIn, { signal: controller.signal });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") { event.preventDefault(); onCancel(); }
      if (event.key === "Tab") {
        const elements = focusables(); const first = elements[0]; const last = elements.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    }, { signal: controller.signal });
    return () => { controller.abort(); if (previous?.isConnected) previous.focus(); };
  }, [onCancel]);
  return (
    <div
      className={styles.overlay}
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <div
        ref={dialog}
        className={styles.dialog}
        role="dialog"
        aria-label={ariaLabel}
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.message}>{message}</div>
        <div className={styles.buttons}>
          <button type="button" className={styles.confirm} onClick={onConfirm}>
            {confirmLabel}
          </button>
          <button type="button" className={styles.cancel} onClick={onCancel} autoFocus>
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

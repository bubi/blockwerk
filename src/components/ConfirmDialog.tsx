import { useRef, type ReactNode } from "react";
import { useModalFocus } from "./useModalFocus.ts";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  /** What happens on delete — shown above the buttons so the user knows. */
  message: ReactNode;
  ariaLabel?: string;
  destructive?: boolean;
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
export function ConfirmDialog({
  message,
  confirmLabel = "Löschen",
  onConfirm,
  onCancel,
  ariaLabel = "Löschen bestätigen",
  destructive = true,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDivElement>(null);
  const overlay = useRef<HTMLDivElement>(null);
  useModalFocus(overlay, dialog, onCancel);
  return (
    <div ref={overlay} className={styles.overlay} onClick={onCancel}>
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
          <button
            type="button"
            className={`${styles.confirm} ${destructive ? "" : styles.confirmSafe}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className={styles.cancel}
            onClick={onCancel}
            autoFocus
          >
            Abbrechen
          </button>
        </div>
      </div>
    </div>
  );
}

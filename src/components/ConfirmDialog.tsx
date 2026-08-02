import type { ReactNode } from "react";
import styles from "./ConfirmDialog.module.css";

interface ConfirmDialogProps {
  /** What happens on delete — shown above the buttons so the user knows. */
  message: ReactNode;
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
export function ConfirmDialog({ message, confirmLabel = "Löschen", onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div
      className={styles.overlay}
      onClick={onCancel}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <div
        className={styles.dialog}
        role="dialog"
        aria-label="Löschen bestätigen"
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <p className={styles.message}>{message}</p>
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

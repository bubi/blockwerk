import type { UiNotification } from "../state/state.ts";
import styles from "./Notifications.module.css";

interface NotificationsProps {
  notifications: UiNotification[];
  onDismiss: (id: string) => void;
}

export function Notifications({ notifications, onDismiss }: NotificationsProps) {
  if (notifications.length === 0) return null;
  return (
    <div className={styles.stack}>
      {notifications.map((notification) => (
        <div key={notification.id} className={styles.toast} role="alert">
          <p className={styles.message}>{message(notification)}</p>
          <button type="button" className={styles.dismiss} onClick={() => onDismiss(notification.id)} aria-label="Meldung schließen">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

function message(notification: UiNotification): string {
  if (notification.error.kind === "network") {
    return "Änderung konnte nicht gespeichert werden — Verbindung fehlgeschlagen.";
  }
  if (notification.error.kind === "http") {
    return (
      notification.error.body?.error.message ??
      `Änderung konnte nicht gespeichert werden (Fehler ${notification.error.status}).`
    );
  }
  return "Änderung konnte nicht gespeichert werden — unerwarteter Fehler.";
}

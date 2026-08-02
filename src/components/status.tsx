import styles from "./status.module.css";

export function Loading({ label = "Wird geladen…" }: { label?: string }) {
  return <p className={styles.status}>{label}</p>;
}

export function LoadError({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <div className={styles.status} role="alert">
      <p>{message ?? "Daten konnten nicht geladen werden."}</p>
      {onRetry && (
        <button type="button" onClick={onRetry}>
          Erneut versuchen
        </button>
      )}
    </div>
  );
}

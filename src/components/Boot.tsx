import { Mark } from "./Mark.tsx";
import styles from "./Boot.module.css";

/**
 * Die Ladeansicht beim Start: Zeichen, Wortmarke, Statuszeile — zentriert.
 * Genau eine der drei Einsatzstellen der Marke (neben Kopfzeile und mobiler
 * Startseite).
 */
export function Boot({
  label = "Arbeitsbereich wird geladen…",
}: {
  label?: string;
}) {
  return (
    <div className={styles.boot}>
      <Mark size={44} />
      <span className={styles.wordmark}>Blockwerk</span>
      <p className={styles.status}>{label}</p>
    </div>
  );
}

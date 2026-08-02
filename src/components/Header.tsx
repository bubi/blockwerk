import styles from "./Header.module.css";

export function Header() {
  return (
    <header className={styles.top}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.wordmark}>Blockwerk</span>
        <span className={styles.tagline}>ein Objektmodell für Notizen, Tasks und Termine</span>
      </div>
    </header>
  );
}

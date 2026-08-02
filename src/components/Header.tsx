import styles from "./Header.module.css";

interface HeaderProps {
  query: string;
  onQueryChange: (value: string) => void;
}

export function Header({ query, onQueryChange }: HeaderProps) {
  return (
    <header className={styles.top}>
      <div className={styles.brand}>
        <span className={styles.mark} aria-hidden="true" />
        <span className={styles.wordmark}>Blockwerk</span>
      </div>
      <div className={styles.searchwrap}>
        <input
          className={styles.search}
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Blöcke, Tasks und Termine durchsuchen"
          aria-label="Durchsuchen"
        />
      </div>
    </header>
  );
}

import {
  dayNumber,
  fromISODate,
  monthName,
  weekdayShort,
} from "../domain/dates.ts";
import { Mark } from "./Mark.tsx";
import styles from "./Header.module.css";

interface HeaderProps {
  query: string;
  /** The app's "today" (docs/adr/0013) — the header's date stamp follows it. */
  today: string;
  onQueryChange: (value: string) => void;
}

export function Header({ query, today, onQueryChange }: HeaderProps) {
  const date = fromISODate(today);
  return (
    <header className={styles.top}>
      <div className={styles.brand}>
        <Mark size={28} />
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
        {query && (
          <button
            type="button"
            className={`${styles.clear} label`}
            onClick={() => onQueryChange("")}
          >
            Suche verlassen
          </button>
        )}
      </div>
      <div className={styles.stamp} aria-hidden="true">
        <span className={`${styles.stampwd} label`}>
          {weekdayShort(date.getDay())}
        </span>
        <span className={styles.stampnum}>{dayNumber(today)}</span>
        <span className={`${styles.stampmon} label`}>
          {monthName(date.getMonth()).slice(0, 3)}
        </span>
      </div>
    </header>
  );
}

import type { MobileTab } from "./TabBar.tsx";
import { Mark } from "./Mark.tsx";
import styles from "./MobileHeader.module.css";

/**
 * The mobile header (docs/adr/0012): a title with an in-app back button for
 * the Notizen drill-down, or the search field itself when the Suche tab is
 * active — the field sits in the header and opens focused. On the "Heute"
 * start page the brand (mark + wordmark) sits small above the title.
 */
export function MobileHeader({
  mTab,
  nLevel,
  spaceName,
  pageTitle,
  mirrorMode,
  query,
  onQueryChange,
  onBack,
}: {
  mTab: MobileTab;
  nLevel: "spaces" | "pages" | "stream";
  spaceName: string;
  pageTitle: string;
  mirrorMode: boolean;
  query: string;
  onQueryChange: (value: string) => void;
  onBack: () => void;
}) {
  if (mTab === "suche") {
    return (
      <header className={styles.top}>
        <input
          className={styles.search}
          autoFocus
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Suchen"
          aria-label="Durchsuchen"
        />
      </header>
    );
  }

  if (mTab === "heute") {
    return (
      <header className={styles.top}>
        <div className={styles.home}>
          <div className={styles.brand}>
            <Mark size={19} />
            <span className={styles.wordmark}>Blockwerk</span>
          </div>
          <div className={styles.title}>
            <h1>Heute</h1>
          </div>
        </div>
      </header>
    );
  }

  let title: string;
  if (nLevel === "spaces") title = "Notizen";
  else if (nLevel === "pages") title = spaceName;
  else title = mirrorMode ? "Zugewiesen" : pageTitle || spaceName;

  return (
    <header className={styles.top}>
      {mTab === "notizen" && nLevel !== "spaces" && (
        <button
          type="button"
          className={styles.back}
          onClick={onBack}
          aria-label="Zurück"
        >
          ‹
        </button>
      )}
      <div className={styles.title}>
        <h1>{title}</h1>
      </div>
    </header>
  );
}

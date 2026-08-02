import styles from "./TabBar.module.css";

export type MobileTab = "heute" | "notizen" | "suche";

const TABS: Array<{ key: MobileTab; label: string }> = [
  { key: "heute", label: "Heute" },
  { key: "notizen", label: "Notizen" },
  { key: "suche", label: "Suche" },
];

/**
 * The mobile tab bar (docs/adr/0012): three destinations — Heute (team
 * overview), Notizen (Bereich → Seite → Stream), Suche. Icon plus label, the
 * active state is a colored pill behind the icon, and the overdue count sits
 * as a badge on the Heute icon. Hit areas are at least 48px tall and the bar
 * respects the safe area at the bottom of the screen.
 */
export function TabBar({
  tab,
  overdueCount,
  onTab,
}: {
  tab: MobileTab;
  overdueCount: number;
  onTab: (tab: MobileTab) => void;
}) {
  return (
    <nav className={styles.tabbar} role="tablist" aria-label="Hauptbereiche">
      {TABS.map((entry) => {
        const active = tab === entry.key;
        return (
          <button
            key={entry.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={active ? styles.btnOn : styles.btn}
            onClick={() => onTab(entry.key)}
          >
            <span className={styles.icon}>
              <TabIcon name={entry.key} />
              {entry.key === "heute" && overdueCount > 0 && (
                <span className={styles.badge} aria-label={`${overdueCount} überfällig`}>
                  {overdueCount > 9 ? "9+" : overdueCount}
                </span>
              )}
            </span>
            <span className={styles.label}>{entry.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function TabIcon({ name }: { name: MobileTab }) {
  const stroke = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (name === "heute") {
    return (
      <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" {...stroke} />
        <path d="M3.5 9.5h17M8 3.5v3M16 3.5v3" {...stroke} />
        <path d="M9 14.5l2 2 4-4" {...stroke} />
      </svg>
    );
  }
  if (name === "notizen") {
    return (
      <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
        <path d="M6 3.5h9.5L20 8v12.5H6a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 6 3.5Z" {...stroke} />
        <path d="M15 3.5V8h5M8.5 12.5h7M8.5 16h4.5" {...stroke} />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="23" height="23" aria-hidden="true">
      <circle cx="10.8" cy="10.8" r="6.3" {...stroke} />
      <path d="M15.5 15.5 20 20" {...stroke} />
    </svg>
  );
}

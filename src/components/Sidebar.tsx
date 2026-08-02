import type { SpaceWithPages } from "../../shared/api.ts";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  people: SpaceWithPages[];
  topics: SpaceWithPages[];
  /** Open-task counts, only for spaces whose mirror has been loaded. */
  openCounts: ReadonlyMap<string, number>;
  selectedSpaceId: string | null;
  onSelectSpace: (spaceId: string) => void;
}

export function Sidebar({ people, topics, openCounts, selectedSpaceId, onSelectSpace }: SidebarProps) {
  return (
    <div className={styles.rail}>
      <h2 className={styles.colhead}>Bereiche</h2>
      <SpaceGroup title="Personen" spaces={people} openCounts={openCounts} selectedSpaceId={selectedSpaceId} onSelectSpace={onSelectSpace} />
      <SpaceGroup title="Themen" spaces={topics} openCounts={openCounts} selectedSpaceId={selectedSpaceId} onSelectSpace={onSelectSpace} />
      <div className={styles.railfoot}>
        <p>
          Ein Task, der an eine Person geht, wird nicht kopiert. Er erscheint gespiegelt in ihrem Bereich — abhaken wirkt an beiden Stellen.
        </p>
      </div>
    </div>
  );
}

function SpaceGroup({
  title,
  spaces,
  openCounts,
  selectedSpaceId,
  onSelectSpace,
}: {
  title: string;
  spaces: SpaceWithPages[];
  openCounts: ReadonlyMap<string, number>;
  selectedSpaceId: string | null;
  onSelectSpace: (spaceId: string) => void;
}) {
  if (spaces.length === 0) return null;
  return (
    <div className={styles.group}>
      <h3 className={styles.grouphead}>{title}</h3>
      <ul>
        {spaces.map((space) => {
          const active = space.id === selectedSpaceId;
          const count = openCounts.get(space.id) ?? 0;
          return (
            <li key={space.id}>
              <button
                type="button"
                className={active ? styles.itemOn : styles.item}
                aria-current={active ? "page" : undefined}
                onClick={() => onSelectSpace(space.id)}
              >
                <span className={space.kind === "person" ? styles.badgePerson : styles.badgeTopic} aria-hidden="true">
                  {initials(space.name)}
                </span>
                <span className={styles.name}>{space.name}</span>
                {count > 0 && <span className={styles.open}>{count}</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function initials(name: string): string {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((word) => word[0] ?? "")
      .join("")
      .toUpperCase() || "??"
  );
}

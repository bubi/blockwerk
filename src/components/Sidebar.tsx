import { useState } from "react";
import type { SpaceRow } from "../../shared/db.ts";
import type { SpaceWithPages } from "../../shared/api.ts";
import { deriveShort } from "../domain/naming.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  people: SpaceWithPages[];
  topics: SpaceWithPages[];
  /** Open-task counts, only for spaces whose tasks are loaded. */
  openCounts: ReadonlyMap<string, number>;
  selectedSpaceId: string | null;
  /** The overdue badge of the "Heute" entry. */
  overdueCount: number;
  homeActive: boolean;
  /** Hide the "Heute" entry — the mobile tab bar provides it. */
  showHome?: boolean;
  onHome: () => void;
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: (kind: SpaceRow["kind"], name: string) => void;
  onDeleteSpace: (spaceId: string) => void;
}

export function Sidebar({
  people,
  topics,
  openCounts,
  selectedSpaceId,
  overdueCount,
  homeActive,
  showHome = true,
  onHome,
  onSelectSpace,
  onCreateSpace,
  onDeleteSpace,
}: SidebarProps) {
  return (
    <div className={styles.rail}>
      {showHome && (
        <button
          type="button"
          className={homeActive ? styles.homeOn : styles.home}
          aria-current={homeActive ? "page" : undefined}
          onClick={onHome}
        >
          <span className={styles.name}>Heute</span>
          {overdueCount > 0 && <span className={styles.open}>{overdueCount}</span>}
        </button>
      )}

      <h2 className={styles.colhead}>Bereiche</h2>
      <SpaceGroup
        kind="person"
        title="Personen"
        spaces={people}
        openCounts={openCounts}
        selectedSpaceId={selectedSpaceId}
        onSelectSpace={onSelectSpace}
        onCreateSpace={onCreateSpace}
        onDeleteSpace={onDeleteSpace}
      />
      <SpaceGroup
        kind="topic"
        title="Themen"
        spaces={topics}
        openCounts={openCounts}
        selectedSpaceId={selectedSpaceId}
        onSelectSpace={onSelectSpace}
        onCreateSpace={onCreateSpace}
        onDeleteSpace={onDeleteSpace}
      />
      <div className={styles.railfoot}>
        <p>
          Ein Task, der an eine Person geht, wird nicht kopiert. Er erscheint gespiegelt in ihrem Bereich — abhaken wirkt an beiden Stellen.
        </p>
      </div>
    </div>
  );
}

function SpaceGroup({
  kind,
  title,
  spaces,
  openCounts,
  selectedSpaceId,
  onSelectSpace,
  onCreateSpace,
  onDeleteSpace,
}: {
  kind: SpaceRow["kind"];
  title: string;
  spaces: SpaceWithPages[];
  openCounts: ReadonlyMap<string, number>;
  selectedSpaceId: string | null;
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: (kind: SpaceRow["kind"], name: string) => void;
  onDeleteSpace: (spaceId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) return;
    onCreateSpace(kind, name);
    setName("");
    setAdding(false);
  };

  return (
    <div className={styles.group}>
      <h3 className={styles.grouphead}>
        {title}
        <button
          type="button"
          className={styles.sadd}
          onClick={() => setAdding((open) => !open)}
          aria-label={`${title} hinzufügen`}
          title="Bereich anlegen"
        >
          +
        </button>
      </h3>

      {adding && (
        <div className={styles.saddrow}>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
              if (event.key === "Escape") {
                setAdding(false);
                setName("");
              }
            }}
            placeholder={kind === "person" ? "Name" : "Thema"}
            aria-label="Name des Bereichs"
          />
          <button type="button" className={styles.saddgo} onClick={submit}>
            Anlegen
          </button>
        </div>
      )}

      {spaces.map((space) => {
        const active = space.id === selectedSpaceId;
        const count = openCounts.get(space.id) ?? 0;
        return (
          <div key={space.id} className={styles.srow}>
            <button
              type="button"
              className={active ? styles.itemOn : styles.item}
              aria-current={active ? "page" : undefined}
              onClick={() => onSelectSpace(space.id)}
            >
              <span className={space.kind === "person" ? styles.badgePerson : styles.badgeTopic} aria-hidden="true">
                {deriveShort(space.name)}
              </span>
              <span className={styles.name}>{space.name}</span>
              {count > 0 && <span className={styles.open}>{count}</span>}
            </button>
            <button
              type="button"
              className={styles.skill}
              onClick={() => setConfirmId(space.id)}
              aria-label={`${space.name} entfernen`}
              title="Bereich entfernen"
            >
              ×
            </button>
          </div>
        );
      })}
      {spaces.length === 0 && <p className={styles.grpempty}>Noch keiner angelegt</p>}

      {confirmId !== null && (
        <ConfirmDialog
          message={
            <>
              „{spaces.find((entry) => entry.id === confirmId)?.name ?? ""}“ wird gelöscht: Seiten und Blöcke gehen mit,
              Tasks in anderen Bereichen verlieren nur ihre Zuständigkeit.
            </>
          }
          onConfirm={() => {
            onDeleteSpace(confirmId);
            setConfirmId(null);
          }}
          onCancel={() => setConfirmId(null)}
        />
      )}
    </div>
  );
}

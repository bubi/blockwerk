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
  /** The person space that is "me" (docs/adr/0013) — marked in the list. */
  meSpaceId: string | null;
  homeActive: boolean;
  /** Hide the "Heute" entry — the mobile tab bar provides it. */
  showHome?: boolean;
  onHome: () => void;
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: (kind: SpaceRow["kind"], name: string, email: string) => void;
  onDeleteSpace: (spaceId: string) => void;
  /** The rail footer's "Templates bearbeiten" (design-system 5). */
  onManageTemplates: () => void;
}

export function Sidebar({
  people,
  topics,
  openCounts,
  selectedSpaceId,
  overdueCount,
  meSpaceId,
  homeActive,
  showHome = true,
  onHome,
  onSelectSpace,
  onCreateSpace,
  onDeleteSpace,
  onManageTemplates,
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
          {overdueCount > 0 && (
            <span className="badge badge--warn">{overdueCount}</span>
          )}
        </button>
      )}

      <SpaceGroup
        kind="person"
        title="Personen"
        spaces={people}
        openCounts={openCounts}
        selectedSpaceId={selectedSpaceId}
        meSpaceId={meSpaceId}
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
        meSpaceId={meSpaceId}
        onSelectSpace={onSelectSpace}
        onCreateSpace={onCreateSpace}
        onDeleteSpace={onDeleteSpace}
      />

      <div className={styles.railfoot}>
        <button
          type="button"
          className={styles.railbtn}
          onClick={onManageTemplates}
        >
          Templates bearbeiten
        </button>
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
  meSpaceId,
  onSelectSpace,
  onCreateSpace,
  onDeleteSpace,
}: {
  kind: SpaceRow["kind"];
  title: string;
  spaces: SpaceWithPages[];
  openCounts: ReadonlyMap<string, number>;
  selectedSpaceId: string | null;
  meSpaceId: string | null;
  onSelectSpace: (spaceId: string) => void;
  onCreateSpace: (kind: SpaceRow["kind"], name: string, email: string) => void;
  onDeleteSpace: (spaceId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const submit = () => {
    if (!name.trim()) return;
    onCreateSpace(kind, name, email);
    setName("");
    setEmail("");
    setAdding(false);
  };

  return (
    <div className={styles.group}>
      <h3 className={`${styles.grouphead} label label--muted`}>
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
                setEmail("");
              }
            }}
            placeholder={kind === "person" ? "Name" : "Thema"}
            aria-label="Name des Bereichs"
          />
          {kind === "person" && (
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submit();
                if (event.key === "Escape") {
                  setAdding(false);
                  setName("");
                  setEmail("");
                }
              }}
              placeholder="E-Mail"
              aria-label="E-Mail des Bereichs"
            />
          )}
          <button
            type="button"
            className={`${styles.saddgo} label`}
            onClick={submit}
          >
            Anlegen
          </button>
        </div>
      )}

      {spaces.map((space) => {
        const active = space.id === selectedSpaceId;
        const count = openCounts.get(space.id) ?? 0;
        const isMe = space.id === meSpaceId;
        return (
          <div key={space.id} className={styles.srow}>
            <button
              type="button"
              className={active ? styles.itemOn : styles.item}
              aria-current={active ? "page" : undefined}
              onClick={() => onSelectSpace(space.id)}
            >
              <span
                className={`sbadge ${space.kind === "topic" ? "sbadge--topic" : ""}`}
                aria-hidden="true"
              >
                {deriveShort(space.name)}
              </span>
              <span className={styles.name}>
                {space.name}
                {isMe && (
                  <em
                    className={`${styles.me} badge badge--own`}
                    aria-hidden="true"
                  >
                    ich
                  </em>
                )}
              </span>
              {count > 0 && (
                <span
                  className={`badge ${active ? "badge--active" : "badge--quiet"}`}
                >
                  {count}
                </span>
              )}
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
      {spaces.length === 0 && (
        <p className={styles.grpempty}>Noch keiner angelegt</p>
      )}

      {confirmId !== null && (
        <ConfirmDialog
          message={
            <>
              „{spaces.find((entry) => entry.id === confirmId)?.name ?? ""}“
              wird gelöscht: Seiten und Blöcke gehen mit, Tasks in anderen
              Bereichen verlieren nur ihre Zuständigkeit.
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

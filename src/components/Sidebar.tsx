import { useState } from "react";
import type { SpaceRow } from "../../shared/db.ts";
import type { SpaceWithPages } from "../../shared/api.ts";
import { deriveShort } from "../domain/naming.ts";
import type { PageSelection } from "../state/navigation.ts";
import { ConfirmDialog } from "./ConfirmDialog.tsx";
import styles from "./Sidebar.module.css";

interface SidebarProps {
  people: SpaceWithPages[];
  topics: SpaceWithPages[];
  /** Open-task counts, only for spaces whose tasks are loaded. */
  openCounts: ReadonlyMap<string, number>;
  selectedSpaceId: string | null;
  /** The selected entry of the active space's sub-list. */
  selectedPage: PageSelection | null;
  /** The overdue badge of the "Heute" entry. */
  overdueCount: number;
  /** The person space that is "me" (docs/adr/0013) — marked in the list. */
  meSpaceId: string | null;
  homeActive: boolean;
  /** Hide the "Heute" entry — the mobile tab bar provides it. */
  showHome?: boolean;
  /** Show the sub-list under the active space (accordion). Mobile keeps a
   * flat list — its drill-down provides the entries (docs/adr/0012). */
  expandable?: boolean;
  onHome: () => void;
  onSelectSpace: (spaceId: string) => void;
  onSelectPage: (pageId: PageSelection) => void;
  onCreatePage: (title: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onDeletePage: (pageId: string) => void;
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
  selectedPage,
  overdueCount,
  meSpaceId,
  homeActive,
  showHome = true,
  expandable = true,
  onHome,
  onSelectSpace,
  onSelectPage,
  onCreatePage,
  onRenamePage,
  onDeletePage,
  onCreateSpace,
  onDeleteSpace,
  onManageTemplates,
}: SidebarProps) {
  return (
    <nav className={styles.rail} aria-label="Bereiche">
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
        selectedPage={selectedPage}
        meSpaceId={meSpaceId}
        expandable={expandable}
        onSelectSpace={onSelectSpace}
        onSelectPage={onSelectPage}
        onCreatePage={onCreatePage}
        onRenamePage={onRenamePage}
        onDeletePage={onDeletePage}
        onCreateSpace={onCreateSpace}
        onDeleteSpace={onDeleteSpace}
      />
      <SpaceGroup
        kind="topic"
        title="Themen"
        spaces={topics}
        openCounts={openCounts}
        selectedSpaceId={selectedSpaceId}
        selectedPage={selectedPage}
        meSpaceId={meSpaceId}
        expandable={expandable}
        onSelectSpace={onSelectSpace}
        onSelectPage={onSelectPage}
        onCreatePage={onCreatePage}
        onRenamePage={onRenamePage}
        onDeletePage={onDeletePage}
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
    </nav>
  );
}

function SpaceGroup({
  kind,
  title,
  spaces,
  openCounts,
  selectedSpaceId,
  selectedPage,
  meSpaceId,
  expandable,
  onSelectSpace,
  onSelectPage,
  onCreatePage,
  onRenamePage,
  onDeletePage,
  onCreateSpace,
  onDeleteSpace,
}: {
  kind: SpaceRow["kind"];
  title: string;
  spaces: SpaceWithPages[];
  openCounts: ReadonlyMap<string, number>;
  selectedSpaceId: string | null;
  selectedPage: PageSelection | null;
  meSpaceId: string | null;
  expandable: boolean;
  onSelectSpace: (spaceId: string) => void;
  onSelectPage: (pageId: PageSelection) => void;
  onCreatePage: (title: string) => void;
  onRenamePage: (pageId: string, title: string) => void;
  onDeletePage: (pageId: string) => void;
  onCreateSpace: (kind: SpaceRow["kind"], name: string, email: string) => void;
  onDeleteSpace: (spaceId: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  /** A space the user folded away while it stays selected (accordion). */
  const [collapsedId, setCollapsedId] = useState<string | null>(null);
  const [pageConfirm, setPageConfirm] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [addingPage, setAddingPage] = useState(false);
  const [pageDraft, setPageDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const submit = () => {
    if (!name.trim()) return;
    onCreateSpace(kind, name, email);
    setName("");
    setEmail("");
    setAdding(false);
  };

  const submitAddPage = () => {
    const draft = pageDraft.trim();
    if (draft) onCreatePage(draft);
    setPageDraft("");
    setAddingPage(false);
  };

  const submitRename = () => {
    if (editingId === null) return;
    const draft = editDraft.trim();
    if (draft) onRenamePage(editingId, draft);
    setEditingId(null);
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

      <ul className={styles.list}>
        {spaces.map((space) => {
          const active = space.id === selectedSpaceId;
          const count = openCounts.get(space.id) ?? 0;
          const isMe = space.id === meSpaceId;
          const expanded = expandable && active && collapsedId !== space.id;
          return (
            <li key={space.id} className={styles.srow}>
              <div className={styles.srowtop}>
                <button
                  type="button"
                  className={active ? styles.itemOn : styles.item}
                  aria-current={
                    expanded ? undefined : active ? "page" : undefined
                  }
                  aria-expanded={expandable ? expanded : undefined}
                  onClick={() => {
                    if (active && expandable) {
                      // A second click on the active space folds the accordion
                      // away; any other click selects and expands the space.
                      setCollapsedId((previous) =>
                        previous === space.id ? null : space.id,
                      );
                    } else {
                      setCollapsedId(null);
                      onSelectSpace(space.id);
                    }
                  }}
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
                  {!expanded && count > 0 && (
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

              {expanded && (
                <ul className={styles.sublist}>
                  {kind === "person" && (
                    <li className={styles.subrow}>
                      <button
                        type="button"
                        className={
                          selectedPage === "tasks"
                            ? styles.subitemOn
                            : styles.subitem
                        }
                        aria-current={
                          selectedPage === "tasks" ? "page" : undefined
                        }
                        onClick={() => onSelectPage("tasks")}
                      >
                        <span className={styles.subname}>Aufgaben</span>
                        {count > 0 && (
                          <span
                            className={`badge ${
                              selectedPage === "tasks"
                                ? "badge--active"
                                : "badge--quiet"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    </li>
                  )}
                  <li className={styles.subrow}>
                    <button
                      type="button"
                      className={
                        selectedPage === "jourfix"
                          ? styles.subitemOn
                          : styles.subitem
                      }
                      aria-current={
                        selectedPage === "jourfix" ? "page" : undefined
                      }
                      onClick={() => onSelectPage("jourfix")}
                    >
                      <span className={styles.subname}>Jour Fix</span>
                    </button>
                  </li>
                  {space.pages.map((page) => {
                    const pageActive = selectedPage === page.id;
                    if (editingId === page.id) {
                      return (
                        <li key={page.id} className={styles.subrow}>
                          <input
                            className={styles.subedit}
                            autoFocus
                            value={editDraft}
                            onChange={(event) =>
                              setEditDraft(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") submitRename();
                              if (event.key === "Escape") setEditingId(null);
                            }}
                            onBlur={submitRename}
                            aria-label="Seitentitel umbenennen"
                          />
                        </li>
                      );
                    }
                    return (
                      <li key={page.id} className={styles.subrow}>
                        <button
                          type="button"
                          className={
                            pageActive ? styles.subitemOn : styles.subitem
                          }
                          aria-current={pageActive ? "page" : undefined}
                          onClick={() => onSelectPage(page.id)}
                        >
                          <span className={styles.subname}>{page.title}</span>
                        </button>
                        <button
                          type="button"
                          className={styles.subact}
                          onClick={() => {
                            setEditingId(page.id);
                            setEditDraft(page.title);
                          }}
                          aria-label={`${page.title} umbenennen`}
                          title="Seite umbenennen"
                        >
                          ✎
                        </button>
                        <button
                          type="button"
                          className={`${styles.subact} ${styles.subdel}`}
                          onClick={() =>
                            setPageConfirm({ id: page.id, title: page.title })
                          }
                          aria-label={`${page.title} entfernen`}
                          title="Seite entfernen"
                        >
                          ×
                        </button>
                      </li>
                    );
                  })}
                  <li className={styles.subrow}>
                    {addingPage ? (
                      <input
                        className={styles.subedit}
                        autoFocus
                        value={pageDraft}
                        onChange={(event) => setPageDraft(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") submitAddPage();
                          if (event.key === "Escape") {
                            setPageDraft("");
                            setAddingPage(false);
                          }
                        }}
                        onBlur={submitAddPage}
                        placeholder="Seitenname"
                        aria-label="Neue Seite"
                      />
                    ) : (
                      <button
                        type="button"
                        className={styles.subadd}
                        onClick={() => setAddingPage(true)}
                        aria-label="Seite hinzufügen"
                        title="Seite hinzufügen"
                      >
                        + Seite
                      </button>
                    )}
                  </li>
                </ul>
              )}
            </li>
          );
        })}
        {spaces.length === 0 && (
          <li className={styles.grpempty}>Noch keiner angelegt</li>
        )}
      </ul>

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

      {pageConfirm !== null && (
        <ConfirmDialog
          message={<>„{pageConfirm.title}“ mit ihren Blöcken löschen?</>}
          onConfirm={() => {
            onDeletePage(pageConfirm.id);
            setPageConfirm(null);
          }}
          onCancel={() => setPageConfirm(null)}
        />
      )}
    </div>
  );
}

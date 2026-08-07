import { useState } from "react";
import type { SpaceWithPages } from "../../shared/api.ts";
import type { PageRow } from "../../shared/db.ts";
import type { PageSelection } from "../state/navigation.ts";
import styles from "./MobilePages.module.css";

/**
 * The middle step of the mobile Notizen drill-down (docs/adr/0012): a space's
 * entries — the virtual "Aufgaben" (person) and "Jour Fix", then the pages —
 * with an in-line "new page" affordance. Selecting an entry descends to the
 * stream level.
 */
export function MobilePages({
  space,
  pages,
  openCount,
  onPickPage,
  onAddPage,
}: {
  space: SpaceWithPages | null;
  pages: PageRow[];
  openCount: number;
  onPickPage: (id: PageSelection) => void;
  onAddPage: (title: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = () => {
    const title = draft.trim();
    if (title) onAddPage(title);
    setDraft("");
    setAdding(false);
  };

  return (
    <div className={styles.pages}>
      <section className={styles.sec}>
        <ul className={styles.list}>
          {space?.kind === "person" && (
            <li className={styles.row}>
              <button
                type="button"
                className={styles.body}
                onClick={() => onPickPage("tasks")}
              >
                <span className={styles.name}>Aufgaben</span>
                {openCount > 0 && (
                  <span className="badge badge--quiet">{openCount}</span>
                )}
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          )}
          <li className={styles.row}>
            <button
              type="button"
              className={styles.body}
              onClick={() => onPickPage("jourfix")}
            >
              <span className={styles.name}>Jour Fix</span>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </button>
          </li>
          {pages.map((page) => (
            <li key={page.id} className={styles.row}>
              <button
                type="button"
                className={styles.body}
                onClick={() => onPickPage(page.id)}
              >
                <span className={styles.name}>{page.title}</span>
                <span className={styles.chevron} aria-hidden="true">
                  ›
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {adding ? (
        <div className={styles.addrow}>
          <input
            autoFocus
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") submit();
              if (event.key === "Escape") {
                setDraft("");
                setAdding(false);
              }
            }}
            onBlur={submit}
            placeholder="Seitenname"
            aria-label="Neue Seite"
          />
        </div>
      ) : (
        <button
          type="button"
          className={styles.add}
          onClick={() => setAdding(true)}
        >
          + Seite
        </button>
      )}
    </div>
  );
}

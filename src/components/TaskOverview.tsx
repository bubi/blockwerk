import { Fragment, useState } from "react";
import type { SpaceRow } from "../../shared/db.ts";
import { formatShort, fromISODate, monthName, weekdayShort } from "../domain/dates.ts";
import type { OverviewRow, TaskOverviewView } from "../domain/overview.ts";
import type { TodayScope } from "../domain/preferences.ts";
import styles from "./TaskOverview.module.css";

/**
 * The unified task overview (docs/adr/0011) — one component, two modes. Team
 * mode is the desktop "Heute" view (and the mobile "Heute" tab); person mode
 * shows a single person's assigned tasks and replaced the mirror. Both render
 * the same sections (Überfällig · the next 8 days · Später fällig · Ohne
 * Datum) with the same row markup; the team extras — scope bar, Auslastung,
 * overdue grouped by person — are conditionals around the shared structure,
 * never a second code path.
 */
export function TaskOverview({
  mode,
  person,
  view,
  today,
  scope = "team",
  meSpaceId = null,
  spacesById,
  onScopeChange = () => {},
  onToggle,
  onJumpToBlock,
}: {
  mode: "team" | "person";
  person: SpaceRow | null;
  view: TaskOverviewView;
  today: string;
  scope?: TodayScope;
  meSpaceId?: string | null;
  spacesById: ReadonlyMap<string, SpaceRow>;
  onScopeChange?: (scope: TodayScope) => void;
  onToggle: (itemId: string, done: boolean) => void;
  onJumpToBlock: (blockId: string, pageId: string, spaceId: string) => void;
}) {
  const team = mode === "team";
  const [laterOpen, setLaterOpen] = useState(false);
  const [undatedOpen, setUndatedOpen] = useState(false);

  const nothing =
    view.overdue.length === 0 && view.days.length === 0 && view.later.length === 0 && view.undated.length === 0;

  return (
    <div className={styles.today}>
      {team && (
        <div className={styles.scopebar} role="tablist" aria-label="Umfang">
          <button
            type="button"
            role="tab"
            aria-selected={scope === "team"}
            className={scope === "team" ? styles.scopeOn : undefined}
            onClick={() => onScopeChange("team")}
          >
            Ganzes Team
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "mine"}
            className={scope === "mine" ? styles.scopeOn : undefined}
            onClick={() => onScopeChange("mine")}
          >
            Nur meine
          </button>
        </div>
      )}

      {team && scope === "team" && view.workload.length > 0 && (
        <section className={styles.sec}>
          <h2>Auslastung</h2>
          <ul className={styles.loadlist}>
            {view.workload.map((entry) => (
              <li key={entry.space.id}>
                <span className={styles.whoBadge} aria-hidden="true">
                  {entry.space.short}
                </span>
                <span className={styles.loadname}>{entry.space.name}</span>
                <span className={styles.loadnum}>
                  {entry.open} offen
                </span>
                {entry.late > 0 && <span className={styles.loadlate}>{entry.late} überfällig</span>}
              </li>
            ))}
            {view.orphanOpen > 0 && (
              <li className={styles.orphan}>
                <span className={styles.whoBadge} aria-hidden="true">
                  ?
                </span>
                <span className={styles.loadname}>Ohne Zuständigkeit</span>
                <span className={styles.loadnum}>{view.orphanOpen} offen</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {view.overdue.length > 0 && (
        <section className={`${styles.sec} ${styles.late}`}>
          <h2>
            Überfällig <span>{view.overdue.length}</span>
          </h2>
          {team
            ? view.overdueByPerson.map((group) => (
                <div key={group.person?.id ?? "orphan"} className={styles.lategroup}>
                  <h3>
                    {group.person ? group.person.name : "Ohne Zuständigkeit"} <em>{group.tasks.length}</em>
                  </h3>
                  <ul className={styles.list}>
                    {group.tasks.map((row) => (
                      <TaskRow
                        key={row.item.id}
                        row={row}
                        showDue
                        team={team}
                        meSpaceId={meSpaceId}
                        spacesById={spacesById}
                        onToggle={onToggle}
                        onJumpToBlock={onJumpToBlock}
                      />
                    ))}
                  </ul>
                </div>
              ))
            : (
              <ul className={styles.list}>
                {view.overdue.map((row) => (
                  <TaskRow
                    key={row.item.id}
                    row={row}
                    showDue
                    team={team}
                    meSpaceId={meSpaceId}
                    spacesById={spacesById}
                    onToggle={onToggle}
                    onJumpToBlock={onJumpToBlock}
                  />
                ))}
              </ul>
            )}
        </section>
      )}

      {nothing && (
        <p className={styles.empty}>
          {team
            ? "Nichts überfällig, nichts terminiert, nichts offen."
            : `Für ${person ? person.name.split(" ")[0] : "diese Person"} ist nichts offen.`}
        </p>
      )}

      {view.days.map((day) => (
        <section key={day.date} className={styles.sec}>
          <h2>{dayLabel(day.date, today)}</h2>
          <ul className={styles.list}>
            {day.events.map((row) => (
              <li key={row.item.id} className={styles.eventRow} data-item-id={row.item.id}>
                <span className={styles.time}>{row.item.eventTime ?? "—"}</span>
                <button
                  type="button"
                  className={styles.body}
                  onClick={() => onJumpToBlock(row.block.id, row.block.pageId, row.block.spaceId)}
                >
                  <span className={styles.title}>{row.item.text}</span>
                  {row.block.title && <span className={styles.sub}><span className={styles.from}>{row.block.title}</span></span>}
                </button>
              </li>
            ))}
            {day.tasks.map((row) => (
              <TaskRow
                key={row.item.id}
                row={row}
                showDue={false}
                team={team}
                meSpaceId={meSpaceId}
                spacesById={spacesById}
                onToggle={onToggle}
                onJumpToBlock={onJumpToBlock}
              />
            ))}
          </ul>
        </section>
      ))}

      <FoldSection
        label="Später fällig"
        rows={view.later}
        open={laterOpen}
        team={team}
        meSpaceId={meSpaceId}
        spacesById={spacesById}
        onToggleOpen={() => setLaterOpen((open) => !open)}
        onToggle={onToggle}
        onJumpToBlock={onJumpToBlock}
      />
      <FoldSection
        label="Ohne Datum"
        rows={view.undated}
        open={undatedOpen}
        team={team}
        meSpaceId={meSpaceId}
        spacesById={spacesById}
        onToggleOpen={() => setUndatedOpen((open) => !open)}
        onToggle={onToggle}
        onJumpToBlock={onJumpToBlock}
      />
    </div>
  );
}

function FoldSection({
  label,
  rows,
  open,
  team,
  meSpaceId,
  spacesById,
  onToggleOpen,
  onToggle,
  onJumpToBlock,
}: {
  label: string;
  rows: OverviewRow[];
  open: boolean;
  team: boolean;
  meSpaceId: string | null;
  spacesById: ReadonlyMap<string, SpaceRow>;
  onToggleOpen: () => void;
  onToggle: (itemId: string, done: boolean) => void;
  onJumpToBlock: (blockId: string, pageId: string, spaceId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className={styles.sec}>
      <h2>
        <button type="button" className={styles.foldbtn} onClick={onToggleOpen} aria-expanded={open}>
          {label} <em>{rows.length}</em> {open ? "▾" : "▸"}
        </button>
      </h2>
      {open && (
        <ul className={styles.list}>
          {rows.map((row) => (
            <TaskRow
              key={row.item.id}
              row={row}
              showDue
              team={team}
              meSpaceId={meSpaceId}
              spacesById={spacesById}
              onToggle={onToggle}
              onJumpToBlock={onJumpToBlock}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function TaskRow({
  row,
  showDue,
  team,
  meSpaceId,
  spacesById,
  onToggle,
  onJumpToBlock,
}: {
  row: OverviewRow;
  showDue: boolean;
  team: boolean;
  meSpaceId: string | null;
  spacesById: ReadonlyMap<string, SpaceRow>;
  onToggle: (itemId: string, done: boolean) => void;
  onJumpToBlock: (blockId: string, pageId: string, spaceId: string) => void;
}) {
  const assigneeId = row.item.assigneeSpaceId;
  const isMine = team && assigneeId !== null && assigneeId === meSpaceId;
  const assignee = assigneeId !== null ? spacesById.get(assigneeId) : null;
  const who = isMine ? "ich" : assignee ? assignee.name.split(" ")[0] : "ohne Zuständigkeit";

  return (
    <Fragment key={row.item.id}>
      <li className={isMine ? styles.rowMine : undefined} data-item-id={row.item.id}>
        <button
          type="button"
          role="checkbox"
          aria-checked={row.item.done}
          aria-label={`${row.item.text || "Aufgabe"} — ${row.item.done ? "wieder öffnen" : "als erledigt markieren"}`}
          className={row.item.done ? styles.checkDone : styles.check}
          onClick={() => onToggle(row.item.id, !row.item.done)}
        >
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.body}
          onClick={() => onJumpToBlock(row.block.id, row.block.pageId, row.block.spaceId)}
        >
          <span className={styles.title}>{row.item.text}</span>
          <span className={styles.sub}>
            {team && (
              <span className={isMine ? styles.whoMine : assigneeId === null ? styles.whoOrphan : undefined}>{who}</span>
            )}
            {showDue && row.item.dueDate && <span className={styles.due}>{formatShort(row.item.dueDate)}</span>}
            {row.block.title && <span className={styles.from}>{row.block.title}</span>}
          </span>
        </button>
      </li>
      {row.notes.map((note) => (
        <li key={note.id} className={styles.childRow}>
          <span className={styles.childText}>{note.text || " "}</span>
        </li>
      ))}
    </Fragment>
  );
}

function dayLabel(isoDate: string, today: string): string {
  const diff = Math.round((fromISODate(isoDate).getTime() - fromISODate(today).getTime()) / 86_400_000);
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  const date = fromISODate(isoDate);
  return `${weekdayShort(date.getDay())}, ${date.getDate()}. ${monthName(date.getMonth()).slice(0, 3)}`;
}

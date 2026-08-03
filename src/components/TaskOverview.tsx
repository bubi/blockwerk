import { Fragment, useState } from "react";
import type { SpaceRow } from "../../shared/db.ts";
import { isOverdueTask } from "../domain/calendar.ts";
import {
  formatShort,
  fromISODate,
  monthName,
  relativeLabel,
  weekdayShort,
} from "../domain/dates.ts";
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
    view.overdue.length === 0 &&
    view.days.length === 0 &&
    view.later.length === 0 &&
    view.undated.length === 0;

  return (
    <div className={styles.today}>
      {team && (
        <div className={styles.scopebar} role="tablist" aria-label="Umfang">
          <button
            type="button"
            role="tab"
            aria-selected={scope === "team"}
            className={`label ${scope === "team" ? styles.scopeOn : undefined}`}
            onClick={() => onScopeChange("team")}
          >
            Ganzes Team
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={scope === "mine"}
            className={`label ${scope === "mine" ? styles.scopeOn : undefined}`}
            onClick={() => onScopeChange("mine")}
          >
            Nur meine
          </button>
        </div>
      )}

      {team && scope === "team" && view.workload.length > 0 && (
        <section className={styles.sec}>
          <h2 className="label">Auslastung</h2>
          <ul className={styles.loadlist}>
            {view.workload.map((entry) => (
              <li key={entry.space.id}>
                <span className="sbadge" aria-hidden="true">
                  {entry.space.short}
                </span>
                <span className={styles.loadname}>{entry.space.name}</span>
                <span className="label">{entry.open} offen</span>
                {entry.late > 0 && (
                  <span className="badge badge--warn">
                    {entry.late} überfällig
                  </span>
                )}
              </li>
            ))}
            {view.orphanOpen > 0 && (
              <li className={styles.orphan}>
                <span className="sbadge sbadge--topic" aria-hidden="true">
                  ?
                </span>
                <span className={styles.loadname}>Ohne Zuständigkeit</span>
                <span className="label">{view.orphanOpen} offen</span>
              </li>
            )}
          </ul>
        </section>
      )}

      {view.overdue.length > 0 && (
        <section className={`${styles.sec} ${styles.late}`}>
          <h2 className="label">
            Überfällig{" "}
            <span className="badge badge--warn">{view.overdue.length}</span>
          </h2>
          {team ? (
            view.overdueByPerson.map((group) => (
              <div
                key={group.person?.id ?? "orphan"}
                className={styles.lategroup}
              >
                <h3>
                  {group.person ? group.person.name : "Ohne Zuständigkeit"}{" "}
                  <span className="badge badge--warn">
                    {group.tasks.length}
                  </span>
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
                      today={today}
                      onToggle={onToggle}
                      onJumpToBlock={onJumpToBlock}
                    />
                  ))}
                </ul>
              </div>
            ))
          ) : (
            <ul className={styles.list}>
              {view.overdue.map((row) => (
                <TaskRow
                  key={row.item.id}
                  row={row}
                  showDue
                  team={team}
                  meSpaceId={meSpaceId}
                  spacesById={spacesById}
                  today={today}
                  onToggle={onToggle}
                  onJumpToBlock={onJumpToBlock}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {nothing && (
        <p className="empty">
          {team
            ? "Nichts überfällig, nichts terminiert, nichts offen."
            : `Für ${person ? person.name.split(" ")[0] : "diese Person"} ist nichts offen.`}
        </p>
      )}

      {view.days.map((day) => (
        <section key={day.date} className={styles.sec}>
          <h2 className="label">{dayLabel(day.date, today)}</h2>
          <ul className={styles.list}>
            {day.events.map((row) => (
              <li
                key={row.item.id}
                className={styles.eventRow}
                data-item-id={row.item.id}
              >
                <span className={styles.time}>{row.item.eventTime ?? "—"}</span>
                <button
                  type="button"
                  className={styles.body}
                  onClick={() =>
                    onJumpToBlock(
                      row.block.id,
                      row.block.pageId,
                      row.block.spaceId,
                    )
                  }
                >
                  <span className={styles.title}>{row.item.text}</span>
                  {row.block.title && (
                    <span className={styles.sub}>
                      <span className={styles.from}>{row.block.title}</span>
                    </span>
                  )}
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
                today={today}
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
        today={today}
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
        today={today}
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
  today,
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
  today: string;
  onToggleOpen: () => void;
  onToggle: (itemId: string, done: boolean) => void;
  onJumpToBlock: (blockId: string, pageId: string, spaceId: string) => void;
}) {
  if (rows.length === 0) return null;
  return (
    <section className={styles.sec}>
      <h2>
        <button
          type="button"
          className={`${styles.foldbtn} label`}
          onClick={onToggleOpen}
          aria-expanded={open}
        >
          {label} <em className="badge badge--quiet">{rows.length}</em>{" "}
          {open ? "▾" : "▸"}
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
              today={today}
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
  today,
  onToggle,
  onJumpToBlock,
}: {
  row: OverviewRow;
  showDue: boolean;
  team: boolean;
  meSpaceId: string | null;
  spacesById: ReadonlyMap<string, SpaceRow>;
  today: string;
  onToggle: (itemId: string, done: boolean) => void;
  onJumpToBlock: (blockId: string, pageId: string, spaceId: string) => void;
}) {
  const assigneeId = row.item.assigneeSpaceId;
  const isMine = team && assigneeId !== null && assigneeId === meSpaceId;
  const assignee = assigneeId !== null ? spacesById.get(assigneeId) : null;
  const who = isMine
    ? "ich"
    : assignee
      ? assignee.name.split(" ")[0]
      : "ohne Zuständigkeit";
  const todayDate = fromISODate(today);
  const late = row.item.dueDate !== null && isOverdueTask(row.item, today);

  return (
    <Fragment key={row.item.id}>
      <li data-item-id={row.item.id}>
        <button
          type="button"
          role="checkbox"
          aria-checked={row.item.done}
          aria-label={`${row.item.text || "Aufgabe"} — ${row.item.done ? "wieder öffnen" : "als erledigt markieren"}`}
          className={row.item.done ? "check check--done" : "check"}
          onClick={() => onToggle(row.item.id, !row.item.done)}
        >
          <span aria-hidden="true" />
        </button>
        <button
          type="button"
          className={styles.body}
          onClick={() =>
            onJumpToBlock(row.block.id, row.block.pageId, row.block.spaceId)
          }
        >
          <span className={styles.title}>{row.item.text}</span>
          <span className={styles.sub}>
            {team &&
              (isMine ? (
                <span className="badge badge--own">ich</span>
              ) : assigneeId === null ? (
                <span className={styles.whoOrphan}>ohne Zuständigkeit</span>
              ) : (
                <span className={styles.who}>{who}</span>
              ))}
            {showDue && row.item.dueDate && (
              <span className={late ? styles.dueLate : styles.due}>
                {formatShort(row.item.dueDate)} ·{" "}
                {relativeLabel(row.item.dueDate, todayDate)}
              </span>
            )}
            {row.block.title && (
              <span className={styles.from}>{row.block.title}</span>
            )}
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
  const diff = Math.round(
    (fromISODate(isoDate).getTime() - fromISODate(today).getTime()) /
      86_400_000,
  );
  if (diff === 0) return "Heute";
  if (diff === 1) return "Morgen";
  const date = fromISODate(isoDate);
  return `${weekdayShort(date.getDay())}, ${date.getDate()}. ${monthName(date.getMonth()).slice(0, 3)}`;
}

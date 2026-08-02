import type { SpaceRow } from "../../shared/db.ts";
import { isOverdueTask, ledgerRows, type LedgerDay } from "../domain/calendar.ts";
import { dayNumber, formatMonthYear, monthName, weekdayShort } from "../domain/dates.ts";
import type { ViewStatus } from "../state/state.ts";
import { formatError } from "./errorText.ts";
import { LoadError, Loading } from "./status.tsx";
import styles from "./Dates.module.css";

interface DatesProps {
  month: { year: number; month: number };
  view: ViewStatus;
  ledger: LedgerDay[];
  today: string;
  spacesById: ReadonlyMap<string, SpaceRow>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpToBlock: (blockId: string) => void;
  onRetry: () => void;
}

/**
 * The calendar column (prototype reference for the layout): days with entries
 * are sections with a full-width heading line (weekday, date, "heute" tag),
 * their entries are two-line cards. Only consciously set dates are shown —
 * task due dates and events; a block's date is automatic and never appears.
 * Consecutive empty days collapse into one gap row; a completely empty month
 * shows an empty state instead. The grouping is pure domain logic
 * (ledgerRows); this component only renders it.
 */
export function Dates(props: DatesProps) {
  const { month, view, ledger, today, spacesById, onPrevMonth, onNextMonth, onJumpToBlock, onRetry } = props;
  const load = ledger.reduce((sum, day) => sum + day.tasks.length + day.events.length, 0);

  return (
    <div className={styles.dates}>
      <div className={styles.monthbar}>
        <button type="button" className={styles.mnav} onClick={onPrevMonth} aria-label="Vorheriger Monat">
          ‹
        </button>
        <h2 className={styles.monthtitle}>{formatMonthYear(month.year, month.month)}</h2>
        <button type="button" className={styles.mnav} onClick={onNextMonth} aria-label="Nächster Monat">
          ›
        </button>
      </div>
      <p className={styles.monthmeta}>{load} datierte Einträge im Monat</p>

      {view.status === "idle" || view.status === "loading" ? (
        <Loading label="Kalender wird geladen…" />
      ) : view.status === "failed" ? (
        <LoadError message={formatError(view.error)} onRetry={onRetry} />
      ) : load === 0 ? (
        <p className={styles.empty}>Keine Termine oder Fälligkeiten in diesem Monat.</p>
      ) : (
        <div className={styles.ledger}>
          {ledgerRows(ledger).map((row) =>
            row.type === "gap" ? (
              <div key={`gap-${row.from}`} className={styles.gap}>
                <span>{row.count === 1 ? "ein Tag ohne Einträge" : `${row.count} Tage ohne Einträge`}</span>
              </div>
            ) : (
              <DayBlock
                key={row.day.date}
                day={row.day}
                today={today}
                spacesById={spacesById}
                onJumpToBlock={onJumpToBlock}
              />
            ),
          )}
        </div>
      )}
    </div>
  );
}

function DayBlock({
  day,
  today,
  spacesById,
  onJumpToBlock,
}: {
  day: LedgerDay;
  today: string;
  spacesById: ReadonlyMap<string, SpaceRow>;
  onJumpToBlock: (blockId: string) => void;
}) {
  const isToday = day.date === today;
  const monthAbbrev = monthName(Number(day.date.slice(5, 7)) - 1).slice(0, 3);

  return (
    <section className={`${styles.dayblock} ${isToday ? styles.isToday : ""}`}>
      <header className={styles.dayhead}>
        <span className={styles.dwd}>{weekdayShort(day.weekday)}</span>
        <span className={styles.dnum}>
          {dayNumber(day.date)}. {monthAbbrev}
        </span>
        {isToday && <span className={styles.todaytag}>heute</span>}
      </header>

      {day.events.map((event) => (
        <button
          key={event.id}
          type="button"
          className={`${styles.card} ${styles.cardEvent}`}
          onClick={() => onJumpToBlock(event.blockId)}
        >
          <span className={styles.cardtitle}>{event.text}</span>
          <span className={styles.cardmeta}>
            <span className={styles.cardkind}>Termin</span>
            {event.eventTime && <span className={styles.cardtime}>{event.eventTime}</span>}
          </span>
        </button>
      ))}

      {day.tasks.map((task) => {
        const late = isOverdueTask(task, today);
        return (
          <button
            key={task.id}
            type="button"
            className={`${styles.card} ${styles.cardTask} ${task.done ? styles.isDone : ""} ${late ? styles.isLate : ""}`}
            onClick={() => onJumpToBlock(task.blockId)}
          >
            <span className={styles.cardtitle}>{task.text}</span>
            <span className={styles.cardmeta}>
              <span className={styles.cardkind}>{task.done ? "erledigt" : late ? "überfällig" : "fällig"}</span>
              {task.assigneeSpaceId && (
                <span className={styles.cardwho}>{spacesById.get(task.assigneeSpaceId)?.name.split(" ")[0]}</span>
              )}
            </span>
          </button>
        );
      })}
    </section>
  );
}

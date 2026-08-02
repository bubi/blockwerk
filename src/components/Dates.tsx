import type { SpaceRow } from "../../shared/db.ts";
import type { ItemPatch } from "../../shared/schemas.ts";
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
  onReschedule: (itemId: string, patch: ItemPatch) => void;
  onRetry: () => void;
}

/**
 * The calendar column (prototype reference for the layout): days with entries
 * are sections with a full-width heading line (weekday, date, "heute" tag),
 * their entries are two-line cards. Only consciously set dates are shown —
 * task due dates and events; a block's date is automatic and never appears.
 * The date on a card is a date field: clicking it opens the browser date
 * picker and re-schedules the item (due date for tasks, event date for
 * events). Consecutive empty days collapse into one gap row; a completely
 * empty month shows an empty state instead. The grouping is pure domain
 * logic (ledgerRows); this component only renders it.
 */
export function Dates(props: DatesProps) {
  const { month, view, ledger, today, spacesById, onPrevMonth, onNextMonth, onJumpToBlock, onReschedule, onRetry } = props;
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
                onReschedule={onReschedule}
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
  onReschedule,
}: {
  day: LedgerDay;
  today: string;
  spacesById: ReadonlyMap<string, SpaceRow>;
  onJumpToBlock: (blockId: string) => void;
  onReschedule: (itemId: string, patch: ItemPatch) => void;
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
        <div key={event.id} className={`${styles.card} ${styles.cardEvent}`}>
          <button type="button" className={styles.cardtitle} onClick={() => onJumpToBlock(event.blockId)}>
            {event.text}
          </button>
          <span className={styles.cardmeta}>
            <DateField
              value={event.eventDate ?? ""}
              label="Neues Termindatum wählen"
              onChange={(value) => onReschedule(event.id, { eventDate: value })}
            />
            <span className={styles.cardkind}>Termin</span>
            {event.eventTime && <span className={styles.cardtime}>{event.eventTime}</span>}
          </span>
        </div>
      ))}

      {day.tasks.map((task) => {
        const late = isOverdueTask(task, today);
        return (
          <div
            key={task.id}
            className={`${styles.card} ${styles.cardTask} ${task.done ? styles.isDone : ""} ${late ? styles.isLate : ""}`}
          >
            <button type="button" className={styles.cardtitle} onClick={() => onJumpToBlock(task.blockId)}>
              {task.text}
            </button>
            <span className={styles.cardmeta}>
              <DateField
                value={task.dueDate ?? ""}
                label="Neues Fälligkeitsdatum wählen"
                onChange={(value) => onReschedule(task.id, { dueDate: value })}
              />
              <span className={styles.cardkind}>{task.done ? "erledigt" : late ? "überfällig" : "fällig"}</span>
              {task.assigneeSpaceId && (
                <span className={styles.cardwho}>{spacesById.get(task.assigneeSpaceId)?.name.split(" ")[0]}</span>
              )}
            </span>
          </div>
        );
      })}
    </section>
  );
}

/**
 * A card's date control: a native date field whose value is the item's date.
 * Clicking it opens the browser's date picker; picking a date re-schedules
 * the item via onReschedule. Clearing the field is ignored (value stays), so
 * an accidental clear can never wipe a date.
 */
function DateField({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.datefield}>
      <span className="sr-only">{label}</span>
      <input type="date" value={value} onChange={(event) => event.target.value && onChange(event.target.value)} />
    </label>
  );
}

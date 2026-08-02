import type { SpaceRow, TemplateRow } from "../../shared/db.ts";
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
  templatesById: ReadonlyMap<string, TemplateRow>;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onJumpToBlock: (blockId: string) => void;
  onRetry: () => void;
}

/**
 * The calendar column (prototype reference): days with entries are sections
 * with a full-width heading line (weekday, date, "heute" tag), their entries
 * are two-line cards. Consecutive empty days collapse into one gap row. The
 * grouping is pure domain logic (ledgerRows); this component only renders it.
 */
export function Dates(props: DatesProps) {
  const { month, view, ledger, today, spacesById, templatesById, onPrevMonth, onNextMonth, onJumpToBlock, onRetry } = props;
  const load = ledger.reduce((sum, day) => sum + day.blocks.length + day.tasks.length + day.events.length, 0);

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
                templatesById={templatesById}
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
  templatesById,
  onJumpToBlock,
}: {
  day: LedgerDay;
  today: string;
  spacesById: ReadonlyMap<string, SpaceRow>;
  templatesById: ReadonlyMap<string, TemplateRow>;
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

      {day.blocks.map((block) => {
        const template = templatesById.get(block.templateId ?? "");
        return (
          <button
            key={block.id}
            type="button"
            className={`${styles.card} hue-${template?.hue ?? "ink"}`}
            onClick={() => onJumpToBlock(block.id)}
          >
            <span className={styles.cardtitle}>{block.title}</span>
            <span className={styles.cardmeta}>
              <span className={styles.cardkind}>{template?.label ?? "Block"}</span>
            </span>
          </button>
        );
      })}
    </section>
  );
}

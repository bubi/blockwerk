import type { SpaceRow, TemplateRow } from "../../shared/db.ts";
import type { LedgerDay } from "../domain/calendar.ts";
import { dayNumber, formatMonthYear, weekdayShort } from "../domain/dates.ts";
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

export function Dates(props: DatesProps) {
  const { month, view, ledger, today, spacesById, templatesById, onPrevMonth, onNextMonth, onJumpToBlock, onRetry } = props;
  const load = ledger.reduce((sum, day) => sum + day.blocks.length + day.tasks.length + day.events.length, 0);

  return (
    <div className={styles.dates}>
      <div className={styles.monthbar}>
        <button type="button" className={styles.mnav} onClick={onPrevMonth} aria-label="Vorheriger Monat">
          ‹
        </button>
        <h2 className={styles.monthtitle}>
          {formatMonthYear(month.year, month.month)}
        </h2>
        <button type="button" className={styles.mnav} onClick={onNextMonth} aria-label="Nächster Monat">
          ›
        </button>
      </div>
      <p className={styles.monthmeta}>{load} datierte Einträge</p>

      {view.status === "idle" || view.status === "loading" ? (
        <Loading label="Kalender wird geladen…" />
      ) : view.status === "failed" ? (
        <LoadError message={formatError(view.error)} onRetry={onRetry} />
      ) : (
        <div className={styles.ledger}>
          {ledger.map((day) => {
            const dayLoad = day.blocks.length + day.tasks.length + day.events.length;
            const isToday = day.date === today;
            const weekend = day.weekday === 0 || day.weekday === 6;
            const dayClass = [
              styles.day,
              dayLoad ? styles.dayFull : styles.dayThin,
              isToday ? styles.dayToday : "",
              weekend ? styles.dayWe : "",
            ]
              .filter(Boolean)
              .join(" ");
            return (
              <div key={day.date} className={dayClass}>
                <div className={styles.daymark}>
                  <span className={styles.dnum}>{dayNumber(day.date)}</span>
                  <span className={styles.dwd}>{weekdayShort(day.weekday)}</span>
                </div>
                <div className={styles.dayload}>
                  {day.events.map((event) => (
                    <button
                      key={event.id}
                      type="button"
                      className={`${styles.chip} ${styles.chipEvent}`}
                      onClick={() => onJumpToBlock(event.blockId)}
                    >
                      <span className={styles.chiptime}>{event.eventTime ?? "—"}</span>
                      {event.text}
                    </button>
                  ))}
                  {day.tasks.map((task) => (
                    <button
                      key={task.id}
                      type="button"
                      className={`${styles.chip} ${styles.chipTask} ${task.done ? styles.chipDone : ""}`}
                      onClick={() => onJumpToBlock(task.blockId)}
                    >
                      <span className={styles.chiptime}>{task.done ? "erledigt" : "fällig"}</span>
                      {task.text}
                      {task.assigneeSpaceId && <em className={styles.who}>{spacesById.get(task.assigneeSpaceId)?.short}</em>}
                    </button>
                  ))}
                  {day.blocks.map((block) => (
                    <button
                      key={block.id}
                      type="button"
                      className={`${styles.chip} ${styles.chipBlock} hue-${templatesById.get(block.templateId ?? "")?.hue ?? "ink"}`}
                      onClick={() => onJumpToBlock(block.id)}
                    >
                      <span className={styles.chiptime}>{templatesById.get(block.templateId ?? "")?.label ?? "Block"}</span>
                      {block.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

import type { SpaceRow } from "../../shared/db.ts";
import { fromISODate, monthName } from "../domain/dates.ts";
import type { TaskOverviewView } from "../domain/overview.ts";
import type { TodayScope } from "../domain/preferences.ts";
import type { ViewStatus } from "../state/state.ts";
import { formatError } from "./errorText.ts";
import { LoadError, Loading } from "./status.tsx";
import { TaskOverview } from "./TaskOverview.tsx";
import styles from "./Today.module.css";

const WEEKDAYS_LONG = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

/**
 * The desktop "Heute" entry: the Tageskopf (design-system 5) above the team
 * overview, with its own load states. Same component and data as the
 * person-mode view — the sectioning lives in /src/domain (docs/adr/0011).
 */
export function Today({
  viewStatus,
  taskView,
  today,
  scope,
  meSpaceId,
  spacesById,
  doneWeek,
  showHead = true,
  onScopeChange,
  onToggle,
  onJumpToBlock,
  onRetry,
}: {
  viewStatus: ViewStatus;
  taskView: TaskOverviewView | null;
  today: string;
  scope: TodayScope;
  meSpaceId: string | null;
  spacesById: ReadonlyMap<string, SpaceRow>;
  /** Tasks checked off this session within seven days (see App). */
  doneWeek: number;
  /** The mobile header already carries the "Heute" title. */
  showHead?: boolean;
  onScopeChange: (scope: TodayScope) => void;
  onToggle: (itemId: string, done: boolean) => void;
  onJumpToBlock: (blockId: string, pageId: string, spaceId: string) => void;
  onRetry: () => void;
}) {
  return (
    <div className={styles.today}>
      {showHead && taskView && (
        <DayHead today={today} view={taskView} doneWeek={doneWeek} />
      )}

      {viewStatus.status === "idle" || viewStatus.status === "loading" ? (
        <Loading label="Überblick wird geladen…" />
      ) : viewStatus.status === "failed" ? (
        <LoadError message={formatError(viewStatus.error)} onRetry={onRetry} />
      ) : taskView ? (
        <TaskOverview
          mode="team"
          person={null}
          view={taskView}
          today={today}
          scope={scope}
          meSpaceId={meSpaceId}
          spacesById={spacesById}
          onScopeChange={onScopeChange}
          onToggle={onToggle}
          onJumpToBlock={onJumpToBlock}
        />
      ) : null}
    </div>
  );
}

/**
 * The Tageskopf (design-system 5): weekday big, the full date beside it, and
 * four readings that answer the stand at a glance. The number carries the
 * meaning color; the label stays a neutral Etikett.
 */
function DayHead({
  today,
  view,
  doneWeek,
}: {
  today: string;
  view: TaskOverviewView;
  doneWeek: number;
}) {
  const date = fromISODate(today);
  const todayDay = view.days.find((day) => day.date === today) ?? null;
  const readings = [
    {
      n: view.overdue.length,
      label: "überfällig",
      tone: view.overdue.length > 0 ? styles.alarm : undefined,
    },
    { n: todayDay?.tasks.length ?? 0, label: "heute fällig", tone: styles.now },
    {
      n: todayDay?.events.length ?? 0,
      label: "Termine heute",
      tone: styles.time,
    },
    { n: doneWeek, label: "erledigt, 7 Tage", tone: undefined },
  ];

  return (
    <section className={styles.hero}>
      <p className={`${styles.eyebrow} label label--muted`}>Arbeitsstand</p>
      <h1 className={styles.herodate}>
        <span className={styles.heroday}>{WEEKDAYS_LONG[date.getDay()]}</span>
        <span className={styles.herofull}>
          {date.getDate()}. {monthName(date.getMonth())} {date.getFullYear()}
        </span>
      </h1>
      <div className={styles.herostats}>
        {readings.map((reading) => (
          <div
            key={reading.label}
            className={`${styles.stat} ${reading.tone ?? ""}`}
          >
            <span className={styles.statnum}>{reading.n}</span>
            <span className="label">{reading.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

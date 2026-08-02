import type { SpaceRow } from "../../shared/db.ts";
import type { TaskOverviewView } from "../domain/overview.ts";
import type { TodayScope } from "../domain/preferences.ts";
import type { ViewStatus } from "../state/state.ts";
import { formatError } from "./errorText.ts";
import { LoadError, Loading } from "./status.tsx";
import { TaskOverview } from "./TaskOverview.tsx";
import styles from "./Today.module.css";

/**
 * The desktop "Heute" entry: the team overview as the start view, with its
 * own head and load states. Same component and data as the person-mode view —
 * the sectioning lives in /src/domain (docs/adr/0011).
 */
export function Today({
  viewStatus,
  taskView,
  today,
  scope,
  meSpaceId,
  spacesById,
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
  /** The mobile header already carries the "Heute" title. */
  showHead?: boolean;
  onScopeChange: (scope: TodayScope) => void;
  onToggle: (itemId: string, done: boolean) => void;
  onJumpToBlock: (blockId: string, pageId: string, spaceId: string) => void;
  onRetry: () => void;
}) {
  return (
    <div className={styles.today}>
      {showHead && (
        <div className={styles.head}>
          <strong>Heute</strong>
        </div>
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

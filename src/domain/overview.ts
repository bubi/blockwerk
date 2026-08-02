import type { ItemRow, SpaceRow } from "../../shared/db.ts";
import { isOverdueTask } from "./calendar.ts";
import { addDays, fromISODate, toISODate } from "./dates.ts";

/**
 * The task overview — the single definition of how open tasks and the next
 * days' events are sectioned and ordered. One function, two modes: the team
 * view ("Heute") and a person's assigned-tasks view (which replaced the
 * mirror, docs/adr/0011). Grouping rules (overdue by person, workload per
 * person) live here, never in a component. The worker loads raw rows and the
 * client selector assembles OverviewRows; both project with this module.
 */

/** The overview covers today plus the following 7 days (8 days in total). */
export const OVERVIEW_WINDOW_DAYS = 8;

/** A task or event with just enough block context for a result row. */
export interface OverviewRow {
  item: ItemRow;
  block: {
    id: string;
    pageId: string;
    spaceId: string;
    title: string;
    date: string;
  };
  /**
   * The task's own notes (docs/adr/0014), position-sorted — the reason the
   * overview shows them without a jump into the block. Empty for events and
   * for tasks without notes.
   */
  notes: ItemRow[];
}

export interface OverviewDay {
  /** 'YYYY-MM-DD'. */
  date: string;
  tasks: OverviewRow[];
  events: OverviewRow[];
}

export interface PersonWorkload {
  space: SpaceRow;
  open: number;
  late: number;
}

export interface OverdueGroup {
  /** null for tasks without an assignee ("Ohne Zuständigkeit"). */
  person: SpaceRow | null;
  tasks: OverviewRow[];
}

export interface TaskOverviewView {
  /** Overdue tasks, due date ascending. */
  overdue: OverviewRow[];
  /** The same overdue tasks grouped by assignee, for the team view. */
  overdueByPerson: OverdueGroup[];
  /** The next 8 days with content; a day lists its events before its tasks. */
  days: OverviewDay[];
  /** Tasks due after the window, due date ascending. */
  later: OverviewRow[];
  /** Open tasks without a due date, stable order. */
  undated: OverviewRow[];
  /** Open and overdue counts per person space, name order. */
  workload: PersonWorkload[];
  /** Open tasks with `assignee_space_id` NULL. */
  orphanOpen: number;
}

/** Whether an ISO date falls inside the overview window ([today, today+7]). */
export function inOverviewWindow(isoDate: string, today: string): boolean {
  const lastDay = toISODate(addDays(fromISODate(today), OVERVIEW_WINDOW_DAYS - 1));
  return isoDate >= today && isoDate <= lastDay;
}

/** The rows whose task is assigned to `assignee` — a person's view. */
export function rowsForPerson(tasks: readonly OverviewRow[], assignee: string): OverviewRow[] {
  return tasks.filter((row) => row.item.assigneeSpaceId === assignee);
}

/**
 * Sections open tasks and window events. `tasks` is what the sections show
 * (already filtered to a person or the "mine" scope); `allTasks` is the full
 * set and the single source for the workload, so the Auslastung is derived in
 * one in-memory pass — never by a per-person query. Events are only shown in
 * the team view (person mode passes an empty list).
 */
export function buildTaskOverview(
  tasks: readonly OverviewRow[],
  allTasks: readonly OverviewRow[],
  events: readonly OverviewRow[],
  spaces: readonly SpaceRow[],
  today: string,
): TaskOverviewView {
  const horizon = toISODate(addDays(fromISODate(today), OVERVIEW_WINDOW_DAYS - 1));
  const byDue = (a: OverviewRow, b: OverviewRow): number =>
    (a.item.dueDate ?? "").localeCompare(b.item.dueDate ?? "") || a.item.id.localeCompare(b.item.id);
  const byId = (a: OverviewRow, b: OverviewRow): number => a.item.id.localeCompare(b.item.id);

  const overdue = tasks.filter((row) => isOverdueTask(row.item, today)).sort(byDue);
  const later = tasks.filter((row) => row.item.dueDate !== null && row.item.dueDate > horizon).sort(byDue);
  const undated = tasks.filter((row) => row.item.dueDate === null).sort(byId);

  const days: OverviewDay[] = [];
  for (let offset = 0; offset < OVERVIEW_WINDOW_DAYS; offset++) {
    const date = toISODate(addDays(fromISODate(today), offset));
    const dayTasks = tasks.filter((row) => row.item.dueDate === date).sort(byId);
    const dayEvents = events
      .filter((row) => row.item.eventDate === date)
      .sort((a, b) => (a.item.eventTime ?? "").localeCompare(b.item.eventTime ?? "") || a.item.id.localeCompare(b.item.id));
    if (dayTasks.length > 0 || dayEvents.length > 0) days.push({ date, tasks: dayTasks, events: dayEvents });
  }

  const people = spaces.filter((space) => space.kind === "person");
  const workload = people
    .map((space) => {
      const mine = allTasks.filter((row) => row.item.assigneeSpaceId === space.id);
      return {
        space,
        open: mine.length,
        late: mine.filter((row) => isOverdueTask(row.item, today)).length,
      };
    })
    .filter((entry) => entry.open > 0)
    .sort((a, b) => a.space.name.localeCompare(b.space.name));

  const orphanOpen = allTasks.filter((row) => row.item.assigneeSpaceId === null).length;

  const groups: OverdueGroup[] = [];
  const byAssignee = new Map<string, OverdueGroup>();
  for (const row of overdue) {
    const key = row.item.assigneeSpaceId ?? "";
    let group = byAssignee.get(key);
    if (!group) {
      const person =
        row.item.assigneeSpaceId !== null
          ? (people.find((p) => p.id === row.item.assigneeSpaceId) ?? null)
          : null;
      group = { person, tasks: [] };
      byAssignee.set(key, group);
      groups.push(group);
    }
    group.tasks.push(row);
  }
  groups.sort((a, b) => {
    if (a.person === null && b.person === null) return 0;
    if (a.person === null) return 1;
    if (b.person === null) return -1;
    return a.person.name.localeCompare(b.person.name);
  });

  return { overdue, overdueByPerson: groups, days, later, undated, workload, orphanOpen };
}

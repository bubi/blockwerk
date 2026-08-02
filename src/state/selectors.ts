import type { ApiBlock, SpaceWithPages } from "../../shared/api.ts";
import type { CalendarWindow, ItemRow, TemplateRow } from "../../shared/db.ts";
import { buildBlockView, type BlockSection } from "../domain/blockView.ts";
import { projectCalendar } from "../domain/calendar.ts";
import { orderBlockItems, orderPageBlocks } from "../domain/order.ts";
import {
  buildTaskOverview,
  inOverviewWindow,
  rowsForPerson,
  type OverviewRow,
  type TaskOverviewView,
} from "../domain/overview.ts";
import type { TodayScope } from "../domain/preferences.ts";
import type { AppState, SearchView, ViewStatus } from "./state.ts";

/**
 * Derived views over the normalized state. Views are assembled here at read
 * time and never stored — a task row in `items` is referenced by every view
 * that shows it. Ordering and grouping rules come from /src/domain
 * (orderBlockItems, orderPageBlocks, buildBlockView, buildTaskOverview,
 * projectCalendar); this module only selects and delegates.
 */

/** A page block with its display model pre-built by /src/domain. */
export interface BlockView extends ApiBlock {
  sections: BlockSection;
}

export function selectSpaces(state: AppState): SpaceWithPages[] {
  return [...state.spaces.values()]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((space) => ({
      ...space,
      pages: [...state.pages.values()]
        .filter((page) => page.spaceId === space.id)
        .sort((a, b) => a.id.localeCompare(b.id)),
    }));
}

export function selectTemplates(state: AppState): TemplateRow[] {
  return [...state.templates.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function selectPageBlocks(state: AppState, pageId: string): BlockView[] {
  return orderPageBlocks([...state.blocks.values()].filter((block) => block.pageId === pageId)).map((block) => ({
    ...block,
    items: orderBlockItems([...state.items.values()].filter((item) => item.blockId === block.id)),
    sections: buildBlockView([...state.items.values()].filter((item) => item.blockId === block.id)),
  }));
}

export function selectCalendar(state: AppState, from: string, to: string): CalendarWindow {
  return projectCalendar([...state.items.values()], from, to);
}

export function selectSpacesView(state: AppState): ViewStatus {
  return state.spacesView;
}

export function selectPageView(state: AppState, pageId: string): ViewStatus {
  return state.pageViews.get(pageId) ?? { status: "idle" };
}

export function selectCalendarView(state: AppState): ViewStatus {
  return state.calendarView;
}

export function selectOverviewView(state: AppState): ViewStatus {
  return state.overviewView;
}

export function selectSearch(state: AppState): SearchView {
  return state.search;
}

/**
 * Which space is "me" — resolved server-side from the Access email against
 * the person spaces' email field (docs/adr/0013). Null when no person space
 * carries the caller's email; the app keeps working, the scope filter and
 * own-row highlighting just stay neutral.
 */
export function selectMeSpaceId(state: AppState): string | null {
  return state.meSpaceId;
}

/** The team view ("Heute"): every open task, optionally scoped to "mine". */
export function selectTeamOverview(
  state: AppState,
  today: string,
  scope: TodayScope,
  meSpaceId: string | null,
  spaces: readonly SpaceWithPages[],
): TaskOverviewView {
  const allTasks = openTaskRows(state);
  // "Nur meine" without a known identity shows nothing — never everything
  // and never someone else's tasks. Identity lands in PR 3.
  const mine =
    scope === "mine"
      ? meSpaceId !== null
        ? allTasks.filter((row) => row.item.assigneeSpaceId === meSpaceId)
        : []
      : allTasks;
  return buildTaskOverview(mine, allTasks, eventRows(state, today), spaces, today);
}

/** A person's assigned-tasks view (replaces the mirror): their tasks only. */
export function selectPersonOverview(
  state: AppState,
  today: string,
  personId: string,
  spaces: readonly SpaceWithPages[],
): TaskOverviewView {
  const allTasks = openTaskRows(state);
  return buildTaskOverview(rowsForPerson(allTasks, personId), allTasks, [], spaces, today);
}

/** The open task count of a person — the "Zugewiesen" tab badge. */
export function selectPersonOpenCount(state: AppState, personId: string): number {
  let count = 0;
  for (const item of state.items.values()) {
    if (item.kind === "task" && !item.done && item.assigneeSpaceId === personId) count++;
  }
  return count;
}

/** Open-task counts per space, for the sidebar badges. */
export function selectOpenTaskCounts(state: AppState): Map<string, number> {
  const counts = new Map<string, number>();
  for (const item of state.items.values()) {
    if (item.kind !== "task" || item.done || item.assigneeSpaceId === null) continue;
    counts.set(item.assigneeSpaceId, (counts.get(item.assigneeSpaceId) ?? 0) + 1);
  }
  return counts;
}

function openTaskRows(state: AppState): OverviewRow[] {
  const rows: OverviewRow[] = [];
  for (const item of state.items.values()) {
    if (item.kind !== "task" || item.done) continue;
    const row = toOverviewRow(state, item);
    if (row) rows.push(row);
  }
  return rows;
}

function eventRows(state: AppState, today: string): OverviewRow[] {
  const rows: OverviewRow[] = [];
  for (const item of state.items.values()) {
    if (item.kind !== "event" || item.eventDate === null || !inOverviewWindow(item.eventDate, today)) continue;
    const row = toOverviewRow(state, item);
    if (row) rows.push(row);
  }
  return rows;
}

function toOverviewRow(state: AppState, item: ItemRow): OverviewRow | null {
  const block = state.blocks.get(item.blockId);
  if (!block) return null;
  const page = state.pages.get(block.pageId);
  return {
    item,
    block: { id: block.id, pageId: block.pageId, spaceId: page?.spaceId ?? "", title: block.title, date: block.date },
  };
}

import type { ApiBlock, MirrorTask, SpaceWithPages } from "../../shared/api.ts";
import type { BlockRow, CalendarWindow, ItemRow, TemplateRow } from "../../shared/db.ts";
import { buildBlockView, type BlockSection } from "../domain/blockView.ts";
import { projectCalendar } from "../domain/calendar.ts";
import { groupMirrorTasks, type MirrorGroup } from "../domain/mirror.ts";
import { orderBlockItems, orderPageBlocks } from "../domain/order.ts";
import type { AppState, SearchView, ViewStatus } from "./state.ts";

/**
 * Derived views over the normalized state. Views are assembled here at read
 * time and never stored — a task row in `items` is referenced by every view
 * that shows it. Ordering and grouping rules come from /src/domain
 * (orderBlockItems, orderPageBlocks, buildBlockView, groupMirrorTasks,
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

export function selectMirror(state: AppState, spaceId: string): MirrorTask[] {
  const order = state.mirrorOrder.get(spaceId) ?? [];
  const tasks: MirrorTask[] = [];
  for (const id of order) {
    const item = state.items.get(id);
    if (!item) continue;
    if (item.done || item.assigneeSpaceId !== spaceId) continue;
    tasks.push({ item, block: blockContext(state, item) });
  }
  return tasks;
}

export function selectMirrorGroups(state: AppState, spaceId: string): MirrorGroup[] {
  return groupMirrorTasks(selectMirror(state, spaceId));
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

export function selectMirrorView(state: AppState, spaceId: string): ViewStatus {
  return state.mirrorViews.get(spaceId) ?? { status: "idle" };
}

export function selectCalendarView(state: AppState): ViewStatus {
  return state.calendarView;
}

export function selectSearch(state: AppState): SearchView {
  return state.search;
}

function blockContext(state: AppState, item: ItemRow): Pick<BlockRow, "id" | "pageId" | "title" | "date"> {
  const block = state.blocks.get(item.blockId);
  return block ?? { id: item.blockId, pageId: "", title: "", date: "" };
}

export type SpaceKind = "person" | "topic";

export interface SpaceRow {
  id: string;
  name: string;
  kind: SpaceKind;
  short: string;
  /** The Access email a person space stands for (docs/adr/0013); topics are null. */
  email: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface PageRow {
  id: string;
  spaceId: string;
  title: string;
  createdAt: number;
  updatedAt: number;
}

export interface TemplateRow {
  id: string;
  label: string;
  hue: string;
  /** Lines used to seed a new block's notes, in order. */
  seed: string[];
  createdAt: number;
  updatedAt: number;
}

export interface BlockRow {
  id: string;
  pageId: string;
  templateId: string | null;
  title: string;
  /** 'YYYY-MM-DD' */
  date: string;
  createdAt: number;
  updatedAt: number;
}

export type ItemKind = "note" | "task" | "event" | "ref";
export interface ItemRow {
  id: string;
  blockId: string;
  kind: ItemKind;
  position: number;
  text: string;
  /** Set only when kind is "note". */
  heading: 1 | 2 | null;
  /** Set only when kind is "task". */
  done: boolean;
  /** 'YYYY-MM-DD'. Set only when kind is "task". */
  dueDate: string | null;
  /** Set only when kind is "task". */
  assigneeSpaceId: string | null;
  /** 'YYYY-MM-DD'. Set only when kind is "event". */
  eventDate: string | null;
  /** 'HH:MM'. Set only when kind is "event". */
  eventTime: string | null;
  /** Set only when kind is "ref". */
  refBlockId: string | null;
  /**
   * The task this note belongs to (docs/adr/0014). Set only when kind is
   * "note"; the parent must be a task, and a child note is never itself a
   * parent. One level only — no task-under-task tree.
   */
  parentItemId: string | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * The calendar window — only the consciously dated objects: task due dates
 * and events. A block's date is assigned automatically when the block is
 * created; it orders the stream and feeds search, but is not a statement
 * about time, so blocks never appear here. Built by /src/domain and used by
 * the worker's calendar route.
 */
export interface CalendarWindow {
  dueTasks: ItemRow[];
  events: ItemRow[];
}

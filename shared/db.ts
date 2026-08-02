export type SpaceKind = "person" | "topic";

export interface SpaceRow {
  id: string;
  name: string;
  kind: SpaceKind;
  short: string;
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
  createdAt: number;
  updatedAt: number;
}

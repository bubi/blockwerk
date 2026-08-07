/**
 * What is selected in a space's sub-list: a real page, or one of the virtual
 * entries that carry no page row — "Aufgaben" (a person's assigned-tasks
 * view, ADR 0011, renamed from "Zugewiesen") and "Jour Fix" (a placeholder
 * entry without data, ADR 0015).
 */
export type PageSelection = string | "tasks" | "jourfix";

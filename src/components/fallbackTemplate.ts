import type { TemplateRow } from "../../shared/db.ts";

/** Shown when a block has no template (template deleted or never assigned). */
export const FALLBACK_TEMPLATE: TemplateRow = {
  id: "?",
  label: "Ohne Template",
  hue: "ink",
  seed: [],
  createdAt: 0,
  updatedAt: 0,
};

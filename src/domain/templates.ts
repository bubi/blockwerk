/**
 * The palette a template can take. `hue` is stored as the key and mapped to
 * a CSS class (`hue-<key>`) — one definition shared by the template manager
 * and the block menu.
 */
export interface TemplateHue {
  key: string;
  name: string;
}

export const TEMPLATE_HUES: TemplateHue[] = [
  { key: "steel", name: "Blau" },
  { key: "moss", name: "Grün" },
  { key: "plum", name: "Violett" },
  { key: "amber", name: "Orange" },
  { key: "ink", name: "Grau" },
];

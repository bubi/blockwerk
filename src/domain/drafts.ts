import { COMPOSER_COMMANDS, type ComposerCommandKey } from "./composer.ts";

export interface ComposerDraft { value: string; mode: ComposerCommandKey | null; mentionId: string | null; refTarget: string }
interface DraftStorage { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }
const storage = () => (globalThis as { localStorage?: DraftStorage }).localStorage;
const key = (id: string) => `blockwerk:draft:${id}`;
export function readDraft(id: string): ComposerDraft | null {
  try {
    const raw: unknown = JSON.parse(storage()?.getItem(key(id)) ?? "null");
    if (!raw || typeof raw !== "object" || !("value" in raw) || typeof raw.value !== "string") return null;
    const draft = raw as Partial<ComposerDraft>;
    return { value: raw.value, mode: COMPOSER_COMMANDS.some(command => command.key === draft.mode) ? draft.mode! : null, mentionId: typeof draft.mentionId === "string" ? draft.mentionId : null, refTarget: typeof draft.refTarget === "string" ? draft.refTarget : "" };
  } catch { return null; }
}
export function writeDraft(id: string, draft: ComposerDraft) {
  try {
    if (!draft.value && !draft.refTarget) storage()?.removeItem(key(id));
    else storage()?.setItem(key(id), JSON.stringify(draft));
  } catch { /* Storage may be disabled; the in-memory draft remains usable. */ }
}

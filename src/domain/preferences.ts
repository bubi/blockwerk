/**
 * Client-side preferences — small, pure reads/writes over an injectable
 * storage. The task overview's scope toggle ("Ganzes Team" / "Nur meine") is
 * a display preference, not a domain fact, so it lives on the device
 * (localStorage) rather than in the API — see docs/adr/0011.
 */

export type TodayScope = "team" | "mine";

const SCOPE_KEY = "blockwerk.todayScope";

interface ScopeStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Default storage; undefined outside a real browser (tests inject a stub). */
function defaultStorage(): ScopeStorage | undefined {
  const storage = (globalThis as { localStorage?: unknown }).localStorage;
  return typeof storage === "object" && storage !== null && typeof (storage as ScopeStorage).getItem === "function"
    ? (storage as ScopeStorage)
    : undefined;
}

/** The stored scope, defaulting to "team"; anything else is treated as "team". */
export function readScope(storage: ScopeStorage | undefined = defaultStorage()): TodayScope {
  return storage?.getItem(SCOPE_KEY) === "mine" ? "mine" : "team";
}

export function writeScope(scope: TodayScope, storage: ScopeStorage | undefined = defaultStorage()): void {
  storage?.setItem(SCOPE_KEY, scope);
}

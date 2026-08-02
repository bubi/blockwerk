import type { ClientError } from "../state/state.ts";

/** Human-readable German text for a classified client error. */
export function formatError(error: ClientError): string {
  if (error.kind === "network") return `Verbindung fehlgeschlagen — bitte erneut versuchen. (${error.message})`;
  if (error.kind === "http") {
    return error.body?.error.message ?? `Serverfehler (${error.status}).`;
  }
  return "Unerwarteter Fehler beim Laden.";
}

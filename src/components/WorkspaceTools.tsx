export function WorkspaceTools({ pending, failed, undoLabel, onUndo, onCapture }: {
  pending: number; failed: number; undoLabel?: string;
  onUndo: () => void; onCapture: () => void;
}) {
  return <div className="workspace-tools">
    <button type="button" className="primary-action" onClick={onCapture}>Erfassen</button>
    <span role="status" aria-live="polite" className={failed ? "save-status save-status--failed" : "save-status"}>{pending ? "Wird gespeichert…" : failed ? "Ungespeicherte Änderungen – Entwürfe bleiben erhalten" : "Alles gespeichert"}</span>
    {undoLabel && <button type="button" onClick={onUndo} title={`Rückgängig: ${undoLabel}`}>Rückgängig</button>}
    <details className="keyboard-help"><summary>Tastaturhilfe</summary><div>
      <p><strong>Erfassen:</strong> Alt+N · <strong>Suche:</strong> Cmd/Ctrl+K</p>
      <p>Im Eingabefeld: / für Befehle, @ für Personen, !morgen oder !2026-10-20 für Datum. Enter fügt hinzu; Entwürfe bleiben bei Fehlern erhalten.</p>
      <p>In bestehenden Notizen: Enter fügt darunter eine Zeile ein. In Listen fügt Enter einen Punkt im selben Eintrag hinzu; Enter auf einem leeren Punkt beendet die Liste.</p>
      <p>Escape wechselt vom Feld zur Zeile. Dort wählen ↑/↓ Nachbarzeilen, Leertaste hakt Aufgaben ab und Enter öffnet das Feld. Shift+↑/↓ markiert Notizen zum Zusammenfassen.</p>
      <p>Backspace in einer leeren Notiz entfernt zuerst Überschrift/Listenmarker, danach die Zeile. Im Zeilenmodus entfernt Delete/Backspace die Zeile. Rückgängig ist außerhalb von Textfeldern auch mit Cmd/Ctrl+Z erreichbar.</p>
      <p>Alle Bereiche sind gemeinsame Teamablagen. Ein Personenname bedeutet keine private Ablage.</p>
    </div></details>
  </div>;
}

# 0008: Tastaturbedienung mit DOM-Fokus als einziger Wahrheit

## Kontext

Phase 2b, Teil 5 führt die Interaktionsmodi aus dem Prototyp ein: Zeile
ausgewählt (Pfeiltasten wandern, Leertaste hakt ab, Enter öffnet das Feld,
Backspace löscht) und Cursor im Feld (Pfeiltasten verlassen das Feld, Escape
kehrt zurück). Die Trennung ist zwingend — ohne sie würde die Leertaste beim
Schreiben Tasks umschalten.

Die Frage ist, wo der Auswahlmodus-Zustand lebt: in einer Komponente, in
`/src/state` oder im DOM-Fokus.

## Entscheidung

**Der DOM-Fokus ist die einzige Wahrheit.** Zeilen sind `tabIndex={-1}`
(per Skript fokussierbar, keine Tab-Stops); die Eingabefelder bleiben die
natürlichen Tab-Stops. Es gibt keinen `selectedId`- und keinen Modus-Zustand
in Komponente oder Reducer. Der Modus ergibt sich aus dem Event-Ziel: ein
Keydown-Handler auf dem `<li>` empfängt die gebubbelten Tasten und entscheidet
an `event.target === input`, ob Auswahl- oder Feld-Tasten gelten. Die
sichtbare Markierung ist der native Fokusring (plus ein leichter
Hintergrund-Fill über `:focus-visible`).

BlockCard hält nur die DOM-Referenzen der Zeilen und Felder (ref-Maps), um
Fokus imperativ zu bewegen — Pfeiltasten, Fokus nach Einfügen/Löschen. Eigene
Buttons in der Zeile (Überschriftsmarke, Checkbox, Verweis-Link) sind
`tabIndex={-1}`, damit die Tastatur vollständig über die Zeilen wandert, und
bleiben per Maus bedienbar.

Begründung:

- **Fokus ist der einzige bereits konsistente Zustand.** `document.activeElement`
  hält der Browser konsistent; jede Kopie erzeugt bidirektionale
  Synchronisation (Ereignis → Zustand, Zustand → Fokus) — jede Sync-Stelle ist
  eine Drift-Stelle bei Rerenders. Die DOM-Lösung hat keine Kopie.
- **Der Modus ist Event-Routing, kein Boolean.** Zwei Modi = zwei Handler-Zweige
  im selben Handler, unterschieden am Event-Ziel. Die Leertaste-Trennung ist
  damit strukturell, nicht per Zustandsprüfung.
- **React braucht den Modus nicht zum Rendern.** Die sichtbare Auswahl ist der
  native Fokusring, den der Browser ohne Re-Render verwaltet.
- **Nichts im Interaktionsmodell braucht ein „ausgewählt"-Konzept.** Die
  Pfeilnavigation kennt die eigene ID und die Anzeigeordnung (`sections.order`);
  Einfügen nach Enter kennt den Anker aus der Handler-Closure.

Der einzige gerenderte Komponenten-Zustand ist der Composer-Entwurf
(`value`, Modus-Chip, Menüindex, Zielblock) — das ist gerendertes Markup
(Menü, Chip, Select), kein Fokus-Tracking.

## Konsequenzen

- Der Modus kann nicht driften — es gibt keinen zweiten Ort, der ihn hielte.
- Ein React-Re-Render, der den fokussierten Knoten **ersetzt**, verliert den
  Fokus. Gegenmittel: stabile Keys (Zeilen sind über `item.id` keyed) und
  imperatives Refokussieren in den Einfüge-/Löschpfaden — das braucht jede
  Lösung, auch eine mit `selectedId`.
- Die Eingabefelder bleiben die Tab-Stops; Screenreader finden die Felder über
  ihre Labels, den Zeilenmodus über den Fokusring.

## Verworfene Alternativen

- **`selectedId` als Komponenten-Zustand in BlockCard** (Hybrid): hält eine
  Zweitwahrheit neben dem Fokus, die bei jedem optimistischen Re-Render
  auseinanderlaufen kann — die schlechteste der drei Optionen.
- **Auswahlmodus in `/src/state`:** Fokus in den Reducer zu legen hieße, jeden
  Pfeil als globalen Write zu behandeln, der die ganze App re-rendert und den
  Fokus trotzdem nicht bewegen kann (die imperativen `.focus()`-Aufrufe blieben,
  jetzt in Effects versteckt). Es bricht zudem das bestehende Muster: `spaceId`,
  `pageId`, `pane`, `month`, `jump` liegen alle in Komponenten, nicht im Reducer.

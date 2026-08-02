# 0006: Normalisierter Zustand und optimistische Updates

## Kontext

Die Oberfläche (Phase 2b, Teil 3) braucht den Datenfluss zwischen Worker
und UI: einen typisierten Client und einen Reducer über den Zustand. Zwei
Eigenschaften sind nicht verhandelbar:

- Im Prototyp erscheint eine neue Zeile beim Tippen sofort — die
  Tastaturbedienung lebt davon. Der Client vergibt die IDs selbst, PUT ist
  idempotent (siehe [0005](0005-api-kontrakt.md)), also ist eine optimistische
  Anzeige ohne Doppelanlage möglich.
- Ein Task erscheint in zwei Ansichten (Block und Spiegel). Er muss im
  Zustand genau einmal liegen — als Spiegel eine Kopie zu bauen, wäre genau
  das Nicht-Ziel des Projekts.

## Entscheidung

**Normalisierter Zustand.** `AppState` hält fünf flache Maps (`spaces`,
`pages`, `blocks`, `items`, `templates`), jede Zeile genau einmal. Ansichten
werden beim Lesen von Selektoren zusammengebaut: Blockstream über
`orderBlockItems`, Kalender über `projectCalendar`, Spiegel als ID-Liste
(`mirrorOrder`, vom Server geordnet) auf die `items`-Maps gemappt — niemals
gespeicherte Kopien. Der Spiegel-Selector referenziert dieselbe `ItemRow`
wie der Blockstream; Abhaken aktualisiert eine Zeile und wirkt überall.

**Optimistische Updates mit Rückbauplan.** Eine Änderung wirkt sofort lokal
(`writeOptimistic`), danach geht der Request raus. Beim Anwenden hinterlegt
der Reducer einen Rückbauplan im `pending`-Eintrag: Create → ID entfernen;
Update → Vorgängerzeile; Delete → gelöschte Zeilen wieder einfügen und die
genullten Querbezüge (fremde `assignee_space_id`, `template_id`,
`ref_block_id`) wiederherstellen — exakt die Server-Kaskade. Der Plan ist
transient und wird mit der Bestätigung verworfen.

**Rollback ist nie still.** `writeFailed` wendet den Rückbauplan an und legt
im selben Schritt eine `UiNotification` an, die die klassifizierte Ursache
und die betroffene Entität trägt; die UI rendert sie sichtbar. Es gibt
keinen Pfad „zurückgerollt ohne Meldung".

**Fehlerklassifikation und Wiederholung im Client.** Der Client ist der
einzige HTTP-Teil des Frontends. Er klassifiziert Fehler: Netzfehler
(wiederholbar) vs. HTTP-Antwort inkl. `ApiErrorBody` (nicht wiederholbar).
Weil die Schreibvorgänge idempotent sind, wiederholt der Client sie bei
Netzfehlern eine feste, kleine Zahl (Standard: 2 Versuche); 4xx/5xx wird nie
wiederholt und führt sofort zu Rollback + Meldung.

## Konsequenzen

- Jede Zeile existiert im Speicher genau einmal; zwei gleichzeitig offene
  Ansichten desselben Tasks können nicht divergieren.
- Die einzigen Kopien sind die transienten Rollback-Snapshots in `pending`.
- Der Reducer ist pure Logik ohne Netzwerk und wird direkt getestet
  (optimistisches Anlegen, Bestätigung, Rollback, Kaskaden).
- 4xx ist sichtbar als Programmfehler, nicht als stille Korrektur.

## Verworfene Alternative: verschachtelter Zustand wie im Prototyp

Bereiche → Seiten → Blöcke → Items als Baum, Spiegel als eigene Liste. Lässt
sich direkt renderen, aber: dieselbe Task-Zeile läge doppelt im Speicher
(Block und Spiegel), jede Änderung müsste synchronisiert werden, und zwei
gleichzeitig offene Ansichten laufen auseinander. Der Spiegel wäre damit
eine Kopie — das ausdrückliche Nicht-Ziel. Der normalisierte Zustand kostet
ein bisschen Selektoren-Code und spart die gesamte Synchronisation.

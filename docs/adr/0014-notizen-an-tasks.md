# 0014: Notizen an Tasks

## Kontext

Kontext zu einem Task landet heute als lose Notizzeile irgendwo im Block und
verliert den Bezug — „wartet auf Freigabe von Herrn Voss" gehört an den Task,
nicht daneben, und soll in der Übersicht sichtbar sein, ohne dass man in den
Block springt. Bisher gilt in PROJECT.md: „Die Einrückung ist reine
Darstellung, es gibt keine Baumstruktur in den Daten." Diese Aussage kehren
wir um — aber nur um genau eine Ebene.

## Entscheidung

Items bekommen `parent_item_id`, genau eine Ebene und genau eine Richtung:

- **Nur Notizen haben einen Elternteil**, nur Tasks dürfen einer sein, und
  eine Kindnotiz ist nie eine Überschrift. Das DB-CHECK
  (`parent_item_id IS NULL OR (kind = 'note' AND heading IS NULL)`) und die
  Spiegel-Regeln in `shared/schemas.ts` (Codes `parent_only_on_note`,
  `heading_forbidden_on_child`) erzwingen das pro Zeile — beim Anlegen wie
  beim PATCH gegen die gespeicherte Zeile.
- **Der Elternteil muss existieren, ein Task sein und selbst oben stehen.**
  SQLite kann das nicht prüfen; der Worker tut es in `checkParentItem`
  (Codes `not_found`, `parent_must_be_task`, `parent_must_not_be_child`).
  Es ist eine Beziehungsregel wie die Referenzprüfungen — die Elternzeile
  steckt nicht im Payload, sie muss aus der DB gelesen werden.
- **ON DELETE CASCADE:** Die Notiz gehört dem Task. Das ist Besitzkette
  (wie Bereich → Seite → Block → Item), kein Querbezug — Besitz kaskadiert,
  Querbezüge werden genullt. Löscht man den Task, gehen seine Notizen mit.
- **Anzeige:** Die Notizen stehen eingerückt unter ihrem Task, im Block und
  in der Aufgabenübersicht. `orderBlockItems` bleibt die eine Stelle, die die
  Anzeigereihenfolge definiert (ein Task, dann seine Notizen nach
  `position`); `taskChildrenByParent` ist die eine Definition der
  Geschwisterreihenfolge, Block und Überblick nutzen sie beide. Die drei
  Gruppen bleiben drei — Kindnotizen zählen zum Task, nicht zur Notizgruppe.

## Warum die Grenze genau hier

Tasks unter Tasks wären der Anfang eines Baums, den man nicht wieder los
wird: jedes Verschieben, Sortieren und jede Übersichtsprojektion müsste
rekursiv denken. Und die Gruppenreihenfolge im Block würde mehrdeutig —
gehören Kind-Tasks zu ihresgleichen oder in die eigene Gruppe? Eine Ebene,
nur Notizen unter Tasks, bleibt deterministisch und deckt den Bedarf ab
(Kontext am Task, sichtbar in der Übersicht).

## Konsequenzen

- Der Aufgabenüberblick (ADR 0011) zeigt den Kontext ohne Sprung in den
  Block: Die Kindnotizen reisen in `OverviewResponse.notes` mit — in
  derselben festen Abfragezahl, nie pro Task nachgeladen (Budget-Test mit
  vielen Tasks à mehrere Notizen: drei Abfragen).
- Das Löschen eines Tasks entfernt seine Notizen (DB-Kaskade; der Reducer
  spiegelt das optimistisch, damit sie nicht bis zum Reload liegen bleiben).
- `parent_item_id` ist unveränderlich (wie `kind` und `blockId`): Es gibt
  keine UI, die eine Notiz von einem Task zu einem anderen umhängt.

## Verworfene Alternativen

- **Tasks unter Tasks (echte Hierarchie):** Der Anfang eines Baums, siehe
  oben; die Gruppenreihenfolge würde mehrdeutig.
- **Mehrere Ebenen unter Tasks:** Kein konkreter Bedarf; jede Ebene erhöht
  die Komplexität von Reihenfolge, Respace und Navigation.
- **Kein Modellfeld, Kontext nur als Textkonvention:** nicht maschinell
  auswertbar und in der Übersicht nicht vom Task abzugrenzen.

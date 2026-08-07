# 0015: Die Seitennavigation wandert in die Bereichsleiste

## Kontext

Die Seiten eines Bereichs stehen bisher als Tab-Reihe im Kopf des Streams
(`PageTabs`), bei Personen mit einem vorangestellten Tab „Zugewiesen". Die
Bereichsleiste listet nur die Bereiche. Zwei Schwächen: Auf schmalen
Desktops wird die Tab-Reihe lang, und „Zugewiesen" ist ein Sonderfall, der
als Literal `"mirror"` durch den Code streut. Für die Besprechung im Team
fehlt ein Eintrag „Jour Fix", der noch keinen Inhalt trägt.

## Entscheidung

**Die Seite wird die zweite Ebene der Bereichsleiste.** Unter jedem
Bereichsnamen stehen seine Einträge als Unterordner; die Tab-Reihe im
Stream entfällt. Ein Akkordeon hält die Leiste kurz: Die Unterliste erscheint
nur unter dem aktiven Bereich, ein zweiter Klick auf den Namen klappt sie
zu, der Zähler offener Aufgaben wandert dabei zwischen Bereichszeile und
„Aufgaben"-Eintrag.

**Ein Aliastyp statt Streusonderfälle:** `PageSelection = string | "tasks" |
"jourfix"` (`src/state/navigation.ts`). Das Literal `"mirror"` wird im Code
zu `"tasks"` umbenannt — die Ansicht heißt jetzt „Aufgaben", der Begriff
„Spiegel" ist seit ADR 0011 überholt. Der Stream entscheidet an genau einer
Stelle, was der gewählte Eintrag rendert (Aufgaben-Überblick, Jour-Fix-
Platzhalter oder eine Seite).

**„Jour Fix" ist ein virtueller Eintrag ohne Datenhaltung:** keine
`page`-Zeile, keine Migration, kein Worker-Feld. Er öffnet eine leere
Ansicht mit einem ruhigen Platzhaltertext. Bekommt er später Inhalt, ist
das eine eigene Entscheidung. „Aufgaben" ist die heutige Personen-Ansicht,
nur umbenannt — Verhalten, Zähler und Datenweg bleiben unverändert.

**Voreinstellung beim Bereichswechsel:** Person → „Aufgaben". Thema → erste
Notizseite; nur ohne Notizseiten → „Jour Fix". Absichtlich nicht „Jour Fix
zuerst": Ein Klick auf ein Thema soll nicht auf einer leeren Ansicht landen.

**Mobil bleibt der Drill-down** (ADR 0012, Bereiche → Einträge → Strom) —
`MobilePages` zeigt dieselben Einträge in derselben Reihenfolge, die Leiste
wird mobil nicht aufklappbar.

## Konsequenzen

- Die Seite anlegen/umbenennen/löschen zieht in die Unterliste um und ist
  dort nur für den aktiven Bereich sichtbar (Schalter bei Hover/Fokus,
  wie bisher im Streamkopf).
- Der Streamkopf nennt den gewählten Eintrag unter dem Bereichsnamen, damit
  der Kontext ohne Tabs erkennbar bleibt.
- `PageSelection` trägt die Unterscheidung durch App, Stream, MobilePages
  und MobileHeader; `grep "mirror"` findet nur noch Kommentare zum
  Spiegel-Konzept, nicht zur Ansicht.

## Verworfene Alternative

- **Jour Fix als echte `page` je Bereich:** hätte pro Bereich eine leere
  Seite und die Seitenverwaltung (umbenennen/löschen) auf einem Eintrag,
  der noch gar keine Blöcke tragen kann. Das Datenmodell bekommt einen
  Platzhalter, der mit der heutigen Bedeutung nichts anfängt — bis der
  Inhalt existiert, trägt ein virtueller Eintrag dieselbe Last ohne
  Datenmüll.

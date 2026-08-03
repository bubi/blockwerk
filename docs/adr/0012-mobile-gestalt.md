# 0012: Mobile Gestalt — Tabs, Drill-down, keine Datumsspalte

## Kontext

Unterhalb von etwa 860px war die Anwendung eine gestauchte Desktop-Ansicht:
drei Spalten, die über eine Panebar (Bereiche/Stream/Datum) einzeln
aufgeschlagen wurden. Das sprang zwischen Spalten, ohne Verlauf — es gab
keine „Zurück"-Geste, und die Datumsspalte beantwortete am Telefon keine
Frage. Der Blockstream selbst ist bewusst noch nicht angefasst und wird
separat bewertet.

## Entscheidung

Unter `(max-width: 860px)` bekommt die Anwendung eine eigene Gestalt
(`useMediaQuery`, dieselbe Konstante wie in den CSS-Medienabfragen):

- **Tab-Leiste** mit drei Zielen: **Heute** (der Teamüberblick aus ADR 0011),
  **Notizen**, **Suche**. Icon plus Beschriftung; der aktive Zustand ist eine
  farbig hinterlegte Pille hinter dem Icon; der Überfällig-Zähler sitzt als
  Zahl am Heute-Icon; Trefferflächen ≥ 48px; `env(safe-area-inset-bottom)`
  wird berücksichtigt.
- **Notizen ist ein echter Drill-down** Bereich → Seite → Stream, mit
  Zurück im Header. Der Verlauf wird über die Browser-History abgebildet:
  jede mobile Navigation pusht `history.state`, `popstate` stellt sie wieder
  her, die Basis wird beim Laden per `replaceState` gesetzt, und der
  Zurück-Knopf ruft `history.back()` — die Telefon-Geste „zurück"
  funktioniert damit genauso.
- **Die Datumsspalte entfällt mobil ersatzlos** — „Heute" beantwortet die
  Frage, die ein Monatsregister am Telefon nicht beantwortet.
- Der Blockstream (Stream/BlockCard) ist mobil **unverändert derselbe** wie
  am Desktop — derselbe JSX-Pfad, ausdrücklich nicht neu gebaut.
- Die Verwaltung bleibt mobil erreichbar: die Bereiche-Ebene des Drill-downs
  wiederverwendet die bestehende `Sidebar` (Anlegen, Löschen mit Rückfrage,
  offene Zähler); nur der „Heute"-Eintrag entfällt (die Tab-Leiste hat ihn).

Die Ebenen über der mobilen Grenze folgen dem Design-System (Abschnitt 4.2):
drei Spalten über 1320px (274 / flexibel / 384), schmalere Spalten mit
kleineren Auszeichnungsgraden bei 1101–1320px, und unter 1101px eine
Zwei-Spalten-Desktopfassung (Bereichsleiste 224, ohne Datumsspalte). Eine
Tablet-Panebar gibt es nicht mehr — die frühere Zwischenbreite 861–980px
mit Panebar ist bewusst zugunsten der Spec-Haltepunkte zurückgenommen.

## Konsequenzen

- Es gibt genau einen Navigations-Code für mobile Übergänge (`commitNav`):
  Zustand und History gehen immer zusammen, `popstate` ist die einzige
  Rückrichtung — kein zweiter, divergierender Zurück-Pfad.
- Der geteilte `spaceId`/`pageId`-Zustand macht den Wechsel über die
  Breitengrenze hinweg stetig: Was auf dem Telefon offen ist, ist es nach
  dem Hochkanten auch (und umgekehrt).
- Die Datumsspalte ist nur noch Desktop; der Kalender-Load bleibt
  harmlos stehen.
- Mobil ist strikt ≤ 860px; zwischen 861px und 1100px ist die Oberfläche
  eine Zwei-Spalten-Desktopfassung, keine Telefonfassung.

## Verworfene Alternativen

- **Nur CSS, keine eigene Navigation:** hätte die „gestauchte Desktop-Ansicht"
  nur verkleinert — der Verlauf (Browser-Zurück) und die Tab-Struktur
  brauchen Zustand, nicht nur Stile.
- **Eigene Zurück-Leiste ohne History-API:** der In-App-Zurück hätte
  funktioniert, aber die Telefon-Geste „zurück" und die Verlaufs-Einträge
  des Browsers wären ausgehebelt worden — „mit Verlauf" heißt beides.
- **Die Datumsspalte mobil verdichten statt entfernen:** hätte die Frage
  „Was ist heute dran?" nicht beantwortet — „Heute" tut das besser.

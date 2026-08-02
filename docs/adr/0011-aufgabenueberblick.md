# 0011: Der Aufgabenüberblick ersetzt den Spiegel

## Kontext

Offene Tasks erscheinen bisher an zwei Orten mit unterschiedlicher
Einteilung: als Spiegel im Bereich einer Person (gruppiert nach
Ursprungsblock, nur die zugewiesenen Tasks) und — im Prototyp — als
Tagesliste. Zwei Lücken fallen auf: Tasks jenseits der nächsten Tage und
Tasks ohne Fälligkeit sind nirgends sichtbar, und die „Auslastung" (wer hat
wie viel offen) verlangt, alle offenen Tasks eines Teams zu sehen.

Der Spiegel lädt pro Person eine eigene Abfrage. Ein Teamüberblick, der
dasselbe Muster fortsetzt, würde mit der Teamgröße skalieren — das
Abfragebudget (max. 50 D1-Abfragen pro Worker-Aufruf) verbietet genau das.

## Entscheidung

**Eine Übersichtsroute `GET /api/overview?today=YYYY-MM-DD`** nach dem
Muster von Kalender und Suche (ADR 0005, 0010): drei feste Abfragen
(items, blocks, pages) laden die Rohdaten, danach projiziert ausschließlich
`buildTaskOverview` in `/src/domain/overview.ts`. Die „Auslastung" entsteht
als ein Lauf über das bereits geladene Tasks-Array (`group by
assignee_space_id`, einmal die überfälligen zählen) — **nie** pro Person eine
Abfrage; die Route bleibt unabhängig von Teamgröße und Datenmenge konstant
(durch den Budget-Test abgesichert: `/api/overview` = 3).

**Eine Komponente, zwei Modi** (`TaskOverview` in `mode="team"` / `"person"`):

- **Team** — der Desktop-Einstieg „Heute" (erster Seitenleisten-Eintrag mit
  Überfällig-Zähler, Startansicht) und der mobile Tab: alle offenen Tasks,
  umschaltbar auf „nur meine"; Umfangsschalter, Auslastung, Überfälliges nach
  Person gruppiert. Jede Zeile nennt die zuständige Person; eigene Zeilen
  sind hervorgehoben.
- **Person** — ersetzt den Spiegel im Bereich einer Person (Tab
  „Zugewiesen"): dieselben Abschnitte, gefiltert auf die eine Person, ohne
  Auslastung und ohne Termine.

Beide Modi teilen dieselbe Einteilung: **Überfällig · die nächsten 8 Tage ·
Später fällig · Ohne Datum**. „Später fällig" (jenseits heute + 7 Tage) und
„Ohne Datum" sind neu und schließen die Lücke; beide sind standardmäßig
eingeklappt. Die Abschnitts-, Sortier- und Gruppierungsregeln liegen genau
einmal in `/src/domain/overview.ts`; die Komponente ist additiv gebaut —
Team-Extras sind Bedingungen um gemeinsame Zeilen-/Abschnitts-Renderer, kein
zweiter Code-Pfad, damit die Doppelung, die dieser PR beseitigt, nicht nur
umbenannt wiederkehrt.

**Der Spiegel gruppierte nach Ursprungsblock; neu wird nach Fälligkeit
gruppiert, der Blocktitel steht als Herkunft in der Zeile.** Das ist eine
bewusste Verhaltensänderung und wird hier festgehalten, damit sie niemand
zurückrepariert. Der Spiegel-Weg (Route `/api/spaces/:id/mirror`,
`worker/db/mirror.ts`, `Mirror.tsx`, `groupMirrorTasks`, Mirror-State) wird
entfernt; die Datenmodell-Invariante aus ADR 0001 bleibt unangetastet (ein
Datensatz, `WHERE assignee_space_id`).

**Der Überblick ist ein Daten-Load, kein transienter Treffer.** Die Route
liefert die offenen Tasks, die Fenster-Termine und die zugehörigen
Blöcke/Seiten; der Reducer mischt sie in den normalisierten Zustand (wie
Kalender und Spiegel). Abhaken wirkt damit über den bestehenden
optimistischen Schreibpfad — die Selector-Ansicht rechnet neu, es gibt keine
zweite Kopie.

**Der Umfangsschalter (Team/meine) ist eine Geräte-Präferenz in
`localStorage`** (`src/domain/preferences.ts`), Standard „Team". Er ist eine
reine Anzeige-Präferenz eines Views, keine Domänentatsache; eine serverseitige
Pro-Person-Speicherung hätte bis zur Identität keinen Schlüssel. Wer „ich"
ist, bleibt vorerst offen: `selectMeSpaceId` liefert `null`, „nur meine" und
die Hervorhebung eigener Zeilen hängen an dieser einen Stelle und zünden,
sobald das E-Mail-Feld der Personenbereiche kommt (folgt mit der Identität).

## Konsequenzen

- Die Übersichtsroute kostet konstant 3 D1-Abfragen, durch den Budget-Test
  abgesichert; die Auslastung skaliert mit nichts als der Datenmenge im
  Speicher.
- Es gibt genau eine Darstellung offener Tasks (eine Komponente, ein
  View-Typ, eine Domänenfunktion) — der Spiegel ist vollständig entfernt.
- „Heute" ist der Einstieg: die Startansicht lädt den Überblick, bevor ein
  Bereich gewählt ist; die Zähler in der Seitenleiste kommen aus demselben
  Datensatz.
- Der Überblick lädt alle offenen Tasks + Fenster-Termine beim Start. Für
  ein internes Team-Werkzeug akzeptabel (wie Kalender und Suche).

## Verworfene Alternativen

- **Spiegel erweitert, nicht ersetzt:** zwei Darstellungen mit zwei
  Gruppierungen blieben — genau die Doppelung, die dieser PR beseitigt.
- **Auslastung pro Person per Abfrage:** mit der Teamgröße wachsend — gegen
  das Abfragebudget.
- **Der Client baut den Überblick aus dem geladenen Zustand:** die offenen
  Tasks sind nicht vollständig im Client (der Kalender hält nur das
  Monatsfenster) — deshalb die eigene Route.
- **Überblick als transienter Treffer (wie Suche):** Abhaken im Überblick
  hätte eine zweite Kopie erfordert; als Daten-Load wirkt der bestehende
  Schreibpfad.

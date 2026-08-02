# 0010: Volltextsuche als Server-Route mit Domain-Projektion

## Kontext

Phase 4 plant die Volltextsuche. Der Prototyp sucht im Client über das gesamte
Datenobjekt (Blocktitel und Item-Text als case-insensitive Teilstring). Die
echte Anwendung hält aber nie alle Zeilen im Speicher — sie lädt pro Ansicht
(Seite, Spiegel, Kalender). Eine Client-Suche über den geladenen Ausschnitt
wäre unvollständig, also braucht die Suche eine eigene Leseroute im Worker.

Zwei Randbedingungen sind verbindlich: Das Abfragebudget (max. 50 D1-Abfragen
pro Worker-Aufruf) erlaubt keine N+1-Suche, und die „Eine Idee" nennt das
Blockdatum ausdrücklich als Sortier- und Auffindbarkeitskriterium („…dient
Sortierung und Suche").

## Entscheidung

**Eine neue Leseroute `GET /api/search?q=…`**, die nach dem Muster von
`loadCalendarWindow` arbeitet: fünf feste Abfragen laden alle Zeilen
(blocks, items, pages, spaces, templates), danach entscheidet ausschließlich
`searchMatches` in `/src/domain/search.ts`, was ein Treffer ist und in
welcher Reihenfolge — dieselbe „load all, project in domain"-Grenze wie beim
Kalender (ADR 0005). Es gibt kein zweites Matching im SQL.

- **Was findet die Suche:** Blocktitel und Item-Text, case-insensitive
  Teilstring — exakt der Prototyp.
- **Reihenfolge:** Blöcke zuerst, neuestes Datum zuerst (wie
  `orderPageBlocks`); Items nach dem Datum ihres Blocks, dann `position`.
- **Ergebnis-Cap:** `SEARCH_LIMIT = 50` pro Gruppe — ein Treffer-Raster ist
  Navigation, kein Export; eine breite Anfrage darf nicht die ganze
  Datenbank in eine Antwort kippen.
- **Kontext gehört in die Antwort.** Die Treffer tragen Seite, Bereich und
  Template-Label mit; der Client hat fremde Seiten nicht geladen und kann den
  Pfad nicht selbst bauen.
- **Der Client zeigt die Treffer unverändert** (`SearchResponse` aus
  `/shared`) und mischt sie **nicht** in den normalisierten Zustand — die
  Treffer tragen nur die Felder, die eine Ergebniszeile zeigt; in die
  `items`-Map eingemischt würden sie echte Zeilen überschreiben.
- **Suchzustand als View** im Reducer (`searchView`), wie Kalender und
  Spiegel. Live-Suche mit Debounce (200 ms) und Sequenz-Guard in
  `operations.ts`: Antworten dürfen den Zustand nur berühren, wenn ihre
  Anfrage die neueste ist.
- **Sprung verlässt die Suche.** Ein Treffer-Klick springt zum Block und
  leert die Query, wie `jumpTo` im Prototyp.

## Konsequenzen

- Die Suchroute kostet konstant 5 D1-Abfragen, unabhängig von der
  Datenmenge — durch den Budget-Test in `worker/db/api.test.ts` abgesichert.
- Die Such-Sortierregel liegt genau einmal in `/src/domain/search.ts` und
  ist dort getestet; Worker und (bei Bedarf) Client nutzen dieselbe Funktion.
- Die Suche ist eine Teilstring-Suche ohne Tokenisierung/Relevanz. Das genügt
  dem Prototyp-Verhalten; FTS5 oder Ranking wäre eine bewusste spätere
  Erweiterung, nicht diese Änderung.
- Der Gesamtdatensatz wird pro Suchanfrage geladen (wie der Kalender pro
  Monatswechsel). Für ein internes Team-Werkzeug akzeptabel; bei sehr großen
  Beständen wäre ein SQL-`LIKE` mit `LIMIT` eine spätere Optimierung, kein
  Vorbild hierfür.

## Verworfene Alternativen

- **SQL-`LIKE` mit `LIMIT`:** effizienter, aber das Matching
  („Titel/Text enthält Query") wäre ein zweites Mal in SQL definiert — gegen
  die Projektregel „genau einmal in /src/domain".
- **Client-Suche über geladene Daten:** vollständige Treffer nur für die
  gerade offene Seite — die Suche wäre unzuverlässig, genau das, was sie
  nicht sein darf.
- **Volltext-Suchindex (FTS5) mit Migration:** mehrwertig erst ab
  großem Bestand oder Token-Suche; als Teilstring-Suche wie der Prototyp
  unnötig komplex.

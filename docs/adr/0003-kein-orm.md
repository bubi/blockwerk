# 0003: Kein ORM — rohes SQL mit typisierten Mappern

## Kontext

`worker/db` braucht eine Zugriffsschicht auf D1: eine Seite laden, den Task-Spiegel einer
Person laden, die Kalenderprojektion für ein Datumsfenster laden, sowie Anlegen/Ändern/
Löschen für die fünf Entitäten. Der Free-Plan erlaubt maximal 50 D1-Abfragen pro
Worker-Aufruf (siehe CLAUDE.md) — eine harte Grenze, kein Performance-Ziel.

## Entscheidung

Kein ORM. Jede Funktion in `worker/db` schreibt ihr SQL selbst, mit `db.prepare(...).bind(...)`,
und mappt das Ergebnis über eine schmale Funktion in `worker/db/mappers.ts` auf den
Zeilen-Typ aus `/shared/db.ts`. `loadPageBlocks` etwa ist zwei sichtbare `prepare()`-Aufrufe,
nicht eine Kette aus `.include()`/`.with()`, die sich erst beim Ausführen in eine unbekannte
Zahl echter Abfragen auflöst.

## Konsequenzen

- Die Zahl der Abfragen einer Funktion steht im Code, nicht im Verhalten eines
  Query-Builders bei einer bestimmten Datenmenge. Der Query-Budget-Test in
  `worker/db/page.test.ts` zählt das nach (`countingD1`) und schreibt eine Obergrenze fest —
  er wäre bei einem ORM nicht weniger nötig, aber schwerer zu erklären, wenn er rot wird.
- Jede der vier vom Anwendungsfall vorgegebenen Abfragen (Seite laden, Spiegel, Kalender,
  Suche) hat einen Index, der genau zu ihrem `WHERE`/`ORDER BY` passt — siehe die Indizes
  in `migrations/0001_initial.sql`. Ohne ORM ist sichtbar, welche Abfrage welchen Index
  braucht, weil beide im selben Commit entstehen.
- Mehr Code pro Funktion als mit einem ORM — jede der fünf Entitäten bekommt ihre eigenen
  `create`/`get`/`update`/`delete`-Funktionen mit ausgeschriebenem SQL. Akzeptiert, weil die
  Entitäten sich strukturell kaum ähneln (unterschiedliche Nullable-Felder, unterschiedliche
  Löschregeln) und eine gemeinsame Abstraktion mehr verstecken würde, als sie spart.

## Verworfene Alternative: ein ORM (z. B. Drizzle, Kysely)

Type-safe Query-Builder für D1 existieren und sind für Cloudflare Workers gebaut. Dagegen:

- Sie verschieben die Frage „wie viele Abfragen macht das?" vom Code in die Laufzeit eines
  Fremdsystems — genau die Eigenschaft, die beim 50-Abfragen-Limit sichtbar bleiben muss.
- Ein zusätzlicher Layer, der übersetzt werden muss, wenn D1s SQL-Dialekt (SQLite mit
  workerd-Eigenheiten) nicht exakt das abbildet, was der Query-Builder erwartet — z. B.
  partielle Indizes (`CREATE INDEX ... WHERE ...`), die nicht jeder Query-Builder generiert.
- Kein Gewinn, der bei fünf Entitäten und vier Abfrageformen die zusätzliche Abhängigkeit
  und den Übersetzungsaufwand aufwiegt.

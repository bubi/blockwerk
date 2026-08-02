# 0001: Ein Task ist ein Datensatz, kein Duplikat

## Kontext

Ein Task, der einer Person zugewiesen wird, muss an zwei Stellen sichtbar sein: im Block,
in dem er entstanden ist (z. B. einem Meeting-Notiz-Block), und im Bereich der Person, der
alle offenen Zuständigkeiten zeigt. Zwei Wege führen dorthin: den Task beim Zuweisen in den
Bereich der Person kopieren, oder ihn an Ort und Stelle lassen und die Personenansicht als
Abfrage über denselben Datensatz bauen.

## Entscheidung

Ein Task ist genau eine Zeile in `items`. Die Personenansicht ist keine zweite Tabelle und
keine Kopie, sondern die Abfrage `SELECT … FROM items WHERE assignee_space_id = ?`. Der Task
bleibt physisch in seinem Ursprungsblock (`block_id` ändert sich beim Zuweisen nicht); nur
`assignee_space_id` verweist auf die Person.

## Konsequenzen

- Abhaken, Text ändern, Fälligkeit verschieben — jede Änderung passiert an einer Zeile.
  Es gibt keinen Synchronisationsschritt und damit auch keinen Zustand, in dem Block und
  Personenansicht auseinanderlaufen können.
- Die Personenansicht braucht keinen eigenen Schreibpfad. Sie ist rein lesend eine gefilterte
  Sicht auf `items`.
- **Löschregeln folgen aus derselben Idee.** Kaskadiert wird ausschließlich entlang der
  Besitzkette Bereich → Seite → Block → Item — das ist die einzige Beziehung, bei der ein
  Kind ohne sein Elternteil bedeutungslos wird. Jeder Querbezug (`assignee_space_id`,
  `template_id`, `ref_block_id`) wird dagegen genullt, nie gelöscht: eine Zeile darf nicht
  verschwinden, weil jemand an anderer Stelle etwas gelöscht hat.
  - Löschen eines Bereichs: Seiten, Blöcke und deren Items werden mitgelöscht (Besitzkette).
    Ein Task in einem fremden Block, der dieser Person zugewiesen war, bleibt bestehen und
    verliert nur `assignee_space_id`.
  - Löschen eines Templates: Der Block behält Titel, Datum und alle Items, `template_id`
    wird `NULL`, die Anzeige fällt auf „Ohne Template" zurück.
  - Löschen eines Blocks: Verweise (`ref`-Items) auf diesen Block bleiben als Zeile bestehen,
    `ref_block_id` wird `NULL`, die Oberfläche zeigt „Ziel entfernt".
- **Der partielle Index hat eine bewusste Lücke.** `idx_items_assignee_open` deckt nur
  `kind = 'task' AND done = 0` ab, weil genau das die Abfrage ist, die bei jedem Laden einer
  Personenansicht läuft. Löschen eines Bereichs muss aber *alle* Tasks mit dieser
  `assignee_space_id` nullen, erledigte eingeschlossen — dafür scannt SQLite die
  `items`-Tabelle, weil der schmale Index diesen Fall nicht abdeckt. Das ist akzeptiert:
  ein Bereich wird selten gelöscht, während die Personenansicht bei jedem Seitenaufruf
  läuft — der schmalere Index senkt dort die Schreiblast, ohne die seltene Operation
  spürbar zu verlangsamen.

## Verworfene Alternative: Kopie mit Synchronisation

Beim Zuweisen eine Kopie des Tasks in den Bereich der Person schreiben und beide Zeilen bei
jeder Änderung gegenseitig aktualisieren. Dagegen:

- Jede Änderung (Text, Fälligkeit, Abhaken, Neuzuweisung) müsste beide Zeilen treffen —
  ein zusätzlicher Schreibpfad, der bei jedem Feature erneut korrekt sein muss.
- Race Conditions zwischen den beiden Schreibvorgängen sind unvermeidlich, sobald zwei
  Personen gleichzeitig an verschiedenen Enden desselben Tasks arbeiten.
- Löschregeln würden sich verdoppeln: was passiert mit der Kopie, wenn das Original
  gelöscht wird, und umgekehrt? Die Spiegel-Lösung hat diese Frage gar nicht erst, weil es
  nur einen Datensatz gibt.
- Kein Vorteil, der die zusätzliche Fehlerfläche aufwiegt — die Abfrage über
  `assignee_space_id` ist genauso schnell wie ein Lookup auf eine Kopie, bei einer
  Datenmenge, für die D1 gebaut ist.

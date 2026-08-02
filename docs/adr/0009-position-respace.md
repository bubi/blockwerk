# 0009: Positionen mit Lücken, bei Erschöpfung Respace des Blocks

## Kontext

Items tragen Integer-`position`-Werte mit Lücken (Seed-Schritt 1000). Eine
neue Zeile wird per Midpoint zwischen ihre Nachbarn gelegt, ohne andere zu
nummerieren. Die Lücke ist endlich: Nach genügend Einfügungen an derselben
Stelle existiert zwischen zwei Nachbarn kein Integer mehr.

Zwei Randbedingungen sind verbindlich: Das Abfragebudget aus PROJECT.md
(max. 50 D1-Abfragen pro Worker-Aufruf) verbietet ein UPDATE pro Zeile, und
optimistische Updates vertragen keine still auseinanderlaufenden Positionen —
sobald lokal eine andere Reihenfolge stünde als auf dem Server, würde sie
beim nächsten Nachladen springen.

## Entscheidung

**`position` bleibt INTEGER. Bei Erschöpfung re-spaced der Server den Block in
einer einzigen Anweisung**, danach wird eingefügt. Konkret:

- Der Client meldet Erschöpfung, indem er `after + 1` sendet — eine Position,
  die mit dem oberen Nachbarn kollidiert. Das braucht kein neues Request-Feld;
  das Schema bleibt `strict()`.
- Der Server erkennt „Respace nötig" ausschließlich über den
  Positions-Kollisionstest — unabhängig davon, wie veraltet der Client war.
- Der Respace ist **eine** Anweisung: `UPDATE items SET position = CASE id
  WHEN ? THEN ? … END WHERE block_id = ?`. Schritt 1000, die bestehende
  Anzeigeordnung bleibt erhalten, die neue Zeile landet direkt vor dem
  kollidierenden Item (also zwischen ihren Nachbarn).
- **Die Schreibroute gibt die neuen Positionen zurück**: `{ row, respaced }`,
  wobei `respaced` die Positionen aller Items des Blocks enthält, nur wenn ein
  Respace passierte. Die Bestätigung im Client übernimmt sie — ausschließlich
  das `position`-Feld, laufende Text-Edits bleiben unberührt.

**Warum Rückgabe statt Nachladen:** Ein Nachladen würde über
`applyPageLoaded` die Block-Subtree ersetzen; laufende optimistische Edits in
diesem Block würden zurückgesetzt (Pending-Writes werden beim Laden nicht
re-applied). Positionen sind reine Buchhaltung — sie mit der Bestätigung zu
übernehmen kollidiert nie mit parallelen Text-Edits, kostet eine Round-Trip
und ist serverseitige Wahrheit ohne Ratespiel. Client und Worker deployen
zusammen, der Response-Shape-Wechsel ist frei von Versionsskew.

## Konsequenzen

- Die Abfragezahl eines Respace ist konstant: `getItem` + `getBlock` +
  `listBlockItems` + Respace-`UPDATE` + `INSERT` = 5, unabhängig von der
  Blockgröße — durch einen Abfragebudget-Test abgesichert.
- Die CASE-Anweisung braucht zwei Parameter pro Item; SQLites
  Parametergrenze (999) setzt eine Grenze von ~499 Items pro Respace. Darüber
  wäre ein D1-Batch nötig — bewusst nicht eingebaut, dokumentierte Grenze.
- Der Client zeigt im Erschöpfungsfall kurzzeitig eine provisorische Position
  (ein Tie), die sich mit der Bestätigung korrigiert — akzeptabel und
  selbstheilend.
- Zwei Clients, die gleichzeitig dasselbe erschöpfte Fach füllen, laufen zwei
  Respaces hintereinander — nicht transaktional abgesichert, aber
  deterministisch: das zweite re-spaced von der Wahrheit des ersten.

## Verworfene Alternativen

- **REAL/Float:** verschiebt die Grenze nur (≈50 statt ≈10 Halbierungen) und
  braucht denselben Rückfallpfad, bringt aber Fließkomma-Vergleiche. Das Schema
  liegt bereits remote; ein Typwechsel ist teurer als der Rückfallpfad.
- **Fraktionale Textschlüssel:** lösen das Problem endgültig, lohnen sich aber
  erst beim gleichzeitigen Umsortieren — ausdrückliches Nicht-Ziel.
- **Nachladen des Blocks nach einem Respace:** eine Round-Trip mehr und
  setzt laufende optimistische Edits im selben Block zurück (siehe oben).

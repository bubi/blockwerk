# 0005: API-Kontrakt — PUT-Idempotenz, Fehlerform, Server-Ordering

## Kontext

Phase 2b braucht die HTTP-API des Workers: vier Leserouten plus Schreiben
für die fünf Entitäten. Zwei Randbedingungen bestimmen den Kontrakt:

- IDs kommen vom Client (UUIDv7/ULID). Anlegen muss also idempotent sein:
  ein wiederholtes PUT mit derselben ID darf keinen zweiten Datensatz
  erzeugen und keinen Fehler werfen.
- Das Ordering im Block (Notizen → Tasks → Termine, Termine chronologisch)
  ist eine Domänenregel und gehört in die Hand des Servers, nicht des Clients.

## Entscheidung

**PUT = idempotent anlegen oder ersetzen.** Der Router liest die Zeile; gibt
es sie nicht, wird angelegt, sonst werden die veränderlichen Felder ersetzt.
Dieselbe ID → nie ein zweiter Datensatz. Antwort ist in beiden Fällen 200 mit
der gespeicherten Zeile.

**`item.blockId`, `item.kind`, `block.pageId`, `page.spaceId` sind immutable.**
Sie werden beim Anlegen gesetzt; PUT/PATCH mit anderem Wert → 400 `immutable`.
Passt zum Prototyp (dort ändert sich die Art einer Zeile nie) und zur
db-Schicht, deren Patches diese Felder gar nicht erst enthalten.

**Item-Body ist flach mit Defaults** (`done:false`, `heading:null`, …) und
wird gegen `kind` kreuzvalidiert — dieselben Regeln wie die
CHECK-Constraints in der Migration, einmal in `shared/schemas.ts`
(`itemKindRuleViolations`). Feldspezifische Regeln sind damit an der
Systemgrenze nicht umgehbar. PATCH validiert gegen den gespeicherten `kind`.

**Referenzen werden explizit geprüft** (page→space, block→page+template,
item→block+assignee+ref, nur wenn non-null). Fehlende Referenz → 400 mit
Feldpfad (`{ path: "spaceId", code: "not_found" }`) statt roher FK-Fehler.
`null` ist überall ein gültiger Wert.

**Fehlerform einmal in `/shared/api.ts`**, überall verwendet:
`{ error: { code, message?, issues?: [{ path, code }] } }`.
400 `validation` (Zod → Feldpfad + Code, kein roher Dump), 400 `bad_request`
(kaputtes JSON), 404 `not_found`, 405 `method_not_allowed` (mit `Allow`),
500 `internal` (Details nur ins Log).

**Ordering entscheidet der Server — und ist genau einmal definiert.** Die
Block-Reihenfolge (Notizen und Refs → Tasks → Termine; Termine chronologisch)
liegt als `orderBlockItems` in `/src/domain/order.ts`; `loadPageBlocks` lädt
die Items nur noch mechanisch (`block_id`, `id`) und ruft die Domänenfunktion
auf. Es gibt kein zweites Ordering im SQL. Refs sind Stream-Zeilen wie
Notizen — der Prototyp rendert sie zwischen den Notizzeilen und rückt sie
unter Überschriften ein (PROJECT.md kennt drei Gruppen, keine vierte). Blöcke
einer Seite: date DESC, id. Spiegel: Fälligkeit, `null` zuletzt — eine
Sicht-Abfrage ohne Domänen-Pendant.

**Kalenderprojektion ebenfalls einmal definiert.** `projectCalendar` in
`/src/domain` ist die einzige Definition, welche datierten Objekte in einem
Zeitfenster liegen und wie sie geordnet sind. Die Worker-Route lädt alle
Blöcke und Items (zwei feste Abfragen) und projiziert darüber. Die
fensterbasierten Kalender-Indizes aus der Migration sind damit ungenutzt und
Kandidaten für das Aufräumen in Phase 3.

**Zod an der Systemgrenze, Schemata in `/shared`** (direct dependency
`zod@4.4.3`), damit Client und Worker dieselbe Wahrheit nutzen. Objekte sind
`strict()` — unbekannte Felder werden abgelehnt, nicht still verworfen.

**Schreibende Routen loggen die E-Mail** des Aufrufers aus der
Access-Identität. Kein Rollen-/Rechtemodell (Nicht-Ziel).

## Konsequenzen

- Jede Leseroute kommt mit fester, kleiner Zahl an D1-Abfragen aus
  (spaces=3, page=3, mirror=2, calendar=2), gemessen durch den
  Budget-Test in `worker/db/api.test.ts` über den fetch-Handler.
- PUT auf existierender Zeile kostet eine Leseabfrage mehr als reines
  Anlegen; das ist der Preis für die „get then create-or-replace"-Semantik
  und bleibt konstant.
- Ein PUT kann die Art eines Items nicht ändern. Braucht die UI das später,
  ist es eine neue, bewusst zu treffende Entscheidung — bis dahin gilt:
  löschen und neu anlegen.
- Der Client muss die API-Typen aus `/shared` verwenden; `refId` aus dem
  Prototyp heißt in der API `refBlockId`.

## Verworfene Alternative: PATCH/POST-Erzeugen mit Server-IDs

`POST /api/<entität>` mit vom Server vergebenen IDs wäre REST-üblicher,
scheitert aber an der Prototyp-Annahme (Client-IDs) und macht
Wiederholungen (Retry, Offline-Warteschlange) zu einem Duplikatrisiko.
PUT mit Client-IDs ist für dieses Szenario die robuste Wahl.

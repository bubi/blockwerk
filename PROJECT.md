# Blockwerk

Interne Team-Software, die Notizen, Aufgaben und Termine auf **ein** Objektmodell legt,
statt sie auf drei Apps zu verteilen. Ersetzt bei uns Task-Manager und Notiz-App.

Dieses Dokument ist das Gedächtnis des Projekts. Wer hier etwas Falsches oder
Veraltetes findet, korrigiert es im selben Commit wie die Änderung, die es veraltet hat.

---

## Für neue Mitarbeit

Reihenfolge zum Einlesen: erst dieses Dokument, danach die Entscheidungsprotokolle in
`/docs/adr`, danach der Code in `/src/domain`. Für die Oberfläche sind zusätzlich
`design/DESIGN-SYSTEM.md` (verbindliche Spezifikation) und `design/tokens.css`
(einzige Quelle für Farb-, Abstands-, Radien- und Schriftwerte) verbindlich. `/prototype`
ist Referenz für das Verhalten, nicht für seine Struktur — siehe „Stand des Prototyps" am
Ende dieses Dokuments.

---

## Die eine Idee

Eine Notiz, ein Task und ein Termin sind **kein** eigener Datentyp. Es gibt Blöcke, und in
Blöcken liegen Zeilen (Items). Ein Item hat eine Art und Datumsfelder. Daraus folgt:

- Der Kalender ist **keine zweite Datenhaltung**, sondern eine Projektion der **bewusst** gesetzten Daten:
  Fälligkeit (`due_date`) und Termin (`event_date`). Ein Blockdatum wird beim Anlegen automatisch vergeben —
  es dient der Sortierung im Stream und der Auffindbarkeit über die Suche, ist aber keine Aussage über Zeit.
  Deshalb fallen Blöcke aus der Kalenderprojektion heraus; es bleiben Task-Fälligkeiten und Termine.
- Ein Task, der einer Person zugewiesen wird, wird **nicht kopiert**. Er bleibt in seinem
  Ursprungsblock und erscheint im Bereich der Person als Spiegel derselben Zeile.
  Abhaken wirkt an beiden Stellen, weil es dasselbe Objekt ist.

Wenn eine Änderung eine dieser beiden Aussagen verletzt, ist sie mit hoher Wahrscheinlichkeit
falsch. Lieber nachfragen, bevor sie umgesetzt wird.

---

## Wissen festhalten

Sitzungen sind kurzlebig und teilen kein Gedächtnis. Was nicht im
Repo steht, ist verloren. Deshalb gilt:

- Am Ende jeder Arbeitseinheit, nicht erst am Ende einer Sitzung:
  PROJECT.md, HANDOFF.md und die ADRs auf Stand bringen.
- Eine Entscheidung mit Konsequenzen über den aktuellen PR hinaus
  wird zum ADR — kurz, eine Seite, inklusive der verworfenen
  Alternative.
- Eine Erkenntnis ohne Entscheidungscharakter (eine Falle, ein
  überraschendes Verhalten, ein Irrweg) kommt nach HANDOFF.md
  unter „Fehler, die wir schon gemacht haben".
- Ändert sich der Umsetzungsstand, wird der Abschnitt „Stand" in
  HANDOFF.md korrigiert. Er ist die Landkarte für die nächste
  Sitzung; ist er falsch, startet sie in die falsche Richtung.
- Wird eine Regel durch eine Änderung überholt, wird sie im
  selben Commit korrigiert — nicht in einem Folge-Commit.

Umgekehrt gilt die Sparsamkeitsregel: Diese Dokumente werden
gelesen, bevor irgendetwas passiert. Was niemand für eine
Entscheidung braucht, gehört nicht hinein. Lieber einen Satz
streichen als einen Absatz anhängen.

---

## Domänenmodell

```
Space (Bereich)     Person oder Thema
 └─ Page (Seite)    mehrere pro Space
     └─ Block       datierte Einheit mit Typ (aus einem Template)
         └─ Item    note | task | event | ref
```

| Entität    | Wichtige Felder                                                                                                                                                                                                                                                                                    |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `space`    | `id`, `name`, `kind` (`person` \| `topic`), `short` (Kürzel), `email` (nur Person, eindeutig, für „ich" — ADR 0013)                                                                                                                                                                                |
| `page`     | `id`, `space_id`, `title`                                                                                                                                                                                                                                                                          |
| `block`    | `id`, `page_id`, `template_id`, `title`, `date` (jeder Block ist datiert)                                                                                                                                                                                                                          |
| `item`     | `id`, `block_id`, `kind`, `position`, `text`, `heading` (1\|2\|null), `list_mark` (`*`\|`-`\|null, nur `note`, wie `heading` ein Marker), `done`, `due_date`, `event_date`, `event_time`, `assignee_space_id`, `ref_block_id`, `parent_item_id` (nur `note`, verweist auf einen `task` — ADR 0014) |
| `template` | `id`, `label`, `hue`, `seed` (Zeilen zur Vorbelegung)                                                                                                                                                                                                                                              |

Regeln, die im Code gelten müssen:

- **Reihenfolge im Block:** Notizen und Verweise → Tasks → Folgetermine. Verweise sind
  Stream-Zeilen wie Notizen: sie stehen in `position`-Reihenfolge zwischen den Notizzeilen
  und werden unter Überschriften eingerückt — es gibt keine vierte Gruppe. Innerhalb der
  Notizen und Verweise zählt `position`, Termine werden chronologisch sortiert. Eine
  Notiz mit `parent_item_id` gehört zu ihrem Task (ADR 0014): sie erscheint direkt unter
  ihm innerhalb der Task-Gruppe, untereinander nach `position` sortiert — die drei
  Gruppen bleiben drei. Diese Regel ist **genau einmal** definiert (in `/src/domain`,
  `orderBlockItems`); der Worker ruft sie von dort auf und sortiert nicht zusätzlich in
  SQL. Dasselbe gilt für die Block-Reihenfolge einer Seite (neuestes Datum zuerst, bei
  gleichem Datum neueste Anlage zuerst, dann id — der eindeutige Zweitschlüssel macht auch
  identische Zeitstempel deterministisch): `orderPageBlocks` ist die einzige Definition,
  Worker und Client rufen sie beide auf, auch die Suche ordnet Blocktreffer darüber.
- **Positionen:** Lücken zulassen (Schritt 1000), bei Erschöpfung Respace des Blocks
  (eine Anweisung, Reihenfolge bleibt erhalten — siehe [ADR 0009](docs/adr/0009-position-respace.md)).
- **Überschriften:** Ein Item mit `heading` ist eine Überschrift; alle folgenden Notiz- und
  Verweiszeilen bis zur nächsten Überschrift werden eingerückt dargestellt. Die Einrückung
  ist reine Darstellung, es gibt keine Baumstruktur in den Daten — **mit genau einer
  Ausnahme:** eine Notiz kann einem Task gehören (`parent_item_id`, ADR 0014) und wird
  unter ihm eingerückt dargestellt. Ein Task unter einem Task ist ausgeschlossen; das wäre
  der Anfang eines Baums, den man nicht wieder los wird, und die Gruppenreihenfolge im
  Block würde mehrdeutig.
- **Listenpunkte:** Eine Notiz kann einen Listenpunkt-Marker tragen (`list_mark`, `*` oder
  `-`), wie `heading` ein Merkmal auf dem Notiz-Item — **keine** eigene `item.kind`. `kind`
  steuert die Gruppenreihenfolge im Block; eine vierte Art würde sie mehrdeutig. `- ` und
  `* ` am Zeilenanfang wandeln um (Erkennung in `/src/domain/headings.ts` neben der
  Überschriftenerkennung), der Marker steht im Text. **Enter ist ein weicher Umbruch
  innerhalb derselben Notiz**: Er fügt den nächsten Punkt derselben Liste hinzu
  (`\n` + Marker), es entsteht **kein** neuer Block-Eintrag — mehrere Aufzählungspunkte
  leben in einer Blockzeile. Enter auf einem leeren Punkt verlässt die Liste. Keine
  Verschachtelung; eine Notiz ist entweder Überschrift oder Listenpunkt, nie beides
  (CHECK wie bei `heading`: nur `kind='note'`).
- **Aufgabenüberblick statt Spiegel (ADR 0011):** Offene Tasks erscheinen an genau einer
  Stelle — dem Überblick, einer Komponente mit zwei Modi (Team „Heute" und die Person im
  Tab „Zugewiesen"). Der Überblick ist `SELECT … WHERE kind = 'task' AND done = 0` mit
  Kontext (Ursprungsblock), projiziert in `/src/domain/overview.ts`. Die Auslastung entsteht
  im Speicher aus den geladenen Tasks, nie per Abfrage pro Person. Ein Task, der einer
  Person zugewiesen wird, ist weiterhin **kein** Duplikat — er bleibt in seinem
  Ursprungsblock und erscheint nur in der Ansicht. Abhaken wirkt überall, weil es dasselbe
  Objekt ist.
- **Bewusste Gruppierung:** Der Überblick gruppiert nach Fälligkeit
  (Überfällig · nächste 8 Tage · Später fällig · Ohne Datum), der Blocktitel steht als
  Herkunft in der Zeile. Der frühere Spiegel gruppierte nach Ursprungsblock — das wird
  nicht zurückgebaut.
- **Identität (ADR 0013):** „Ich" ist der Personenbereich, dessen `email` der
  Access-E-Mail entspricht — vom Worker bei `/api/spaces` als `meSpaceId` aufgelöst, im
  State genau einmal gehalten, von `selectMeSpaceId` gelesen. Ohne Zuordnung arbeitet die
  Anwendung weiter („nur meine" zeigt nichts, nie eine falsche Auswahl).
- **`@`-Auswahl merkt die Bereichs-ID, nicht den Text:** Die Auswahl aus der
  Personenliste schreibt `@Vorname` und merkt `mentionId`; `composeItem` nimmt die
  gemerkte ID vor dem Textparser (gleiche Vornamen bleiben unterscheidbar). Der Parser
  bleibt Rückfall für getipptes `@Name` ohne Menüauswahl.

**Löschregeln:** Kaskadiert wird ausschließlich entlang der Besitzkette
Bereich → Seite → Block → Item — und von einem Task zu seinen Notizen
(`parent_item_id`, ADR 0014). Jeder Querbezug wird dagegen genullt, nie gelöscht.
Eine Zeile darf nicht verschwinden, weil jemand an anderer Stelle etwas gelöscht hat.

- **Löschen eines Bereichs:** Seiten, Blöcke und deren Items werden mitgelöscht. Tasks in
  fremden Blöcken bleiben bestehen und verlieren nur ihre Zuständigkeit
  (`assignee_space_id` → `NULL`).
- **Löschen eines Templates:** Der Block behält Titel, Datum und alle Items und fällt in
  der Anzeige auf „Ohne Template" zurück (`template_id` → `NULL`). Inhalte gehen nie
  verloren.
- **Löschen eines Blocks:** Verweise auf diesen Block bleiben als Zeile bestehen und
  verlieren nur ihr Ziel (`ref_block_id` → `NULL`). Die Oberfläche zeigt „Ziel entfernt".
  Ein Verweis wird nie gelöscht, weil sein Ziel verschwindet.

---

## Stack

- **Frontend:** Vite + React + TypeScript
- **Backend + Hosting:** ein einzelner Cloudflare Worker mit statischen Assets
  (nicht Pages — Cloudflare empfiehlt Workers für neue Projekte)
- **Datenbank:** D1 (SQLite), Migrationen über `wrangler d1 migrations`
- **Auth:** Cloudflare Access vor der Anwendung. Kein eigener Auth-Code.
- **CI:** GitHub Actions → `wrangler deploy`

### Zwei harte Randbedingungen

1. **Max. 50 D1-Abfragen pro Worker-Aufruf** (Free-Plan; bezahlt sind es 1000).
   Kein N+1 über Blöcke oder Items. Eine Seite lädt mit einer festen, kleinen Zahl von
   Abfragen — wächst die Zahl mit der Datenmenge, ist der Ansatz falsch.
2. **Access-JWT muss serverseitig geprüft werden.** Access schützt nur den Weg über die
   Cloudflare-Kante. Der Worker validiert `Cf-Access-Jwt-Assertion` gegen die JWKs-URL und
   die `aud`-Kennung. Header ungeprüft zu vertrauen wäre eine offene API.

---

## Repo-Struktur

```
/src            React-Anwendung
  /domain       reine Logik, ohne React und ohne Netzwerk  → hier liegen die Tests
  /components   UI
  /state        Reducer und Datenzugriff
/worker         Worker: Routing, Access-Prüfung, D1-Zugriff
  /db/testing   Testhelfer für die worker/db-Tests (Abfragezähler, Migrationen)
/shared         Typen, die Client und Worker teilen
/migrations     D1-Migrationen, aufsteigend nummeriert
/e2e            Playwright-Specs gegen die lokale Umgebung
/scripts        Entwicklungshelfer (z. B. der E2E-Webserver)
/docs/adr       kurze Entscheidungsprotokolle
/design         verbindliche Spezifikation der Oberfläche: DESIGN-SYSTEM.md + tokens.css
/prototype      der ursprüngliche Einzeldatei-Prototyp, als Referenz
seed.sql        idempotentes Seed für die lokale Entwicklung (INSERT OR IGNORE)
```

`/domain` ist die wichtigste Grenze: Datumsparser, Token-Parser (`@Person`, `!datum`, `14:00`),
Sortierung, Einrückungsberechnung, Kalenderprojektion. Alles dort ist pur und testbar. Soll
Logik in eine Komponente wandern, erst prüfen, ob sie stattdessen nach `/domain` gehört.

---

## Konventionen

- **Sprache:** Code, Bezeichner, Kommentare und Commits auf Englisch. Die Oberfläche ist
  Deutsch. Fachbegriffe im Code englisch (`space`, `block`, `item`), nicht gemischt.
- **TypeScript strict.** Kein `any`. Typen für Datenbankzeilen liegen in `/shared`.
- **Keine Formatierungsdebatten:** Prettier und ESLint entscheiden, nicht wir.
- **Tests:** Vitest für `/domain` und den Worker, Playwright für die Wege, die wirklich
  brechen dürfen (Seiten-/Blockstream-Reihenfolge, Bereichswechsel, Composer-Interaktion
  samt Tastatur, Task-Spiegel, Verwaltung). Kein Zwang zu Coverage-Zahlen; Tests für
  Logik, nicht für Markup.
- **Migrationen sind unveränderlich.** Einmal deployt wird eine Migration nie editiert,
  sondern durch eine neue ersetzt.
- **Commits:** Konventionelles Format (`feat:`, `fix:`, `refactor:`, `docs:`).

---

## Gates

Vier Prüfstufen, die vor jedem Commit fehlerfrei durchlaufen müssen:

```
npm run typecheck     # TypeScript strict, App und Worker (tsc -b) — Typen stimmen
npm run lint          # ESLint — Konventionen eingehalten
npm test              # Vitest für /domain und die App-Logik — Verhalten stimmt
npm run test:workers  # Vitest gegen den Worker — D1-Zugriffsschicht stimmt
```

Jede Stufe weist etwas anderes nach; keine ersetzt eine andere. Alle vier laufen vor
jedem Commit.

Zusätzlich gibt es **Playwright-Wege gegen die lokale Umgebung** (`npm run test:e2e`):
sie starten den Worker mit D1 local und Seed selbst (siehe unten) und brauchen den
Port 8787 frei. Sie gehören nicht zu den vier Gates, weil sie die echte lokale
Umgebung voraussetzen; abgedeckt sind Stream-Reihenfolge, Bereichswechsel,
Composer/Tastatur, Task-Spiegel und die Verwaltung.

---

## Lokale Entwicklung

```
npm run dev              # D1 local migrieren + seeden, dann Worker (8787) + Vite (5173, HMR, /api-Proxy) gleichzeitig
npm run dev:worker       # nur der Worker (braucht dist, siehe ASSETS-Binding)
npm run dev:vite         # nur Vite
npm run test:e2e         # Playwright gegen lokale Umgebung (resetet .wrangler/state)
```

Die Berechtigung kommt in der Entwicklung aus `.dev.vars`
(`DEV_ACCESS_EMAIL=dev@example.com`); Access selbst prüft nur der Worker in
Produktion. `seed.sql` ist mit `INSERT OR IGNORE` idempotent, mehrfaches Seeden
schadet also nicht. `npm run test:e2e` setzt den lokalen D1-Zustand zurück
(`rm -rf .wrangler/state`), damit die Wege deterministisch sind — erst `npm run dev`
stoppen, sonst belegt der Worker den Port.

**Deploy:** Normalerweise über CI (GitHub Actions → `wrangler deploy`). Ist CI nicht
verfügbar (z. B. verbrauchte Monatsminuten), wird manuell ausgeliefert:
`npm run build && npx wrangler deploy` — **nach jedem Push auf `main`**.
Remote-Migrationen bleiben davon getrennt und laufen nur auf ausdrückliche
Anweisung (`npm run db:migrate:remote`).

---

## Arbeitsweise

- Ein Arbeitsschritt hat **PR-Größe**. Lieber fünf kleine Änderungen als ein großer Umbau.
- Vor jedem Commit laufen alle vier Gates (siehe oben).
- **Vor einem größeren Umbau erst Plan und Dateiliste vorlegen, Bestätigung abwarten,
  dann umsetzen.** Kleine, klar umrissene Änderungen brauchen diesen Schritt nicht.
- **Bestehende Muster im Repo haben Vorrang vor den Gewohnheiten des Modells.** Wer eine
  Konvention hier für falsch hält, sagt es, bevor er sie ändert.
- **Migrationen gegen Remote führt der Mensch aus, nicht das Modell.** Migrationen werden
  vorbereitet und lokal nachgewiesen (`npm run db:migrate:local`); `npm run db:migrate:remote`
  ist eine bewusste, separate Entscheidung des Menschen.
- Architekturentscheidungen kommen als kurzes ADR nach `/docs/adr` — eine Seite: Kontext,
  Entscheidung, Konsequenz. Auch die abgelehnten Alternativen kurz nennen.
- **Nachfragen statt raten**, wenn eine Anforderung das Domänenmodell berührt.
  Bei allem anderen: entscheiden, umsetzen, im PR begründen.
- Wer eine bestehende Entscheidung für falsch hält, sagt es. Stillschweigend am Modell
  vorbeizubauen ist der teuerste Fehler in diesem Projekt.

---

## Nicht-Ziele

Bewusst _nicht_ gebaut, bis jemand einen konkreten Bedarf zeigt:

- Öffentliche Registrierung, Mandantenfähigkeit, Rollen- und Rechtemodell
  (interne Nutzung, Access regelt den Zugang)
- Echtzeit-Kollaboration im selben Block
- Mobile Apps (die Weboberfläche ist responsiv)
- Rich Text über Überschriften, Listen und Verweise hinaus
- Import aus Evernote oder anderen Werkzeugen
- Offline-Betrieb

---

## Fahrplan

| Phase | Ziel                                                                                                                                                                                                              | Status    |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------- |
| 0     | Repo-Skelett, Toolchain, `PROJECT.md`                                                                                                                                                                             | erledigt  |
| 1     | Leere Seite deployt, hinter Access, CI grün                                                                                                                                                                       | erledigt  |
| 2a    | D1-Schema                                                                                                                                                                                                         | erledigt  |
| 2b    | API, Prototyp-Logik, State/Client, Oberfläche                                                                                                                                                                     | erledigt  |
| 3     | Rest von 2b (Verwaltung), Tests, ADRs, Aufräumen                                                                                                                                                                  | in Arbeit |
| 4     | Features: Volltextsuche (erledigt), Rückverweise, Terminserien                                                                                                                                                    | in Arbeit |
| 5     | Aufgabenüberblick (ADR 0011): Übersichtsroute, Team-/Personen-Ansicht, „Heute" als Einstieg                                                                                                                       | erledigt  |
| 6     | Mobile Gestalt (ADR 0012): Tab-Leiste Heute/Notizen/Suche unter 860px, Drill-down mit Verlauf, keine Datumsspalte                                                                                                 | erledigt  |
| 7     | Identität (ADR 0013), @-Auswahl im Composer, Checkbox in der Datumsspalte, Aufräumen, Mitternachts-Fix                                                                                                            | erledigt  |
| 8     | Notizen an Tasks (ADR 0014): eine Verschachtelungsebene, Kindnotizen unter dem Task, auch in der Übersicht                                                                                                        | erledigt  |
| 9     | Design-System (design/DESIGN-SYSTEM.md, tokens.css): Oberfläche nach der Spezifikation, Sammelregeln, Tageskopf, Haltepunkte                                                                                      | erledigt  |
| 10    | Bug- und Change-Sammlung 06.08.2026: Breiten (gemeinsames Maß, Metazeile), Editor (leerer Notizbereich, sichtbare Eingabezeile, Listenpunkte), Sortierung + Klappzustand, Feinschliff (Block anlegen, Umschalter) | erledigt  |

Erst wenn eine Phase steht, beginnt die nächste. Phase 1 vor Phase 2 ist Absicht: die
Auslieferungskette soll funktionieren, solange noch nichts kaputtgehen kann.

---

## Stand des Prototyps

`/prototype/blockwerk.jsx` ist eine lauffähige Einzeldatei mit dem vollständigen
Interaktionsmodell: Slash-Befehle, `#`-Überschriften mit Einrückung, Tastaturbedienung
(Pfeiltasten wählen Zeilen, Leertaste hakt ab), Aufgabenüberblick („Heute" mit
Auslastung), Datumsleiste, Bereichs- und Template-Verwaltung. In der echten Anwendung
ist davon alles umgesetzt:
Composer mit Slash-Menü, `#`-Umwandlung, Zeilen einfügen/löschen, zwei Tastaturmodi
über den DOM-Fokus (ADR 0008), Position-Respace (ADR 0009), die Volltextsuche
im Kopf (ADR 0010), der Aufgabenüberblick als Startansicht und Personen-Sicht
(ADR 0011), die mobile Gestalt unter 860px mit Tab-Leiste Heute/Notizen/Suche
und Drill-down mit Verlauf (ADR 0012) sowie die Verwaltung (Bereiche anlegen/löschen
mit Rückfrage, Seiten anlegen/umbenennen, Block anlegen, Templates bearbeiten).

Er ist **Referenz für das Verhalten, nicht für die Struktur.** Das Aussehen der
Oberfläche folgt nicht dem Prototyp, sondern der verbindlichen Spezifikation in
`design/DESIGN-SYSTEM.md` mit den Token in `design/tokens.css` — die Referenz hält sie
ein und dient als Beleg, ist aber nicht das Gesetz. Eine bewusste Abweichung:
In der Datumsleiste des Prototyps stehen noch Block-Karten; die echte Anwendung zeigt dort
nur Termine und Fälligkeiten (siehe „Die eine Idee" — ein Blockdatum ist automatisch, keine
Zeitangabe). Der Prototyp bleibt in diesem Punkt bewusst stehen. Eine bewusste Erweiterung:
Notizen an Tasks (ADR 0014) — ein Task kann eigene, unter ihm eingerückte Notizzeilen
tragen; der Prototyp kennt diese eine Verschachtelungsebene nicht. Der Zustand liegt dort in
einem einzigen Objekt und wird über einen Key-Value-Speicher persistiert. Diese Grenze
(`window.storage`) ist inzwischen ersetzt: `/src/state` (typisierter Client + Reducer,
siehe [ADR 0006](docs/adr/0006-state-und-optimistische-updates.md)) übernimmt den
Datenfluss zur API — der einzige Teil des Prototyps, der bewusst so gebaut wurde, dass er
ersetzt werden kann.

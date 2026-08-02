# Blockwerk

Interne Team-Software, die Notizen, Aufgaben und Termine auf **ein** Objektmodell legt,
statt sie auf drei Apps zu verteilen. Ersetzt bei uns Task-Manager und Notiz-App.

Dieses Dokument ist das Gedächtnis des Projekts. Wer hier etwas Falsches oder
Veraltetes findet, korrigiert es im selben Commit wie die Änderung, die es veraltet hat.

---

## Für neue Mitarbeit

Reihenfolge zum Einlesen: erst dieses Dokument, danach die Entscheidungsprotokolle in
`/docs/adr`, danach der Code in `/src/domain`. `/prototype` ist Referenz für das Verhalten
der Anwendung, nicht für ihre Struktur — siehe „Stand des Prototyps" am Ende dieses
Dokuments.

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

## Domänenmodell

```
Space (Bereich)     Person oder Thema
 └─ Page (Seite)    mehrere pro Space
     └─ Block       datierte Einheit mit Typ (aus einem Template)
         └─ Item    note | task | event | ref
```

| Entität  | Wichtige Felder |
|----------|-----------------|
| `space`  | `id`, `name`, `kind` (`person` \| `topic`), `short` (Kürzel) |
| `page`   | `id`, `space_id`, `title` |
| `block`  | `id`, `page_id`, `template_id`, `title`, `date` (jeder Block ist datiert) |
| `item`   | `id`, `block_id`, `kind`, `position`, `text`, `heading` (1\|2\|null), `done`, `due_date`, `event_date`, `event_time`, `assignee_space_id`, `ref_block_id` |
| `template` | `id`, `label`, `hue`, `seed` (Zeilen zur Vorbelegung) |

Regeln, die im Code gelten müssen:

- **Reihenfolge im Block:** Notizen und Verweise → Tasks → Folgetermine. Verweise sind
  Stream-Zeilen wie Notizen: sie stehen in `position`-Reihenfolge zwischen den Notizzeilen
  und werden unter Überschriften eingerückt — es gibt keine vierte Gruppe. Innerhalb der
  Notizen und Verweise zählt `position`, Termine werden chronologisch sortiert. Diese Regel
  ist **genau einmal** definiert (in `/src/domain`, `orderBlockItems`); der Worker ruft sie
  von dort auf und sortiert nicht zusätzlich in SQL. Dasselbe gilt für die Block-Reihenfolge
  einer Seite (neuestes Datum zuerst): `orderPageBlocks` ist die einzige Definition, Worker
  und Client rufen sie beide auf.
- **Positionen:** Lücken zulassen (Schritt 1000), bei Erschöpfung Respace des Blocks
  (eine Anweisung, Reihenfolge bleibt erhalten — siehe [ADR 0009](docs/adr/0009-position-respace.md)).
- **Überschriften:** Ein Item mit `heading` ist eine Überschrift; alle folgenden Notiz- und
  Verweiszeilen bis zur nächsten Überschrift werden eingerückt dargestellt. Die Einrückung
  ist reine Darstellung, es gibt keine Baumstruktur in den Daten.
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

**Löschregeln:** Kaskadiert wird ausschließlich entlang der Besitzkette
Bereich → Seite → Block → Item. Jeder Querbezug wird dagegen genullt, nie gelöscht.
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

Bewusst *nicht* gebaut, bis jemand einen konkreten Bedarf zeigt:

- Öffentliche Registrierung, Mandantenfähigkeit, Rollen- und Rechtemodell
  (interne Nutzung, Access regelt den Zugang)
- Echtzeit-Kollaboration im selben Block
- Mobile Apps (die Weboberfläche ist responsiv)
- Rich Text über Überschriften, Listen und Verweise hinaus
- Import aus Evernote oder anderen Werkzeugen
- Offline-Betrieb

---

## Fahrplan

| Phase | Ziel | Status |
|-------|------|--------|
| 0 | Repo-Skelett, Toolchain, `PROJECT.md` | erledigt |
| 1 | Leere Seite deployt, hinter Access, CI grün | erledigt |
| 2a | D1-Schema | erledigt |
| 2b | API, Prototyp-Logik, State/Client, Oberfläche | erledigt |
| 3 | Rest von 2b (Verwaltung), Tests, ADRs, Aufräumen | in Arbeit |
| 4 | Features: Volltextsuche (erledigt), Rückverweise, Terminserien | in Arbeit |
| 5 | Aufgabenüberblick (ADR 0011): Übersichtsroute, Team-/Personen-Ansicht, „Heute" als Einstieg | erledigt |
| 6 | Mobile Gestalt (ADR 0012): Tab-Leiste Heute/Notizen/Suche unter 860px, Drill-down mit Verlauf, keine Datumsspalte | erledigt |
| 7 | Identität (E-Mail am Personenbereich), @-Auswahl, Checkbox in der Datumsspalte, Aufräumen | geplant |

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

Er ist **Referenz für das Verhalten, nicht für die Struktur.** Eine bewusste Abweichung:
In der Datumsleiste des Prototyps stehen noch Block-Karten; die echte Anwendung zeigt dort
nur Termine und Fälligkeiten (siehe „Die eine Idee" — ein Blockdatum ist automatisch, keine
Zeitangabe). Der Prototyp bleibt in diesem Punkt bewusst stehen. Der Zustand liegt dort in
einem einzigen Objekt und wird über einen Key-Value-Speicher persistiert. Diese Grenze
(`window.storage`) ist inzwischen ersetzt: `/src/state` (typisierter Client + Reducer,
siehe [ADR 0006](docs/adr/0006-state-und-optimistische-updates.md)) übernimmt den
Datenfluss zur API — der einzige Teil des Prototyps, der bewusst so gebaut wurde, dass er
ersetzt werden kann.

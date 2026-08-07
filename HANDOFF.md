# Übergabe

Ergänzung zu `PROJECT.md`. Dort steht, **was** gilt — hier steht, **warum**, was
noch offen ist und welche Fehler wir schon gemacht haben.

`PROJECT.md` ist verbindlich. Dieses Dokument ist Kontext, keine Regel. Wo beide
sich widersprechen, hat `PROJECT.md` recht und dieses hier ist veraltet.

Entstanden aus einer langen Entwurfssitzung, die nicht im Repo liegt. Vieles davon
lässt sich aus dem Code nicht ableiten, weil es Entscheidungen _gegen_ etwas sind.

---

## Stand

**Umgesetzt und im Betrieb:**

- Phase 0 bis 3 vollständig — Toolchain, Deployment hinter Cloudflare Access,
  D1-Schema, API, Oberfläche, Interaktion, Aufräumen
- Aufgabenüberblick vereinheitlicht (eine Komponente, Modi „Team" und „Person"),
  „Heute" als Einstieg auf beiden Bildschirmgrößen
- Eigene mobile Gestalt unter ~860 px: Heute / Notizen / Suche
- Identität aus dem Access-Token, verknüpft mit einem Personenbereich
- Notizen an Tasks: eine Verschachtelungsebene, im Block und im Überblick (ADR 0014)
- Oberfläche nach `design/DESIGN-SYSTEM.md` mit den Token aus `design/tokens.css`
- Bug- und Change-Sammlung vom 06.08.2026, alle vier Blöcke: gemeinsames
  Breitenmaß (Blocks, Überblick, KPI-Karten), Metazeile der Datumskarten, Editor
  (leerer Notizbereich als Klickziel, sichtbare Eingabezeile, Listenpunkte),
  deterministische Block-Sortierung, gemerkter Klappzustand, Block anlegen als
  Trennlinie mit mittigem Plus, Reiter als Segment-Umschalter (`bc023ba`,
  `a1881ae`, `ff4df28`, `ee4e664`)
- Listenpunkte sind **weicher Umbruch innerhalb derselben Zeile**: Enter fügt den
  nächsten Punkt im selben Feld ein (Marker im Text), kein neuer Block-Eintrag
  (`c2597e1`)
- Seitennavigation in der Bereichsleiste (ADR 0015): Einträge als Unterliste je
  Bereich (Person: Aufgaben, Jour Fix, Notizseiten; Thema: Jour Fix, Notizseiten),
  Akkordeon mit Zählerwanderung, „Aufgaben" ersetzt „Zugewiesen", „Jour Fix" als
  virtueller Eintrag ohne Datenhaltung, Tab-Reihe aus dem Streamkopf entfernt
- Remote: Migration 0005 (`list_mark`) angewendet, Worker deployt
  (https://blockwerk.m-schmidinger.workers.dev)

**Betrieb:** GitHub Actions erzeugt derzeit keine Läufe — die monatlichen
Hosted-Minuten sind verbraucht (öffentliches Repo sollte eigentlich freie Minuten
haben; Ursache unklar, wird auf GitHub-Seite geprüft). Der Workflow `ci.yml` ist
aktiv und unverändert; die vier Gates laufen lokal vor jedem Commit. Bis zur
Freischaltung wird nach jedem Push manuell deployt: `npm run build && npx wrangler deploy`.
Option bei dauerhaftem Limit: self-hosted Runner (verbraucht keine Hosted-Minuten).

Der Rest des früheren Blocks „beauftragt, Stand unbekannt" ist am 06.08.2026 gegen
das Repo geprüft worden. Ergebnis:

**Nicht gebaut:**

- Sicherung nach R2 — keine R2-Bindung, kein Cron-Auslöser, keine Export-Route
- Konflikterkennung über Versionsnummern — keine Versionsspalte in den Migrationen;
  PUT ersetzt, letzter Schreiber gewinnt (ADR 0005)
- Rückgängig — der `UndoPlan` in `/src/state` ist der Rückbau **fehlgeschlagener**
  Schreibvorgänge (ADR 0006), nicht das Feature
- Rückverweise — die Hinrichtung steht (`ref`-Items), die Gegenrichtung fehlt ganz:
  keine Route, kein Selektor, keine Ansicht
- Blöcke verschieben — `block.pageId` und `item.blockId` sind unveränderlich
- Wochenrückschau — es gibt nur die Kennzahl „erledigt, 7 Tage" im Tageskopf, und
  die zählt die Häkchen der laufenden Sitzung; das Modell hat kein `done_at`

**Teilweise:**

- **Tasks nachträglich ändern:** Text, Häkchen, Überschriftsmarke und Listenpunkt
  gehen. Die Fälligkeit nur über die Datumsspalte — ein Task ohne Datum bekommt
  nachträglich keins. Die Zuständigkeit ist nach dem Anlegen gar nicht änderbar.
- **Statische Icons (Teil):** Das Zeichen ist eine echte Komponente
  (`src/components/Mark.tsx`, Inline-SVG mit `size`/`tone`), steht an den drei
  Stellen Kopfzeile/Ladeansicht/mobile „Heute"; `public/` hat favicon.svg,
  favicon-32.png, apple-touch-icon.png, site.webmanifest und `_headers`
  (Cache-Header). `blockwerk-logo.svg` (die Varianten) bleibt untracked im
  Wurzelverzeichnis. Tab-Leiste-Icons bleiben die drei Inline-SVGs.

---

## Offene Fäden

Keine Aufträge, sondern bekannte Lücken. Reihenfolge ist meine Einschätzung, nicht
die des Product Owners.

1. **Es gab noch keine echte Nutzungswoche.** Der Durchgang in Phase 3 war ein
   Test. Jede Prioritätenliste hier ist eine Vermutung darüber, was im Alltag
   stört. Eine Woche mit echten Meetings korrigiert sie zuverlässiger als weitere
   Analyse.
2. **Task schnell anlegen auf dem Telefon** geht nicht ohne vorher zu einem Block
   zu navigieren. „Unterwegs etwas hineinwerfen" ist der zweite Grund, die App am
   Handy zu öffnen.
3. **Der Blockstream ist mobil unverändert der Desktop-Stream.** Bewusst nicht
   angefasst, aber vermutlich zu eng. Braucht eine Bewertung im echten Betrieb.
4. **Suche ist ein LIKE-Scan.** Bei ein paar tausend Items unauffällig, danach
   nicht mehr. FTS5 ist im ADR als nachrüstbar vermerkt.
5. **Schreibbudget:** 100.000 Zeilenschreibvorgänge pro Tag im Free-Plan. Wenn der
   Client bei jedem Tastendruck schreibt, ist das schnell aufgebraucht. Prüfen, ob
   gebündelt wird.
6. **Anhänge und Bilder** gibt es nicht — weder gebaut noch bewusst verworfen. Für
   eine Evernote-Ablösung bemerkenswert.

---

## Bewusst verworfen

Jeweils mit dem Auslöser, ab dem die Entscheidung neu ansteht. Ein Nicht-Ziel ohne
Ablaufbedingung ist wenig wert.

| Verworfen                              | Grund                                                                                                   | Neu entscheiden, wenn                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Rechte- und Rollenmodell               | Internes Team hinter Access; Querbezüge und Teamüberblick leben von bereichsübergreifender Sichtbarkeit | jemand außerhalb des Teams Zugang bekommt                                      |
| Verschlüsselung der Inhalte            | Nutzen begrenzt, Komplexität dauerhaft                                                                  | Kundendaten in Notizen landen, oder Cloudflare Teil des Bedrohungsmodells wird |
| Echtzeit-Kollaboration                 | Nicht-Ziel; Konflikte werden stattdessen sichtbar gemacht                                               | mehrere Personen regelmäßig denselben Block bearbeiten                         |
| Fraktionale Indizierung für `position` | Löst das Lückenproblem endgültig, lohnt aber erst bei gleichzeitigem Umsortieren                        | Umsortieren durch mehrere Nutzer gleichzeitig gebraucht wird                   |
| `REAL` statt `INTEGER` für `position`  | Verschiebt die Grenze nur, Rückfallpfad bleibt nötig                                                    | —                                                                              |

---

## Wiederkehrende Prüfpunkte

Diese Fragen sind in Reviews mehrfach fällig geworden. Sie lohnen sich bei jedem PR:

- **Wächst die Abfragezahl mit der Datenmenge?** Das 50er-Budget des Free-Plans ist
  die Randbedingung, die sich nachträglich am schlechtesten herausrefactorn lässt.
  Besonders verführerisch: eine Zählung pro Person für die Auslastung.
- **Existiert die Sortierung nur einmal?** Wenn `/src/domain` sortiert und SQL
  ebenfalls, stimmen beide eine Weile überein und dann nicht mehr.
- **Ist die Sortierung deterministisch?** Jede Sortierung braucht einen eindeutigen
  Zweitschlüssel. Bei Items (`position` → `id`) und bei Blöcken (Datum →
  `created_at` → `id`) jeweils schon passiert.
- **Beschreibt `PROJECT.md` noch die Wirklichkeit?** Weicht der Code ab, hat der
  Code recht und das Dokument wird fortgeschrieben — nicht umgekehrt.
- **Wird eine Zusage abgeschwächt?** Bei „nur Umformulierung" schleichen sich
  inhaltliche Verschiebungen ein. Besonders bei den Löschregeln.
- **Kaskade oder Nullen?** Entlang der Besitzkette Bereich → Seite → Block → Item
  wird kaskadiert, jeder Querbezug wird genullt. Bei jedem neuen Fremdschlüssel
  prüfen, welcher Fall vorliegt.
- **Funktioniert es ohne Hover?** Auf Touchgeräten gibt es keinen. Mehrere
  Bedienelemente waren dort zeitweise unsichtbar.

---

## Fehler, die wir schon gemacht haben

Damit sie nicht ein zweites Mal passieren.

- **CSS-Spezifität im Reset.** Ein `.bw button { border: none }` schlug alle
  einfach klassifizierten Komponenten und machte unter anderem die Checkbox
  unsichtbar. Lösung: Reset-Selektoren mit `:where()` auf null setzen.
- **Hooks nach einem frühen Return.** Zwei `useMemo` standen hinter
  `if (!data) return`. Erster Render zählt anders als der zweite → React-Fehler 310.
- **`node:fs` in der workerd-Sandbox.** Führte zu einem Segfault, der zuerst als
  Betriebssystemproblem gedeutet wurde. Migrationen Node-seitig lesen und als
  Test-Binding hineinreichen.
- **Ein PR mit vier Arbeitspaketen**, weil `main` vier Commits hinterherhing. Nach
  jedem abgeschlossenen Schritt pushen; ab dieser Größe ist Review nicht mehr
  leistbar.
- **Lücken bei `position` erschöpfen sich schneller als gedacht.** Zehnmal an
  derselben Stelle einfügen genügt — und das ist der normale Schreibfluss unter
  einer Überschrift, kein Randfall.
- **Ein falscher Schnitt beim Umbau** hat 29.000 Zeichen dupliziert. Gefunden hat
  es der Kompilierlauf, nicht das Lesen. Deshalb laufen die Gates vor jedem Commit.
- **`margin-inline: auto` auf Flex-Kindern hebt `align-items: stretch` auf.** Der
  Measure-Umbau legte `max-width` + Auto-Margin auf drei Flex-Items (Blockstrom,
  Überblick, Anlegeleiste); sie schrumpften dadurch auf ihre Inhaltsbreite
  (Überblick ~362 px, Blockkarten ~450 px) statt auf das Textmaß — die Sektionen
  hatten unterschiedliche Breiten. Zentrierung gehört auf die Block-Container, nicht
  auf Flex-Kinder.

---

## Der Prototyp

`/prototype/blockwerk.jsx` ist Referenz für **Verhalten und Aussehen**, nie für
Struktur. Er hält den gesamten Zustand in einem Objekt und persistiert über einen
Key-Value-Speicher.

Einiges darin ist ausdrücklich **kein** Vorbild:

- Rückgängig ist als Momentaufnahme des gesamten Zustands gebaut. In der Anwendung
  falsch — das würde parallele Änderungen anderer mit zurückrollen. Dort gehört
  eine gezielte Gegenoperation hin.
- Die Identität ist über einen Umschalter simuliert; in der Anwendung kommt sie aus
  dem Access-Token.
- Alle Stile liegen in einem CSS-Block im selben File.

**Wann er weg kann:** sobald du bei einer Frage nach dem gewünschten Verhalten
zuerst in die Anwendung schaust statt in den Prototyp. Dann entweder löschen oder
in `PROJECT.md` als rein historisch kennzeichnen. Zwei Implementierungen desselben
Verhaltens driften zuverlässig auseinander.

---

## Arbeitsteilung

- **Claude Code im Repo** — Umsetzung, Tests, Migrationen. Liest `PROJECT.md` und
  die ADRs; kennt dieses Gespräch nicht.
- **Chat** — Prototyp, Gestaltung, Prompts, Review von eingefügten Diffs.
- **Claude Design** — nur für offene Gestaltungsfragen, bei denen mehrere Varianten
  nebeneinander helfen. Die Übergabe läuft einmalig als Paket an Claude Code, es
  gibt keine laufende Verbindung zum Repo.

Die Instanzen teilen kein Gedächtnis. Was zwischen ihnen gelten soll, muss in
`PROJECT.md`, in einem ADR oder hier stehen — sonst wird es zweimal entschieden,
beim zweiten Mal anders.

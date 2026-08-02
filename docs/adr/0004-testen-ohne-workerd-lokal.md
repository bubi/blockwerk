# 0004: D1-Tests laufen einstufig gegen echtes workerd

## Kontext

D1-Tests sollen gegen eine echte SQLite-Instanz mit aktiven Fremdschlüsseln laufen, nicht
gegen Mocks — sonst testen die Löschregeln aus [0001](0001-task-spiegel.md) nichts. Der
naheliegende Weg ist `@cloudflare/vitest-pool-workers`, das Tests im echten
workerd-Runtime gegen eine lokale D1-Instanz ausführt.

Der erste Versuch, dieses Paket lokal einzurichten, scheiterte reproduzierbar: der
workerd-Kindprozess stürzte mit `SIGSEGV` ab, bevor ein einziger Test lief. Isoliert wurde:

- **Nicht die Node-Version.** Derselbe Absturz unter Node 22.22.0 und 25.2.1.
- **Nicht das Ausführungs-Sandboxing.** Derselbe Absturz mit und ohne Sandbox.
- **Nicht workerd selbst.** `wrangler dev --local` startet workerd (inklusive eines
  eigenen Inspector-workerd-Prozesses) einwandfrei und beantwortet Requests.

Der Absturz lag also im Kontrollkanal, über den `@cloudflare/vitest-pool-workers` den
workerd-Prozess treibt — nicht in workerd selbst. Die Maschine, auf der das passierte,
meldet `Darwin 25.2.0` (macOS „Tahoe" 26, zum Zeitpunkt dieses Tests ein sehr junges
Release). Eine Websuche zeigte mehrere unabhängige native Tools (u. a. wezterm, hashcat),
die seit dem Tahoe-Upgrade ähnliche Abstürze melden — ein Muster, aber keine exakte
Fehlermeldung, die zu diesem Paket passte.

**Der eigentliche Fehler lag nicht am Betriebssystem, sondern an einer falschen Verwendung
der API.** Der erste Setup-Versuch rief `readD1Migrations()` (liest Dateien via `node:fs`)
aus einer `setupFiles`-Datei auf, die *innerhalb* des workerd-Sandkastens läuft — dort ist
beliebiger Dateisystemzugriff nicht vorgesehen. Das offizielle Beispiel
(`fixtures/vitest-pool-workers-examples/d1` im `cloudflare/workers-sdk`-Repo) liest
Migrationen stattdessen auf der Node-Seite beim Konfigurationsaufbau und reicht sie als
Test-Binding (`TEST_MIGRATIONS`) in den Worker hinein; `applyD1Migrations()` wendet sie dort
an. Nach dieser Korrektur lief das echte workerd/D1 auch lokal stabil, ohne einen einzigen
Absturz.

## Ursprüngliche Entscheidung (inzwischen zurückgebaut)

Auf Basis der noch ungeklärten Absturzursache wurde zunächst ein Shim gebaut:
`node:sqlite` mit `PRAGMA foreign_keys = ON` als schnelle, lokal garantiert lauffähige
Stufe 1 (`npm test`), echtes workerd/D1 als Stufe 2 (`npm run test:workers`, CI) zur
Absicherung gegen ein lügendes Mock. Dieselben Testdateien liefen gegen beide, unterschieden
nur durch einen Alias auf `#test-db`.

Nachdem der echte Fehler (siehe oben) gefunden und behoben war, lief Stufe 2 auch lokal
zuverlässig — der ursprüngliche Auslöser für zwei Stufen (Stufe 2 ist hier kaputt) galt
nicht mehr. Damit blieb nur noch eine Frage: lohnt sich der Shim allein für den
Geschwindigkeitsvorteil? Gemessen an identischem Testumfang (dieselben vier Dateien, zehn
Tests), Median über je fünf Läufe:

| | Median (5 Läufe) |
|---|---|
| Stufe 1 (`node:sqlite`-Shim) | 0,50 s |
| Stufe 2 (echtes workerd/D1) | 1,57 s |
| Differenz | ~1,1 s |

Unter fünf Sekunden Differenz — der Shim (`worker/db/testing/sqlite-d1.ts`,
`get-test-db.local.ts`, der `#test-db`-Alias in `vite.config.ts` und
`worker/db/vitest.config.ts`) wurde ersatzlos entfernt.

## Entscheidung

Eine Stufe: D1-Tests (`worker/db/*.test.ts`) laufen ausschließlich über
`@cloudflare/vitest-pool-workers` gegen echtes workerd/D1, per `npm run test:workers`
(eigener CI-Job auf `ubuntu-latest`, gatet `deploy`). `npm test` deckt sie nicht ab — dafür
`npm run typecheck`, `npm run lint` und `npm test` für alles andere (Domain-Logik, Access).

## Konsequenzen

- **Eine Wahrheit statt zwei.** Kein Shim, der D1s Verhalten nachbilden und mit echtem D1
  synchron bleiben muss. Was grün ist, ist an echtem D1 geprüft — nicht an einer
  Annäherung.
- **~1 s Mehrkosten pro Testlauf sind kein Grund für eine zweite Codebasis.** Ein Shim, der
  nur sechs Methoden nachbildet, ist wenig Code — aber nicht kostenlos: er muss bei jeder
  Erweiterung der D1Like-Oberfläche mitgepflegt werden, obwohl er inzwischen keinen
  Zuverlässigkeitsvorteil mehr bietet, seit die eigentliche Ursache des Absturzes behoben
  ist.
- **`npm run test:workers` ist jetzt Voraussetzung, nicht nur Absicherung.** Wer an
  `worker/db` arbeitet, muss diesen Befehl laufen lassen, nicht nur `npm test` — beide
  README und CI spiegeln das.
- Falls `@cloudflare/vitest-pool-workers` künftig erneut lokal bricht (auf dieser oder
  einer anderen Maschine) und sich der Fehler nicht wie diesmal auf einen Bug in der
  eigenen Testinfrastruktur zurückführen lässt: dann ist ein Shim wieder eine legitime
  Option — diesmal mit einer echten, dokumentierten Ursache statt eines Verdachts.

## Verworfene Alternative: zwei Teststufen dauerhaft behalten

Den Shim trotz behobener Ursache als ständige Stufe 1 weiterführen, mit der Begründung
„schneller ist immer besser". Dagegen: ~1 s Differenz bei zehn Tests ist nicht die Größenordnung,
die eine zweite, separat zu pflegende D1-Implementierung rechtfertigt. Wächst die Testmenge
später deutlich und wird die Differenz relevant, ist das eine neue, mit Zahlen zu belegende
Entscheidung — keine, die man auf Vorrat trifft.

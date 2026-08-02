# 0004: Zwei Teststufen statt einer lokalen workerd-Abhängigkeit

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
Fehlermeldung, die zu diesem Paket passt.

**Nachtrag:** Der eigentliche Fehler lag nicht am Betriebssystem, sondern an einer falschen
Verwendung der API. Der erste Setup-Versuch rief `readD1Migrations()` (liest Dateien via
`node:fs`) aus einer `setupFiles`-Datei auf, die *innerhalb* des workerd-Sandkastens läuft —
dort ist beliebiger Dateisystemzugriff nicht vorgesehen. Das offizielle Beispiel
(`fixtures/vitest-pool-workers-examples/d1` im `cloudflare/workers-sdk`-Repo) liest
Migrationen stattdessen auf der Node-Seite beim Konfigurationsaufbau und reicht sie als
Test-Binding (`TEST_MIGRATIONS`) in den Worker hinein; `applyD1Migrations()` wendet sie dort
an. Nach dieser Korrektur läuft Stufe 2 (unten) auch lokal stabil, ohne einen einzigen
Absturz. Die zwei Teststufen bleiben trotzdem bestehen — nicht mehr als Notlösung für einen
kaputten Kanal, sondern weil Stufe 1 echte Vorteile hat (siehe Konsequenzen), die den
kleinen Wartungsaufwand einer zweiten Stufe rechtfertigen.

## Entscheidung

Zwei Teststufen, dieselben Testdateien (`worker/db/*.test.ts`), unterschiedliche Herkunft
des DB-Handles:

- **Stufe 1 — lokal, `npm test` (Standard):** ein dünner Shim
  (`worker/db/testing/sqlite-d1.ts`) bildet die D1Database-Oberfläche nach, die der
  Datenzugriff tatsächlich nutzt (`prepare`, `bind`, `first`, `all`, `run`, `batch`) —
  über `node:sqlite`. Der Shim setzt `PRAGMA foreign_keys = ON` beim Öffnen; ohne das
  würden SQLites Standardeinstellungen die Löschregeln stillschweigend nicht prüfen. Kein
  ORM, kein zusätzliches natives Paket — `node:sqlite` deckt alles ab, was gebraucht wird.
- **Stufe 2 — CI, `npm run test:workers`, eigener Job auf `ubuntu-latest`:** dieselben
  Testdateien über `@cloudflare/vitest-pool-workers` gegen echtes workerd/D1. Die
  Absicherung dagegen, dass der Shim aus Stufe 1 lügt.

Welche Herkunft ein Testlauf bekommt, entscheidet ein Vite-Alias auf den Bezeichner
`#test-db` (`vite.config.ts` für Stufe 1, `worker/db/vitest.config.ts` für Stufe 2) — die
Testdateien selbst importieren nur `getTestDb()` von dort und wissen nicht, welche Stufe
läuft.

## Konsequenzen

- **Stufe 1 ist der Normalfall.** Schnell (in-memory, kein Kindprozess), lokal
  reproduzierbar, keine Abhängigkeit von einem Tool, das erwiesenermaßen empfindlich auf
  falsche API-Nutzung reagiert. Jeder Beitrag läuft dagegen, auch ohne dass CI abgewartet
  werden muss.
- **Stufe 2 ist die Wahrheit.** `node:sqlite` ist SQLite, D1 ist SQLite mit workerds
  eigener Handhabung von Transaktionen, Limits und Konsistenz obendrauf. Eine Regel, die
  nur in Stufe 1 grün ist, ist nicht bewiesen — deshalb blockiert `deploy` in der CI auf
  *beiden* Jobs (`test` und `test-workers`), nicht nur auf dem schnellen.
- **Bekannte Lücke:** Der Shim bildet nur die sechs genutzten Methoden nach, nicht D1s
  echtes Verhalten bei Netzwerkfehlern, Rate Limits, `D1_ERROR`-Codes oder den Grenzen des
  Free-Plans (50 Abfragen/Aufruf). Das Abfragebudget-Kriterium aus Phase 2a wird deshalb in
  *beiden* Stufen geprüft — in Stufe 1 zählt der Test die tatsächlichen `prepare()`-Aufrufe
  gegen den Shim, was korrekt ist, weil die Zählung reine Aufrufzählung ist und nichts mit
  D1-spezifischem Verhalten zu tun hat. Was der Shim nicht abdeckt und nie abdecken soll:
  ob eine Migration auch *remote* durchläuft — dafür bleibt `npm run db:migrate:remote`
  der einzige verlässliche Test.
- Falls Stufe 2 später auch unter Linux (CI) fehlschlägt, obwohl Stufe 1 grün ist: gegen
  eine Remote-Preview-D1-Instanz laufen lassen statt gegen lokales workerd, und Bescheid
  geben — dann ist vermutlich ein echtes Verhaltens-Delta zwischen Shim und D1 gefunden,
  keine Infrastrukturfrage mehr.

## Verworfene Alternative: nur eine Stufe (workerd überall)

Direkt auf `@cloudflare/vitest-pool-workers` setzen, lokal wie in CI, ohne Shim. Dagegen:

- Der ursprüngliche Absturz zeigt, dass dieser Kanal empfindlich auf Fehler in der
  Testinfrastruktur selbst reagiert (Absturz statt Fehlermeldung) — ein schlechtes
  Fehlerbild für jeden, der lokal an `worker/db` arbeitet, unabhängig davon, ob die
  Ursache diesmal behoben ist.
- Ein Shim, der nur sechs Methoden nachbildet, ist wenig Code für einen echten Gewinn:
  Tests laufen ohne Kindprozess, ohne Abhängigkeit von einem lokal funktionierenden
  workerd-Build, und decken sich mit dem, was `node:sqlite` bereits mitbringt.

## Verworfene Alternative: nur Shim, kein CI-Gegencheck

Stufe 1 allein, mit der Begründung „SQLite ist SQLite". Dagegen: D1 ist nicht nur SQLite —
Transaktionsverhalten bei `batch()`, die Fremdschlüssel-Durchsetzung selbst (die dieses ADR
ja gerade verifizieren soll) und die 50-Abfragen-Grenze sind D1-/workerd-Eigenheiten, die
ein Shim nicht beweisen kann. Ohne Stufe 2 wäre „alle Tests grün" eine Aussage über den
Shim, nicht über D1.

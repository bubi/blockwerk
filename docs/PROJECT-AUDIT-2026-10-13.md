# Projektprüfung vom 13.10.2026

## Ergebnis und Umfang

Blockwerk hat eine solide Trennung zwischen React-Oberfläche, reiner Domänenlogik,
optimistischem Clientzustand und Cloudflare Worker/D1. Vor einer Überarbeitung
müssen vor allem Schreibreihenfolge, Rückrollen und destruktive Sammelaktionen
abgesichert werden. Bestehende Tests decken normale Abläufe gut ab, aber nicht
die unten beschriebenen Fehler- und Parallelitätsszenarien.

Priorisierung: sechs P1-Befunde und fünf P2-Pakete einschließlich JFX;
keine im normalen Testablauf reproduzierte vollständige P0-Blockade.

Anwendungslogik, Schema und produktive Notizen wurden nicht geändert. Ergänzt
wurden dieser Bericht und ein Helfer für isolierte Release-Prüfungen.
Es wurde kein Worker veröffentlicht, kein Remote-Seed importiert und keine
Migration angewendet. Bestehende Änderungen am Prototyp bleiben erhalten.

## Sicherungen

Die Sicherungen liegen im bereits von Git ausgeschlossenen Verzeichnis
`.wrangler/backups/20261013-211901/`, außerhalb des von E2E gelöschten `state`.

| Sicherung | Inhalt | Prüfung |
| --- | --- | --- |
| `local-d1.sqlite` und `local-d1.sql` | 5 Bereiche, 6 Seiten, 7 Blöcke, 32 Items | SQLite-Integrität ok, keine Fremdschlüsselfehler |
| `remote-d1.sql` | 12 Bereiche, 12 Seiten, 37 Blöcke, 375 Items | In frischer SQLite-Datenbank eingelesen; Integrität ok, keine Fremdschlüsselfehler |
| `manifest.json` | Zeilenzahlen und SHA-256-Prüfsummen | Ermöglicht spätere Integritätsprüfung |
| `prototype-working-copy.jsx` | Bereits vor der Prüfung geänderter Prototyp | Original unverändert, Prüfsumme im Manifest |

Das lokale SQLite-Backup wurde über die Backup-API erstellt. Der Remote-Export
kam direkt aus D1. Die Sicherungen enthalten private Notizen und gehören nicht
ins Repository. Sie liegen auf demselben Rechner und ersetzen keine externe
Sicherung. Ein produktiver Wiederherstellungstest wurde nicht ausgeführt.

## Deployment-Bereitschaft

- Cloudflare-OAuth geprüft: Worker- und D1-Schreibrechte vorhanden. Keine neuen
  Zugangsdaten im Projekt gespeichert.
- Worker: `blockwerk`, produktives D1-Binding unverändert gemäß `wrangler.jsonc`.
- Remote-Migrationsliste: keine ausstehenden Migrationen.
- GitHub: Anmeldung als `bubi`; letzter vorhandener CI-Lauf inklusive
  Deployment erfolgreich: [CI vom 12.08.2026](https://github.com/bubi/blockwerk/actions/runs/31611720078).
  Die Aussage in `HANDOFF.md`, CI sei wegen Minutenlimits blockiert, ist damit
  nicht mehr aktuell. Die zukünftige Verfügbarkeit ist dadurch nicht garantiert.
- Lokale Laufzeit: Node 25.2.1, npm 11.6.2; CI verwendet Node 22.
- Vorhandene lokale Abhängigkeiten und einige Git-Dateizugriffe blockierten
  zeitweise in Betriebssystem-Dateizugriffen. Eine Neuinstallation aus dem
  unveränderten Lockfile in einer isolierten Kopie funktioniert. Die Ursache
  der Dateiblockaden ist nicht abschließend geklärt; der ursprüngliche
  `node_modules`-Ordner wurde beibehalten.

Reproduzierbare Vorbereitung, ohne lokale Notizen zu löschen:

```sh
node scripts/verify-release.mjs --e2e
```

Der Helfer kopiert aktuelle Quellen und Konfiguration in einen neuen temporären
Ordner, installiert aus dem Lockfile, führt Build/Typecheck, Lint, beide
Testgruppen, optional E2E und einen Deployment-Dry-Run aus. Lokale D1-Daten,
Git-Metadaten und Backups werden nicht kopiert. Eine vorhandene `.dev.vars`
wird für lokale Tests kopiert; deren Inhalt wird nicht ausgegeben.
E2E benötigt weiterhin einen freien Port 8787. Die temporäre Kopie bleibt für
Diagnosen erhalten und kann ebenfalls die kopierte lokale Konfiguration enthalten.

Nach Freigabe einer konkreten Änderung kann im vom Helfer ausgegebenen Ordner
`npm run deploy` ausgeführt werden. Vorher erneut vorbereiten, wenn sich Quellen
geändert haben; eine alte Kopie enthält einen alten Stand. Das Deployment bleibt
getrennt von Datenbankmigrationen. Ein Push auf `main` löst laut Workflow ebenfalls
ein Deployment aus.

Cloudflare beschreibt [Dry-Runs](https://developers.cloudflare.com/workers/wrangler/commands/workers/)
und [D1-Exporte](https://developers.cloudflare.com/d1/best-practices/import-export-data/)
in der offiziellen Dokumentation.

## Bestehende Prüfungen

Alle folgenden Prüfungen liefen gegen eine isolierte Quellkopie mit frischen
Lockfile-Abhängigkeiten; lokale und produktive Notizdaten wurden dabei nicht verwendet.

| Prüfung | Ergebnis |
| --- | --- |
| TypeScript und Produktionsbuild | erfolgreich |
| ESLint | erfolgreich |
| Domain-/Client-/Auth-Tests | 206 erfolgreich |
| D1-/Worker-Integrationstests | 58 erfolgreich |
| Bestehende Playwright-Tests | 36 erfolgreich, einschließlich Mobile, Listen, JFX und Löschkaskaden |
| `wrangler deploy --dry-run` | erfolgreich, korrekte D1-/Assets-/Access-Bindings |
| Impeccable-Detektor über `src` | keine Musterbefunde; ersetzt keine A11y- oder Verhaltensprüfung |

Zusätzliche Diagnosen bestätigten den Personen-JFX-Kaltstart und den entweichenden
Modalfokus im Browser sowie Rückrollen und Reload-Abgleich am echten Reducer.
Eine zusätzliche Listen-Auswahl-Diagnose war nicht eindeutig und wird nicht als
bestätigter Befund gezählt. Diagnosequellen und Desktop-/Mobile-Screenshots liegen
unter `.wrangler/audit/20261013/`, getrennt von den regulären Tests.

Clientbundle: ca. 284,75 kB JavaScript / 86,37 kB gzip und 35,54 kB CSS / 7,49 kB gzip.
Keine umfassende Lastmessung, Safari-Prüfung oder WCAG-Zertifizierung durchgeführt.

## Priorisierte Fehler und Risiken

P1: vor dem größeren Umbau absichern. P2: im anschließenden Interaktionspaket behandeln.
„Codebefund“ bezeichnet einen belegbaren Ablauf im Code; „reproduziert“ einen
zusätzlich ausgeführten Nachweis. Risiken sind keine Behauptung, dass produktive
Notizen bereits verloren gegangen sind.

### P1 — Schreibvorgänge können sich überholen

**Ort:** `src/components/ItemRow.tsx:263`, `src/state/operations.ts:198`,
`worker/db/items.ts:140`. **Kategorie:** Datenintegrität / Performance.

Jeder Textwechsel sendet sofort einen eigenen PATCH. Es gibt keine Warteschlange
pro Item und keine Versionsprüfung. Bei unterschiedlicher Ankunftsreihenfolge
kann ein älterer Text zuletzt gespeichert werden; mehrere Benutzer überschreiben
sich ebenfalls nach „letzter Schreiber gewinnt“. Zusätzlich entsteht Schreiblast
pro Tastendruck. **Codebefund.** Empfehlung: Änderungen pro Item geordnet senden,
ausstehende Texte sinnvoll bündeln und einen sichtbaren Speicherzustand vorsehen.
Konflikterkennung erst mit abgestimmtem Datenmodell ergänzen.

### P1 — Verspätetes Rückrollen überschreibt neueren Text

**Ort:** `src/state/reducer.ts:535`. **Kategorie:** Datenintegrität.

`failWrite` stellt die vollständige alte Zeile wieder her, ohne spätere Änderungen
zu berücksichtigen. **Mit dem echten Reducer reproduziert:** Original → PATCH A
→ PATCH AB → AB bestätigt → A fehlgeschlagen ergibt im Client wieder „Original“.
Empfehlung: Rückrollen nur für die betroffene Operation und unter Erhaltung
nachfolgender Änderungen; gezielte Parallelitätsregression aufnehmen.

### P1 — Zusammenfassen ist nicht atomar

**Ort:** `src/components/BlockCard.tsx:138`. **Kategorie:** Datenintegrität.

Der kombinierte Text wird gepatcht, anschließend werden die übrigen Originalzeilen
sofort unabhängig gelöscht. Scheitert das Speichern und gelingen die Deletes,
fehlen Originalinhalte. Umgekehrt entstehen bei einzelnen fehlgeschlagenen Deletes
Duplikate. **Codebefund; Produktionsfehler nicht provoziert.** Empfehlung: ein
serverseitiger, transaktionaler Merge mit konsistenter Clientbestätigung.

### P1 — Reload entfernt serverseitig gelöschte Items nicht

**Ort:** `src/state/reducer.ts:168`. **Kategorie:** Datenintegrität / UX.

`applyPageLoaded` entfernt Items nur dann, wenn der gesamte Block fehlt. Bleibt
der Block bestehen, werden seine neuen Items lediglich in die alte Map gemischt.
**Mit dem echten Reducer reproduziert:** Ein Block mit nun leerer Itemliste lässt
ein zuvor geladenes Item weiter im Client stehen. Empfehlung: den geladenen
Blockinhalt vollständig abgleichen und ausstehende lokale Writes gezielt erhalten.

### P1 — Abhängige Neuanlagen warten nicht aufeinander

**Ort:** `src/App.tsx:178` und `src/App.tsx:252`;
`src/state/operations.ts:198`. **Kategorie:** Datenintegrität / UX.

Bei Personen-Tasks und JFX werden gegebenenfalls Seite, Block und Item ohne
gegenseitiges Abwarten angelegt. Das Item kann vor seinem Block eintreffen und
wegen des Fremdschlüssels scheitern. Selbst ein bloßes `await` genügt aktuell
nicht: `runWrite` fängt Fehler und erfüllt sein Promise trotzdem. Der Composer
leert den Entwurf schon vor der Serverbestätigung. **Codebefund.** Empfehlung:
abhängige Schritte serverseitig zusammenfassen oder geordnet mit einem echten
Erfolgs-/Fehlersignal ausführen; Entwurf bei Fehler erhalten.

### P1 — Geringer Kontrast bedeutungstragender Texte

**Ort:** `src/styles/global.css:23`, `src/components/ItemRow.module.css:141`.
**Kategorie:** Accessibility. **Standard:** WCAG 1.4.3, normaler Text mindestens 4,5:1.

Berechnet gegen Weiß: `--text3` 2,63:1, `--green-dk` 4,08:1,
`--red` 3,91:1, `--blue` 3,87:1. Diese Farben werden auch für kleine Fälligkeits-
und Metadatentexte verwendet, nicht nur für dekorative Symbole. Empfehlung:
semantische Textfarben kontrastsicher abstimmen; Fokus und Checkboxrahmen separat
prüfen. Die Aussage „kontrastsicher“ beim Grün-Token ist für kleinen Text falsch.

### P2 — Leere Zeilen, Fokus und destruktive Tasten

**Ort:** `src/components/ItemRow.tsx:194`, `src/components/BlockCard.tsx:269`.
**Kategorie:** UX / Accessibility.

- Backspace löscht im Feld ausschließlich Notizen mit exakt leerem String;
  Leerzeichen sind nicht leer. Bei einer leeren Überschrift oder Listenzeile
  wird zuerst der Marker entfernt. Das ist bewusst so gebaut und muss beim
  Umbau erhalten oder ausdrücklich neu festgelegt werden.
- Delete im leeren Feld entfernt keine Zeile; Escape → Delete im Zeilenmodus
  dagegen schon. In diesem Modus löschen Delete/Backspace auch gefüllte Tasks,
  samt Kindnotizen, ohne Rückfrage und ohne Benutzer-Undo.
- Nach Löschen der einzigen Zeile existiert kein Fokusziel. Wird die erste
  Zeile als Task samt Kindnotiz gelöscht, kann das ausgewählte Folge-Fokusziel
  selbst zur mitgelöschten Kindnotiz gehören.

**Codebefunde.** Empfehlung: explizite Regeln für „leer“ und destruktive Tasten,
Fokus auf die nächste tatsächlich überlebende Zeile oder den Composer und
zusätzliche Szenarien für erste/letzte/einzige Zeile.

### P2 — Modaler Löschdialog sperrt Hintergrundfokus nicht

**Ort:** `src/components/ConfirmDialog.tsx:19`. **Kategorie:** Accessibility.
**Standard:** Tastaturfokus in einem modalen Dialog halten.

Der Dialog nutzt `aria-modal` und fokussiert „Abbrechen“, besitzt aber weder
Fokusfalle noch `inert` für den Hintergrund oder explizite Fokusrückgabe.
**Im Browser reproduziert:** Tab aus dem fokussierten „Abbrechen“-Button
verlässt den Dialog.
Empfehlung: nativen Dialog oder vollständiges Fokusmanagement verwenden.

### P2 — Kleine Touchziele und unterschiedliche Tastaturpfade

**Ort:** `src/components/ItemRow.module.css:175`,
`src/components/ItemRow.tsx:322`, `src/components/TaskOverview.tsx:89`.
**Kategorie:** Responsive / Accessibility / UX.

Das Notiz-Plus hat 24 × 24 px, Zeilenlöschen nur 24 px Breite. Für komfortable
Touchbedienung sind größere Trefferflächen sinnvoll. Nicht pauschal als WCAG-
Verstoß gewertet: Zielgröße, Abstände und Ausnahmen müssen je Stelle geprüft werden.
Zeilenbuttons sind aus der Tab-Reihenfolge entfernt; vieles ist über Escape und
Zeilenmodus erreichbar, aber nicht als sichtbare, einheitliche Bedienregel
erklärt. Der Team-/Meine-Umschalter nutzt Tab-Rollen ohne Pfeilnavigation.
Es gibt keine zentrale Shortcut-Hilfe oder Cmd/Ctrl+K-Suche.
Empfehlung: vorhandene Tasten erhalten, Unterschiede dokumentieren, Tab-Muster
vervollständigen und erst dann fehlende produktweite Shortcuts abstimmen.

### P2 — Tokenquelle ist dupliziert

**Ort:** `design/tokens.css:14`, `src/styles/global.css:13`.
**Kategorie:** Theming / Implementation Integrity.

Trotz „einzige Quelle“-Kommentar definiert die globale CSS-Datei dieselben
Token nochmals. Änderungen an der Design-Datei wirken dadurch nicht automatisch
im Produkt. Empfehlung: eine tatsächlich importierte Tokenquelle und getrennte
globale Grundregeln. Kein Dark Mode gefordert; dessen Fehlen ist hier kein Bug.

## JFX und fehlende Funktionen

JFX ist bereits implementiert: `/jfx`, `@Person`-Zielwahl, Themenliste und
Übernahme in einen Meeting-Block durch Verschieben derselben Item-ID. Die beiden
bestehenden JFX-E2E-Tests laufen erfolgreich.

Die virtuelle JFX-Auswahl setzt `activePageId` auf `null`
(`src/App.tsx:172`) und liest ihre Themen aus bereits geladenen Maps
(`src/state/selectors.ts:175`). Ein Personenbereich startet in der Aufgabenansicht,
deren Daten keine allgemeinen JFX-Notizen enthalten. **Im Browser reproduziert:**
Ein über `/jfx … @lena` gespeichertes Thema ist zunächst sichtbar. Nach Reload
und direktem Einstieg in Lenas „Jour Fix“ fehlt es; nach Öffnen ihrer echten
Notizseite erscheint es wieder. Das Item ist gespeichert, der Fehler liegt im
Ladeweg. Ein Themenbereich öffnet
dagegen automatisch seine echte erste Seite und kann diesen Effekt verdecken.
JFX-Blöcke werden außerdem über den veränderlichen Titel „Jour Fix“ erkannt;
Umbenennen kann ihre Zuordnung verlieren. Empfehlung: den JFX-Datenbedarf
unabhängig von zuvor geöffneten Seiten laden; stabile Blockzuordnung separat
abstimmen. Der Titelbefund wurde nicht durch Umbenennen produktiver Blöcke getestet.

Weitere vorhandene Einschränkungen, keine neuen Implementierungsaufträge:

- Kein Benutzer-Undo; die vorhandenen Undo-Pläne dienen nur fehlgeschlagenen Writes.
- Kein automatisches R2-Backup und keine Versionskonflikterkennung.
- Kein Rückverweisindex, keine Terminserien, keine Anhänge oder Bilder.
- Aufgaben-Zuständigkeit und ein bisher fehlendes Fälligkeitsdatum lassen sich
  über die vorhandene Blockzeile nicht nachträglich vollständig bearbeiten.
- Die Kennzahl „Erledigt, 7 Tage“ hat keinen belastbaren `done_at`-Zeitstempel;
  sie misst laufende Sitzungsänderungen statt einer vollständigen historischen Woche.
- Referenzziele im Composer kommen aus dem geladenen Zustand, nicht aus einem
  vollständigen bereichsübergreifenden Zielkatalog.

## Vorläufige UI-Gesundheit

Die Implementierung besitzt eine erkennbare, produktspezifische Gestaltung.
Der technische Mindeststandard ist wegen Kontrast- und Fokusproblemen noch nicht
durchgehend erfüllt. Keine bloßen Detektor-Warnungen als bestätigte Defekte gewertet.

| Dimension | Wert / 4 | Wesentlicher Befund |
| --- | --- | --- |
| Accessibility | 2 | Kontrast, Modal-Fokus und unvollständige Tastaturmuster |
| Performance | 3 | kleines Bundle; unmittelbare Schreiblast pro Tastendruck |
| Responsive | 3 | eigener mobiler Aufbau und erfolgreiche Mobile-E2E; kleine Touchziele |
| Theming | 2 | konsistente Palette, aber doppelte Tokendefinition |
| Implementation Integrity | 2 | klare Architektur, jedoch erhebliche Datenkonsistenzlücken |
| Gesamt | 12 / 20 | brauchbare Grundlage, gezielte Absicherung nötig |

Positiv: serverseitige Access-JWT-Prüfung, geprüfte Löschkaskaden entlang der
Besitzkette, Erhalt fremder Aufgaben beim Bereichslöschen, gemeinsame Sortierlogik,
stabile Item-IDs, CSS Modules, Fokusindikatoren, eigener mobiler Aufbau und
erfolgreiche bestehende Browserwege. Diese Eigenschaften beim Umbau erhalten.

## Reihenfolge für die Überarbeitung

1. Schreibreihenfolge, Rückrollen, Reload-Abgleich und atomaren Merge absichern;
   `$impeccable harden` für die zugehörigen Fehlerzustände.
2. JFX-Kaltstart und abhängige Neuanlagen absichern, ohne bestehende IDs oder
   Inhalte neu anzulegen.
3. Leere-Zeilen-Regeln und Tastaturmatrix festlegen, Fokus-/Dialogverhalten
   vervollständigen; `$impeccable clarify` und `$impeccable harden`.
4. Kontraste, Touchziele und die echte Tokenquelle korrigieren;
   `$impeccable colorize`, `$impeccable adapt`, `$impeccable extract`.
5. Erst danach Funktionslücken priorisieren; abschließend `$impeccable polish`
   und erneute gezielte Prüfung der geänderten Wege.

Die Pakete können einzeln oder gemeinsam beauftragt werden. Vor jedem größeren
Umbau zuerst konkrete Dateiliste und Plan erstellen. Vor jedem späteren Release
eine neue Datenbanksicherung und eine frische Release-Prüfung verwenden.

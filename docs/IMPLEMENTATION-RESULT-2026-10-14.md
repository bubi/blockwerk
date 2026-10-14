# Ergebnis der Überarbeitung vom 14. Oktober 2026

Die konkreten Arbeitspakete aus dem [Umsetzungsplan](IMPLEMENTATION-PLAN-2026-10-14.md)
sind lokal umgesetzt. Die drei Reviews vom 13. Oktober bleiben als historische
Befundaufnahme erhalten. Es gab kein Deployment, keinen Push und keine Änderung
an Produktionsdaten oder am Datenbankschema.

## Notizen und Schreibsicherheit

- Geordnete Schreibwarteschlange und gebündelte Textänderungen; spätes Scheitern
  überschreibt keine neuere Eingabe. Fehlgeschlagener Text bleibt als sichtbarer
  Entwurf und wird lokal gesichert. Composer-Inhalte verschwinden erst nach
  erfolgreichem Speichern; Eingaben sind während ihres Speicherns geschützt.
- Revision über das bestehende `updated_at`: Item-PATCH, Löschen, Verschieben,
  Zusammenführen und Umwandeln erkennen veraltete Änderungen. Wiederholte
  Item-Neuanlage bestätigt gleichen Inhalt, überschreibt aber keine spätere
  Bearbeitung. Alte Clients ohne Versionsheader bleiben kompatibel.
- Ein Seiten-/Übersichtsabruf, während dessen geschrieben wurde, wird wiederholt.
  Pending Writes bleiben über Reload-Abgleiche erhalten; serverseitig entfernte
  Zeilen verschwinden aus dem Cache.
- Zusammenführen erfolgt atomar auf dem Server und erhält die erste Item-ID.
  Die Originale bleiben bei einem Konflikt erhalten. Leere Zeilen, reine
  Leerzeichen, Listenmarker, IME-Eingaben, markierter Text und Fokus nach Löschen
  sind berücksichtigt.
- Gezieltes Rückgängig für Item-Löschen, Zusammenführen und Umwandeln: gleiche
  IDs und Erstellungszeit, keine Überschreibung neuerer Arbeit. Große Aufgaben
  werden mit ihren Kindnotizen in einer Transaktion wiederhergestellt; JSON-
  Bulk-Inserts vermeiden eine Datenbankabfrage pro Zeile.

## Erfassung, Jour Fix und Aufgaben

- „Erfassen“ bietet eine explizite Ablagewahl und den vorhandenen Composer.
  Abhängige Seite/Block/Item-Neuanlagen warten auf bestätigte Eltern. Stabile
  Capture-IDs finden auch umbenannte Ablageblöcke wieder.
- Jour Fix lädt auch nach einem Kaltstart die tatsächliche Notizseite, erlaubt
  direktes Erfassen und Bearbeiten. Der reservierte Blocktitel ist schreibgeschützt.
- Übernommene Themen behalten ihre IDs und erhalten einen Verweis auf das
  Gespräch. Mehrere Themen werden in serverseitig bestimmter Reihenfolge angehängt.
- Ein gemeinsamer Editor ergänzt Zuständigkeit, Fälligkeit, Termin und Uhrzeit,
  Erledigt-Status sowie Umwandlung zwischen Notiz/Aufgabe/Termin. Tasks mit
  Kindnotizen lassen sich nicht versehentlich in einen ungeeigneten Typ umwandeln.

## Wiederfinden, UX und Design

- Suche springt zur genauen Zeile, markiert Treffer, bietet Filter für Bereich,
  Typ und Blockdatum sowie Direktlinks, die auch nach Reload zum Ziel führen.
- Erledigte Aufgaben sind auffindbar und wieder zu öffnen. Block-Verweise und
  Rückverweise helfen, den Ursprung und verknüpfte Gespräche wiederzufinden.
- „Heute“ zeigt die Aufgaben früher: kompakter Tageskopf, Teamzusammenfassung
  nach den Aufgaben, Datumspanel auf Wunsch. Der Sitzungszähler benennt seine
  tatsächliche Bedeutung. Mobile Inhalte vermeiden horizontalen Überlauf und
  berücksichtigen die feste Navigation.
- Eine Tokenquelle, bessere Text-/Bedeutungsfarbkontraste, größere Touchflächen,
  klare Fokuszustände, beschriftetes „Block anlegen“, konsistente deutsche Begriffe.
- Kontextuelle Tastaturhilfe; Alt+N, Cmd/Ctrl+K und gezieltes Cmd/Ctrl+Z außerhalb
  von Textfeldern. Reiter und Vorlagenmenüs unterstützen Pfeile/Home/End.
  Dialoge halten den Fokus, schützen den Hintergrund und stellen den Fokus wieder
  her. Escape schließt bei verschachtelten Dialogen nur den vordersten.

## Betrieb und Grenzen

`node scripts/verify-release.mjs --e2e` prüft eine frische Quellkopie mit
Lockfile-Installation. E2E nutzt ausschließlich `.wrangler/e2e-state`; der frühere
Löschbefehl für `.wrangler/state` ist entfernt. Vor jedem Commit liefen die vier
Projekt-Gates. Der endgültige Build, ESLint, **213 Client-/Domänentests, 67 Worker-/D1-Tests,
46 Playwright-Browserwege und der Deployment-Dry-Run waren erfolgreich**.
Die geprüfte Quellkopie mit gebauten Assets liegt unter
`/private/var/folders/hp/d35n6_yn2zx90_913q0sj9_40000gn/T/blockwerk-release-N9OoQa/`.
Sie wird nicht automatisch veröffentlicht; nach weiteren Quelländerungen neu prüfen.

Die visuelle Prüfung umfasste Desktop-Heute, Notizseite, Editor und Mobile-Heute.
Kein horizontaler Überlauf bei 360, 390, 768 und 1.440 px; keine JavaScript-
Laufzeitfehler. Bei 390 px beginnt die erste Aufgabe bei y=424 px statt etwa
779 px in der ursprünglichen Analyse. Mobile Titel umbrechen vollständig;
Checkbox und Statusbeschriftung im Editor stehen zusammen. Sekundärtexte und
Bedeutungsfarben erreichen auf der Arbeitsfläche mindestens 4,5:1, Checkbox-
Rahmen mehr als 3:1. Screenshots und Messwerte liegen lokal, ignoriert, unter
`.wrangler/audit/final-20261014/`.

Der abschließende read-only Vergleich bestätigt: die lokale Entwicklungsdatenbank
ist seit der Sicherung vom 14.10. vollständig unverändert (5 Bereiche, 6 Seiten,
7 Blöcke, 32 Items, 5 Vorlagen), Integrität OK, keine Fremdschlüsselverletzung.
Die Prüfsummen aller vier Sicherungsdateien vom 13.10. stimmen weiterhin.

Die geprüfte Produktionssicherung vom 13.10. liegt lokal unter
`.wrangler/backups/20261013-211901/` (375 Items). Am 14.10. wurde zusätzlich die
lokale SQLite-Datenbank gesichert. Ein erneuter vollständiger Produktionsexport
wurde von der automatischen Freigabeprüfung wegen des sensiblen Gesamtinhalts
und einer fehlenden ausdrücklichen Freigabe für den neuen Export abgelehnt;
er wurde nicht ausgeführt. Die Backups sind ignoriert und werden nicht committed.

Bewusste Grenzen: Rückgängig umfasst die letzten zehn Aktionen der laufenden
Sitzung und höchstens 1.000 Items pro Wiederherstellung; Bereich/Seite/Block-Löschen
bleibt eine bestätigte Hierarchieaktion. Es gibt keine Offline-Synchronisation,
kein historisches `done_at`, keinen automatischen R2-Backupdienst und keinen
universellen Konfliktschutz für alte API-Clients oder Hierarchie-/Vorlagenänderungen.
Die ausdrücklich zurückgestellten Produktideen (Kanban, Gantt, Anhänge,
Terminserien, Kalender-Sync, komplexe Kapazitätsplanung) wurden nicht ergänzt.

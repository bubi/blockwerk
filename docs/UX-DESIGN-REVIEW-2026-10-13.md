Method: dual-agent (A: /root/design_review · B: /root/browser_evidence), ergänzt durch eine Browserprüfung des Hauptagenten.

# UX- und Designreview: Blockwerk

## Urteil

Blockwerk besitzt eine passende visuelle Identität für ein internes Arbeitswerkzeug:
ruhige Flächen, starke Inhaltstitel, Grün für Interaktion und semantische Farbe.
Bereiche, datierte Notizblöcke und Aufgaben mit Herkunft sind produktspezifisch.
Diese Grundlage erhalten. Die größte Schwäche ist die Verteilung von Aufmerksamkeit
und Handlungsmöglichkeiten: Zusammenfassungen stehen vor der Arbeit, Erfassung
verlangt Kontextwechsel und die Grenze zwischen Bearbeiten und sicher Speichern
ist für Nutzer zu wenig sichtbar.

**Vorläufige heuristische Bewertung: 20/40 — brauchbare Grundlage mit wesentlichem
Verbesserungsbedarf.** Das ist ein begründetes Expertenurteil, keine Messung von
Nutzerzufriedenheit und kein WCAG-Zertifikat. Alle zehn Heuristiken gelten für
dieses Operate-Werkzeug; keine wurde als nicht anwendbar ausgeschlossen.

## Methode und Evidenz

Ziel: `src/App.tsx`, Slug `src-app-tsx`. Keine Critique-Ignoreliste vorhanden.
Zwei isolierte Agenten prüften unabhängig voneinander. A las Produktbrief,
Design-System und App-Struktur, ohne frühere Berichte oder Detektorergebnisse.
B führte den Detektor aus und hielt Ergebnisse bis nach Abschluss von A zurück.
Die Quellbewertung von A lag bei vorläufig 23/40; die folgende Gesamtbewertung
berücksichtigt zusätzlich visuelle Evidenz und zuvor bestätigte Fehlerpfade.

Die nativen Browserflächen waren nicht verfügbar: IAB meldete „Browser is not
available: iab“, das Browserinventar war leer; native App-Bindungen hingen und
wurden durch die Hauptinstanz abgebrochen. Die Agenten inspizierten deshalb
selbst keine Live-Oberflächen. Diese Einschränkung wird nicht als erfolgreicher
visueller Review ausgegeben.

Der Hauptagent ergänzte eine begrenzte Headless-Playwright-Prüfung gegen die
isolierte, lokal gestartete Beispiel-App auf Port 8791: Heute, Notizstream,
JFX, Suche sowie mobiles Heute. Desktop 1440 × 900 px, Mobile 390 × 844 px.
Die Screenshots wurden visuell geprüft. Es entstand kein sichtbares
Browser-Overlay und keine Script-Injection. Weder Oberfläche noch Notizdaten
wurden geändert. Aktuelle Screenshots liegen unter `.wrangler/audit/20261013-ux/`.
Die alten Seed-Daten erklären die hohen Überfälligzahlen; daraus wird kein
Rückschluss auf tatsächliches Teamverhalten gezogen.

Detektor: `node .agents/skills/impeccable/scripts/detect.mjs --json src`,
Exitcode 0, exakte Ausgabe `[]`: keine Musterbefunde und keine False Positives.
Der Detektor deckt die hier betrachteten Ablauflücken nicht vollständig ab.

## Heuristiken

| Heuristik | Wert / 4 | Wichtigster Befund |
| --- | --- | --- |
| Sichtbarkeit des Systemstatus | 2 | Lade-/Fehlerzustände vorhanden; Erfolg einzelner Speicherungen zu wenig erkennbar |
| Sprache und Lebenswelt | 3 | Personen, Notizen und Termine verständlich; Task/Template und Kennzahlen uneinheitlich |
| Kontrolle und Freiheit | 2 | Zurück und Suche verlassen vorhanden; kein Benutzer-Undo |
| Konsistenz und Standards | 2 | gemeinsame visuelle Rollen; abweichende Bearbeitungs- und Tastaturpfade |
| Fehlervermeidung | 1 | Zeilenlöschen und Merge noch unzureichend abgesichert |
| Wiedererkennen statt Erinnern | 2 | erkennbare Navigation; Befehle und Tastaturmodus verlangen Vorwissen |
| Flexibilität und Effizienz | 2 | Slash-Kommandos und Zeilenauswahl gut; kein zentraler Erfassungseinstieg |
| Ästhetik und Minimalismus | 3 | ruhige Gestaltung; Zusammenfassungen und leeres Datumsband beanspruchen viel Platz |
| Fehlerdiagnose und Erholung | 2 | Wiederholungswege vorhanden; gespeicherte JFX-Themen können wie echte Leere aussehen |
| Hilfe und Dokumentation | 1 | kurze Platzhalterhinweise, keine vollständige auffindbare Bedienhilfe |
| Gesamt | 20 / 40 | mehrere Kernabläufe benötigen Überarbeitung |

## Was funktioniert

1. **Lesen mit Kontext:** Blocktitel sind stark, Textgruppen klar getrennt;
   Aufgaben behalten ihre Herkunft. Suchtreffer nennen Bereich, Seite und Block.
   Das hilft beim Wiederfinden statt nur beim Abhaken.
2. **Ruhige, konsistente Identität:** neutrale Flächen, begrenzte Lesebreite und
   semantische Farben passen zu längerer täglicher Nutzung. Mehr Dekoration oder
   eine neue Schriftfamilie würden die zentralen Probleme nicht lösen.
3. **Eigener mobiler Aufbau:** Heute / Notizen / Suche und der Zurückweg bilden
   eine verständliche Basis. Im geprüften Heute-Viewport trat kein horizontaler
   Overflow auf; dasselbe gilt für den geprüften Desktop-Einstieg.

## Fünf priorisierte Themen

### P1 — Erfassung und JFX verlangen unnötige Kontextwechsel

**Beleg:** `src/components/Stream.tsx:181`, `src/App.tsx:252`.
Die leere JFX-Ansicht verweist auf `/jfx`, enthält aber selbst null Eingabefelder
und null Buttons. Ein neuer Kollege muss die Ansicht verlassen und einen anderen
Block öffnen, um für diese Liste zu sammeln. Der bereits bestätigte Personen-
Kaltstartfehler kann gespeicherte Themen zusätzlich wie eine leere Liste aussehen lassen.
Auch Heute ist auf Sichten ausgerichtet, ohne unmittelbare Erfassungsaktion.

**Auswirkung:** Der Nutzer muss den Ablageaufbau verstehen, bevor er einen
Gedanken festhalten kann. Ein leerer Zustand hilft hier nicht zum nächsten Schritt.

**Empfehlung:** In JFX direkt erfassen können; Laden, fehlgeschlagenes Laden und
echte Leere unterscheiden. Für Heute einen klaren Erfassungseinstieg mit sichtbarem
Zielkontext gestalten. Das bestehende Objektmodell und vorhandene Item-IDs erhalten.
Passend: `$impeccable shape`, `$impeccable onboard`.

### P1 — Bearbeiten, Speichern und Wiederherstellen vermitteln zu wenig Sicherheit

**Beleg:** `src/components/ItemRow.tsx:236`, `src/state/operations.ts:198`,
`src/components/BlockCard.tsx:138`, `src/components/ConfirmDialog.tsx:19`.
Bestehende Zeilen sind direkt editierbar und speichern unmittelbar; der zusätzliche
Button „Hinzufügen“ betrifft neue Einträge. Dieser Unterschied ist visuell kaum
erklärt. Zeilenmodus löscht auch gefüllte Zeilen; ein Benutzer-Undo fehlt.
Die frühere Browser-Reproduktion bestätigt entweichenden Fokus aus dem Löschdialog.
Die technischen Schreib-/Merge-Risiken stehen im separaten Projekt-Audit.

**Auswirkung:** Nutzer können sichtbaren Text nicht sicher mit gespeichertem Text
gleichsetzen und haben beim Fehlklick keinen einfachen Rückweg.

**Empfehlung:** verständlichen Speicherstatus und Fehlerbezug zur betroffenen
Zeile; Entwürfe bei Fehler erhalten; gezieltes Undo für destruktive Änderungen;
Fokus im Dialog halten und anschließend zurückgeben. Bearbeitungszustände durch
Fokus/aktive Fläche vermitteln, ohne jedes Feld dauerhaft einzurahmen.
Passend: `$impeccable harden`, `$impeccable clarify`.

Ein modaler Dialog sollte den Tab-Fokus im Dialog halten, bis er geschlossen ist:
[W3C-Dialogmuster](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/).

### P1 — Kleine Texte und Bedienelemente sind zu zurückhaltend

**Beleg:** `src/styles/global.css:23`, `src/components/ItemRow.module.css:175`.
Metadaten, Fälligkeiten, × und das Notiz-Plus sind klein und teils sehr blass.
Berechnet gegen Weiß: `--text3` 2,63:1, grüner Text 4,08:1, roter Text 3,91:1.
Die Farben werden auch für bedeutungstragende kleine Texte verwendet.
Das Notiz-Plus misst 24 × 24 px; Zeilenlöschen hat nur 24 px Breite.

**Auswirkung:** Wichtige Details sind schwerer zu lesen und kleine Aktionen
auf dem Telefon schwerer zu treffen. „Ruhig“ wird hier teilweise zu „unauffindbar“.

**Empfehlung:** Kontrast der Textrollen erhöhen, Status nicht nur durch Farbe
vermitteln und Touch-Trefferflächen vergrößern. Grün als Identität beibehalten;
nicht die ganze Oberfläche stärker einfärben. Keine pauschale WCAG-Verletzung
allein aus einer 24-px-Trefffläche ableiten: Abstände und Ausnahmen je Stelle prüfen.
Passend: `$impeccable colorize`, `$impeccable adapt`.

Normaler Text benötigt für WCAG AA grundsätzlich 4,5:1, mit definierten Ausnahmen:
[W3C-Kontrastanforderung](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

### P2 — Heute gewichtet Zusammenfassung stärker als konkrete Arbeit

**Beleg:** `src/components/Today.tsx:107`, aktuelle Browseraufnahmen.
Am Desktop beginnt die erste Aufgabenzeile bei etwa y=591 px von 900 px Höhe.
Auf Mobile bei y=779 px von 844 px; die feste Tab-Leiste verdeckt dort den Beginn.
Datum, vier Kennzahlen, Umfangsschalter und Team-Auslastung kommen vorher.
Rechts beansprucht selbst ein leerer Monatskalender eine große dauerhafte Fläche.

**Auswirkung:** Wer etwas erledigen will, muss zuerst eine Zusammenfassung
überwinden. Mehr Oberfläche bedeutet hier nicht mehr Orientierung.

**Empfehlung:** eigene/relevante Aufgaben früher zeigen, Kennzahlen komprimieren,
Auslastung sekundär machen; Datumsband bedarfsabhängig einblenden oder einklappen.
„Erledigt, 7 Tage“ entfernen/korrekt benennen, solange nur Sitzungsdaten zugrunde
liegen. „Auslastung“ besser als „Offene Aufgaben nach Person“ bezeichnen.
Passend: `$impeccable distill`, `$impeccable layout`.

### P2 — Erlernbare Regeln und Aktionsgewichtung sind uneinheitlich

**Beleg:** `src/components/Composer.tsx:200`, `src/components/ItemRow.tsx:109`,
`src/components/NewBlockBar.tsx`, `src/components/SearchResults.tsx:14`.
Sieben Slash-Einträge mischen Inhaltstypen, Überschrift, Merge und JFX-Ablauf.
Die Tastatur unterscheidet Feld- und Zeilenmodus; Enter und Backspace wirken je
nach Modus/Inhalt unterschiedlich. Die Regeln sind leistungsfähig, aber schwach
sichtbar. Ein kleines Plus startet Blöcke, während „Löschen“ in jedem Kopf steht.
Deutschsprachige „Aufgabe“ wechselt mit „Task“, teilweise auch „Template“.

**Auswirkung:** Nutzer lernen durch Versuch und Irrtum und können in einem
ungewohnten Fokuszustand eine destruktive Aktion auslösen.

**Empfehlung:** sichtbare primäre Aktion „Block anlegen“, sekundäre Verwaltung
bündeln, kurze Befehls-/Shortcut-Hilfe im Kontext, einheitliche deutsche Labels.
Vorhandene Tastaturwege erhalten und dokumentieren, bevor Tasten neu belegt werden.
Sieben Befehle allein sind kein Beweis für Überforderung; das Problem ist ihre
vermischte Bedeutung und fehlende Kontextführung.
Passend: `$impeccable clarify`, `$impeccable onboard`.

## Kognitive Last und emotionale Reise

**Gut:** Navigation, Textgruppen und Suchtreffer besitzen nachvollziehbare
Gruppierung. Die sieben Befehle werden erst im Slash-Menü sichtbar.
**Problematisch:** primärer Fokus und Hierarchie auf Heute; Erinnerungsbedarf
für den Tastaturmodus; Kontextwechsel zwischen JFX-Liste und Erfassung.
Das sind vier beobachtete Reibungsindikatoren, keine gemessene kognitive Belastung.
Die derzeitige UI wirkt leicht, kann aber mehr Lernarbeit verlangen, als ihr
ruhiges Erscheinungsbild erwarten lässt.

Der Einstieg bietet Orientierung. Beim Erfassen fällt die Zuversicht durch die
indirekte Zielwahl; beim Speichern fehlt eine klare Bestätigung; nach versehentlichem
Löschen fehlt der einfache Rückweg. Die größte Chance ist verlässlich erlebte
Kontrolle, nicht zusätzliche Animation. Bei vielen überfälligen Aufgaben kann
Alarmrot dominieren; die Menge im Beispielbestand ist kein Beleg für echten Teamstress.

## Personas

- **Jordan, neuer Kollege:** findet Bereiche und Suchkontext, aber in JFX keinen
  Einstieg zum Hinzufügen. Muss `/jfx`, `@`, `!` und den Unterschied zwischen
  Inline-Bearbeiten und „Hinzufügen“ lernen.
- **Alex, Tastatur-Power-User:** profitiert von Slash-Menü, Zeilennavigation und
  Bereichsauswahl. Die Modusunterschiede, uneinheitliche Bearbeitbarkeit von
  Metadaten und fehlendes Undo begrenzen Sicherheit und Geschwindigkeit.
- **Casey, unterwegs:** versteht die drei Haupttabs, sieht im geprüften ersten
  Heute-Bildschirm aber keine nutzbare Aufgabenzeile und keine schnelle Erfassung.
  Kleine Zeilenaktionen und Unterbrechungen beim Schreiben sind kritische Wege.

## Kleinere Beobachtungen

- Die Sidebar kürzt das „ich“-Badge im geprüften Desktop-Zustand stark; Name und
  Zusatz brauchen eine abgestimmte Breitenregel.
- Suchtreffer zeigen hilfreichen Ursprung, markieren aber den Suchausdruck nicht
  sichtbar. Ein Sprung sollte die genaue Trefferzeile fokussieren/hervorheben.
- Native Datumsfelder erscheinen in den Aufnahmen numerisch nach Browser-/OS-
  Konvention. Die deutsche Beschriftung und Datumsformatierung auf anderen
  Geräten gesondert prüfen; nicht als bewiesenen Parserfehler behandeln.
- Die feste mobile Tab-Leiste darf Aufgaben beim Scrollen nicht dauerhaft
  verdecken; aktuell wurde nur der erste Viewport, nicht jede Scrollposition geprüft.

## Offene Gestaltungsentscheidungen

1. Soll Heute unmittelbar erfassen können, oder bewusst nur bestehende Arbeit sichten?
2. Soll Team-Auslastung dauerhaft vor den eigenen Aufgaben stehen?
3. Welche destruktiven Änderungen müssen sofort rückgängig gemacht werden können?

Die konkrete Umsetzungsreihenfolge und der Umfang werden anschließend mit dem
Nutzer festgelegt. Dieser Review beauftragt keine UI-Änderung und keine Migration.

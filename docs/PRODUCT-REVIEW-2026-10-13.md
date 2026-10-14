# UI- und Produktbewertung vom 13.10.2026

## Urteil

Die Produktidee ist sinnvoll: Notizen behalten ihren Gesprächskontext; Aufgaben
und Termine entstehen daraus und werden zusätzlich in passenden Übersichten
sichtbar. Die Oberfläche unterstützt diese Idee grundsätzlich. Mehrere Abläufe
sind jedoch nur vom Anlegen her gedacht und nicht über ihren ganzen Lebenszyklus.
Vor einer Erweiterung sollte Blockwerk Erfassen, Ändern, Wiederfinden und
Wiederherstellen zuverlässig und verständlich machen.

Das ist eine eigene PO-/UX-Bewertung auf Basis von Produktbrief, Code,
vorher ausgeführten Browserwegen und geprüften Desktop-/Mobile-Screenshots.
Es ist keine Nutzerstudie und kein neuer unabhängiger Mehrpersonen-Designreview.
Bewertungen sind begründete Produkthypothesen; echte Nutzung kann Prioritäten ändern.
Es wurden keine Funktionen oder Oberflächen geändert.

## Sinn und Vollständigkeit der vorhandenen Funktionen

| Funktion | PO-Bewertung | Lücke im Arbeitsablauf |
| --- | --- | --- |
| Bereich → Seite → datierter Block | behalten: nachvollziehbarer Arbeitskontext | schnelle Erfassung verlangt zu früh eine Ablageentscheidung; lange Streams brauchen Orientierung |
| Aufgabe im Ursprungsblock, zusätzlich bei Person | besonders stark: eine Aufgabe, mehrere sinnvolle Sichten | Zuständigkeit und Fälligkeit nachträglich ändern; erledigte Aufgaben wiederfinden und öffnen |
| Heute / Team / Nur meine | sinnvoller Einstieg | „Heute“ enthält auch die gesamte offene Zukunft; Aufgaben liegen unter Kennzahlen und Auslastung |
| Jour Fix | sinnvoll: Themen vor einem Gespräch sammeln und im Gespräch übernehmen | in der eigenen JFX-Ansicht fehlt die direkte Eingabe; Kaltstart lädt Personen-Themen nicht; Übernahme hat keinen sichtbaren Herkunftsverlauf |
| Termine aus Notizen | behalten: konkrete Folgehandlung statt isolierter Kalender | Terminänderungen nicht überall erreichbar; insbesondere mobil fehlt der Desktop-Datumseditor |
| Suche | unverzichtbar | Suchergebnis springt zum Block statt direkt zur passenden Zeile; kein sichtbarer Filter für Bereich/Typ/Zeitraum |
| Templates | sinnvoll für wiederholbare Meetingstruktur | Verwaltung ist vom Anwendungsfall entfernt; nicht zuerst zu einem komplexen Template-System ausbauen |
| Verweise | sinnvoll für zusammenhängendes Wissen | Ziele hängen vom geladenen Zustand ab; Rückverweise und kopierbare Direktlinks fehlen |
| Listen zusammenfassen | nützliche Ergänzung | nur für geübte Nutzer auffindbar; vor allem noch nicht gegen teilweises Scheitern abgesichert |

## Die fünf wichtigsten Produktlücken

### 1. Schnell erfassen, ohne zuerst aufzuräumen

**Beobachtung:** Der primäre Composer hängt am Block; zusätzlich gibt es einen
Task-Composer in der Personenansicht. Auf „Heute“ fehlt eine zentrale Erfassung.
Das Telefon verlangt Navigation durch Bereich und Seite, bevor eine Notiz
geschrieben werden kann.

**Empfehlung:** Ein gut sichtbarer Einstieg „Notiz / Aufgabe erfassen“, von
„Heute“ und mobil erreichbar. Der aktuelle Kontext sollte voreingestellt sein;
eine globale Erfassung benötigt eine eindeutig sichtbare, bewusst gewählte
Standardablage. Dafür ist nicht zwingend eine neue Inbox-Tabelle erforderlich.
Die Bedeutung der Ablage muss vor Umsetzung festgelegt werden.

**Erfolgskriterium:** Einen spontanen Gedanken mit einer Aktion beginnen und
ohne Kenntnis des Datenmodells wiederfinden können.

### 2. Aufgaben vollständig bearbeiten

**Beobachtung:** Anlegen mit `/task`, `@Person` und `!datum` funktioniert.
Nachträgliche Änderung derselben Metadaten ist in der normalen Zeile unvollständig.
Ein vorhandener Notizgedanke lässt sich nicht direkt zur Aufgabe umwandeln.

**Empfehlung:** Gleiche Bearbeitungsmöglichkeiten in Block und Aufgabenübersicht:
Text, Zuständigkeit, Fälligkeit und Erledigungszustand. Umwandeln von Notiz zu
Aufgabe als kontrollierte Änderung derselben Identität prüfen, mit Erhalt von
Text, Verweisen und Kontext. Keine parallele Kopie des Eintrags erzeugen.

**Erfolgskriterium:** „Das übernimmt Lena bis Freitag“ lässt sich auch nach dem
Meeting korrigieren, ohne den Eintrag neu anzulegen.

### 3. Fehler rückgängig machen und Inhalte wiederherstellen

**Beobachtung:** Notizen können unmittelbar gelöscht werden; Task-Löschen
entfernt auch Kindnotizen. Es gibt Rollback bei Netzwerkfehlern, aber kein
Benutzer-Undo oder einen Papierkorb. Backups helfen im Betrieb, sind aber kein
zugänglicher Wiederherstellungsweg für das Team.

**Empfehlung:** Zunächst ein gezieltes Undo für Löschen und Umformen; einen
Papierkorb mit definierter Aufbewahrung separat bewerten. Die Lösung darf nicht
den gesamten Zustand zurücksetzen und damit fremde Änderungen überschreiben.
Erledigte Aufgaben sollten auffindbar und wieder zu öffnen sein.

**Erfolgskriterium:** Ein versehentlich gelöschter Absatz ist unmittelbar
wiederherstellbar, ohne technische Hilfe oder Datenbank-Restore.

### 4. Jour Fix als zusammenhängenden Arbeitsablauf gestalten

**Beobachtung:** Die JFX-Ansicht sagt bei Leere „Tippe im Composer /jfx“, zeigt
selbst aber keinen Composer. Nutzer müssen einen anderen Block öffnen, um ein
Thema für die gerade angesehene Liste anzulegen. Personen-JFX kann nach Reload
gespeicherte Themen unsichtbar lassen. Übernommene Themen verschwinden aus der
Sammlung, ohne dort einen Weg zum Gesprächsergebnis anzubieten.

**Empfehlung:** In JFX direkt sammeln und bearbeiten können; Ladezustand und
echte Leere unterscheiden. Vorbereiten → Meeting übernehmen → Ergebnis bzw.
Folgeaufgabe wiederfinden als vollständigen Ablauf ausarbeiten. Herkunft bzw.
Zuordnung sichtbar machen, ohne Inhalte zu duplizieren. Eine explizite Anzeige
„besprochen“ erst ergänzen, wenn der gewünschte Lebenszyklus geklärt ist.

**Erfolgskriterium:** „Was will ich mit Lena besprechen?“ und später „Was kam
dabei heraus?“ sind beide ohne Suchen in zufälligen Blöcken beantwortbar.

### 5. Wiederfinden und Zusammenarbeit vereinfachen

**Beobachtung:** Suche bietet Texttreffer und Blocksprünge. Mobile Navigation
speichert Zustände in der History, aber keine kopierbare Block-/Itemadresse.
Mehrere Personen können bearbeiten, ohne einen Schutz gegen stille Überschreibung.

**Empfehlung:** Trefferzeile fokussieren und hervorheben; stabile Direktlinks zu
Blocks und perspektivisch Items; einfache Suchfilter erst bei belegtem Bedarf.
Speicherstatus und Konfliktbehandlung gehören zur Verlässlichkeit gemeinsamer
Arbeit, auch ohne Echtzeit-Kollaboration.

**Erfolgskriterium:** Ein Kollege öffnet einen Link und sieht denselben Kontext;
gleichzeitige Arbeit zerstört keine Änderung stillschweigend.

## UI: konkrete gestalterische und funktionale Probleme

### Aufgaben kommen zu spät

Im mobilen Heute-Screenshot belegen Tageskopf, vier Kennzahlen, Umfangsschalter
und Auslastung fast den gesamten ersten Bildschirm. Die eigentlichen Aufgaben
beginnen erst am unteren Rand. Das ist für ein Arbeitswerkzeug die falsche
Gewichtung. Eigene heute relevante Aufgaben sollten früher erscheinen;
Teamzusammenfassung und Auslastung können kompakter oder sekundär werden.

### Der leere Kalender bekommt viel Fläche

Am Desktop reserviert die rechte Spalte auch ohne Termine erheblichen Platz,
während der Editor schmal bleibt. Das Datumspanel sollte bei Bedarf präsent sein
und ansonsten zurücktreten. Keine weitere Dashboardfläche hinzufügen, bevor
diese Verteilung geklärt ist.

### Anlegen und Löschen sind ungleich gewichtet

Ein kleines Plus auf einer Trennlinie ist der Block-Einstieg; „Löschen“ steht
direkt in jedem Blockkopf und viele × stehen an einzelnen Zeilen. Die häufige,
positive Aktion ist schwächer erläutert als die destruktiven Optionen. Block
anlegen verständlich beschriften und sekundäre Aktionen ruhiger bündeln, ohne
sie ausschließlich per Hover erreichbar zu machen.

### Die Oberfläche setzt zu viel Vorwissen voraus

Slash-Befehle, @-Zielwahl, Datumstokens und zwei Tastaturmodi sind effizient,
aber nicht ausreichend sichtbar erklärt. „Task“, „Aufgabe“, „Jour Fix“ und „JFX“
wechseln als Bezeichnungen. Eine kleine kontextuelle Hilfe, klare deutsche Labels
und eine vollständige Tastaturmatrix sind sinnvoller als ein großes Tutorial.
Wichtige Aktionen müssen auch ohne Kommando-Syntax auffindbar bleiben.

### Kennzahlen versprechen mehr, als sie messen

„Auslastung“ zählt offene Aufgaben; fünf kurze Aufgaben sind nicht zwingend mehr
Arbeit als eine große. Als „Offene Aufgaben nach Person“ wäre die Darstellung
ehrlicher. „Erledigt, 7 Tage“ zählt nur Sitzungsänderungen und ist keine belastbare
Wochenstatistik. Die Kennzahl entfernen/umbenennen oder erst mit einer echten
historischen Grundlage anbieten. Keine Kapazitätsplanung hineininterpretieren.

### Teamwerkzeug und Personenbereich klar erklären

Ein Bereich mit Personennamen kann wie eine private Ablage wirken. Das Produkt
ist laut Brief ein gemeinsamer, Access-geschützter Teamraum ohne separate
Bereichsrechte. Diese Erwartung sollte verständlich sein; ein neues Rollenmodell
ist daraus noch kein Auftrag. „Nur meine“ ohne passende E-Mail-Zuordnung benötigt
eine erklärende Rückmeldung statt einer scheinbar leer funktionierenden Ansicht.

## Was ich vorerst nicht priorisieren würde

Kanban, Gantt, umfangreiche Statusmodelle, Prioritätsstufen, Dashboards,
Terminserien und ein vollständiges Kalender-Sync-System sind keine Voraussetzung
für die aktuelle Produktidee. Anhänge/Bilder, Erinnerungen und wiederkehrende
Termine können wertvoll werden, sollten aber aus konkreten Teamfällen entstehen.
Automatische Erinnerungen brauchen vorher verlässliche Datums- und Zuständigkeits-
pflege. Neue Funktionen beheben die vorhandenen Erfassungs- und Vertrauenslücken
nicht automatisch.

## Empfohlene Überarbeitung

1. Datenintegrität und Speicherrückmeldung absichern; Backup beibehalten.
2. Erfassung, vollständige Aufgabenpflege, Zeilenbedienung und Undo als ein
   zusammenhängendes Alltagspaket gestalten.
3. Heute-Ansicht auf tatsächliche Arbeit fokussieren; mobile Erfassung einbeziehen.
4. JFX vom Sammeln bis zum Wiederfinden eines Ergebnisses vervollständigen.
5. Suche, Direktlinks und Orientierung in größeren Notizbeständen verbessern.
6. Erst danach zusätzliche Funktionen anhand echter Nutzungsprobleme priorisieren.

Maßstab für die nächste Iteration sind drei Alltagsszenarien: unterwegs einen
Gedanken festhalten, im Meeting eine Aufgabe mit Zuständigkeit/Fälligkeit festlegen,
und eine Woche später Entscheidung und Folgeaufgabe sicher wiederfinden.

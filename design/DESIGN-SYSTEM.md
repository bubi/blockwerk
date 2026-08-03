# Blockwerk — Design System

Version 1.0 · Stand 3. August 2026

Verbindliche Spezifikation für die Oberfläche von Blockwerk. Sie beschreibt, **was gilt**, nicht wie eine bestimmte Technik es umzusetzen hat. Die mitgelieferte `blockwerk.jsx` ist die Referenzimplementierung: sie hält diese Spezifikation vollständig ein und darf bei Zweifelsfragen als Beleg herangezogen werden.

> Die Projektregeln in `PROJECT.md` stehen über diesem Dokument. Wo beide etwas zum selben Punkt sagen — Dateiablage, Namensgebung, Formatierung, Teststrategie, Commit-Konventionen —, gilt `PROJECT.md`. Dieses Dokument entscheidet ausschließlich über das Aussehen und Verhalten der Oberfläche.

---

## 1. Grundsätze

Vier Entscheidungen tragen das ganze Bild. Sie sind aus mehreren verworfenen Entwürfen hervorgegangen; die Begründung steht dabei, damit sie nicht versehentlich rückgängig gemacht werden.

### 1.1 Farbe codiert, sie dekoriert nicht

Grau trägt die Oberfläche. Farbe erscheint nur, wo sie eine Unterscheidung trifft, die der Benutzer sonst nicht sähe: Blocktyp, Terminart, Fälligkeit, Zuständigkeit, Auswahl. Grün ist die einzige Betonfarbe der Anwendung. Blau, Rot, Violett und Orange sind Bedeutungsträger, keine Akzente — eine violette Blockkarte bedeutet „1:1", sie bedeutet nicht „hübsch".

Daraus folgt: keine Verläufe, keine getönten Flächen ohne Aussage, keine zweite Betonfarbe, keine farbigen Schatten.

### 1.2 Keine Farbleisten an Kanten

Der Typ einer Karte wird durch **einen runden Punkt vor der Plakette** angezeigt, dazu die Plakette selbst in derselben Farbe leicht getönt und beschriftet. Es gibt an keiner Stelle des Interfaces eine farbige Leiste an einer Kante — weder als `border-left`, noch als `box-shadow: inset`, noch als absolut gesetztes Pseudo-Element.

Das ist eine bewusste Entscheidung gegen eine sehr naheliegende Lösung. Frühere Fassungen hatten solche Leisten; sie sind an drei Problemen gescheitert:

1. Eine Leiste an einer abgerundeten Ecke rundet entweder mit (dann sieht sie aus wie ein angeschnittener Rahmen) oder läuft aus der Kontur heraus (dann sieht sie aus wie ein Fehler). Beides fällt auf, sobald mehrere Radien im Spiel sind.
2. Sie musste zwei verschiedene Aufgaben tragen — dauerhafte Einordnung und flüchtigen Zustand — und wurde dadurch mehrdeutig.
3. Bei mehreren Karten untereinander entsteht ein unruhiges senkrechtes Farbmuster am linken Rand.

**Nicht wieder einführen.** Wenn eine Kennzeichnung fehlt, ist ein Punkt, eine Plakette oder eine Schriftfarbe das Mittel.

### 1.3 Alles kommt aus Leitern

Abstände, Radien und Schriftgrade stammen ausschließlich aus den Leitern in Abschnitt 2. Kein Zwischenwert, keine Ausnahme „nur hier". Freihändig gesetzte Werte waren der Hauptgrund, weshalb eine frühere Fassung unruhig wirkte, obwohl jede Einzelentscheidung vertretbar war.

### 1.4 Eine Rolle, ein Satz Werte

Wiederkehrende Rollen sind genau einmal definiert und werden von allen Stellen geteilt, nicht pro Komponente nachgebaut. Das betrifft vor allem **Etikett** (Abschnitt 3.2) und **Plakette** (Abschnitt 3.3). Eine neue Rubrik, ein neuer Zähler erbt die Rolle — er bekommt keine eigenen Werte.

---

## 2. Token

Maschinenlesbar in `tokens.css`. Kein Token-Wert darf in einer Komponente wiederholt werden.

### 2.1 Farbe

| Token | Wert | Bedeutung |
|---|---|---|
| `--white` | `#FFFFFF` | Karten, Panels, Kopfleiste |
| `--bg` | `#FAFAFA` | Arbeitsfläche hinter den Karten |
| `--side` | `#F5F6F8` | Bereichsleiste, ruhige Plaketten, Eingabefelder |
| `--hover` | `#EDEEF0` | Überfahren bei Bedienelementen |
| `--line` | `#E4E6E9` | Rahmen, trennende Linien |
| `--line2` | `#EFF0F2` | Trennung innerhalb einer Fläche |
| `--text` | `#1D2125` | Fließtext, Titel |
| `--text2` | `#6B7075` | Beitext, Etiketten, Metadaten |
| `--text3` | `#9BA0A6` | Platzhalter, ruhende Symbole, leere Zustände |
| `--green` | `#00A82D` | Auswahl, Bestätigung, Hauptaktion |
| `--green-dk` | `#00922A` | Grün auf heller Fläche (Kontrast) |
| `--green-soft` | `#E8F6EC` | Fläche eines aktiven oder eigenen Elements |
| `--blue` / `--blue-soft` | `#2F80ED` / `#E9F1FD` | Termine, Verweise |
| `--red` / `--red-soft` | `#E5484D` / `#FDECEC` | Überfällig, Löschen |
| `--purple`, `--orange`, `--grey` | `#7A5AF8`, `#E8883A`, `#7A828A` | ausschließlich Blocktyp-Farben |
| `--check-line`, `--badge-person`, `--badge-topic`, `--card-hover`, `--green-lit` | `#B6BCC3`, `#8C93A0`, `#B0B6BF`, `#CFD4D9`, `#7FE0A0` | abgeleitete Grauwerte, gegen eine bestimmte Nachbarfarbe ausgemischt |
| `--hue` | erbt | Farbe des aktuellen Blocktyps |

**Regel zu `--green` und `--green-dk`:** Grün als Fläche oder als Symbol auf weißem Grund nutzt `--green`. Grün als **Text** auf heller Fläche nutzt immer `--green-dk`.

**Regel zu `--hue`:** wird von einer Klasse am Container gesetzt (`hue-steel`, `hue-moss`, `hue-plum`, `hue-amber`, `hue-ink`) und ausschließlich von Typpunkt und Plakette gelesen. Die Zuordnung liegt in den Daten, nicht im Bogen — Benutzer können Templates umfärben.

### 2.2 Abstand

`--s1` 4 · `--s2` 8 · `--s3` 12 · `--s4` 16 · `--s5` 24 · `--s6` 32 · `--s7` 40

Gebrauch:

| Stufe | Wofür |
|---|---|
| `--s1` 4 | Innenabstand von Symbolschaltern, Abstand in Reitern |
| `--s2` 8 | Abstand zwischen eng gehörigen Dingen, Kartenabstand im Datumsband |
| `--s3` 12 | Standardabstand in einer Zeile, Zeilenhöhe in Listen, Abstand zwischen Karten in Rastern |
| `--s4` 16 | Innenabstand kleiner Karten, Abstand zwischen Karten im Strom, Gruppentrennung im Block |
| `--s5` 24 | Innenabstand großer Karten und Panels, Abstand zwischen Kopf und Inhalt |
| `--s6` 32 | Abstand zwischen Abschnitten einer Ansicht |
| `--s7` 40 | seitlicher Rand der Arbeitsfläche |

Zwei dokumentierte Ausnahmen: `2px` als Abstand zwischen Titel und Beitext innerhalb eines Textpaars, `-1px` für die Überlappung der Reiterlinie mit ihrer Grundlinie. Sonst nichts.

### 2.3 Radius

`--r-xs` 6 · `--r-sm` 8 · `--r-md` 12 · `--r-lg` 16

| Stufe | Wofür |
|---|---|
| `--r-xs` 6 | Plaketten, Kontrollkästchen, Menüeinträge, Zeilen, kleine Symbolschalter |
| `--r-sm` 8 | Schaltflächen, Eingabefelder, Eintragskarten im Datumsband, Bereichszeilen |
| `--r-md` 12 | Blockkarten, Kennzahlkacheln, Listen, Suchtreffer, Menüs |
| `--r-lg` 16 | Panels, die über der Oberfläche liegen |

Punkte sind `50%`. Sonst kommt kein anderer Radius vor.

### 2.4 Schrift

Eine Familie in allen Rollen. Frutiger LT ist ein Gewichtssystem, kein Familienverbund — die Rollen entstehen durch Grad, Gewicht und Sperrung, nicht durch verschiedene Schriften. Eine Monospace gibt es nicht; Ziffern richten sich über `font-variant-numeric: tabular-nums` aus.

Stack: `--sans`, beginnend mit den lizenzierten Frutiger-Schnitten, dann Source Sans 3 als humanistischer Ersatz, dann Segoe UI und Myriad Pro als Systemrückfall.

**Textleiter** — elf Grade, mehr gibt es nicht:

| Grad | Gewicht | Sperrung | Rolle |
|---|---|---|---|
| 11 | 600 | .12em, versal | Etikett (siehe 3.2) |
| 12 | 400 | – | Datumsangaben in Zeilen, Hilfstext |
| 13 | 400 | – | Metatext, Formularwerte, Hinweisbanner |
| 14 | 400 | – | dichte Listen, Kartentitel im Datumsband, Panelfließtext |
| 15 | 400 | – | Fließtext, Notiz- und Eingabezeilen, Listentitel |
| 16 | 600 | – | Überschrift Ebene 1 in Notizen, Gruppentitel, Navigationsziel |
| 18 | 600 | −.02em | Suchtreffer-Titel |
| 22 | 700 | −.02em | Blocktitel, Panelüberschrift, Wortmarke, Monatsname |
| 28 | 700 | −.03em | Bereichsname über dem Blockstrom |
| 36 | 700 | −.04em | Kennzahl, Tagesziffer im Datumsband |
| 44 | 700 | −.04em | Tagesdatum im Tageskopf |

Sperrungsregel: unter 18 px keine Sperrung, 18–22 px −0.02em, 28 px −0.03em, ab 36 px −0.04em.

Zeilenhöhe: 1.6 als Grundwert, 1.45 in dichten Kartentiteln, 1.0–1.1 bei Zahlen ab 36 px.

**Glyphenleiter** — Größen für Symbolschalter, getrennt von der Textleiter, weil sie optische und keine typografischen Größen sind: 16 (Hinzufügen, Entfernen in der Leiste) · 20 (Zeile entfernen, Monatswechsel, Weiter-Pfeil) · 24 (Panel schließen) · 28 (Zurück auf dem Telefon).

Eine dokumentierte Ausnahme: die Rautenmarke vor Überschriften läuft mit −0.05em, damit `##` als ein Zeichen liest.

### 2.5 Bewegung

Ein einziger Auftritt: `rise` — 8 px von unten, Deckkraft 0 auf 1. Dauer 140–320 ms, je nach Größe des Elements. Verwendet bei Karten beim Laden (gestaffelt in Schritten von 50 ms bis zur vierten Karte), bei Menüs, Panels und Hinweisen.

Zustandsübergänge: 120–160 ms, nur auf `background`, `border-color`, `box-shadow`, `color`, `opacity`. Kein Bewegen von Layout.

Ein Sonderfall: `pulse` — ein grüner Ring, der über 1,4 s ausläuft, wenn aus Suche oder Datumsband zu einem Block gesprungen wird. Er beantwortet die Frage „wo bin ich gelandet".

`prefers-reduced-motion: reduce` schaltet **alle** Animationen und Übergänge ab. Die Endzustände müssen ohne Animation korrekt aussehen — kein Element darf seine Sichtbarkeit aus einer Animation beziehen.

---

## 3. Primitive

### 3.1 Fläche

| Rolle | Hintergrund | Rahmen | Radius | Innenabstand |
|---|---|---|---|---|
| Große Karte (Block) | `--white` | 1px `--line` | `--r-md` | `--s5` |
| Kachel (Kennzahl, Auslastung) | `--white` | 1px `--line` | `--r-md` | `--s4` … `--s5` |
| Kleine Karte (Datumsband) | `--white` | 1px `--line` | `--r-sm` | `--s3` `--s4` |
| Liste | `--white` | 1px `--line` | `--r-md` | 0, Zeilen tragen den Abstand |
| Panel | `--white` | – | `--r-lg` | `--s5` |
| Leerer Zustand | `--white` | 1px **gestrichelt** `--line` | `--r-md` | `--s5` |

Schatten trägt nur, was über der Oberfläche liegt: Karten `0 1px 2px rgba(29,33,37,.04)`, Menüs `0 12px 32px rgba(29,33,37,.14–.16)`, Panels `0 24px 60px rgba(29,33,37,.3)`, Hinweise `0 8px 24px rgba(29,33,37,.28)`. Beim Überfahren einer Eintragskarte `0 4px 12px rgba(29,33,37,.08)` — kein Anheben, kein `transform`.

### 3.2 Etikett

Rubriken, Zähler-Beschriftungen, Reiter, Zeitangaben, Schaltflächen ohne Fläche.

```
font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: .12em;
```

Farbe `--text2` als Standard, `--text3` wenn ruhend. Diese Werte stehen **einmal** in einer Sammelregel, die alle Etikettenstellen zusammenfasst. Eine neue Rubrik wird dieser Regel hinzugefügt; sie bekommt keine eigene Deklaration.

### 3.3 Plakette

Jeder Zähler, jede kurze Auszeichnung, jede Typangabe.

```
font-size: 11px; font-weight: 600; border-radius: var(--r-xs);
padding: 2px var(--s2); letter-spacing: .04em;
```

Ebenfalls eine geteilte Sammelregel. Farbvarianten:

| Variante | Fläche | Schrift |
|---|---|---|
| ruhig | `--side` | `--text2` |
| aktiv | `--green` | `#fff` |
| eigen | `--green-soft` | `--green-dk` |
| warnend | `--red` | `#fff` |
| Termin | `--blue-soft` | `--blue` |
| Blocktyp | `--hue` bei 12 % auf Weiß | `--hue` |

### 3.4 Typpunkt

Runder Punkt, 10 px, Farbe `--hue`, unmittelbar vor der Plakette in derselben Zeile. Er ist das einzige rein farbige Element ohne Beschriftung im ganzen Interface und deshalb nur für den Blocktyp zulässig.

Technisch als `::before` der umgebenden Flex-Zeile umzusetzen, damit kein zusätzliches Element in die Auszeichnung wandert.

### 3.5 Kontrollkästchen

20 × 20, Rahmen 1,5 px `#B6BCC3`, Radius `--r-xs`, Fläche weiß. Überfahren: Rahmen `--green`, Fläche `--green-soft`. Erledigt: Fläche und Rahmen `--green`, Haken weiß. Erledigte Aufgaben bekommen zusätzlich `--text3` und Durchstreichung im Text.

### 3.6 Eingabefeld

Zwei Ausprägungen. **Sichtbar** — Fläche `--side` oder `--white`, Rahmen 1 px `--line`, Radius `--r-sm`, Innenabstand `--s2` `--s4`. Bei Fokus: Fläche weiß, Rahmen `--line`, dazu `0 0 0 3px var(--green-soft)`. **Unsichtbar** — Notiz-, Aufgaben- und Titelzeilen tragen keinen Rahmen und keine Fläche; sie sehen aus wie Text und verhalten sich wie Text. Das ist der Normalfall im Blockstrom.

### 3.7 Schaltfläche

| Rolle | Aussehen |
|---|---|
| Hauptaktion | Fläche `--green`, Schrift weiß, 14/600, Radius `--r-sm`, `--s3` `--s5` |
| Nebenaktion | ohne Fläche, Schrift `--text2`, Überfahren `--hover` |
| Etikettenaktion | wie Etikett (3.2), Farbe `--green-dk` |
| Zerstörend | Schrift `--red`, immer mit vorgeschalteter Rückfrage an Ort und Stelle |
| Symbolschalter | Glyphengröße aus 2.4, Farbe `--text3`, Fläche erst beim Überfahren |

Symbolschalter innerhalb einer Zeile sind im Ruhezustand durchsichtig und erscheinen erst beim Überfahren der Zeile. Auf Geräten ohne Zeigegerät (`hover: none`) sind sie dauerhaft sichtbar.

### 3.8 Zustand

Zustände tragen **niemals** eine Kante (siehe 1.2), sondern Fläche und Schriftfarbe.

| Zustand | Darstellung |
|---|---|
| Ausgewählt (Bereich, Reiter) | Fläche `--green-soft`, Schrift `--green-dk`, Plaketten grün |
| Fokussiert (Zeile) | Fläche `--green-soft` |
| Mir zugewiesen | Zuständigkeit als Plakette „eigen" |
| Überfällig | Schrift `--red` in Datum und Rubrik |
| Erledigt | `--text3` plus Durchstreichung |
| Tastaturfokus | `outline: 2px solid var(--green); outline-offset: 2px` |

---

## 4. Layout

### 4.1 Raster

Drei Spalten: Bereichsleiste `274px` · Arbeitsfläche `minmax(0,1fr)` · Datumsband `384px`. Jede Spalte scrollt für sich; der Rahmen bleibt stehen.

Der Inhalt der Arbeitsfläche ist auf `1000px` begrenzt, Suchtreffer auf `820px`, Fließtext in leeren Zuständen auf `60ch`.

### 4.2 Haltepunkte

| Breite | Verhalten |
|---|---|
| ab 1321 | drei Spalten in voller Breite |
| 1101–1320 | Spalten auf 248 / 344, Ränder auf `--s5`, Auszeichnungsgrade eine Stufe kleiner |
| 861–1100 | Datumsband entfällt, zwei Spalten, Bereichsleiste 224 |
| bis 860 | Telefonfassung (4.3) |

### 4.3 Telefon

Keine gestauchte Desktopfassung, sondern eine eigene Gestalt: Kopfzeile mit Titel und Zurück, drei Hauptbereiche über eine feste Leiste am unteren Rand, Navigation in Ebenen (Bereiche → Seiten → Strom).

Die Auszeichnungsgrade fallen genau eine Stufe: 44 → 36, 36 → 28, 28 → 22. Grundgrad steigt auf 16 px. Die Leiste am unteren Rand respektiert `env(safe-area-inset-bottom)`.

---

## 5. Komponenten

Maße, die nicht genannt sind, folgen den Leitern. Die Klassennamen der Referenzimplementierung stehen in Klammern.

| Komponente | Festlegungen |
|---|---|
| **Kopfleiste** (`.top`) | 64 hoch, weiß, untere Linie. Marke links, Suchfeld rechtsbündig bis 520 breit, Tagesstempel ganz rechts (Wochentag als Etikett, Tageszahl 22/700, Monat als Etikett). |
| **Bereichsleiste** (`.rail`) | Fläche `--side`. Oben Sprung auf „Heute" mit Zähler überfälliger Aufgaben, darunter Gruppen „Personen" und „Themen", unten angeheftet Templates und Identität. Zeilen 8/12 innen, Plakette 28 × 28. |
| **Tageskopf** (`.hero`) | Rubrik, Wochentag 44/700, vollständiges Datum daneben, darunter vier Kennzahlkacheln in einem Raster ab 148 px Spaltenbreite: überfällig, heute fällig, Termine heute, erledigt in sieben Tagen. Die Zahl trägt die Bedeutungsfarbe. |
| **Blockkarte** (`.blk`) | Kopf: Typpunkt, Typplakette, Datum, Zielseite, Löschen rechtsbündig. Darunter Titel 22/700. Inhalt in Gruppen: Notizen, Aufgaben, Folgetermine, Verweise hierher — jede Gruppe mit Etikettenrubrik und Zähler, getrennt durch `--line2`. Abschluss: die Eingabezeile. |
| **Zeile** (`.it`) | Ein Muster für Notiz, Überschrift, Aufgabe, Termin und Verweis. Höhe aus Inhalt, Innenabstand `--s1` `--s3`. Zwei Bedienmodi: Zeile ausgewählt (Leertaste hakt ab, Pfeile wandern) oder Textcursor im Feld. Einrückung unter Überschriften `--s4`, Notizen an Aufgaben `--s6`, jeweils mit 2 px Führungslinie in `--line2`. |
| **Eingabezeile** (`.comp`) | Am Fuß jeder Blockkarte. `/` öffnet die Befehlsliste, `@` die Personenliste, `#` macht eine Überschrift. Erkennt `!heute`, `!morgen`, Wochentage, Datumsangaben und Uhrzeiten im Fließtext. Der gewählte Modus erscheint als Plakette links und ist dort abwählbar. |
| **Datumsband** (`.dates`) | Monatskopf mit Blättern, darunter je Tag mit Einträgen eine Zeile: Wochentag, Tageszahl 36/700 und Monat in einer 56 px breiten Spalte, Einträge rechts daneben. Der heutige Tag wird eingefärbt, nicht unterlegt. Läufe leerer Tage werden zu einer Zeile mit gestrichelter Maßlinie und Anzahl zusammengefasst. |
| **Übersichtsliste** (`.mlist`) | Weiße Liste, Radius `--r-md`, Zeilen durch `--line2` getrennt. Je Zeile: Kontrollkästchen oder Uhrzeit, Titel, darunter Beitext aus Zuständigkeit, Fälligkeit und Herkunftsblock. Überfälliges wird nach Person gruppiert. |
| **Panel** (`.overlay` / `.sheet`) | Abdunklung `rgba(29,33,37,.45)`, Blatt bis 600 breit, oben ausgerichtet mit 6 vh Abstand. Schließt über Escape, Kreuz und Klick daneben. |
| **Hinweis** (`.flash`) | Unten mittig, dunkle Fläche, 13 px. Zerstörende Aktionen liefern hier neun Sekunden lang „Rückgängig". |

---

## 6. Zugänglichkeit

Verbindlich, nicht optional:

- Sichtbarer Tastaturfokus überall: `2px solid var(--green)`, Versatz 2 px. Nie entfernen, auch nicht dort, wo eine eigene Fokusdarstellung existiert.
- Der Blockstrom ist vollständig mit der Tastatur bedienbar: Pfeile wandern durch die Zeilen, Leertaste hakt ab, Enter springt ins Feld, Escape zurück zur Zeile, Rücktaste in einer leeren Zeile löscht sie und setzt den Cursor in die vorige.
- Jeder Symbolschalter trägt ein `aria-label`, jede Umschaltung ein `aria-pressed` oder `aria-selected`, jede Liste mit Auswahl `role="listbox"` und `aria-selected`.
- Farbe ist nie der alleinige Träger einer Aussage. Überfälliges trägt zusätzlich das Wort, Erledigtes die Durchstreichung, der Blocktyp die beschriftete Plakette.
- Kontrast: Text auf Fläche mindestens 4.5:1. Deshalb `--green-dk` für grüne Schrift und `--text2` statt `--text3` überall dort, wo etwas gelesen und nicht nur bemerkt werden soll.
- `prefers-reduced-motion` schaltet Bewegung vollständig ab.

---

## 7. Sprache in der Oberfläche

Deutsch, Satzfall, keine Versalien außer im Etikett. Kein „Sie", kein „Du" — die Oberfläche spricht über Sachen, nicht über den Benutzer.

- Schaltflächen benennen die Handlung, nicht das System: „Block anlegen", nicht „Erstellen". Was die Schaltfläche verspricht, meldet der Hinweis danach im selben Wort zurück.
- Leere Zustände laden zur Handlung ein und erklären den nächsten Schritt: „Diese Seite ist leer. Leg oben einen Block an — er bekommt automatisch das heutige Datum."
- Fehler benennen, was geschehen ist und was jetzt gilt: „Speichern fehlgeschlagen. Änderungen bleiben nur in dieser Sitzung erhalten." Keine Entschuldigung, kein Ausrufezeichen.
- Zeitangaben relativ, wo es hilft: „heute", „morgen", „3 T überfällig". Absolut, wo es zählt.
- Fachbegriffe der Anwendung sind gesetzt und werden nicht variiert: Bereich, Seite, Block, Zeile, Task, Termin, Verweis, Template.

---

## 8. Prüfliste

Vor Abgabe maschinell prüfbar. Alle Ausdrücke beziehen sich auf den fertigen Bogen.

| # | Prüfung | Erwartung |
|---|---|---|
| 1 | `padding\|margin\|gap` mit rohem `px` | nur `2px` und `-1px`, sonst ausschließlich `var(--s*)` |
| 2 | `border-radius` | nur `var(--r-*)`, `50%`, `0` |
| 3 | `font-size` | nur 11, 12, 13, 14, 15, 16, 18, 22, 28, 36, 44 sowie die Glyphengrößen 16, 20, 24, 28 |
| 4 | `letter-spacing` negativ | nur −.02, −.03, −.04 sowie die dokumentierte Ausnahme −.05 an der Rautenmarke |
| 5 | Farbliterale außerhalb der Token-Schicht | ausschließlich `#fff` als Schrift auf Farbfläche |
| 6 | `border-left` mit Farbe, `box-shadow: inset` mit Farbe | kommt nicht vor (Grundsatz 1.2) |
| 7 | Zweite Betonfarbe neben Grün | kommt nicht vor |
| 8 | `outline: none` ohne eigene Fokusdarstellung | kommt nicht vor |
| 9 | Etiketten- und Plakettenwerte | stehen genau einmal, als Sammelregel |
| 10 | `prefers-reduced-motion` | vorhanden und schaltet Animation und Übergang ab |

Zusätzlich von Hand: die Anwendung bei 1440, 1200, 1000 und 380 px Breite ansehen und in jeder Breite einen Block anlegen, eine Aufgabe abhaken und eine Zeile löschen.

---

## 9. Offene Punkte

Bewusst nicht entschieden, weil die Daten dafür fehlen:

- **Dunkle Fassung.** Die Token sind darauf vorbereitet (Fläche, Linie und Schrift sind getrennt benannt), eine zweite Palette existiert aber nicht. Nicht nebenbei einführen.
- **Dichte Ansicht.** Für lange Blocklisten könnte eine kompaktere Zeilenhöhe sinnvoll sein. Wäre über eine zweite Abstandsleiter zu lösen, nicht über Einzelwerte.
- **Druckansicht.** Nicht spezifiziert.
- **Schriftlizenz.** Der Stack nennt Frutiger LT zuerst und fällt sonst auf Source Sans 3 zurück. Ob Frutiger für den Einsatzzweck lizenziert ist, ist vor Auslieferung zu klären; die Gestaltung funktioniert in beiden Fällen.

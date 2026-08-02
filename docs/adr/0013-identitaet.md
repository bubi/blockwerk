# 0013: Identität aus der Access-E-Mail

## Kontext

Cloudflare Access steht vor der Anwendung und der Worker kennt die
Access-E-Mail jedes Aufrufers (`identity.email`). Im Datenmodell fehlte sie
bisher — die Anwendung wusste nicht, wer „ich" bin. Ohne das kann „nur
meine" (ADR 0011) nicht entscheiden, welche Tasks die eigenen sind, eigene
Zeilen nicht hervorgehoben werden und der eigene Bereich nicht markiert
werden. Wer einen Task per `@`-Auswahl zuweist, braucht zudem eine
deterministische Auflösung, auch bei zwei Personen mit gleichem Vornamen.

## Entscheidung

**Personenbereiche bekommen ein E-Mail-Feld** (`spaces.email`, Migration
0003, eindeutig, `NULL` für Themen). Der Worker löst daraus bei jedem
`GET /api/spaces` die Identität auf: `meSpaceId` ist der Personenbereich,
dessen E-Mail mit `identity.email` übereinstimmt — andernfalls `null`. Die
Anwendung arbeitet auch ohne Zuordnung weiter: „nur meine" zeigt dann nichts
(vorherige Abfrage pro Person, nie eine falsche Auswahl).

- **„Ich" lebt genau einmal im State** (`state.meSpaceId`); `selectMeSpaceId`
  ist die einzige Stelle, an der die UI es liest. Aus ihr folgen die
  „nur meine"-Filterung, die Hervorhebung eigener Zeilen („ich") und der
  „ich"-Marker am eigenen Bereich.
- **Die E-Mail wird beim Anlegen eines Personenbereichs gesetzt** (optionales
  Feld im Formular); für die Entwicklung trägt `seed.sql` Lenas Bereich die
  Access-E-Mail ein.

**Die `@`-Auswahl merkt die Bereichs-ID, nicht den Text** (Composer): Beim
Tippen von `@` erscheint eine Personenliste (Pfeiltasten, Enter/Tab
übernimmt, Escape schließt, Tippen filtert — wie das Slash-Menü). Die
Übernahme schreibt `@Vorname ` in den Text **und** merkt `mentionId` (die
Bereichs-ID). `composeItem` verwendet die gemerkte ID vor dem Textparser —
bei zwei Personen mit gleichem Vornamen entscheidet die Auswahl, nicht die
erste Textübereinstimmung. Der Parser bleibt der Rückfall für getipptes
`@Name` ohne Menüauswahl.

## Konsequenzen

- `meSpaceId` skaliert nicht mit der Datenmenge: ein Scan über die bereits
  geladenen Bereiche, keine Extra-Abfrage.
- Die E-Mail ist eindeutig (partieller Unique-Index) — eine E-Mail gehört zu
  genau einem Bereich, es kann nie zwei „ich"s geben.
- Das E-Mail-Feld ist bewusst **nur ein Datenmodell- und
  Auflösungsmechanismus**: Die Zuordnung selbst stellt weiterhin der Mensch
  ein (beim Anlegen des Bereichs), Access bleibt die einzige Auth-Quelle.
- Der Textparser bleibt existieren, verliert aber seine Eindeutigkeit: wählt
  jemand nicht aus dem Menü, gilt weiterhin die erste Textübereinstimmung.

## Verworfene Alternativen

- **Die Access-E-Mail clientseitig anfordern und vergleichen:** hätte eine
  zweite, nicht-gesicherte Quelle der Identität eingeführt; die Zuordnung
  gehört in den Worker, der die E-Mail bereits verifiziert hat.
- **`meSpaceId` in einer eigenen Route:** ein zusätzlicher Rundtrip; die
  Auflösung kostet nichts und passt in die ohnehin geladene
  Bereiche-Antwort.
- **Die Auswahl nur aus dem Text zurücklesen:** bei zwei Personen mit
  gleichem Vornamen unbestimmt — genau der Fehler, den dieser PR behebt.

# 0017: Themen für den Jour Fix sammeln

## Kontext

„Das bespreche ich beim nächsten Mal mit X" braucht heute einen Ort — ohne dass
schon ein Meeting existiert. Seit ADR 0015 gibt es je Bereich den virtuellen
Eintrag „Jour Fix", absichtlich ohne Inhalt; dieses ADR füllt ihn.

Festgelegt: Trigger ist **`/jfx`** im Slash-Menü (`!` bleibt das Datums-Token);
die Person ergibt sich aus `@Person` bzw. dem Bereich; ein einem Meeting
zugewiesenes Thema **fällt aus der offenen Liste**.

## Entscheidung (Vorschlag)

**Die Themen sind `note`-Items in einem Jour-Fix-Block des Bereichs** — im
bestehenden Objektmodell, keine vierte `item.kind`, keine eigene Tabelle (eine
vierte Art würde die Gruppenreihenfolge im Block mehrdeutig machen,
PROJECT.md).

- **Zielauflösung:** `/jfx` richtet sich an den Jour-Fix-Eintrag des Bereichs.
  Steht `@Person` in der Zeile, ist das deren Jour Fix; sonst der des aktuellen
  Bereichs (auch wenn das ein Thema ist).
- **Der Jour-Fix-Block:** ein Block mit Titel „Jour Fix" auf der ersten Seite
  des Bereichs, beim ersten `/jfx` angelegt (wie Feature 3 den Block „Ohne
  Kontext"). Die offenen Themen sind seine `note`-Items in Anzeigeordnung; der
  Jour-Fix-Eintrag der Leiste zeigt statt des Platzhalters genau diese Liste.
- **Übernehmen in ein Meeting:** im Meeting-Block eine Aktion „Themen aus dem
  Jour Fix übernehmen"; sie listet die offenen Themen der beteiligten Person
  und übernimmt die ausgewählten. **Übernehmen heißt: das Item wechselt den
  Block** (`block_id` und `position` neu), es wird **nicht kopiert** — dieselbe
  Zeile, dieselbe Identität, genau wie ein zugewiesener Task nach „Die eine
  Idee" nicht dupliziert wird. Das Item verschwindet dadurch aus der offenen
  Liste und lebt im Meeting-Block weiter.
- **Konsequenz am Schema:** `block_id` ist heute in `itemPatchSchema` bewusst
  unveränderlich („set at creation"). Verschieben braucht eine Ausnahme: ein
  gezielter Verschiebe-Pfad (Patch-Feld `blockId` nur auf der
  Verschiebe-Route, mit Neuvergabe von `position`), kein allgemeines
  Umhängen. Die Kaskade bleibt unberührt — das Item bleibt im Besitz des
  Bereichs, dessen Seite der Zielblock gehört.
- **Die Liste wächst unbegrenzt:** der Jour-Fix-Eintrag rendert die Items des
  einen Blocks (eine Abfrage, kein N+1); 200 Einträge sind nur Scrollen.

## Begründung gegen „Statusfeld am Item"

Ein Statusfeld (offen/zugewiesen/erledigt) wäre ein kleiner Lebenszyklus im
Datenmodell: eigene Übergänge, eigene Löschregeln, eine zweite Bedeutung am
Item, das sonst nur Inhalt trägt. „Fällt aus der offenen Liste" ist bei einem
Blockwechsel **kostenlos** — das Item ist woanders sichtbar, ohne dass ein
Filter die Sichtbarkeit entscheiden muss. Status bräuchte erst dann eine
eigene Spalte, wenn ein zugewiesenes Thema in der Liste **bleiben** und einen
Zustand zeigen soll; das ist ausdrücklich nicht gewünscht.

## Offen, im Entwurf zu bestätigen

- Welche „beteiligte Person" die Meeting-Aktion anbietet (die im Block
  erwähnte Person, die Person des Blocks, oder Auswahl aus allen mit offenen
  Themen).
- Wo der Jour-Fix-Block genau liegt (erste Seite des Bereichs), falls die
  Person keine Seite hat.

## Konsequenz der Umsetzung

Die Meeting-Aktion „Themen aus dem Jour Fix übernehmen" zeigt die offenen
Themen des Bereichs, in dem der Meeting-Block liegt (die Person ergibt sich
aus dem Bereich — ein Meeting im Bereich von Lena bietet ihre Themen an). Der
Jour-Fix-Block liegt auf der ersten Seite des Bereichs (bzw. der Seite
„Notizen"), angelegt beim ersten `/jfx`. Ein Thema in einem fremden Bereich
wird über `@Person` gesammelt.

## Dateiliste (bei Bestätigung)

- `src/domain/composer.ts` — `jfx` als neuer Befehl in `COMPOSER_COMMANDS`.
- `src/state/selectors.ts` — offene Themen eines Bereichs (Items des
  Jour-Fix-Blocks in Anzeigeordnung).
- `src/components/Stream.tsx` — `JourFixPane` zeigt die Themen statt des
  Platzhalters; Aktion „Themen aus dem Jour Fix übernehmen" im Meeting-Block.
- `src/App.tsx` — Jour-Fix-Block auflösen/sicherstellen, `/jfx`-Ziel und
  Verschieben (Patch mit `blockId`) über den optimistischen Pfad.
- `shared/schemas.ts` + `worker/handlers.ts` — der gezielte Verschiebe-Pfad
  (`blockId`-Patch mit Positions-Neuvergabe).
- Tests: Domain (Zielauflösung, Anzeigeordnung), `e2e/` (`/jfx` anlegen,
  Übernehmen in ein Meeting).
- Doku: ADR 0017 (dieses), DESIGN-SYSTEM §5 (Jour-Fix-Eintrag mit Inhalt),
  `PROJECT.md`, `HANDOFF.md`.

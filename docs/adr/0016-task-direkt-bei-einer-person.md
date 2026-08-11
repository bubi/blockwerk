# 0016: Task direkt bei einer Person anlegen (Entwurf zur Bestätigung)

> **Entwurf** — der Code wird erst nach Bestätigung geschrieben (PROJECT.md:
> bei Domänenmodell-Berührung erst Plan, dann Umsetzung).

## Kontext

Ein Task kann heute nur in einem Block entstehen. Ohne vorherige Notiz oder
Block gibt es keinen Anlegeweg für „Ich muss X mit Lena klären". Die
Personenansicht (Eintrag „Aufgaben", `PageSelection === "tasks"`) hat keinen
Composer und keine Anlegezeile.

Das Schema erzwingt den Block: `block_id TEXT NOT NULL REFERENCES
blocks(id) ON DELETE CASCADE` (Migration 0001). Ein Item ohne Block ist heute
unmöglich — und nach „Die eine Idee" (Blöcke besitzen Items) gewollt.

## Entscheidung (Vorschlag)

**`block_id` bleibt `NOT NULL`; der Task landet in einem Block der Person.**
Konkret:

- Ein in der „Aufgaben"-Ansicht angelegter Task wird in einen Block auf der
  **Notizseite dieser Person** geschrieben. Existiert für heute kein Block auf
  dieser Seite, wird er angelegt (Datum = heute, Titel „Ohne Kontext"). Hat die
  Person noch keine Notizseite, wird sie mit angelegt („Notizen", wie beim
  Bereichsanlegen).
- Die „Aufgaben"-Ansicht bekommt am Kopf den bestehenden `Composer`
  wiederverwendet (ein Zielblock wird vorher sichergestellt). `@Person`,
  `!datum` und `14:00` funktionieren damit sofort; der Composer erzeugt den Task
  über den normalen optimistischen Schreibpfad. Ohne ausdrückliches `@Person`
  wird der Task der Person zugewiesen, deren „Aufgaben"-Ansicht ihn anlegt —
  sonst erschiene er dort nicht (der Überblick filtert nach
  `assignee_space_id`).
- Mobil gilt derselbe Weg: der „Aufgaben"-Eintrag des Drill-downs (ADR 0012)
  zeigt dieselbe Ansicht mit dem Composer.

So bleiben Besitzkette (Bereich → Seite → Block → Item), Löschregeln und
`orderBlockItems` unverändert; die Herkunftsangabe im Überblick (Blocktitel)
behält einen Wert. Keine Migration.

**Erzeugen von Seite und Block passiert in einem Zug** (ein `createPage` +
`createBlock`, je ein optimistischer Write), nicht als sichtbarer
Zwischenschritt — die Abfragezahl je Worker-Aufruf bleibt konstant klein
(Seite/Block anlegen kostet je einen PUT, kein N+1).

## Konsequenzen

- Der Task ist ein ganz normaler Task im Ursprungsblock; Abhaken im
  Überblick wirkt an beiden Stellen (dasselbe Objekt).
- Der Block „Ohne Kontext" sammelt bei Bedarf mehrere so angelegte Tasks
  desselben Tages — kein Task pro Block.
- Die Person braucht eine Notizseite; wird sie automatisch angelegt, gilt
  die bestehende Löschregel (Seite löschen kaskadiert).

## Verworfene Alternative

- **`block_id` optional machen:** ein elternloses Item hätte keine
  Löschzugehörigkeit (die Kaskade Bereich → Seite → Block → Item bricht) und
  keinen Ort in der Blocksortierung (`orderBlockItems` gruppiert je Block).
  Es widerspricht „Die eine Idee". Nur wenn der PO Weg 1 ablehnt — dann mit
  Migration, angepassten Löschregeln und einem Rückfalltext dort, wo heute der
  Blocktitel als Kontext steht.

## Dateiliste (bei Bestätigung)

- `src/components/Stream.tsx` + `Stream.module.css` — Composer am Kopf der
  „Aufgaben"-Ansicht (`PersonPane`).
- `src/components/Composer.tsx` — unverändert wiederverwendet (bekommt nur ein
  konkretes `blockId`).
- `src/App.tsx` — Zielblock auflösen/sicherstellen (Seite „Notizen" + Block
  „Ohne Kontext" für heute), Task-Anlage über den bestehenden Composer-Pfad.
- `src/state/selectors.ts` — ggf. Selektor für den Zielblock der Person.
- Tests: `e2e/` (Task aus der Personenansicht anlegen, mobil und Desktop).
- Doku: ADR 0016 (dieses), `PROJECT.md` (Fahrplan), `HANDOFF.md`.

# 0007: CSS Modules für die Komponentenstile

## Kontext

Die UI (Phase 2b, Teil 4) braucht einen Styling-Ansatz. Der Prototyp hält alle
Stile in einem einzigen `<style>`-Block mit `:where()`-Selektoren im Reset — das
war nötig, weil ein globaler Reset sonst die Komponentenklassen überschreibt.
Diese Notlösung gehört nicht ins echte Projekt: sie löst eine Kollision, die
nur entsteht, wenn alle Klassen in einem globalen Namensraum leben. Mit der
Größe der Anwendung kehren die Kollisionen zurück, und nichts erzwingt
eindeutige Namen.

## Entscheidung

**CSS Modules** (`.module.css` je Komponente, von Vite nativ gescoped) plus eine
einzige globale Basisdatei `src/styles/global.css` mit Design-Tokens
(`:root`-Custom Properties), Reset, Basis-Typografie, sichtbarem Fokus,
`sr-only` und `prefers-reduced-motion`. Die Palette lebt genau dort; Komponenten
verwenden nur die Tokens. Die Breakpoints (drei Spalten, Umschalter ab ~980px,
Telefon ab 640px) liegen im Layout-Modul der App-Shell.

Begründung:

- Klassen sind per Hash gescoped; ein Reset kann Komponentenklassen strukturell
  nicht mehr überschreiben. Der `:where()`-Hack des Prototyps entfällt.
- Keine neue Dependency — Vite versteht `*.module.css` von Haus aus.
- Stile liegen colocated neben der Komponente; tote Styles fallen beim
  Löschen der Komponente mit auf.
- Klassenreferenzen sind typisiert (`styles.foo`), Tippfehler fallen in
  `typecheck` auf.

## Konsequenzen

- Gemeinsames Aussehen läuft über Tokens, nicht über übergreifende Klassen;
  wer eine Komponentenklasse von außen ändern will, muss ins Modul gehen.
- Einige datengetriebene Helfer (Template-Hues, der Puls-Effekt fürs
  Springen zum Block) bleiben bewusst global — sie werden imperativ bzw. aus
  Daten heraus referenziert und gehören in keinen Komponentenmodul-Namensraum.
- ADR 0007 gilt für Komponentenstile; neue globale Regeln nur in `global.css`
  begründen.

## Verworfene Alternativen

- **Prototyp-Ansatz** (ein globales Stylesheet, `:where()` im Reset): Kollisionen
  kehren mit der Größe zurück, kein Scoping, Namensdisziplin per Konvention.
- **Tailwind**: neue Dependency, Utility-Markup begräbt die Semantik im Markup,
  das Designsystem ist klein genug für echte Klassen.
- **CSS-in-JS**: Laufzeitkosten und neue Dependency ohne Mehrwert gegenüber
  nativem Scoping.

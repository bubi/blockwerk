# 0002: Workers statt Pages

## Kontext

Blockwerk braucht Hosting für eine statische Vite/React-Oberfläche und einen Server-Teil,
der Requests gegen D1 beantwortet und Access-JWTs prüft. Cloudflare bietet dafür zwei
Wege an: Cloudflare Pages (mit Pages Functions für den dynamischen Teil) oder ein einzelner
Worker mit statischen Assets (`assets` in `wrangler.jsonc`).

## Entscheidung

Ein einzelner Cloudflare Worker mit `assets`-Binding hostet sowohl die gebauten
Vite-Dateien als auch die `/api/*`-Routen. Es gibt kein separates Pages-Projekt.

## Konsequenzen

- Ein Deploy-Ziel, ein `wrangler deploy`, eine `wrangler.jsonc`. Kein Auseinanderlaufen
  zwischen Pages-Projekt-Konfiguration und Functions-Konfiguration.
- Die Auth-Prüfung (`worker/access.ts`) liegt im selben Code wie das Routing und greift
  zentral für alle `/api/*`-Pfade, bevor irgendein Handler läuft — keine Gefahr, sie in
  einer von mehreren Pages-Functions-Dateien zu vergessen.
- Der Worker entscheidet selbst, ob ein Request ein Static Asset ist (`env.ASSETS.fetch`)
  oder eine API-Route — etwas mehr Code als bei Pages, wo das Static-Hosting automatisch
  vor den Functions greift.
- Cloudflare empfiehlt Workers mit `assets` für neue Projekte; Pages wird weiter unterstützt,
  aber nicht mehr als Ausgangspunkt beworben.

## Verworfene Alternative: Cloudflare Pages

Pages mit Pages Functions (`/functions/api/[[path]].ts`) hätte dieselbe Funktionalität
abgebildet. Dagegen:

- Zwei Konfigurationsmodelle im selben Repo (Pages-Projekteinstellungen im Dashboard,
  Functions-Routing über Dateisystem-Konvention) statt einer einzigen `wrangler.jsonc`.
- Pages Functions laufen als separate Worker-artige Isolates pro Route-Datei; die
  JWKS-Zwischenspeicherung (modul-globaler Cache pro Isolate, siehe `worker/access.ts`)
  wäre über mehrere Function-Dateien hinweg dupliziert statt einmal zentral zu greifen.
- Kein technischer Vorteil für unseren Fall (eine SPA + eine kleine API), der die
  zusätzliche Konfigurationsfläche aufwiegt.

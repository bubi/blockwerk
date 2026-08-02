# Blockwerk

Interne Team-Software, die Notizen, Aufgaben und Termine auf **ein** Objektmodell legt.
Details zum Domänenmodell und den Randbedingungen stehen in [`PROJECT.md`](./PROJECT.md).

## Setup (lokal starten)

Voraussetzung: Node.js 22 oder neuer und npm (die CI nutzt Node 22 und npm 11).
Prüfen mit `node -v` und `npm -v`.

1. **Abhängigkeiten installieren**

   ```
   npm install
   ```

2. **Entwicklungs-Konfiguration anlegen**

   ```
   cp .dev.vars.example .dev.vars
   ```

   Ohne diese Datei verweigert der lokale Worker die Anfragen. Sie wird nur in der
   Entwicklung gelesen und ist in git ignoriert.

3. **App starten**

   ```
   npm run dev
   ```

   Das richtet die lokale Datenbank ein (Migrationen + Beispieldaten), startet dann den
   Worker (Port 8787) und die Vite-Entwicklungsumgebung (Port 5173) gleichzeitig. Beim
   ersten Start ein paar Sekunden warten, bis der Worker bereit ist.

4. **Öffnen**

   ```
   http://localhost:5173
   ```

   Beenden wie gewohnt mit `Ctrl+C`.

5. **Tests vor jedem Commit**

   ```
   npm run typecheck && npm run lint && npm test && npm run test:workers
   ```

   Optional gegen die lokale Umgebung (Port 8787 muss frei sein — `npm run dev` vorher
   beenden):

   ```
   npm run test:e2e
   ```

## Deploy

Nur nötig, wenn du die Anwendung wirklich hochladen willst:

1. `npx wrangler login` — einmalig mit dem Cloudflare-Konto verbinden
2. `npm run deploy` — baut die App und deployed den Worker

Deployment passiert außerdem automatisch über GitHub Actions nach jedem Push auf `main`.

## Scripts

| Befehl | Zweck |
|---|---|
| `npm run dev` | D1 migrieren + seeden, dann Worker (8787) + Vite (5173) |
| `npm run build` | Typecheck + Vite-Build nach `dist/` |
| `npm run typecheck` | `tsc -b` für App, Worker und Tooling |
| `npm run lint` | ESLint |
| `npm test` | Vitest (Domain- und App-Logik) |
| `npm run test:workers` | Vitest gegen den Worker (echtes workerd/D1) |
| `npm run test:e2e` | Playwright gegen die lokale Umgebung |
| `npm run deploy` | Build, dann `wrangler deploy` |

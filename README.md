# Blockwerk

Interne Team-Software, die Notizen, Aufgaben und Termine auf ein Objektmodell legt.
Details zum Domänenmodell und den Randbedingungen stehen in [`CLAUDE.md`](./CLAUDE.md).

## Setup

1. `npm install`
2. `npm run dev` — startet die App lokal unter `http://localhost:5173`
3. `npm run typecheck && npm run lint && npm test` — vor jedem Commit
4. `npx wrangler login` — einmalig, um den Worker deployen zu können
5. `npm run deploy` — baut die App und deployed den Worker via `wrangler deploy`

## Scripts

| Befehl | Zweck |
|---|---|
| `npm run dev` | Vite-Dev-Server |
| `npm run build` | Typecheck + Vite-Build nach `dist/` |
| `npm run typecheck` | `tsc -b` für App und Worker |
| `npm run lint` | ESLint |
| `npm test` | Vitest |
| `npm run deploy` | Build, dann `wrangler deploy` |

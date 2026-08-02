import { defineConfig, devices } from "@playwright/test";

/**
 * E2E against the local environment: the built app served by the worker
 * (wrangler dev) over a seeded local D1 — the same serving path as
 * production. `npm run e2e:server` resets the local D1 state first, so a run
 * is deterministic and a checked-off task does not leak into the next run.
 * Port 8787 must be free (stop `npm run dev` first).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:8787",
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run e2e:server",
    // Wait for the API itself, not just the HTML shell: the worker reloads a
    // few times right after startup, so gating on /api/spaces avoids running
    // the specs into a server that is not ready yet.
    url: "http://localhost:8787/api/spaces",
    reuseExistingServer: false,
    timeout: 180_000,
  },
});

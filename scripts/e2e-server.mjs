import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

/**
 * e2e web server. Starts `wrangler dev` (built app + local D1) and only exits
 * once the API has answered 200 a few times in a row. `wrangler dev` reloads
 * briefly right after startup; without this warm-up the first app requests
 * would hit that window and the UI would show load errors.
 */
const WRANGLER_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "node_modules", ".bin", "wrangler");
const API_URL = "http://127.0.0.1:8787/api/spaces";

const child = spawn(WRANGLER_BIN, ["dev"], { stdio: "inherit" });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function apiReady() {
  for (let attempt = 0; attempt < 300; attempt++) {
    let ok = false;
    try {
      const response = await fetch(API_URL);
      ok = response.ok;
    } catch {
      ok = false;
    }
    if (ok) {
      // Wrinkle out the startup reload window: require another success a
      // moment later before reporting ready.
      await sleep(1200);
      try {
        const again = await fetch(API_URL);
        if (again.ok) return true;
      } catch {
        // keep waiting
      }
    }
    await sleep(500);
  }
  return false;
}

const ready = await apiReady();
if (!ready) {
  console.error("[e2e-server] API never became ready");
  child.kill("SIGTERM");
  process.exit(1);
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("exit", (code) => process.exit(code ?? 0));

import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";

const migrationsPath = fileURLToPath(new URL("../../migrations", import.meta.url));
const wranglerConfigPath = fileURLToPath(new URL("../../wrangler.jsonc", import.meta.url));

export default defineConfig(async () => {
  const migrations = await readD1Migrations(migrationsPath);

  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: wranglerConfigPath },
        miniflare: {
          // Test-only binding: the worker can't read /migrations off disk
          // itself, so they're read here (on the Node side) and threaded in
          // for testing/apply-migrations.ts to apply.
          bindings: { TEST_MIGRATIONS: migrations },
        },
      }),
    ],
    test: {
      include: ["worker/db/**/*.test.ts"],
      setupFiles: ["worker/db/testing/apply-migrations.ts"],
    },
  };
});

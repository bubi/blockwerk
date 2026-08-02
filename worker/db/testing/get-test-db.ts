import { env } from "cloudflare:workers";
import type { D1Like } from "../d1-like.ts";

/**
 * The real D1 binding, running under real workerd (`npm run test:workers`,
 * see docs/adr/0004). Migrations are applied once per test file by
 * testing/apply-migrations.ts (a setupFile) — vitest-pool-workers resets
 * storage to that post-setup snapshot per file, not per test, so tests
 * within one file share state (see worker/db/*.test.ts for how that's
 * handled).
 */
export async function getTestDb(): Promise<D1Like> {
  return env.DB;
}

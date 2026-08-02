import { env } from "cloudflare:workers";
import type { D1Like } from "../d1-like.ts";

/**
 * Stage 2 (CI, `npm run test:workers`): the real D1 binding, running under
 * real workerd. Migrations are applied once per test file by
 * testing/apply-migrations.ts (a setupFile) — vitest-pool-workers resets
 * storage to that post-setup snapshot per file, not per test, so tests
 * within one file share state (see worker/db/*.test.ts for how that's
 * handled).
 */
export async function getTestDb(): Promise<D1Like> {
  return env.DB;
}

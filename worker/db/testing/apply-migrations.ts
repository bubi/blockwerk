import { applyD1Migrations, type D1Migration } from "cloudflare:test";
import { env } from "cloudflare:workers";

/**
 * `TEST_MIGRATIONS` is injected by worker/db/vitest.config.ts as a
 * miniflare-only binding (read from /migrations on the Node side, since the
 * worker itself can't read the filesystem). It's not part of Cloudflare.Env
 * on purpose — that type describes the real, deployed worker, and this
 * binding only ever exists in this test harness.
 */
const migrations = (env as unknown as { TEST_MIGRATIONS: D1Migration[] }).TEST_MIGRATIONS;

// Setup files run outside the per-test-file storage isolation, and may run
// multiple times; applyD1Migrations() only applies migrations not already
// applied, so this is safe to call unconditionally here.
await applyD1Migrations(env.DB, migrations);

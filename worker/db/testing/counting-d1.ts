import type { D1Like } from "../d1-like.ts";

/**
 * Wraps a D1Like handle to count round-trips (prepare/batch calls), so
 * tests can assert a fixed query budget instead of just eyeballing the code
 * — see the query-budget test in worker/db/page.test.ts.
 */
export function countingD1(db: D1Like): { db: D1Like; count: () => number } {
  let calls = 0;
  const wrapped: D1Like = {
    prepare(query) {
      calls++;
      return db.prepare(query);
    },
    batch(statements) {
      calls++;
      return db.batch(statements);
    },
  };
  return { db: wrapped, count: () => calls };
}

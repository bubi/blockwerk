/**
 * Wraps a D1Database handle to count round-trips (prepare/batch calls), so
 * tests can assert a fixed query budget instead of just eyeballing the code
 * — see the query-budget test in worker/db/page.test.ts.
 */
export function countingD1(db: D1Database): { db: D1Database; count: () => number } {
  let calls = 0;
  const wrapped: D1Database = {
    prepare(query) {
      calls++;
      return db.prepare(query);
    },
    batch(statements) {
      calls++;
      return db.batch(statements);
    },
    exec(query) {
      return db.exec(query);
    },
    withSession() {
      return db.withSession();
    },
    dump() {
      return db.dump();
    },
  };
  return { db: wrapped, count: () => calls };
}

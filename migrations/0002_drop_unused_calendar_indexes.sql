-- Drop the calendar indexes from 0001 that the calendar route never uses:
-- the worker loads all blocks and items in two fixed queries and projects the
-- window in /src/domain/calendar.ts (see docs/adr/0005) — no SQL date filter,
-- so these indexes only ever cost write overhead.
DROP INDEX IF EXISTS idx_blocks_date;
DROP INDEX IF EXISTS idx_items_due_date;
DROP INDEX IF EXISTS idx_items_event_date;

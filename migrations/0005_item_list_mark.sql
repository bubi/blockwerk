-- List points: a note can carry a list marker (`*` or `-`), the same way it
-- can carry a heading. Not a new item.kind — kind steers the block's group
-- order, and a fourth kind would make it ambiguous. One level, no nesting.
--
-- The CHECK mirrors the single-row rules in shared/schemas.ts: the marker is
-- only set on notes, and a note is either a heading or a list point, never
-- both.
ALTER TABLE items ADD COLUMN list_mark TEXT
  CHECK (list_mark IS NULL OR (kind = 'note' AND heading IS NULL));

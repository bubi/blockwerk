-- Task notes: a note can belong to exactly one task (docs/adr/0014).
-- The child appears directly under its task in the block and in the task
-- overview; the three groups (notes → tasks → events) stay three.
--
-- CASCADE is right here: a task note is owned by its task — an ownership
-- chain like space → page → block → item, not a cross-reference (which is
-- nulled). Deleting a task takes its notes with it.
--
-- The CHECK mirrors the two single-row rules in shared/schemas.ts: a parent
-- is only ever set on notes, and a child note can never be a heading.
--
-- No index: no read query filters on parent_item_id. The overview and the
-- page load select items wholesale; the FK cascade is a write path, and
-- parent lookups during validation go through the primary key.
ALTER TABLE items ADD COLUMN parent_item_id TEXT REFERENCES items(id) ON DELETE CASCADE
  CHECK (parent_item_id IS NULL OR (kind = 'note' AND heading IS NULL));

-- Blockwerk initial schema.
-- D1 enforces foreign keys itself; there is no per-query PRAGMA to set here
-- (see docs/adr/0001-task-spiegel.md for the deletion rules this enables,
-- and the note on PRAGMA defer_foreign_keys for future migrations).

-- ============================================================
-- templates
-- ============================================================
CREATE TABLE templates (
  id         TEXT PRIMARY KEY,
  label      TEXT NOT NULL,
  hue        TEXT NOT NULL,
  seed       TEXT NOT NULL DEFAULT '[]',  -- JSON array of seed lines, e.g. ["# Teilnehmer", "# Agenda"]
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ============================================================
-- spaces
-- ============================================================
CREATE TABLE spaces (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL CHECK (kind IN ('person', 'topic')),
  short      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ============================================================
-- pages
-- ============================================================
CREATE TABLE pages (
  id         TEXT PRIMARY KEY,
  space_id   TEXT NOT NULL REFERENCES spaces(id) ON DELETE CASCADE,
  title      TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- ============================================================
-- blocks
-- ============================================================
CREATE TABLE blocks (
  id          TEXT PRIMARY KEY,
  page_id     TEXT NOT NULL REFERENCES pages(id) ON DELETE CASCADE,
  template_id TEXT REFERENCES templates(id) ON DELETE SET NULL,
  title       TEXT NOT NULL,
  date        TEXT NOT NULL,  -- 'YYYY-MM-DD'
  created_at  INTEGER NOT NULL,
  updated_at  INTEGER NOT NULL,
  CONSTRAINT blocks_date_format CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

-- ============================================================
-- items
-- Position has gaps (step 1000) so inserting between two items never
-- renumbers the block; ties are broken deterministically by id in every
-- read (see worker/db), not by a UNIQUE constraint here.
-- ============================================================
CREATE TABLE items (
  id                TEXT PRIMARY KEY,
  block_id          TEXT NOT NULL REFERENCES blocks(id) ON DELETE CASCADE,
  kind              TEXT NOT NULL CHECK (kind IN ('note', 'task', 'event', 'ref')),
  position          INTEGER NOT NULL,
  text              TEXT NOT NULL DEFAULT '',
  heading           INTEGER CHECK (heading IS NULL OR heading IN (1, 2)),
  done              INTEGER NOT NULL DEFAULT 0 CHECK (done IN (0, 1)),
  due_date          TEXT,  -- 'YYYY-MM-DD', task only
  event_date        TEXT,  -- 'YYYY-MM-DD', event only
  event_time        TEXT,  -- 'HH:MM', event only
  assignee_space_id TEXT REFERENCES spaces(id) ON DELETE SET NULL,
  ref_block_id      TEXT REFERENCES blocks(id) ON DELETE SET NULL,
  created_at        INTEGER NOT NULL,
  updated_at        INTEGER NOT NULL,

  -- Each kind-specific field is only ever set on its own kind, mirroring
  -- the fact that an item is one row with a variant shape, not one table
  -- per kind.
  CONSTRAINT heading_only_on_note      CHECK (heading           IS NULL OR kind = 'note'),
  CONSTRAINT due_date_only_on_task     CHECK (due_date          IS NULL OR kind = 'task'),
  CONSTRAINT assignee_only_on_task     CHECK (assignee_space_id IS NULL OR kind = 'task'),
  CONSTRAINT event_date_only_on_event  CHECK (event_date        IS NULL OR kind = 'event'),
  CONSTRAINT event_time_only_on_event  CHECK (event_time        IS NULL OR kind = 'event'),
  CONSTRAINT ref_block_only_on_ref     CHECK (ref_block_id      IS NULL OR kind = 'ref'),

  CONSTRAINT due_date_format   CHECK (due_date   IS NULL OR due_date   GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]'),
  CONSTRAINT event_date_format CHECK (event_date IS NULL OR event_date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]')
);

-- ============================================================
-- Indizes — aus den vier genannten Abfragen abgeleitet, keine
-- vorsorglichen Indizes auf FK-Spalten (z. B. pages.space_id,
-- blocks.template_id bleiben unindiziert; die Tabellen sind klein
-- und keine der vier Abfragen braucht sie).
-- ============================================================

-- Abfrage 1: Stream einer Seite — Blöcke nach Datum absteigend,
-- danach ihre Items in stabiler Reihenfolge (position, id)
CREATE INDEX idx_blocks_page_date ON blocks(page_id, date DESC);
CREATE INDEX idx_items_block_position ON items(block_id, position, id);

-- Abfrage 2: Task-Spiegel — offene Tasks einer Person
CREATE INDEX idx_items_assignee_open ON items(assignee_space_id)
  WHERE kind = 'task' AND done = 0;

-- Abfrage 3: Kalenderprojektion — datierte Objekte in einem Monatsfenster
CREATE INDEX idx_blocks_date ON blocks(date);
CREATE INDEX idx_items_due_date ON items(due_date) WHERE due_date IS NOT NULL;
CREATE INDEX idx_items_event_date ON items(event_date) WHERE event_date IS NOT NULL;

-- Abfrage 4: Volltextsuche — vorerst kein Index, LIKE-Scan über
-- blocks.title und items.text. FTS5-Nachrüstung siehe ADR 0001.

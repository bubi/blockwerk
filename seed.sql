-- Local dev seed data, mirroring /prototype/blockwerk.jsx's seedData():
-- three people, two topics, a handful of blocks with tasks and events.
-- Not run automatically — see `npm run db:seed`. IDs are readable slugs
-- here for convenience; the real client generates UUIDv7/ULID. Every INSERT
-- is idempotent (OR IGNORE), so re-seeding an existing local database is safe.

-- ============================================================
-- templates (matches prototype/blockwerk.jsx's DEFAULT_TEMPLATES)
-- ============================================================
INSERT OR IGNORE INTO templates (id, label, hue, seed, created_at, updated_at) VALUES
  ('meeting',  'Meeting',      'steel', '["# Teilnehmer", "# Agenda", "# Entscheidungen"]', 1754000000000, 1754000000000),
  ('oneonone', '1:1',          'plum',  '["# Stimmung", "# Themen aus letzter Woche"]',     1754000000000, 1754000000000),
  ('personal', 'Persönlich',   'moss',  '[]',                                               1754000000000, 1754000000000),
  ('research', 'Recherche',    'ink',   '["# Fragestellung", "# Quellen"]',                 1754000000000, 1754000000000),
  ('decision', 'Entscheidung', 'amber', '["# Kontext", "# Optionen", "# Beschluss"]',        1754000000000, 1754000000000);

-- ============================================================
-- spaces: three people, two topics
-- lena carries the dev Access email (DEV_ACCESS_EMAIL) so identity resolves
-- to her in local development (docs/adr/0013); UPDATE also fixes an already
-- seeded local database.
-- ============================================================
INSERT OR IGNORE INTO spaces (id, name, kind, short, email, created_at, updated_at) VALUES
  ('lena',  'Lena Brandt',    'person', 'LB', 'dev@example.com', 1754000000000, 1754000000000),
  ('tomas', 'Tomas Kirsch',   'person', 'TK', NULL,              1754000000000, 1754000000000),
  ('amira', 'Amira Sy',       'person', 'AS', NULL,              1754000000000, 1754000000000),
  ('road',  'Roadmap Q3',     'topic',  'RQ', NULL,              1754000000000, 1754000000000),
  ('feed',  'Kundenfeedback', 'topic',  'KF', NULL,              1754000000000, 1754000000000);

UPDATE spaces SET email = 'dev@example.com' WHERE id = 'lena';

-- ============================================================
-- pages
-- ============================================================
INSERT OR IGNORE INTO pages (id, space_id, title, created_at, updated_at) VALUES
  ('p1', 'road',  'Planung',      1754000000000, 1754000000000),
  ('p2', 'road',  'Architektur',  1754000000000, 1754000000000),
  ('p3', 'feed',  'Interviews',   1754000000000, 1754000000000),
  ('p4', 'lena',  'Notizen',      1754000000000, 1754000000000),
  ('p5', 'tomas', 'Notizen',      1754000000000, 1754000000000),
  ('p6', 'amira', 'Notizen',      1754000000000, 1754000000000);

-- ============================================================
-- blocks
-- ============================================================
INSERT OR IGNORE INTO blocks (id, page_id, template_id, title, date, created_at, updated_at) VALUES
  ('b1', 'p1', 'meeting',  'Quartalsplanung Q3',                          '2026-07-31', 1754000000000, 1754000000000),
  ('b2', 'p1', 'decision', 'Editor: eigener Kern statt Fremdbibliothek',  '2026-08-02', 1754000000000, 1754000000000),
  ('b3', 'p3', 'meeting',  'Interview Nordbau GmbH',                     '2026-08-03', 1754000000000, 1754000000000),
  ('b4', 'p4', 'personal', 'Woche sortieren',                            '2026-08-02', 1754000000000, 1754000000000);

-- ============================================================
-- items
-- ============================================================

-- b1: Quartalsplanung Q3
INSERT OR IGNORE INTO items (id, block_id, kind, position, text, heading, created_at, updated_at) VALUES
  ('b1-h1', 'b1', 'note', 1000, 'Teilnehmer', 1, 1754000000000, 1754000000000),
  ('b1-n1', 'b1', 'note', 2000, 'Lena, Tomas, Amira', NULL, 1754000000000, 1754000000000),
  ('b1-h2', 'b1', 'note', 3000, 'Agenda', 1, 1754000000000, 1754000000000),
  ('b1-n2', 'b1', 'note', 4000, 'Kapazitäten, Interviewwelle, Budget', NULL, 1754000000000, 1754000000000);
INSERT OR IGNORE INTO items (id, block_id, kind, position, text, due_date, assignee_space_id, created_at, updated_at) VALUES
  ('b1-t1', 'b1', 'task', 5000, 'Kapazitätsplan für Q3 aufstellen',      '2026-08-05', 'tomas', 1754000000000, 1754000000000),
  ('b1-t2', 'b1', 'task', 6000, 'Kundenliste für Interviews kuratieren', '2026-08-03', 'amira', 1754000000000, 1754000000000),
  ('b1-t3', 'b1', 'task', 7000, 'Budgetfreigabe einholen',               '2026-08-01', 'lena',  1754000000000, 1754000000000);
INSERT OR IGNORE INTO items (id, block_id, kind, position, text, event_date, event_time, created_at, updated_at) VALUES
  ('b1-e1', 'b1', 'event', 8000, 'Follow-up Runde', '2026-08-07', '10:30', 1754000000000, 1754000000000);

-- b2: Editor-Entscheidung
INSERT OR IGNORE INTO items (id, block_id, kind, position, text, heading, created_at, updated_at) VALUES
  ('b2-h1', 'b2', 'note', 1000, 'Kontext', 1, 1754000000000, 1754000000000),
  ('b2-n1', 'b2', 'note', 2000, 'Fremdeditor bringt 400 kB und kein Blockmodell mit.', NULL, 1754000000000, 1754000000000),
  ('b2-h2', 'b2', 'note', 3000, 'Beschluss', 1, 1754000000000, 1754000000000),
  ('b2-n2', 'b2', 'note', 4000, 'Eigener Kern, Slash-Menü zuerst.', NULL, 1754000000000, 1754000000000);
INSERT OR IGNORE INTO items (id, block_id, kind, position, text, due_date, assignee_space_id, created_at, updated_at) VALUES
  ('b2-t1', 'b2', 'task', 5000, 'Spike Editorkern, 3 Tage', '2026-08-09', 'tomas', 1754000000000, 1754000000000);

-- b3: Interview Nordbau GmbH
INSERT OR IGNORE INTO items (id, block_id, kind, position, text, heading, created_at, updated_at) VALUES
  ('b3-h1', 'b3', 'note', 1000, 'Teilnehmer', 1, 1754000000000, 1754000000000),
  ('b3-n1', 'b3', 'note', 2000, 'Amira, Herr Voss (Nordbau)', NULL, 1754000000000, 1754000000000);
INSERT OR IGNORE INTO items (id, block_id, kind, position, text, event_date, event_time, created_at, updated_at) VALUES
  ('b3-e1', 'b3', 'event', 3000, 'Videocall Nordbau', '2026-08-03', '14:00', 1754000000000, 1754000000000);
INSERT OR IGNORE INTO items (id, block_id, kind, position, text, due_date, assignee_space_id, done, created_at, updated_at) VALUES
  ('b3-t1', 'b3', 'task', 4000, 'Gesprächsleitfaden schicken', '2026-08-02', 'amira', 1, 1754000000000, 1754000000000);

-- b4: Woche sortieren
INSERT OR IGNORE INTO items (id, block_id, kind, position, text, created_at, updated_at) VALUES
  ('b4-n1', 'b4', 'note', 1000, 'Diese Woche: weniger Meetings, mehr Schreibzeit.', 1754000000000, 1754000000000);
INSERT OR IGNORE INTO items (id, block_id, kind, position, text, due_date, assignee_space_id, created_at, updated_at) VALUES
  ('b4-t1', 'b4', 'task', 2000, 'Onboarding-Text überarbeiten', '2026-08-04', 'lena', 1754000000000, 1754000000000);

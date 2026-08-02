-- Person spaces can carry the Access email so the app knows who "me" is
-- (docs/adr/0013): "nur meine", own-row highlighting, the own space marker.
-- Topics stay NULL. Unique where set — one email maps to exactly one space.
ALTER TABLE spaces ADD COLUMN email TEXT;

CREATE UNIQUE INDEX idx_spaces_email ON spaces(email) WHERE email IS NOT NULL;

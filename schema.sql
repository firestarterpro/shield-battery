-- Shield Battery: one shared JSON document plus an append-only edit log.
CREATE TABLE IF NOT EXISTS doc (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  body TEXT NOT NULL,
  version INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
INSERT OR IGNORE INTO doc (id, body, version, updated_at) VALUES (1, '{}', 0, datetime('now'));

CREATE TABLE IF NOT EXISTS log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  who TEXT NOT NULL,
  summary TEXT NOT NULL,
  ops TEXT NOT NULL,        -- JSON [{path, before, after}]
  undo_of INTEGER,          -- id of the entry this one reverses
  undone_by INTEGER         -- id of the entry that reversed this one
);
CREATE INDEX IF NOT EXISTS log_at ON log (id DESC);

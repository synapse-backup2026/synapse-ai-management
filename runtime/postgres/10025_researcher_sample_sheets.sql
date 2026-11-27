CREATE TABLE IF NOT EXISTS researcher_sample_sheets (
  id TEXT PRIMARY KEY,
  created_by TEXT NOT NULL,
  sheet TEXT NOT NULL,
  destination TEXT NOT NULL DEFAULT '',
  revision INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS researcher_sample_sheets_owner_idx
  ON researcher_sample_sheets (created_by, id);

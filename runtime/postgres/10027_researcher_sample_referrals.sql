ALTER TABLE researcher_sample_sheets ADD COLUMN IF NOT EXISTS deleted_at TEXT;
ALTER TABLE researcher_sample_sheets ADD COLUMN IF NOT EXISTS assigned_to TEXT NOT NULL DEFAULT '';
ALTER TABLE researcher_sample_sheets ADD COLUMN IF NOT EXISTS assigned_lab_id TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS researcher_sample_referrals_staff
  ON researcher_sample_sheets (assigned_to) WHERE deleted_at IS NULL AND assigned_to <> '';
CREATE INDEX IF NOT EXISTS researcher_sample_referrals_lab
  ON researcher_sample_sheets (assigned_lab_id) WHERE deleted_at IS NULL AND assigned_lab_id <> '';

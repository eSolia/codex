-- Fragment QC: add quality-check metadata to fragment_index.
-- QC checks are run via Workers AI against the writing guide.
-- Results stored as JSON for flexible issue tracking.

ALTER TABLE fragment_index ADD COLUMN last_qc_at TEXT;
ALTER TABLE fragment_index ADD COLUMN qc_score INTEGER;      -- 0-100
ALTER TABLE fragment_index ADD COLUMN qc_issues TEXT;         -- JSON array of QCIssue objects

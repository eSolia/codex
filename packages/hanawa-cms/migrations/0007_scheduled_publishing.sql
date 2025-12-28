-- Hanawa CMS: Scheduled Publishing Migration
-- InfoSec: Time-based publication with embargo support
-- Reference: docs/concepts/hanawa-features/06-scheduled-publishing.md

-- Scheduled jobs table
CREATE TABLE IF NOT EXISTS scheduled_jobs (
  id TEXT PRIMARY KEY,

  -- Target
  document_id TEXT NOT NULL,
  action TEXT NOT NULL,                 -- 'publish', 'unpublish', 'archive'

  -- Timing
  scheduled_at INTEGER NOT NULL,        -- Unix timestamp (UTC)
  timezone TEXT DEFAULT 'UTC',          -- Original timezone for display

  -- Status
  status TEXT DEFAULT 'pending',        -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  processed_at INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Metadata
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  cancelled_by TEXT,
  cancelled_at INTEGER,
  notes TEXT,

  -- Embargo: Hard embargo means content cannot be published before this time
  is_embargo INTEGER DEFAULT 0,

  FOREIGN KEY (document_id) REFERENCES content(id) ON DELETE CASCADE
);

-- Index for finding pending jobs due for processing
CREATE INDEX IF NOT EXISTS idx_scheduled_pending ON scheduled_jobs(status, scheduled_at);

-- Index for finding jobs by document
CREATE INDEX IF NOT EXISTS idx_scheduled_document ON scheduled_jobs(document_id);

-- Index for finding jobs by status
CREATE INDEX IF NOT EXISTS idx_scheduled_status ON scheduled_jobs(status);

-- Add scheduling columns to content table
-- Note: Using content table as that's our main document table
-- scheduled_publish_at: When content should be auto-published
-- scheduled_unpublish_at: When content should be auto-unpublished
-- embargo_until: Hard embargo - cannot publish before this time

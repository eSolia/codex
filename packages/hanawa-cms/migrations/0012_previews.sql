-- Migration: Preview Deployments
-- Shareable staging environments for content review

-- InfoSec: Token-based access, expiry controls (OWASP A01)

CREATE TABLE IF NOT EXISTS previews (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  content_snapshot TEXT NOT NULL,       -- Frozen content at time of preview creation
  access_token TEXT NOT NULL UNIQUE,    -- 64-char hex token for URL access
  password_hash TEXT,                   -- Optional bcrypt hash for password protection
  allowed_emails TEXT,                  -- JSON array of allowed email addresses
  max_views INTEGER,                    -- Optional view limit
  view_count INTEGER DEFAULT 0,
  expires_at INTEGER NOT NULL,          -- Unix timestamp
  name TEXT,                            -- Descriptive name for the preview
  created_by TEXT NOT NULL,             -- Email of creator
  created_at INTEGER NOT NULL,
  status TEXT DEFAULT 'active',         -- active, expired, revoked
  FOREIGN KEY (document_id) REFERENCES content(id)
);

CREATE TABLE IF NOT EXISTS preview_feedback (
  id TEXT PRIMARY KEY,
  preview_id TEXT NOT NULL,
  page_path TEXT,                       -- Optional path within the preview
  feedback_type TEXT NOT NULL,          -- 'comment', 'issue', 'approval'
  content TEXT NOT NULL,
  author_email TEXT NOT NULL,
  status TEXT DEFAULT 'open',           -- open, resolved, dismissed
  created_at INTEGER NOT NULL,
  FOREIGN KEY (preview_id) REFERENCES previews(id)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_previews_document_id ON previews(document_id);
CREATE INDEX IF NOT EXISTS idx_previews_access_token ON previews(access_token);
CREATE INDEX IF NOT EXISTS idx_previews_status ON previews(status);
CREATE INDEX IF NOT EXISTS idx_previews_expires_at ON previews(expires_at);
CREATE INDEX IF NOT EXISTS idx_preview_feedback_preview_id ON preview_feedback(preview_id);
CREATE INDEX IF NOT EXISTS idx_preview_feedback_status ON preview_feedback(status);

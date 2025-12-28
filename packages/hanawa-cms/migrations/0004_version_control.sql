-- Version Control Migration
-- InfoSec: Full content snapshots for compliance audit trails
-- Based on hanawa-features/02-version-control.md specification

-- Document versions table - stores full content snapshots
CREATE TABLE IF NOT EXISTS document_versions (
  -- Identity
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,

  -- Timing (Unix epoch milliseconds for consistency)
  created_at INTEGER NOT NULL,

  -- Actor
  created_by_id TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT,

  -- Content (full snapshot for compliance - must be able to reconstruct any point in time)
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'html' CHECK(content_format IN ('html', 'json', 'markdown')),
  content_hash TEXT NOT NULL,

  -- Metadata
  title TEXT,
  metadata TEXT,

  -- Classification
  version_type TEXT DEFAULT 'auto' CHECK(version_type IN ('auto', 'manual', 'publish', 'restore')),
  version_label TEXT,
  version_notes TEXT,

  -- Size tracking
  content_size INTEGER,

  -- Navigation
  previous_version_id TEXT,

  FOREIGN KEY (document_id) REFERENCES content(id) ON DELETE CASCADE,
  FOREIGN KEY (previous_version_id) REFERENCES document_versions(id)
);

-- Indexes for version queries
CREATE INDEX IF NOT EXISTS idx_versions_document ON document_versions(document_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_versions_document_time ON document_versions(document_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_versions_hash ON document_versions(content_hash);
CREATE UNIQUE INDEX IF NOT EXISTS idx_versions_unique ON document_versions(document_id, version_number);
CREATE INDEX IF NOT EXISTS idx_versions_type ON document_versions(version_type);
CREATE INDEX IF NOT EXISTS idx_versions_label ON document_versions(version_label) WHERE version_label IS NOT NULL;

-- Fragment versions table (same structure for fragments)
CREATE TABLE IF NOT EXISTS fragment_versions (
  id TEXT PRIMARY KEY,
  fragment_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  created_by_id TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT,
  content_en TEXT,
  content_ja TEXT,
  content_hash TEXT NOT NULL,
  name TEXT,
  metadata TEXT,
  version_type TEXT DEFAULT 'auto' CHECK(version_type IN ('auto', 'manual', 'publish', 'restore')),
  version_label TEXT,
  version_notes TEXT,
  content_size INTEGER,
  previous_version_id TEXT,

  FOREIGN KEY (fragment_id) REFERENCES fragments(id) ON DELETE CASCADE,
  FOREIGN KEY (previous_version_id) REFERENCES fragment_versions(id)
);

CREATE INDEX IF NOT EXISTS idx_frag_versions_fragment ON fragment_versions(fragment_id, version_number DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_frag_versions_unique ON fragment_versions(fragment_id, version_number);

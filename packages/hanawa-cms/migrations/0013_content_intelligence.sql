-- Migration: Content Intelligence
-- Automated content analysis and quality scoring

CREATE TABLE IF NOT EXISTS content_analysis (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL UNIQUE,

  -- Basic metrics
  word_count INTEGER,
  character_count INTEGER,
  reading_time_minutes REAL,

  -- Readability scores
  flesch_reading_ease REAL,
  flesch_kincaid_grade REAL,

  -- SEO metrics
  seo_score INTEGER,
  seo_issues TEXT,               -- JSON array of {type, message, severity}

  -- Link counts
  internal_links INTEGER,
  external_links INTEGER,
  broken_links TEXT,             -- JSON array of {url, status, type}

  -- Overall quality
  quality_score INTEGER,
  quality_issues TEXT,           -- JSON array

  -- Timestamps
  analyzed_at INTEGER NOT NULL,

  FOREIGN KEY (document_id) REFERENCES content(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_analysis_document ON content_analysis(document_id);
CREATE INDEX IF NOT EXISTS idx_content_analysis_quality ON content_analysis(quality_score);
CREATE INDEX IF NOT EXISTS idx_content_analysis_seo ON content_analysis(seo_score);

-- Content alerts for health monitoring
CREATE TABLE IF NOT EXISTS content_alerts (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,      -- 'broken_link', 'stale', 'orphan', 'quality', 'seo'
  severity TEXT NOT NULL,        -- 'info', 'warning', 'error'
  message TEXT NOT NULL,
  details TEXT,                  -- JSON with additional context
  status TEXT DEFAULT 'open',    -- 'open', 'acknowledged', 'resolved'
  created_at INTEGER NOT NULL,
  resolved_at INTEGER,

  FOREIGN KEY (document_id) REFERENCES content(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_content_alerts_document ON content_alerts(document_id, status);
CREATE INDEX IF NOT EXISTS idx_content_alerts_type ON content_alerts(alert_type, status);
CREATE INDEX IF NOT EXISTS idx_content_alerts_severity ON content_alerts(severity, status);

-- Hanawa CMS: AI Assistant Migration
-- InfoSec: Claude-powered writing assistance with usage tracking
-- Reference: docs/concepts/hanawa-features/08-ai-assistant.md

-- Track AI feature usage for billing and analytics
-- InfoSec: Contains usage metrics, no PII stored
CREATE TABLE IF NOT EXISTS ai_usage (
  id TEXT PRIMARY KEY,

  -- User info
  user_email TEXT NOT NULL,

  -- Context
  document_id TEXT,                       -- Optional: which document was being edited
  document_type TEXT,                     -- 'content', 'fragment', etc.

  -- Request details
  action TEXT NOT NULL,                   -- 'continue', 'expand', 'improve', 'translate', etc.
  model TEXT DEFAULT 'claude-sonnet-4-20250514',

  -- Token usage for billing
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,

  -- Timing
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  duration_ms INTEGER,

  -- Error tracking
  success INTEGER DEFAULT 1,              -- 0 = failed, 1 = success
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_email);
CREATE INDEX IF NOT EXISTS idx_ai_usage_action ON ai_usage(action);
CREATE INDEX IF NOT EXISTS idx_ai_usage_created ON ai_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_ai_usage_document ON ai_usage(document_id);

-- Terminology glossary for consistent translations
-- InfoSec: Maintains translation consistency across documents
CREATE TABLE IF NOT EXISTS terminology (
  id TEXT PRIMARY KEY,

  -- Terms
  term_en TEXT NOT NULL,
  term_ja TEXT NOT NULL,

  -- Context
  category TEXT,                          -- 'technical', 'legal', 'brand', etc.
  notes TEXT,                             -- Usage notes for translators

  -- Quality
  verified INTEGER DEFAULT 0,             -- 0 = suggested, 1 = verified by human
  verified_by TEXT,
  verified_at INTEGER,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_terminology_en ON terminology(term_en);
CREATE INDEX IF NOT EXISTS idx_terminology_ja ON terminology(term_ja);
CREATE INDEX IF NOT EXISTS idx_terminology_category ON terminology(category);

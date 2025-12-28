-- Hanawa CMS: Localization Migration
-- InfoSec: Field-level internationalization for bilingual content (EN/JA)
-- Reference: docs/concepts/hanawa-features/07-localization.md

-- Add locale support to content table
-- default_locale: The primary language for this content
-- available_locales: JSON array of locales that have translations
-- localized_content: JSON object with locale-specific field values
ALTER TABLE content ADD COLUMN default_locale TEXT DEFAULT 'en';
ALTER TABLE content ADD COLUMN available_locales TEXT DEFAULT '["en"]';
ALTER TABLE content ADD COLUMN localized_content TEXT;

-- Add locale support to fragments table (reusable content blocks)
-- Fragments often need EN/JA versions for proposals
ALTER TABLE fragments ADD COLUMN default_locale TEXT DEFAULT 'en';
ALTER TABLE fragments ADD COLUMN available_locales TEXT DEFAULT '["en", "ja"]';
ALTER TABLE fragments ADD COLUMN localized_content TEXT;

-- Translation status tracking
-- Tracks progress of translations for each document/locale pair
CREATE TABLE IF NOT EXISTS translation_status (
  id TEXT PRIMARY KEY,

  -- Reference (polymorphic: content or fragment)
  document_id TEXT NOT NULL,
  document_type TEXT DEFAULT 'content',    -- 'content' or 'fragment'
  locale TEXT NOT NULL,                    -- Target locale ('en' or 'ja')

  -- Status tracking
  status TEXT DEFAULT 'pending',           -- 'pending', 'in_progress', 'review', 'complete'
  progress_percent INTEGER DEFAULT 0,      -- 0-100

  -- Field tracking (JSON arrays)
  translated_fields TEXT,                  -- Fields that have been translated
  pending_fields TEXT,                     -- Fields still needing translation

  -- Assignment
  assigned_to TEXT,                        -- Email of translator
  assigned_at INTEGER,

  -- Timestamps
  created_at INTEGER NOT NULL,
  last_updated INTEGER NOT NULL,
  completed_at INTEGER,

  -- Notes
  notes TEXT,

  UNIQUE(document_id, document_type, locale)
);

CREATE INDEX IF NOT EXISTS idx_translation_status_doc ON translation_status(document_id, document_type);
CREATE INDEX IF NOT EXISTS idx_translation_status_locale ON translation_status(locale, status);
CREATE INDEX IF NOT EXISTS idx_translation_status_assigned ON translation_status(assigned_to);

-- Translation memory (optional: for AI-assisted translation)
-- Stores previously translated segments for consistency
CREATE TABLE IF NOT EXISTS translation_memory (
  id TEXT PRIMARY KEY,

  -- Source and target
  source_locale TEXT NOT NULL,
  target_locale TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_text TEXT NOT NULL,

  -- Context
  field_name TEXT,                         -- e.g., 'title', 'description'
  document_type TEXT,                      -- 'content', 'fragment'

  -- Quality
  confidence REAL DEFAULT 1.0,             -- 0.0-1.0, 1.0 = human verified
  usage_count INTEGER DEFAULT 1,

  -- Timestamps
  created_at INTEGER NOT NULL,
  last_used_at INTEGER NOT NULL,

  -- For efficient lookup
  source_hash TEXT NOT NULL                -- Hash of source_text for fast matching
);

CREATE INDEX IF NOT EXISTS idx_tm_lookup ON translation_memory(source_locale, target_locale, source_hash);
CREATE INDEX IF NOT EXISTS idx_tm_source ON translation_memory(source_text);

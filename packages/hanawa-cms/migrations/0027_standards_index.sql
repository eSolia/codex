-- Standards Index: metadata index for coding/workflow standards
-- Content lives in R2 as standards/{slug}.md files, not in D1.
-- This table indexes frontmatter for fast lookup and filtering.

CREATE TABLE IF NOT EXISTS standards_index (
  slug TEXT PRIMARY KEY,               -- matches frontmatter 'slug' field
  title TEXT NOT NULL,                 -- English title
  category TEXT,                       -- e.g., 'guides', 'reference', 'prompts', 'seo'
  tags TEXT DEFAULT '[]',              -- JSON array of strings
  summary TEXT,                        -- Brief description
  status TEXT DEFAULT 'production' CHECK(status IN ('production', 'draft', 'deprecated', 'archived')),
  r2_key TEXT,                         -- R2 object key: standards/{slug}.md
  author TEXT DEFAULT 'eSolia Technical Team',
  created_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_standards_index_category ON standards_index(category);
CREATE INDEX IF NOT EXISTS idx_standards_index_status ON standards_index(status);

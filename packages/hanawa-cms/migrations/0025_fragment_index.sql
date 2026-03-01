-- Fragment Index: metadata index for markdown-first fragments
-- Content lives in R2 as *.en.md / *.ja.md files, not in D1.
-- This table indexes frontmatter for fast lookup and filtering.

CREATE TABLE IF NOT EXISTS fragment_index (
  id TEXT PRIMARY KEY,                -- matches frontmatter 'id' field
  category TEXT,                      -- e.g., 'proposals', 'services', 'diagrams'
  title_en TEXT,
  title_ja TEXT,
  type TEXT,                          -- e.g., 'content', 'mermaid', 'product-overview'
  version TEXT,
  status TEXT DEFAULT 'production' CHECK(status IN ('production', 'draft', 'deprecated', 'archived')),
  tags TEXT DEFAULT '[]',             -- JSON array of strings
  has_en INTEGER DEFAULT 0,           -- 1 if .en.md exists in R2
  has_ja INTEGER DEFAULT 0,           -- 1 if .ja.md exists in R2
  r2_key_en TEXT,                     -- R2 object key for English markdown
  r2_key_ja TEXT,                     -- R2 object key for Japanese markdown
  sensitivity TEXT DEFAULT 'normal' CHECK(sensitivity IN ('normal', 'confidential', 'embargoed')),
  author TEXT DEFAULT 'eSolia Technical Team',
  created_at TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_fragment_index_category ON fragment_index(category);
CREATE INDEX IF NOT EXISTS idx_fragment_index_status ON fragment_index(status);
CREATE INDEX IF NOT EXISTS idx_fragment_index_type ON fragment_index(type);

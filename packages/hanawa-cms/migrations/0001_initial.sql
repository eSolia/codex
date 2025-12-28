-- Hanawa CMS Initial Schema
-- Multi-site headless CMS for eSolia

-- Sites table: each site (esolia.co.jp, j-pvad.jp, etc.)
CREATE TABLE IF NOT EXISTS sites (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  domain TEXT,
  description TEXT,
  default_language TEXT DEFAULT 'ja',
  languages TEXT DEFAULT '["ja", "en"]', -- JSON array
  settings TEXT DEFAULT '{}', -- JSON for site-specific settings
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Content types per site (pages, articles, posts, etc.)
CREATE TABLE IF NOT EXISTS content_types (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  schema TEXT DEFAULT '{}', -- JSON schema for frontmatter fields
  template TEXT, -- Default template name
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  UNIQUE(site_id, slug)
);

-- Content items (pages, articles, etc.)
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  site_id TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  content_type_id TEXT NOT NULL REFERENCES content_types(id) ON DELETE CASCADE,

  -- Identifiers
  slug TEXT NOT NULL,
  path TEXT, -- Full URL path like /articles/my-article

  -- Content
  title TEXT NOT NULL,
  title_translations TEXT DEFAULT '{}', -- JSON: {"ja": "...", "en": "..."}
  body TEXT, -- Markdown/HTML content
  body_translations TEXT DEFAULT '{}', -- JSON for translated bodies

  -- Metadata
  frontmatter TEXT DEFAULT '{}', -- JSON for all frontmatter
  excerpt TEXT,

  -- Status
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'published', 'archived')),
  language TEXT DEFAULT 'ja',

  -- Dates
  published_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  -- Author
  author_id TEXT,

  UNIQUE(site_id, slug, language)
);

-- Fragments: reusable content blocks
CREATE TABLE IF NOT EXISTS fragments (
  id TEXT PRIMARY KEY,

  -- Can be global (site_id NULL) or site-specific
  site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,

  -- Identifiers
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  category TEXT, -- e.g., 'products', 'services', 'boilerplate'

  -- Content (bilingual)
  content_en TEXT,
  content_ja TEXT,

  -- Metadata
  description TEXT,
  tags TEXT DEFAULT '[]', -- JSON array
  version TEXT DEFAULT '1.0',

  -- Status
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'deprecated', 'draft')),

  -- Dates
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),

  UNIQUE(site_id, slug)
);

-- Assets: uploaded files
CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  site_id TEXT REFERENCES sites(id) ON DELETE CASCADE,

  -- File info
  filename TEXT NOT NULL,
  path TEXT NOT NULL, -- R2 path
  mime_type TEXT,
  size INTEGER,

  -- Metadata
  alt_text TEXT,
  alt_text_ja TEXT,
  caption TEXT,

  -- Organization
  folder TEXT DEFAULT '/',
  tags TEXT DEFAULT '[]',

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Users (basic, can be extended with Cloudflare Access)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'editor' CHECK(role IN ('admin', 'editor', 'viewer')),

  -- Cloudflare Access integration
  access_id TEXT, -- Cloudflare Access user ID

  -- Preferences
  preferences TEXT DEFAULT '{}',

  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Audit log
CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT, -- JSON
  created_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_content_site ON content(site_id);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type_id);
CREATE INDEX IF NOT EXISTS idx_content_status ON content(status);
CREATE INDEX IF NOT EXISTS idx_content_slug ON content(slug);
CREATE INDEX IF NOT EXISTS idx_fragments_category ON fragments(category);
CREATE INDEX IF NOT EXISTS idx_fragments_slug ON fragments(slug);
CREATE INDEX IF NOT EXISTS idx_assets_site ON assets(site_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_log(entity_type, entity_id);

-- Insert default eSolia site
INSERT OR IGNORE INTO sites (id, name, slug, domain, description, default_language, languages)
VALUES (
  'esolia-jp',
  'eSolia Japan',
  'esolia-jp',
  'esolia.co.jp',
  'eSolia Inc. Japanese website',
  'ja',
  '["ja", "en"]'
);

-- Insert default content types for eSolia
INSERT OR IGNORE INTO content_types (id, site_id, name, slug, description)
VALUES
  ('esolia-pages', 'esolia-jp', 'Pages', 'pages', 'Static pages'),
  ('esolia-articles', 'esolia-jp', 'Articles', 'articles', 'Blog articles and insights'),
  ('esolia-services', 'esolia-jp', 'Services', 'services', 'Service pages');

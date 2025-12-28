-- Hanawa CMS: Codex Integration Migration
-- InfoSec: Vector search infrastructure for semantic content discovery
-- Reference: docs/concepts/hanawa-features/09-codex-integration.md

-- Document chunks for vector search
-- InfoSec: Content is split for efficient embedding, no sensitive data in vectors
CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,

  -- Document reference
  document_id TEXT NOT NULL,
  document_type TEXT DEFAULT 'content',   -- 'content' or 'fragment'
  chunk_index INTEGER NOT NULL,

  -- Content
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,             -- SHA-256 for deduplication

  -- Metadata for filtering
  collection TEXT NOT NULL,
  locale TEXT DEFAULT 'en',
  status TEXT DEFAULT 'published',

  -- Context within document
  heading_path TEXT,                      -- e.g., "Overview > Key Concepts"
  chunk_type TEXT DEFAULT 'content',      -- 'title', 'heading', 'content', 'list'

  -- Vector reference (in Cloudflare Vectorize)
  vector_id TEXT,
  embedded_at INTEGER,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  FOREIGN KEY (document_id) REFERENCES content(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id, document_type);
CREATE INDEX IF NOT EXISTS idx_chunks_vector ON document_chunks(vector_id);
CREATE INDEX IF NOT EXISTS idx_chunks_hash ON document_chunks(content_hash);
CREATE INDEX IF NOT EXISTS idx_chunks_collection ON document_chunks(collection, locale, status);

-- Search index status tracking
-- InfoSec: Tracks indexing progress, no content stored here
CREATE TABLE IF NOT EXISTS search_index_status (
  document_id TEXT PRIMARY KEY,
  document_type TEXT DEFAULT 'content',

  -- Indexing state
  status TEXT DEFAULT 'pending',          -- 'pending', 'indexing', 'indexed', 'error'
  last_indexed_at INTEGER,
  last_indexed_version INTEGER,
  chunk_count INTEGER DEFAULT 0,

  -- Error tracking
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_search_status ON search_index_status(status);
CREATE INDEX IF NOT EXISTS idx_search_pending ON search_index_status(status, updated_at)
  WHERE status IN ('pending', 'error');

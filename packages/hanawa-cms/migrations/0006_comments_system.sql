-- Hanawa CMS: Comments System Migration
-- InfoSec: Threaded discussions with audit trails
-- Reference: docs/concepts/hanawa-features/04-comments-system.md

-- Comments table
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,

  -- Threading
  parent_id TEXT,                     -- NULL for root comments
  thread_id TEXT NOT NULL,            -- Groups replies together

  -- Type and position
  comment_type TEXT NOT NULL,         -- 'inline', 'document', 'suggestion'

  -- For inline comments: position in document
  anchor_start INTEGER,               -- ProseMirror position start
  anchor_end INTEGER,                 -- ProseMirror position end
  anchor_text TEXT,                   -- The text that was highlighted
  anchor_path TEXT,                   -- JSON path for robustness

  -- Content
  content TEXT NOT NULL,              -- The comment text (supports markdown)
  content_html TEXT,                  -- Rendered HTML

  -- For suggestions: the proposed change
  suggestion_text TEXT,

  -- Status
  status TEXT DEFAULT 'open',         -- 'open', 'resolved', 'rejected'
  resolved_by TEXT,
  resolved_at INTEGER,
  resolution_note TEXT,

  -- Author
  author_id TEXT NOT NULL,
  author_email TEXT NOT NULL,
  author_name TEXT,

  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,

  -- Soft delete
  deleted_at INTEGER,
  deleted_by TEXT,

  FOREIGN KEY (document_id) REFERENCES content(id) ON DELETE CASCADE,
  FOREIGN KEY (parent_id) REFERENCES comments(id)
);

CREATE INDEX IF NOT EXISTS idx_comments_document ON comments(document_id, created_at);
CREATE INDEX IF NOT EXISTS idx_comments_thread ON comments(thread_id);
CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_email);
CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(document_id, status);

-- Mentions table
CREATE TABLE IF NOT EXISTS comment_mentions (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  mentioned_email TEXT NOT NULL,
  notified_at INTEGER,
  read_at INTEGER,

  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_mentions_user ON comment_mentions(mentioned_email, notified_at);
CREATE INDEX IF NOT EXISTS idx_mentions_comment ON comment_mentions(comment_id);

-- Reactions (optional emoji reactions)
CREATE TABLE IF NOT EXISTS comment_reactions (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  reaction TEXT NOT NULL,             -- 'thumbsup', 'thumbsdown', 'heart', etc.
  created_at INTEGER NOT NULL,

  FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
  UNIQUE(comment_id, user_email, reaction)
);

CREATE INDEX IF NOT EXISTS idx_reactions_comment ON comment_reactions(comment_id);

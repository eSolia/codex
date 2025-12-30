-- Migration: Proposals System
-- Dedicated table for client proposals with fragment assembly and delivery tracking

CREATE TABLE IF NOT EXISTS proposals (
  id TEXT PRIMARY KEY,

  -- Client information
  client_code TEXT NOT NULL,
  client_name TEXT,
  client_name_ja TEXT,

  -- Proposal details
  title TEXT NOT NULL,
  title_ja TEXT,
  scope TEXT,                          -- Brief description of scope
  language TEXT DEFAULT 'en',          -- Primary language: en or ja

  -- Content assembly
  template_id TEXT,                    -- Template used (for future)
  fragments TEXT DEFAULT '[]',         -- JSON array of fragment references with order
  custom_sections TEXT,                -- Tiptap JSON for custom content

  -- Workflow status
  status TEXT DEFAULT 'draft' CHECK(status IN ('draft', 'review', 'approved', 'shared', 'archived')),

  -- Review tracking
  reviewed_by TEXT,
  reviewed_at TEXT,
  review_notes TEXT,

  -- PDF generation
  pdf_generated_at TEXT,
  pdf_r2_key TEXT,                     -- R2 path if stored

  -- Courier delivery
  share_id TEXT,                       -- Courier share ID
  share_url TEXT,
  share_pin TEXT,                      -- Stored for reference (masked in UI)
  shared_at TEXT,
  shared_to_email TEXT,
  shared_to_name TEXT,
  share_expires_at TEXT,

  -- Provenance
  provenance TEXT,                     -- JSON with full provenance metadata

  -- Audit
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_proposals_client ON proposals(client_code);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created ON proposals(created_at DESC);

-- InfoSec: Proposal delivery tracking for audit compliance
-- All share operations logged with recipient info for regulatory requirements

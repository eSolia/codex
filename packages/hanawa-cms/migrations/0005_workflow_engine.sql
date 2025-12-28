-- Hanawa CMS: Workflow Engine Migration
-- InfoSec: Multi-stage approval workflows for content governance
-- Reference: docs/concepts/hanawa-features/05-workflow-engine.md

-- Workflow templates
CREATE TABLE IF NOT EXISTS workflow_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  collection TEXT,                    -- Apply to specific collection, NULL = all
  is_default INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  created_by TEXT NOT NULL
);

-- Stages within a workflow
CREATE TABLE IF NOT EXISTS workflow_stages (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  stage_order INTEGER NOT NULL,       -- 1, 2, 3...
  stage_type TEXT NOT NULL,           -- 'draft', 'review', 'approval', 'published'

  -- Approval requirements
  approval_type TEXT DEFAULT 'any',   -- 'any', 'all', 'sequential'
  required_approvers TEXT,            -- JSON: role names or user emails
  min_approvals INTEGER DEFAULT 1,

  -- Automation
  auto_advance INTEGER DEFAULT 0,
  auto_advance_after INTEGER,         -- Hours to wait before auto-advance

  -- Notifications
  notify_on_enter TEXT,               -- JSON: who to notify
  notify_on_exit TEXT,

  FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_workflow_stages_workflow ON workflow_stages(workflow_id, stage_order);

-- Stage transitions (allowed paths)
CREATE TABLE IF NOT EXISTS workflow_transitions (
  id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  from_stage_id TEXT NOT NULL,
  to_stage_id TEXT NOT NULL,
  transition_type TEXT NOT NULL,      -- 'advance', 'reject', 'skip'
  requires_comment INTEGER DEFAULT 0,
  allowed_roles TEXT,                 -- JSON: who can trigger this transition

  FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id) ON DELETE CASCADE,
  FOREIGN KEY (from_stage_id) REFERENCES workflow_stages(id),
  FOREIGN KEY (to_stage_id) REFERENCES workflow_stages(id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_transitions_from ON workflow_transitions(from_stage_id);

-- Current workflow state per document
CREATE TABLE IF NOT EXISTS document_workflow_state (
  document_id TEXT PRIMARY KEY,
  workflow_id TEXT NOT NULL,
  current_stage_id TEXT NOT NULL,

  -- Approval tracking
  approvals TEXT,                     -- JSON: array of {userId, email, at, comment}
  rejections TEXT,                    -- JSON: array of {userId, email, at, comment}

  -- Timing
  entered_stage_at INTEGER NOT NULL,
  deadline INTEGER,                   -- Optional: when approval is needed by

  -- History
  previous_stage_id TEXT,

  FOREIGN KEY (workflow_id) REFERENCES workflow_definitions(id),
  FOREIGN KEY (current_stage_id) REFERENCES workflow_stages(id)
);

-- Workflow history (full audit)
CREATE TABLE IF NOT EXISTS workflow_history (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,

  -- Transition
  from_stage_id TEXT,
  to_stage_id TEXT NOT NULL,
  transition_type TEXT NOT NULL,

  -- Actor
  actor_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,

  -- Context
  comment TEXT,
  metadata TEXT,                      -- JSON: additional context

  FOREIGN KEY (document_id) REFERENCES content(id)
);

CREATE INDEX IF NOT EXISTS idx_workflow_history_doc ON workflow_history(document_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_workflow_history_actor ON workflow_history(actor_email, timestamp DESC);

-- Insert default "Simple Review" workflow
INSERT OR IGNORE INTO workflow_definitions (id, name, description, is_default, is_active, created_at, updated_at, created_by)
VALUES (
  'workflow_simple',
  'Simple Review',
  'Single review stage before publication',
  1,
  1,
  strftime('%s', 'now') * 1000,
  strftime('%s', 'now') * 1000,
  'system'
);

-- Insert stages for Simple Review workflow
INSERT OR IGNORE INTO workflow_stages (id, workflow_id, name, description, stage_order, stage_type, approval_type, required_approvers, min_approvals, auto_advance)
VALUES
  ('stage_simple_draft', 'workflow_simple', 'Draft', 'Initial draft stage', 1, 'draft', 'any', '[]', 0, 0),
  ('stage_simple_review', 'workflow_simple', 'Review', 'Content review by editor', 2, 'review', 'any', '["editor", "admin"]', 1, 0),
  ('stage_simple_published', 'workflow_simple', 'Published', 'Content is live', 3, 'published', 'any', '[]', 0, 0);

-- Insert transitions for Simple Review workflow
INSERT OR IGNORE INTO workflow_transitions (id, workflow_id, from_stage_id, to_stage_id, transition_type, requires_comment, allowed_roles)
VALUES
  ('t_simple_1', 'workflow_simple', 'stage_simple_draft', 'stage_simple_review', 'advance', 0, '["author", "editor", "admin"]'),
  ('t_simple_2', 'workflow_simple', 'stage_simple_review', 'stage_simple_published', 'advance', 0, '["editor", "admin"]'),
  ('t_simple_3', 'workflow_simple', 'stage_simple_review', 'stage_simple_draft', 'reject', 1, '["editor", "admin"]'),
  ('t_simple_4', 'workflow_simple', 'stage_simple_published', 'stage_simple_draft', 'reject', 1, '["admin"]');

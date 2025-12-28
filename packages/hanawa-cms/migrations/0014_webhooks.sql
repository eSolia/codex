-- Migration: Webhooks & Integrations
-- Event-driven integrations with external services

-- Webhook endpoints
CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,

  -- Authentication
  secret TEXT,                      -- For HMAC signing
  auth_type TEXT DEFAULT 'none',    -- 'none', 'bearer', 'basic', 'hmac'
  auth_value TEXT,                  -- Token or credentials

  -- Filtering
  events TEXT NOT NULL,             -- JSON array of event types
  collections TEXT,                 -- JSON array, null = all

  -- Status
  enabled INTEGER DEFAULT 1,

  -- Retry config
  max_retries INTEGER DEFAULT 3,
  retry_delay INTEGER DEFAULT 60,   -- Seconds

  -- Stats
  last_triggered_at INTEGER,
  last_success_at INTEGER,
  last_failure_at INTEGER,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,

  -- Audit
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_webhooks_enabled ON webhooks(enabled);

-- Webhook delivery log
CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,

  -- Event
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload TEXT NOT NULL,            -- JSON

  -- Delivery
  status TEXT DEFAULT 'pending',    -- 'pending', 'success', 'failed', 'retrying'
  attempts INTEGER DEFAULT 0,

  -- Response
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,

  -- Timing
  created_at INTEGER NOT NULL,
  delivered_at INTEGER,
  next_retry_at INTEGER,

  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON webhook_deliveries(status);

-- Integration configs (Slack, Email, etc.)
CREATE TABLE IF NOT EXISTS integrations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,               -- 'slack', 'email', 'teams'
  name TEXT NOT NULL,
  config TEXT NOT NULL,             -- JSON config
  enabled INTEGER DEFAULT 1,

  -- Filtering
  events TEXT NOT NULL,             -- JSON array
  collections TEXT,                 -- JSON array

  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_integrations_type ON integrations(type, enabled);

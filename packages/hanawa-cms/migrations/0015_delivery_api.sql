-- Migration: Delivery API
-- API keys for content delivery

-- API keys for delivery API access
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,         -- First 8 chars for lookup

  -- Permissions
  permissions TEXT NOT NULL,        -- JSON: ['read:content', 'read:media']
  collections TEXT,                 -- JSON: null = all

  -- Restrictions
  allowed_origins TEXT,             -- JSON array of CORS origins
  rate_limit INTEGER DEFAULT 1000,  -- Requests per minute

  -- Audit
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,

  enabled INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_enabled ON api_keys(enabled);

-- Optional: Rate limit tracking (can also use KV)
CREATE TABLE IF NOT EXISTS rate_limit_log (
  id TEXT PRIMARY KEY,
  key_id TEXT NOT NULL,
  window_start INTEGER NOT NULL,
  request_count INTEGER DEFAULT 1,

  FOREIGN KEY (key_id) REFERENCES api_keys(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_key ON rate_limit_log(key_id, window_start);

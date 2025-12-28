-- Security columns for content protection
-- InfoSec: OWASP A01 (Access Control), A04 (Insecure Design)

-- Add security and sensitivity columns to content table
ALTER TABLE content ADD COLUMN sensitivity TEXT DEFAULT 'normal' CHECK(sensitivity IN ('normal', 'confidential', 'embargoed'));
ALTER TABLE content ADD COLUMN embargo_until INTEGER; -- Unix timestamp
ALTER TABLE content ADD COLUMN approved_for_preview INTEGER DEFAULT 0;
ALTER TABLE content ADD COLUMN preview_approved_by TEXT;
ALTER TABLE content ADD COLUMN preview_approved_at INTEGER;

-- Preview token management
ALTER TABLE content ADD COLUMN preview_token TEXT;
ALTER TABLE content ADD COLUMN preview_expires INTEGER;
ALTER TABLE content ADD COLUMN preview_max_views INTEGER;
ALTER TABLE content ADD COLUMN preview_view_count INTEGER DEFAULT 0;
ALTER TABLE content ADD COLUMN preview_ip_allowlist TEXT; -- JSON array
ALTER TABLE content ADD COLUMN preview_created_by TEXT;
ALTER TABLE content ADD COLUMN preview_created_at INTEGER;

-- Preview approval request
ALTER TABLE content ADD COLUMN preview_approval_requested INTEGER DEFAULT 0;
ALTER TABLE content ADD COLUMN preview_approval_requested_by TEXT;
ALTER TABLE content ADD COLUMN preview_approval_requested_at INTEGER;

-- Encryption support for sensitive content
ALTER TABLE content ADD COLUMN encrypted_body TEXT;
ALTER TABLE content ADD COLUMN encryption_iv TEXT;
ALTER TABLE content ADD COLUMN is_encrypted INTEGER DEFAULT 0;

-- Additional content fields for bilingual support
ALTER TABLE content ADD COLUMN title_ja TEXT;
ALTER TABLE content ADD COLUMN body_ja TEXT;
ALTER TABLE content ADD COLUMN excerpt_ja TEXT;
ALTER TABLE content ADD COLUMN tags TEXT DEFAULT '[]'; -- JSON array
ALTER TABLE content ADD COLUMN metadata TEXT DEFAULT '{}'; -- JSON

-- Update audit_log for more detailed security logging
ALTER TABLE audit_log ADD COLUMN timestamp INTEGER;
ALTER TABLE audit_log ADD COLUMN actor TEXT;
ALTER TABLE audit_log ADD COLUMN ip_address TEXT;
ALTER TABLE audit_log ADD COLUMN user_agent TEXT;
ALTER TABLE audit_log ADD COLUMN resource_type TEXT;
ALTER TABLE audit_log ADD COLUMN resource_id TEXT;

-- Fragment additions
ALTER TABLE fragments ADD COLUMN is_bilingual INTEGER DEFAULT 1;

-- Sites status column
ALTER TABLE sites ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'maintenance'));

-- Indexes for security queries
CREATE INDEX IF NOT EXISTS idx_content_sensitivity ON content(sensitivity);
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_preview_token ON content(preview_token);
CREATE INDEX IF NOT EXISTS idx_content_embargo ON content(embargo_until);
CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_resource ON audit_log(resource_type, resource_id);

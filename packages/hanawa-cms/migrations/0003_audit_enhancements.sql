-- Audit System Enhancement Migration
-- InfoSec: Comprehensive audit logging for compliance (SOC 2, ISO 27001)
-- Based on hanawa-features/01-audit-system.md specification

-- Add missing columns to audit_log for full compliance tracking
ALTER TABLE audit_log ADD COLUMN action_category TEXT;
ALTER TABLE audit_log ADD COLUMN actor_email TEXT;
ALTER TABLE audit_log ADD COLUMN actor_name TEXT;
ALTER TABLE audit_log ADD COLUMN resource_title TEXT;
ALTER TABLE audit_log ADD COLUMN collection TEXT;
ALTER TABLE audit_log ADD COLUMN field_path TEXT;
ALTER TABLE audit_log ADD COLUMN value_before TEXT;
ALTER TABLE audit_log ADD COLUMN value_after TEXT;
ALTER TABLE audit_log ADD COLUMN change_summary TEXT;
ALTER TABLE audit_log ADD COLUMN session_id TEXT;
ALTER TABLE audit_log ADD COLUMN request_id TEXT;
ALTER TABLE audit_log ADD COLUMN metadata TEXT;
ALTER TABLE audit_log ADD COLUMN checksum TEXT;

-- Update indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_action_category ON audit_log(action_category);
CREATE INDEX IF NOT EXISTS idx_audit_actor_email ON audit_log(actor_email);
CREATE INDEX IF NOT EXISTS idx_audit_request_id ON audit_log(request_id);

-- Composite index for document timeline queries
CREATE INDEX IF NOT EXISTS idx_audit_doc_timeline ON audit_log(resource_id, timestamp DESC);

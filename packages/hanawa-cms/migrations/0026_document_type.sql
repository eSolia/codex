-- Migration 0026: Add document_type and r2_manifest_key to proposals
-- Enables manifest-based document assembly (Phase 4)

ALTER TABLE proposals ADD COLUMN document_type TEXT DEFAULT 'proposal';
ALTER TABLE proposals ADD COLUMN r2_manifest_key TEXT;

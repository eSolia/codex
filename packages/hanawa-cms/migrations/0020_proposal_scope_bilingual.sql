-- Migration: Bilingual Scope Support
-- Renames scope to scope_en and adds scope_ja for consistency with other bilingual fields

-- Add scope_ja for Japanese scope description
ALTER TABLE proposals ADD COLUMN scope_ja TEXT;

-- Note: Existing 'scope' column kept as scope_en equivalent
-- The application code will treat 'scope' as scope_en for backwards compatibility

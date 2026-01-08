-- Migration: Bilingual Proposal Support
-- Adds cover letter fields (EN/JA), Japanese contact name, and language mode settings

-- Add Japanese contact name for bilingual "Prepared for" line
ALTER TABLE proposals ADD COLUMN contact_name_ja TEXT;

-- Add cover letter fields (HTML from Tiptap editor)
-- These replace the single 'custom_sections' field for better bilingual support
ALTER TABLE proposals ADD COLUMN cover_letter_en TEXT;
ALTER TABLE proposals ADD COLUMN cover_letter_ja TEXT;

-- Language mode: controls PDF generation and field visibility
-- Values: 'en', 'ja', 'both_en_first', 'both_ja_first'
ALTER TABLE proposals ADD COLUMN language_mode TEXT DEFAULT 'en';

-- InfoSec: Cover letters stored as sanitized HTML from Tiptap editor (OWASP A03)
-- All HTML is sanitized before storage to prevent XSS

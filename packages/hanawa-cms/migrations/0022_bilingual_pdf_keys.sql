-- Migration: Add separate R2 keys for bilingual PDF files
-- For bilingual proposals: combined PDF, English-only PDF, Japanese-only PDF

ALTER TABLE proposals ADD COLUMN pdf_r2_key_en TEXT;
ALTER TABLE proposals ADD COLUMN pdf_r2_key_ja TEXT;

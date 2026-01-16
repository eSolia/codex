-- Migration: Add diagram source field to fragments
-- For storing Mermaid/diagram code separately from content
-- InfoSec: No security impact - new optional column

ALTER TABLE fragments ADD COLUMN diagram_source TEXT;
ALTER TABLE fragments ADD COLUMN diagram_format TEXT DEFAULT 'mermaid';

-- Migration: Block Editor Support
-- Adds columns for storing block-based content (JSON format)

-- Add block content columns to fragments table
ALTER TABLE fragments ADD COLUMN block_content TEXT;
ALTER TABLE fragments ADD COLUMN content_format TEXT DEFAULT 'html';

-- Add block content columns to content table
ALTER TABLE content ADD COLUMN block_content TEXT;
ALTER TABLE content ADD COLUMN content_format TEXT DEFAULT 'html';

-- Create index for content_format to optimize queries
CREATE INDEX IF NOT EXISTS idx_fragments_content_format ON fragments(content_format);
CREATE INDEX IF NOT EXISTS idx_content_content_format ON content(content_format);

-- Migration comments:
-- block_content: JSON storing BlockDocument with typed blocks (paragraph, heading, mermaid, etc.)
-- content_format: 'html' for legacy content, 'blocks' for new block-based content
-- This allows gradual migration - existing content continues to work while new content uses blocks

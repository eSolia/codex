-- Composite index on fragments(category, name) to eliminate temp B-tree
-- when listing fragments with ORDER BY category, name
CREATE INDEX IF NOT EXISTS idx_fragments_category_name ON fragments(category, name);

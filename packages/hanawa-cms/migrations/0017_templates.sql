-- Document Templates
-- Templates define default fragment selections for different document types
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS templates (
    id TEXT PRIMARY KEY,

    -- Basic info
    name TEXT NOT NULL,
    name_ja TEXT,
    description TEXT,
    description_ja TEXT,

    -- Classification
    document_type TEXT NOT NULL DEFAULT 'proposal'
        CHECK(document_type IN ('proposal', 'report', 'quote', 'sow', 'assessment')),

    -- Fragment configuration (JSON array)
    -- Format: [{ "id": "fragment-id", "order": 1, "enabled": true, "required": false }]
    default_fragments TEXT NOT NULL DEFAULT '[]',

    -- Settings
    is_default BOOLEAN DEFAULT FALSE,  -- Show as first option for this type
    is_active BOOLEAN DEFAULT TRUE,    -- Available for selection

    -- Audit
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Index for lookups
CREATE INDEX IF NOT EXISTS idx_templates_type ON templates(document_type);
CREATE INDEX IF NOT EXISTS idx_templates_active ON templates(is_active);

-- Seed default templates
INSERT INTO templates (id, name, name_ja, description, description_ja, document_type, default_fragments, is_default) VALUES
(
    'tpl_comprehensive',
    'Comprehensive Proposal',
    '包括的提案書',
    'Full eSolia capabilities - support, development, and tools',
    'eSOLIAの全機能 - サポート、開発、ツール',
    'proposal',
    '[
        {"id": "esolia-introduction", "order": 1, "enabled": true, "required": true},
        {"id": "esolia-background", "order": 2, "enabled": true, "required": false},
        {"id": "secure-hosting", "order": 3, "enabled": true, "required": false},
        {"id": "modern-web-development", "order": 4, "enabled": true, "required": false},
        {"id": "ongoing-support", "order": 5, "enabled": true, "required": false},
        {"id": "website-development", "order": 6, "enabled": true, "required": false},
        {"id": "continuous-monitoring", "order": 7, "enabled": true, "required": false},
        {"id": "dns-email-reliability", "order": 8, "enabled": true, "required": false},
        {"id": "esolia-service-mechanics", "order": 9, "enabled": true, "required": false},
        {"id": "esolia-agreement-characteristics", "order": 10, "enabled": true, "required": false},
        {"id": "esolia-closing", "order": 11, "enabled": true, "required": true}
    ]',
    TRUE
),
(
    'tpl_support_focused',
    'Support-Focused Proposal',
    'サポート重視提案書',
    'Ongoing IT support services emphasis',
    '継続的ITサポートサービスに重点',
    'proposal',
    '[
        {"id": "esolia-introduction", "order": 1, "enabled": true, "required": true},
        {"id": "esolia-background", "order": 2, "enabled": true, "required": false},
        {"id": "ongoing-support", "order": 3, "enabled": true, "required": false},
        {"id": "infrastructure-management", "order": 4, "enabled": true, "required": false},
        {"id": "esolia-service-mechanics", "order": 5, "enabled": true, "required": false},
        {"id": "esolia-agreement-characteristics", "order": 6, "enabled": true, "required": false},
        {"id": "esolia-closing", "order": 7, "enabled": true, "required": true}
    ]',
    FALSE
),
(
    'tpl_website_project',
    'Website Project',
    'ウェブサイトプロジェクト',
    'Website development with optional monitoring',
    'ウェブサイト開発とオプション監視',
    'proposal',
    '[
        {"id": "esolia-introduction", "order": 1, "enabled": true, "required": true},
        {"id": "secure-hosting", "order": 2, "enabled": true, "required": false},
        {"id": "modern-web-development", "order": 3, "enabled": true, "required": false},
        {"id": "website-development", "order": 4, "enabled": true, "required": false},
        {"id": "dns-email-reliability", "order": 5, "enabled": true, "required": false},
        {"id": "esolia-agreement-characteristics", "order": 6, "enabled": true, "required": false},
        {"id": "esolia-closing", "order": 7, "enabled": true, "required": true}
    ]',
    FALSE
),
(
    'tpl_tools_only',
    'Monitoring Tools Only',
    '監視ツールのみ',
    'Periodic and Pulse monitoring services',
    'PeriodicとPulse監視サービス',
    'proposal',
    '[
        {"id": "esolia-introduction", "order": 1, "enabled": true, "required": true},
        {"id": "continuous-monitoring", "order": 2, "enabled": true, "required": false},
        {"id": "dns-email-reliability", "order": 3, "enabled": true, "required": false},
        {"id": "esolia-service-mechanics", "order": 4, "enabled": true, "required": false},
        {"id": "esolia-closing", "order": 5, "enabled": true, "required": true}
    ]',
    FALSE
),
(
    'tpl_blank',
    'Blank Template',
    '空白テンプレート',
    'Start from scratch - select your own fragments',
    'ゼロから開始 - フラグメントを自由に選択',
    'proposal',
    '[
        {"id": "esolia-introduction", "order": 1, "enabled": true, "required": true},
        {"id": "esolia-closing", "order": 2, "enabled": true, "required": true}
    ]',
    FALSE
);

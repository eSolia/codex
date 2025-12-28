# Hanawa Feature Specs: Analysis & Implementation Status

**Reviewed:** 2025-12-28
**Reviewer:** Claude Code

This document analyzes the 9 feature specification documents in `hanawa-features/`, comparing them against the current implementation and flagging gaps, inconsistencies, and items needing attention.

---

## Executive Summary

The feature specifications are **well-designed and comprehensive**, following industry best practices (SOC 2, ISO 27001). However, **most features are NOT yet implemented** in the current codebase. The current implementation is a basic CMS skeleton with:
- Core tables (sites, content, fragments, assets, users)
- Basic CRUD operations
- Security columns added (sensitivity, embargo, preview tokens)
- Simple audit_log table (but not the full audit service)

### Implementation Status Matrix

| Feature | Spec Status | Implementation | Priority |
|---------|-------------|----------------|----------|
| 01 Audit System | Complete | **Partial** (table exists, service not implemented) | P1 |
| 02 Version Control | Complete | **Not implemented** | P1 |
| 03 Real-time Collaboration | Complete | **Not implemented** (future phase) | P3 |
| 04 Comments System | Complete | **Not implemented** | P2 |
| 05 Workflow Engine | Complete | **Not implemented** | P1 |
| 06 Scheduled Publishing | Complete | **Not implemented** | P2 |
| 07 Localization | Complete | **Partial** (basic bilingual columns exist) | P2 |
| 08 AI Assistant | Complete | **Not implemented** | P3 |
| 09 Codex Integration | Complete | **Not implemented** | P2 |

---

## Detailed Analysis by Feature

### 01. Audit System (`01-audit-system.md`)

**Spec Quality:** Excellent. Comprehensive with checksum-based tamper detection, proper indexes, middleware integration, and UI components.

**Current State:**
- Table `audit_log` exists but with different schema:
  - Spec: 20+ columns including checksum, action_category, value_before/after
  - Current: 10 columns (basic: id, user_id, action, entity_type, entity_id, details, created_at, plus recent additions: timestamp, actor, ip_address, user_agent, resource_type, resource_id)

**Gaps to Address:**
1. [ ] Missing `action_category` column for categorizing actions
2. [ ] Missing `value_before`, `value_after` for tracking changes
3. [ ] Missing `change_summary` for human-readable descriptions
4. [ ] Missing `checksum` for tamper detection
5. [ ] Missing `AuditService` in `src/lib/server/audit.ts`
6. [ ] Missing audit middleware in `hooks.server.ts`
7. [ ] Missing `AuditTimeline.svelte` and `DiffViewer.svelte` components

**Schema Alignment Needed:**
```sql
-- Current audit_log is incomplete. Migration needed to add:
ALTER TABLE audit_log ADD COLUMN action_category TEXT;
ALTER TABLE audit_log ADD COLUMN value_before TEXT;
ALTER TABLE audit_log ADD COLUMN value_after TEXT;
ALTER TABLE audit_log ADD COLUMN change_summary TEXT;
ALTER TABLE audit_log ADD COLUMN checksum TEXT;
ALTER TABLE audit_log ADD COLUMN session_id TEXT;
ALTER TABLE audit_log ADD COLUMN request_id TEXT;
ALTER TABLE audit_log ADD COLUMN metadata TEXT;
```

---

### 02. Version Control (`02-version-control.md`)

**Spec Quality:** Excellent. Well-designed with content deduplication via SHA-256, version types, labeled snapshots.

**Current State:**
- **Not implemented** - no `document_versions` table exists

**Required Additions:**
1. [ ] Create `document_versions` table with full snapshot storage
2. [ ] Create `VersionService` in `src/lib/server/versions.ts`
3. [ ] Create `VersionPanel.svelte`, `VersionDiff.svelte`, `SaveVersionDialog.svelte`
4. [ ] Implement auto-save with debouncing
5. [ ] Add restore functionality

**Migration Required:**
```sql
CREATE TABLE document_versions (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  created_by_id TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT,
  content TEXT NOT NULL,
  content_format TEXT DEFAULT 'html',
  content_hash TEXT NOT NULL,
  title TEXT,
  metadata TEXT,
  version_type TEXT DEFAULT 'auto',
  version_label TEXT,
  version_notes TEXT,
  content_size INTEGER,
  previous_version_id TEXT,
  FOREIGN KEY (document_id) REFERENCES content(id) ON DELETE CASCADE
);
```

---

### 03. Real-time Collaboration (`03-realtime-collaboration.md`)

**Spec Quality:** Good. Uses Durable Objects for presence, Tiptap collaboration extension.

**Current State:**
- **Not implemented** - correctly deferred to Phase 5+

**Notes:**
- Spec correctly identifies this as future phase
- Requires Cloudflare Durable Objects setup
- Low priority until multi-user editing is validated as necessary

---

### 04. Comments System (`04-comments-system.md`)

**Spec Quality:** Good. Inline and document-level comments with threading.

**Current State:**
- **Not implemented** - no comments table

**Required Additions:**
1. [ ] Create `comments` table
2. [ ] Create `CommentsService`
3. [ ] Create Tiptap extension for inline comments
4. [ ] Create UI components for comment threads

---

### 05. Workflow Engine (`05-workflow-engine.md`)

**Spec Quality:** Excellent. Comprehensive multi-stage approval system with configurable stages, parallel/sequential approvals.

**Current State:**
- **Not implemented** - no workflow tables
- `content.status` column exists (draft, review, published, archived) but no workflow logic

**Required Additions:**
1. [ ] Create `workflow_definitions`, `workflow_stages`, `workflow_transitions` tables
2. [ ] Create `document_workflow_state`, `workflow_history` tables
3. [ ] Create `WorkflowService`
4. [ ] Create `WorkflowStatusBar.svelte`, `WorkflowStages.svelte`
5. [ ] Default workflow templates (Simple Review, Compliance Review)

**Critical for Compliance:** This is essential for SOC 2/ISO 27001 compliance documentation workflows.

---

### 06. Scheduled Publishing (`06-scheduled-publishing.md`)

**Spec Quality:** Good. Includes embargo support, timezone handling.

**Current State:**
- **Partially exists**: `content.embargo_until` column added in migration 0002
- **Not implemented**: No `scheduled_jobs` table or scheduling service

**Required Additions:**
1. [ ] Create `scheduled_jobs` table
2. [ ] Create `SchedulingService`
3. [ ] Create Cloudflare Cron trigger for job processing
4. [ ] Create `ScheduleDialog.svelte`, `PublicationCalendar.svelte`

**Note:** `embargo_until` column already exists - good foundation.

---

### 07. Localization (`07-localization.md`)

**Spec Quality:** Good but lightweight. Field-level i18n approach.

**Current State:**
- **Partially implemented**:
  - `content.title_translations`, `content.body_translations` (JSON columns)
  - `fragments.content_en`, `fragments.content_ja`
  - Sites have `languages` array

**Gaps:**
1. [ ] Missing `translation_status` table for tracking translation progress
2. [ ] Missing side-by-side translation editor
3. [ ] Missing locale switcher component
4. [ ] Missing translation queue dashboard

**Note:** The spec is relatively lightweight. Consider expanding with more robust translation workflow tracking.

---

### 08. AI Assistant (`08-ai-assistant.md`)

**Spec Quality:** Good. Claude integration for writing assistance.

**Current State:**
- **Not implemented**

**Required Additions:**
1. [ ] Create `AIService` with Claude API integration
2. [ ] Create `ai_usage` table for tracking
3. [ ] Create `AICommandMenu.svelte`, `AIResponsePanel.svelte`
4. [ ] Add keyboard shortcut (Cmd+J) in Tiptap
5. [ ] Implement streaming responses

**Note:** Should use Claude API sparingly (per Codex CLAUDE.md cost guidelines). Heavy lifting done in Claude Desktop, light touches via API.

---

### 09. Codex Integration (`09-codex-integration.md`)

**Spec Quality:** Excellent. Full RAG pipeline with Vectorize.

**Current State:**
- **Not implemented**

**Required Additions:**
1. [ ] Create `document_chunks` table
2. [ ] Create `search_index_status` table
3. [ ] Create `CodexService` with chunking, embedding, search
4. [ ] Setup Cloudflare Vectorize index
5. [ ] Create `RelatedDocuments.svelte`, `SemanticSearch.svelte`
6. [ ] Auto-index on publish hook

**Wrangler Config Needed:**
```toml
[[vectorize]]
binding = "VECTORIZE"
index_name = "codex-index"

[ai]
binding = "AI"
```

---

## Cross-Cutting Issues

### 1. Naming Inconsistency: `content` vs `documents`

**Issue:** Specs refer to `documents` table, but current schema uses `content` table.

**Recommendation:** Either:
- Option A: Rename `content` to `documents` (breaking change)
- Option B: Update specs to use `content` consistently
- Option C: Keep both (content for CMS items, documents for workflow-managed)

**Preferred:** Option B - update specs to match existing `content` table naming.

### 2. ID Generation

**Current:** `generateId()` uses timestamp+random
**Specs:** Use `crypto.randomUUID()`

**Recommendation:** Standardize on `crypto.randomUUID()` for all new code.

### 3. Timestamp Format

**Current:** SQLite `datetime('now')` strings
**Specs:** Unix epoch milliseconds (INTEGER)

**Recommendation:** Migrate to INTEGER timestamps for consistency and performance. Add migration to convert existing datetime strings.

### 4. Foreign Key Naming

**Specs use:** `document_id`
**Current uses:** Various (site_id, content_type_id, etc.)

**Recommendation:** Follow existing naming patterns, update specs where needed.

---

## Security Considerations

### Already Implemented (Good)
- [x] Sensitivity levels (normal, confidential, embargoed)
- [x] Embargo dates
- [x] Preview token with expiry, max views, IP allowlist
- [x] Preview approval workflow
- [x] Encryption support (encrypted_body, encryption_iv, is_encrypted)

### Needs Implementation
- [ ] Checksum-based tamper detection for audit logs
- [ ] Full audit middleware capturing all context
- [ ] Rate limiting on AI endpoints
- [ ] Input validation with Zod schemas

---

## Recommended Implementation Order

### Phase 1: Foundation (Estimated: 1-2 weeks)
1. **Audit System** - Create full `AuditService`, align schema
2. **Version Control** - Create `VersionService`, `document_versions` table

### Phase 2: Workflow (Estimated: 1-2 weeks)
3. **Workflow Engine** - Essential for compliance
4. **Comments System** - Supports review workflow

### Phase 3: Publishing (Estimated: 1 week)
5. **Scheduled Publishing** - Build on existing embargo support
6. **Localization Enhancement** - Translation tracking

### Phase 4: Intelligence (Estimated: 1-2 weeks)
7. **Codex Integration** - RAG search
8. **AI Assistant** - Writing assistance

### Phase 5: Collaboration (Future)
9. **Real-time Collaboration** - When validated as needed

---

## Immediate Bug: Fragment 404 - FIXED

**Reported Issue:** Clicking fragments gives 404

**Root Cause:** Missing route `/fragments/[id]` and `/fragments/new`

**Resolution (2025-12-28):**
- Created `/src/routes/fragments/[id]/+page.server.ts` - loads fragment, handles update/delete
- Created `/src/routes/fragments/[id]/+page.svelte` - view/edit UI with bilingual tabs
- Created `/src/routes/fragments/new/+page.server.ts` - creates new fragments
- Created `/src/routes/fragments/new/+page.svelte` - create form with bilingual tabs

The fragment detail page now includes:
- Breadcrumb navigation
- Edit mode toggle with inline editing
- Delete confirmation modal
- Bilingual content tabs (EN/JA)
- Metadata display (version, status, tags, category)
- Form actions using SvelteKit form enhancement

---

## Spec Document Improvements Suggested

1. **All specs:** Add explicit migration file numbers (e.g., `0003_audit_system.sql`)
2. **All specs:** Align table names (`content` not `documents`)
3. **All specs:** Add Svelte 5 runes syntax (some use older `let { props }`)
4. **07-localization:** Expand translation workflow section
5. **00-roadmap:** Remove time estimates per project guidelines

---

## Files to Create (Prioritized)

```
src/lib/server/audit.ts          # AuditService
src/lib/server/versions.ts       # VersionService
src/lib/server/workflow.ts       # WorkflowService
src/lib/server/scheduling.ts     # SchedulingService
src/lib/server/codex.ts          # CodexService
src/lib/server/ai.ts             # AIService
src/lib/server/comments.ts       # CommentsService

migrations/0003_audit_enhancements.sql
migrations/0004_version_control.sql
migrations/0005_workflow_engine.sql
migrations/0006_comments.sql
migrations/0007_scheduled_publishing.sql
migrations/0008_codex_integration.sql
migrations/0009_ai_usage.sql

src/lib/components/audit/AuditTimeline.svelte
src/lib/components/audit/DiffViewer.svelte
src/lib/components/versions/VersionPanel.svelte
src/lib/components/versions/VersionDiff.svelte
src/lib/components/workflow/WorkflowStatusBar.svelte
src/lib/components/workflow/WorkflowStages.svelte
# ... etc
```

---

*This analysis will be updated as implementation progresses.*

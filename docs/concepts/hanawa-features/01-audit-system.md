# Hanawa: Audit System Specification

Comprehensive audit logging for compliance-grade content management.

## Overview

Every action in Hanawa—edits, views, status changes, exports—must be logged with full context. This isn't just for debugging; it's a compliance requirement. Auditors need to answer: "Who changed what, when, and why?"

Think of the audit system as a flight recorder. Like an aircraft's black box that captures every input and system state, Hanawa's audit log preserves a complete, tamper-evident history of all content operations.

```
┌─────────────────────────────────────────────────────────────────┐
│  AUDIT SYSTEM ARCHITECTURE                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  User Action                                                    │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │   Route     │───▶│   Audit     │───▶│   D1        │         │
│  │   Handler   │    │   Service   │    │   audit_log │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│                           │                                     │
│                           ▼                                     │
│                    ┌─────────────┐                             │
│                    │  Webhooks   │  (optional: SIEM, Slack)    │
│                    └─────────────┘                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Primary Table

```sql
CREATE TABLE audit_log (
  -- Identity
  id TEXT PRIMARY KEY,
  
  -- Timing
  timestamp INTEGER NOT NULL,          -- Unix epoch milliseconds
  
  -- Actor
  actor_id TEXT NOT NULL,              -- User ID from Cloudflare Access
  actor_email TEXT NOT NULL,           -- Email for display
  actor_name TEXT,                     -- Display name if available
  
  -- Action
  action TEXT NOT NULL,                -- Verb: 'create', 'update', 'delete', etc.
  action_category TEXT NOT NULL,       -- 'content', 'workflow', 'access', 'system'
  
  -- Target
  resource_type TEXT NOT NULL,         -- 'document', 'collection', 'media', etc.
  resource_id TEXT NOT NULL,           -- ID of affected resource
  resource_title TEXT,                 -- Human-readable title at time of action
  
  -- Context
  collection TEXT,                     -- Collection name for documents
  field_path TEXT,                     -- Specific field if field-level edit
  
  -- Change Data
  value_before TEXT,                   -- JSON: previous value (null for create)
  value_after TEXT,                    -- JSON: new value (null for delete)
  change_summary TEXT,                 -- Human-readable: "Updated title from X to Y"
  
  -- Request Context
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  request_id TEXT,                     -- Correlation ID for tracing
  
  -- Metadata
  metadata TEXT,                       -- JSON: additional context
  
  -- Integrity
  checksum TEXT                        -- SHA-256 of row data for tamper detection
);

-- Query indexes
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_actor ON audit_log(actor_email);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_log(action);
CREATE INDEX idx_audit_category ON audit_log(action_category);

-- Composite for common queries
CREATE INDEX idx_audit_doc_timeline ON audit_log(resource_id, timestamp DESC);
```

### Action Categories

| Category | Actions | Description |
|----------|---------|-------------|
| `content` | create, update, delete, restore | Document CRUD operations |
| `workflow` | submit, approve, reject, publish, unpublish | Workflow state changes |
| `access` | view, download, export, share, preview_create | Read and distribution |
| `system` | login, logout, settings_change, permission_change | Administrative actions |
| `comment` | comment_add, comment_edit, comment_delete, comment_resolve | Discussion activity |

### Action Verb Reference

```typescript
type AuditAction =
  // Content
  | 'create'              // New document created
  | 'update'              // Document content changed
  | 'update_field'        // Specific field changed
  | 'delete'              // Document deleted (soft)
  | 'restore'             // Document restored from deletion
  | 'archive'             // Document archived
  
  // Workflow
  | 'submit_review'       // Submitted for review
  | 'approve'             // Approved at current stage
  | 'reject'              // Rejected, returned to author
  | 'request_changes'     // Changes requested, stays in stage
  | 'publish'             // Made live
  | 'unpublish'           // Removed from live
  | 'schedule'            // Scheduled for future publish
  | 'unschedule'          // Removed from schedule
  
  // Access
  | 'view'                // Document opened
  | 'download'            // File downloaded
  | 'export'              // Content exported (PDF, etc.)
  | 'share_preview'       // Shareable preview link created
  | 'preview_view'        // Shareable preview accessed
  
  // System
  | 'login'               // User logged in
  | 'logout'              // User logged out
  | 'permission_grant'    // Permission added
  | 'permission_revoke'   // Permission removed
  | 'settings_update'     // System settings changed
  
  // Comments
  | 'comment_create'      // Comment added
  | 'comment_update'      // Comment edited
  | 'comment_delete'      // Comment removed
  | 'comment_resolve'     // Thread marked resolved
```

---

## API Design

### Audit Service

```typescript
// lib/server/audit.ts

import type { D1Database } from '@cloudflare/workers-types';

export interface AuditEntry {
  action: AuditAction;
  actionCategory: 'content' | 'workflow' | 'access' | 'system' | 'comment';
  resourceType: string;
  resourceId: string;
  resourceTitle?: string;
  collection?: string;
  fieldPath?: string;
  valueBefore?: unknown;
  valueAfter?: unknown;
  changeSummary?: string;
  metadata?: Record<string, unknown>;
}

export interface AuditContext {
  actorId: string;
  actorEmail: string;
  actorName?: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  requestId?: string;
}

export function createAuditService(db: D1Database) {
  return {
    /**
     * Log an audit entry
     */
    async log(entry: AuditEntry, context: AuditContext): Promise<string> {
      const id = crypto.randomUUID();
      const timestamp = Date.now();
      
      // Build the row data for checksum
      const rowData = {
        id,
        timestamp,
        ...context,
        ...entry,
      };
      
      // Compute integrity checksum
      const checksum = await computeChecksum(rowData);
      
      await db.prepare(`
        INSERT INTO audit_log (
          id, timestamp,
          actor_id, actor_email, actor_name,
          action, action_category,
          resource_type, resource_id, resource_title,
          collection, field_path,
          value_before, value_after, change_summary,
          ip_address, user_agent, session_id, request_id,
          metadata, checksum
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, timestamp,
        context.actorId, context.actorEmail, context.actorName || null,
        entry.action, entry.actionCategory,
        entry.resourceType, entry.resourceId, entry.resourceTitle || null,
        entry.collection || null, entry.fieldPath || null,
        entry.valueBefore ? JSON.stringify(entry.valueBefore) : null,
        entry.valueAfter ? JSON.stringify(entry.valueAfter) : null,
        entry.changeSummary || null,
        context.ipAddress || null, context.userAgent || null,
        context.sessionId || null, context.requestId || null,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
        checksum
      ).run();
      
      return id;
    },
    
    /**
     * Get audit history for a specific resource
     */
    async getResourceHistory(
      resourceType: string,
      resourceId: string,
      options: { limit?: number; offset?: number; actions?: AuditAction[] } = {}
    ): Promise<AuditLogRow[]> {
      const { limit = 50, offset = 0, actions } = options;
      
      let query = `
        SELECT * FROM audit_log
        WHERE resource_type = ? AND resource_id = ?
      `;
      const params: unknown[] = [resourceType, resourceId];
      
      if (actions?.length) {
        query += ` AND action IN (${actions.map(() => '?').join(', ')})`;
        params.push(...actions);
      }
      
      query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      const { results } = await db.prepare(query).bind(...params).all();
      return results as AuditLogRow[];
    },
    
    /**
     * Get audit history for an actor
     */
    async getActorHistory(
      actorEmail: string,
      options: { limit?: number; since?: number; until?: number } = {}
    ): Promise<AuditLogRow[]> {
      const { limit = 100, since, until } = options;
      
      let query = `SELECT * FROM audit_log WHERE actor_email = ?`;
      const params: unknown[] = [actorEmail];
      
      if (since) {
        query += ` AND timestamp >= ?`;
        params.push(since);
      }
      if (until) {
        query += ` AND timestamp <= ?`;
        params.push(until);
      }
      
      query += ` ORDER BY timestamp DESC LIMIT ?`;
      params.push(limit);
      
      const { results } = await db.prepare(query).bind(...params).all();
      return results as AuditLogRow[];
    },
    
    /**
     * Search audit log
     */
    async search(
      filters: {
        actions?: AuditAction[];
        categories?: string[];
        actors?: string[];
        resources?: string[];
        since?: number;
        until?: number;
        query?: string;
      },
      options: { limit?: number; offset?: number } = {}
    ): Promise<{ entries: AuditLogRow[]; total: number }> {
      const { limit = 50, offset = 0 } = options;
      const conditions: string[] = [];
      const params: unknown[] = [];
      
      if (filters.actions?.length) {
        conditions.push(`action IN (${filters.actions.map(() => '?').join(', ')})`);
        params.push(...filters.actions);
      }
      
      if (filters.categories?.length) {
        conditions.push(`action_category IN (${filters.categories.map(() => '?').join(', ')})`);
        params.push(...filters.categories);
      }
      
      if (filters.actors?.length) {
        conditions.push(`actor_email IN (${filters.actors.map(() => '?').join(', ')})`);
        params.push(...filters.actors);
      }
      
      if (filters.since) {
        conditions.push(`timestamp >= ?`);
        params.push(filters.since);
      }
      
      if (filters.until) {
        conditions.push(`timestamp <= ?`);
        params.push(filters.until);
      }
      
      if (filters.query) {
        conditions.push(`(
          resource_title LIKE ? OR 
          change_summary LIKE ? OR 
          actor_email LIKE ?
        )`);
        const pattern = `%${filters.query}%`;
        params.push(pattern, pattern, pattern);
      }
      
      const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      
      // Get total count
      const countResult = await db.prepare(
        `SELECT COUNT(*) as count FROM audit_log ${whereClause}`
      ).bind(...params).first<{ count: number }>();
      
      // Get results
      const { results } = await db.prepare(`
        SELECT * FROM audit_log
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `).bind(...params, limit, offset).all();
      
      return {
        entries: results as AuditLogRow[],
        total: countResult?.count || 0,
      };
    },
    
    /**
     * Verify audit log integrity
     */
    async verifyIntegrity(
      since?: number,
      until?: number
    ): Promise<{ valid: number; invalid: number; entries: string[] }> {
      let query = `SELECT * FROM audit_log`;
      const params: unknown[] = [];
      
      if (since || until) {
        const conditions: string[] = [];
        if (since) {
          conditions.push(`timestamp >= ?`);
          params.push(since);
        }
        if (until) {
          conditions.push(`timestamp <= ?`);
          params.push(until);
        }
        query += ` WHERE ${conditions.join(' AND ')}`;
      }
      
      const { results } = await db.prepare(query).bind(...params).all();
      
      let valid = 0;
      let invalid = 0;
      const invalidEntries: string[] = [];
      
      for (const row of results as AuditLogRow[]) {
        const expected = await computeChecksum(row);
        if (expected === row.checksum) {
          valid++;
        } else {
          invalid++;
          invalidEntries.push(row.id);
        }
      }
      
      return { valid, invalid, entries: invalidEntries };
    },
  };
}

/**
 * Compute SHA-256 checksum for tamper detection
 */
async function computeChecksum(data: Record<string, unknown>): Promise<string> {
  // Exclude checksum field from calculation
  const { checksum, ...rest } = data;
  const json = JSON.stringify(rest, Object.keys(rest).sort());
  const buffer = new TextEncoder().encode(json);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

### Audit Middleware

Hook into all routes to capture context automatically:

```typescript
// hooks.server.ts

import { createAuditService } from '$lib/server/audit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Generate request ID for correlation
  const requestId = crypto.randomUUID();
  event.locals.requestId = requestId;
  
  // Extract actor from Cloudflare Access headers
  const cfAccessEmail = event.request.headers.get('cf-access-authenticated-user-email');
  const cfAccessId = event.request.headers.get('cf-access-jwt-assertion');
  
  if (cfAccessEmail && event.platform?.env?.DB) {
    event.locals.auditContext = {
      actorId: cfAccessId || cfAccessEmail,
      actorEmail: cfAccessEmail,
      actorName: cfAccessEmail.split('@')[0], // Derive from email
      ipAddress: event.request.headers.get('cf-connecting-ip') || undefined,
      userAgent: event.request.headers.get('user-agent') || undefined,
      sessionId: event.cookies.get('session_id') || undefined,
      requestId,
    };
    
    event.locals.audit = createAuditService(event.platform.env.DB);
  }
  
  return resolve(event);
};
```

### API Endpoints

```typescript
// routes/api/audit/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, url }) => {
  const { audit, auditContext } = locals;
  if (!audit || !auditContext) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Parse query parameters
  const actions = url.searchParams.getAll('action') as AuditAction[];
  const categories = url.searchParams.getAll('category');
  const since = url.searchParams.get('since');
  const until = url.searchParams.get('until');
  const query = url.searchParams.get('q');
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');
  
  const result = await audit.search(
    {
      actions: actions.length ? actions : undefined,
      categories: categories.length ? categories : undefined,
      since: since ? parseInt(since) : undefined,
      until: until ? parseInt(until) : undefined,
      query: query || undefined,
    },
    { limit, offset }
  );
  
  // Log this audit search (meta-audit!)
  await audit.log({
    action: 'view',
    actionCategory: 'system',
    resourceType: 'audit_log',
    resourceId: 'search',
    metadata: { filters: { actions, categories, since, until, query } },
  }, auditContext);
  
  return json(result);
};
```

---

## UI Components

### Audit Timeline

```svelte
<!-- lib/components/audit/AuditTimeline.svelte -->
<script lang="ts">
  import { formatDistanceToNow } from 'date-fns';
  import { 
    FileEdit, Eye, Check, X, Send, Calendar, 
    MessageSquare, Download, Share2, UserPlus, Settings 
  } from 'lucide-svelte';
  
  interface Props {
    entries: AuditLogRow[];
    loading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
  }
  
  let { entries, loading = false, hasMore = false, onLoadMore }: Props = $props();
  
  const actionIcons: Record<string, typeof FileEdit> = {
    create: FileEdit,
    update: FileEdit,
    update_field: FileEdit,
    view: Eye,
    approve: Check,
    reject: X,
    submit_review: Send,
    publish: Check,
    schedule: Calendar,
    comment_create: MessageSquare,
    download: Download,
    share_preview: Share2,
    permission_grant: UserPlus,
    settings_update: Settings,
  };
  
  const actionColors: Record<string, string> = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    approve: 'bg-green-100 text-green-700',
    reject: 'bg-red-100 text-red-700',
    publish: 'bg-purple-100 text-purple-700',
    delete: 'bg-red-100 text-red-700',
    view: 'bg-gray-100 text-gray-700',
  };
  
  function getActionDisplay(action: string): string {
    const displays: Record<string, string> = {
      create: 'created',
      update: 'updated',
      update_field: 'changed',
      delete: 'deleted',
      restore: 'restored',
      view: 'viewed',
      approve: 'approved',
      reject: 'rejected',
      publish: 'published',
      unpublish: 'unpublished',
      submit_review: 'submitted for review',
      schedule: 'scheduled',
      comment_create: 'commented on',
      download: 'downloaded',
      export: 'exported',
      share_preview: 'shared preview of',
    };
    return displays[action] || action;
  }
</script>

<div class="audit-timeline">
  {#each entries as entry (entry.id)}
    {@const Icon = actionIcons[entry.action] || FileEdit}
    {@const colorClass = actionColors[entry.action] || 'bg-gray-100 text-gray-700'}
    
    <div class="timeline-entry">
      <div class="timeline-icon {colorClass}">
        <Icon class="w-4 h-4" />
      </div>
      
      <div class="timeline-content">
        <div class="timeline-header">
          <span class="actor">{entry.actor_name || entry.actor_email}</span>
          <span class="action">{getActionDisplay(entry.action)}</span>
          {#if entry.resource_title}
            <span class="resource">"{entry.resource_title}"</span>
          {/if}
        </div>
        
        {#if entry.change_summary}
          <p class="change-summary">{entry.change_summary}</p>
        {/if}
        
        {#if entry.field_path}
          <p class="field-path">Field: <code>{entry.field_path}</code></p>
        {/if}
        
        <time class="timestamp" datetime={new Date(entry.timestamp).toISOString()}>
          {formatDistanceToNow(entry.timestamp, { addSuffix: true })}
        </time>
      </div>
    </div>
  {/each}
  
  {#if loading}
    <div class="loading-indicator">Loading...</div>
  {:else if hasMore && onLoadMore}
    <button class="load-more" onclick={onLoadMore}>
      Load more
    </button>
  {/if}
</div>

<style>
  .audit-timeline {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }
  
  .timeline-entry {
    display: flex;
    gap: 0.75rem;
  }
  
  .timeline-icon {
    flex-shrink: 0;
    width: 2rem;
    height: 2rem;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .timeline-content {
    flex: 1;
    min-width: 0;
  }
  
  .timeline-header {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    font-size: 0.875rem;
  }
  
  .actor {
    font-weight: 600;
  }
  
  .resource {
    color: var(--color-primary);
  }
  
  .change-summary {
    margin-top: 0.25rem;
    font-size: 0.875rem;
    color: var(--color-text-muted);
  }
  
  .field-path {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  
  .field-path code {
    background: var(--color-bg-muted);
    padding: 0.125rem 0.25rem;
    border-radius: 0.25rem;
  }
  
  .timestamp {
    display: block;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  
  .load-more {
    padding: 0.5rem 1rem;
    font-size: 0.875rem;
    color: var(--color-primary);
    background: none;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    cursor: pointer;
  }
  
  .load-more:hover {
    background: var(--color-bg-muted);
  }
</style>
```

### Diff Viewer

For showing before/after values:

```svelte
<!-- lib/components/audit/DiffViewer.svelte -->
<script lang="ts">
  import { diffWords, diffLines } from 'diff';
  
  interface Props {
    before: string;
    after: string;
    type?: 'words' | 'lines';
  }
  
  let { before, after, type = 'words' }: Props = $props();
  
  let diff = $derived(() => {
    if (type === 'lines') {
      return diffLines(before || '', after || '');
    }
    return diffWords(before || '', after || '');
  });
</script>

<div class="diff-viewer">
  {#each diff as part}
    <span 
      class:added={part.added} 
      class:removed={part.removed}
    >
      {part.value}
    </span>
  {/each}
</div>

<style>
  .diff-viewer {
    font-family: monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    white-space: pre-wrap;
    padding: 1rem;
    background: var(--color-bg-muted);
    border-radius: 0.5rem;
  }
  
  .added {
    background-color: #dcfce7;
    color: #166534;
  }
  
  .removed {
    background-color: #fee2e2;
    color: #991b1b;
    text-decoration: line-through;
  }
</style>
```

---

## Implementation Notes

### Performance Considerations

1. **Write performance**: Audit logging should never block the main operation. Consider:
   - Fire-and-forget with `waitUntil()` in Workers
   - Batch writes for bulk operations
   - Async queue for non-critical audit entries

2. **Read performance**: Historical queries can be expensive:
   - Use indexes strategically (already defined above)
   - Implement pagination (never load unbounded results)
   - Consider archiving old entries to cold storage

3. **Storage growth**: Audit logs grow continuously:
   - Estimate ~1KB per entry
   - 10,000 actions/month = ~10MB/month
   - Plan for retention policy (e.g., 2 years in D1, then R2 archive)

### Cloudflare-Specific

```typescript
// Using waitUntil for non-blocking audit
export async function updateDocument(
  request: Request,
  env: Env,
  ctx: ExecutionContext
) {
  // Perform the update
  const result = await doUpdate(env);
  
  // Log asynchronously without blocking response
  ctx.waitUntil(
    env.audit.log({
      action: 'update',
      actionCategory: 'content',
      resourceType: 'document',
      resourceId: result.id,
      // ...
    }, context)
  );
  
  return new Response(JSON.stringify(result));
}
```

### Tamper Detection

The checksum field provides basic tamper detection. For stronger guarantees:

1. **Hash chaining**: Each entry includes hash of previous entry
2. **External witness**: Periodically hash batches and store in separate system
3. **Signed entries**: Use asymmetric crypto to sign each entry

For Hanawa's compliance needs, the checksum approach is likely sufficient. Add hash chaining if auditors require it.

---

## Testing Strategy

### Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest';
import { createAuditService } from './audit';

describe('AuditService', () => {
  it('logs entries with all required fields', async () => {
    const mockDb = createMockD1();
    const audit = createAuditService(mockDb);
    
    const id = await audit.log({
      action: 'create',
      actionCategory: 'content',
      resourceType: 'document',
      resourceId: 'doc_123',
    }, {
      actorId: 'user_456',
      actorEmail: 'rick@esolia.co.jp',
    });
    
    expect(id).toBeDefined();
    expect(mockDb.prepare).toHaveBeenCalled();
  });
  
  it('computes valid checksums', async () => {
    const mockDb = createMockD1();
    const audit = createAuditService(mockDb);
    
    await audit.log({ /* ... */ }, { /* ... */ });
    
    const integrity = await audit.verifyIntegrity();
    expect(integrity.invalid).toBe(0);
  });
  
  it('filters by action type', async () => {
    const mockDb = createMockD1WithData([
      { action: 'create', /* ... */ },
      { action: 'update', /* ... */ },
      { action: 'view', /* ... */ },
    ]);
    const audit = createAuditService(mockDb);
    
    const result = await audit.search({ actions: ['create', 'update'] });
    expect(result.entries).toHaveLength(2);
  });
});
```

### Integration Tests

```typescript
describe('Audit Integration', () => {
  it('logs document creation end-to-end', async () => {
    // Create document via API
    const response = await fetch('/api/documents', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test Doc', collection: 'posts' }),
    });
    const doc = await response.json();
    
    // Verify audit entry exists
    const auditResponse = await fetch(
      `/api/audit?resource=${doc.id}&action=create`
    );
    const { entries } = await auditResponse.json();
    
    expect(entries).toHaveLength(1);
    expect(entries[0].action).toBe('create');
    expect(entries[0].resource_id).toBe(doc.id);
  });
});
```

---

## Migration Path

### From No Audit Logging

1. **Deploy schema**: Run migration to create `audit_log` table
2. **Add middleware**: Deploy hooks.server.ts with audit context
3. **Instrument routes**: Add audit.log() calls to existing handlers
4. **Backfill history**: Optionally create synthetic entries for existing content

### Existing Content Backfill

```typescript
// scripts/backfill-audit.ts
async function backfillAudit(db: D1Database) {
  const audit = createAuditService(db);
  
  // Get all existing documents
  const { results: docs } = await db.prepare(
    `SELECT id, title, collection, created_at, updated_at FROM documents`
  ).all();
  
  for (const doc of docs) {
    // Create synthetic "create" entry
    await audit.log({
      action: 'create',
      actionCategory: 'content',
      resourceType: 'document',
      resourceId: doc.id,
      resourceTitle: doc.title,
      collection: doc.collection,
      changeSummary: '[Backfilled] Document existed before audit logging',
    }, {
      actorId: 'system',
      actorEmail: 'system@hanawa.internal',
      actorName: 'System Migration',
    });
  }
}
```

---

## Related Documents

- [02-version-control.md](./02-version-control.md) — Version history builds on audit data
- [05-workflow-engine.md](./05-workflow-engine.md) — Workflow transitions generate audit entries
- [cms-content-security.md](../cms-content-security.md) — Security context for audit design

---

*Document version: 1.0*

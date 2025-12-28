# Hanawa: Version Control Specification

Complete version history with visual diff comparison and one-click restore.

## Overview

Every save creates a version. Every version is restorable. Think of it like Git for content—but with a visual diff UI that non-technical users can understand.

```
┌─────────────────────────────────────────────────────────────────┐
│  VERSION CONTROL MENTAL MODEL                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Git (for developers)          Hanawa Versions (for everyone)  │
│  ────────────────────          ───────────────────────────────  │
│  Commit history                Version timeline                 │
│  git diff                      Visual side-by-side diff        │
│  git checkout <sha>            "Restore this version"          │
│  Branches                      Named snapshots                  │
│  Merge conflicts               N/A (single-user per edit)      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

The key insight: compliance auditors need to answer "what did this document say on March 15th?" That requires full snapshots, not just deltas.

## Data Model

### Primary Table

```sql
CREATE TABLE document_versions (
  -- Identity
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  version_number INTEGER NOT NULL,
  
  -- Timing
  created_at INTEGER NOT NULL,           -- Unix epoch milliseconds
  
  -- Actor
  created_by_id TEXT NOT NULL,
  created_by_email TEXT NOT NULL,
  created_by_name TEXT,
  
  -- Content (full snapshot)
  content TEXT NOT NULL,                 -- Full document content (HTML or JSON)
  content_format TEXT DEFAULT 'html',    -- 'html', 'json', 'markdown'
  content_hash TEXT NOT NULL,            -- SHA-256 for deduplication
  
  -- Metadata
  title TEXT,                            -- Document title at this version
  metadata TEXT,                         -- JSON: custom fields, locale, etc.
  
  -- Classification
  version_type TEXT DEFAULT 'auto',      -- 'auto', 'manual', 'publish', 'restore'
  version_label TEXT,                    -- Optional: "Q3 Audit Submission"
  version_notes TEXT,                    -- Optional: why this version was saved
  
  -- Size tracking
  content_size INTEGER,                  -- Bytes
  
  -- Navigation
  previous_version_id TEXT,              -- NULL for first version
  
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
  FOREIGN KEY (previous_version_id) REFERENCES document_versions(id)
);

-- Indexes
CREATE INDEX idx_versions_document ON document_versions(document_id, version_number DESC);
CREATE INDEX idx_versions_document_time ON document_versions(document_id, created_at DESC);
CREATE INDEX idx_versions_hash ON document_versions(content_hash);
CREATE UNIQUE INDEX idx_versions_unique ON document_versions(document_id, version_number);
```

### Version Types

| Type | When Created | Description |
|------|--------------|-------------|
| `auto` | Every save | Automatic version from editing |
| `manual` | User action | "Save as version" with label |
| `publish` | Publish action | Snapshot at time of publish |
| `restore` | Restore action | When rolling back to previous |

### Content Deduplication

Identical saves don't create new versions:

```typescript
// Before creating version
const hash = await computeHash(content);
const existing = await db.prepare(
  `SELECT id FROM document_versions 
   WHERE document_id = ? AND content_hash = ? 
   ORDER BY created_at DESC LIMIT 1`
).bind(documentId, hash).first();

if (existing) {
  // No change, skip version creation
  return existing.id;
}
```

---

## API Design

### Version Service

```typescript
// lib/server/versions.ts

import type { D1Database } from '@cloudflare/workers-types';
import type { AuditService, AuditContext } from './audit';

export interface VersionData {
  content: string;
  contentFormat: 'html' | 'json' | 'markdown';
  title?: string;
  metadata?: Record<string, unknown>;
  versionType?: 'auto' | 'manual' | 'publish' | 'restore';
  versionLabel?: string;
  versionNotes?: string;
}

export interface VersionListItem {
  id: string;
  versionNumber: number;
  createdAt: number;
  createdByEmail: string;
  createdByName: string | null;
  title: string | null;
  versionType: string;
  versionLabel: string | null;
  contentSize: number;
}

export interface VersionDiff {
  before: {
    versionId: string;
    versionNumber: number;
    content: string;
    title: string | null;
    createdAt: number;
  };
  after: {
    versionId: string;
    versionNumber: number;
    content: string;
    title: string | null;
    createdAt: number;
  };
  changes: {
    type: 'title' | 'content' | 'metadata';
    field?: string;
    before: string;
    after: string;
  }[];
}

export function createVersionService(db: D1Database, audit?: AuditService) {
  return {
    /**
     * Create a new version
     * Returns null if content unchanged
     */
    async create(
      documentId: string,
      data: VersionData,
      context: AuditContext
    ): Promise<string | null> {
      // Compute content hash for deduplication
      const contentHash = await computeHash(data.content);
      
      // Check for duplicate content
      const lastVersion = await db.prepare(
        `SELECT id, content_hash, version_number 
         FROM document_versions 
         WHERE document_id = ? 
         ORDER BY version_number DESC 
         LIMIT 1`
      ).bind(documentId).first<{ id: string; content_hash: string; version_number: number }>();
      
      if (lastVersion?.content_hash === contentHash && data.versionType === 'auto') {
        // No change, skip version creation for auto-saves
        return null;
      }
      
      const versionNumber = (lastVersion?.version_number || 0) + 1;
      const id = crypto.randomUUID();
      const now = Date.now();
      
      await db.prepare(`
        INSERT INTO document_versions (
          id, document_id, version_number, created_at,
          created_by_id, created_by_email, created_by_name,
          content, content_format, content_hash,
          title, metadata,
          version_type, version_label, version_notes,
          content_size, previous_version_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, documentId, versionNumber, now,
        context.actorId, context.actorEmail, context.actorName || null,
        data.content, data.contentFormat, contentHash,
        data.title || null, data.metadata ? JSON.stringify(data.metadata) : null,
        data.versionType || 'auto', data.versionLabel || null, data.versionNotes || null,
        new TextEncoder().encode(data.content).length, lastVersion?.id || null
      ).run();
      
      // Audit log
      if (audit) {
        await audit.log({
          action: data.versionType === 'manual' ? 'create' : 'update',
          actionCategory: 'content',
          resourceType: 'document_version',
          resourceId: id,
          resourceTitle: data.title,
          metadata: {
            documentId,
            versionNumber,
            versionType: data.versionType,
            versionLabel: data.versionLabel,
          },
        }, context);
      }
      
      return id;
    },
    
    /**
     * Get version history for a document
     */
    async list(
      documentId: string,
      options: { limit?: number; offset?: number } = {}
    ): Promise<VersionListItem[]> {
      const { limit = 50, offset = 0 } = options;
      
      const { results } = await db.prepare(`
        SELECT 
          id, version_number, created_at,
          created_by_email, created_by_name,
          title, version_type, version_label, content_size
        FROM document_versions
        WHERE document_id = ?
        ORDER BY version_number DESC
        LIMIT ? OFFSET ?
      `).bind(documentId, limit, offset).all();
      
      return results.map(row => ({
        id: row.id as string,
        versionNumber: row.version_number as number,
        createdAt: row.created_at as number,
        createdByEmail: row.created_by_email as string,
        createdByName: row.created_by_name as string | null,
        title: row.title as string | null,
        versionType: row.version_type as string,
        versionLabel: row.version_label as string | null,
        contentSize: row.content_size as number,
      }));
    },
    
    /**
     * Get a specific version
     */
    async get(versionId: string): Promise<{
      id: string;
      documentId: string;
      versionNumber: number;
      content: string;
      contentFormat: string;
      title: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: number;
      createdByEmail: string;
      versionType: string;
      versionLabel: string | null;
      versionNotes: string | null;
    } | null> {
      const row = await db.prepare(
        `SELECT * FROM document_versions WHERE id = ?`
      ).bind(versionId).first();
      
      if (!row) return null;
      
      return {
        id: row.id as string,
        documentId: row.document_id as string,
        versionNumber: row.version_number as number,
        content: row.content as string,
        contentFormat: row.content_format as string,
        title: row.title as string | null,
        metadata: row.metadata ? JSON.parse(row.metadata as string) : null,
        createdAt: row.created_at as number,
        createdByEmail: row.created_by_email as string,
        versionType: row.version_type as string,
        versionLabel: row.version_label as string | null,
        versionNotes: row.version_notes as string | null,
      };
    },
    
    /**
     * Get version at specific point in time
     */
    async getAtTime(documentId: string, timestamp: number): Promise<string | null> {
      const row = await db.prepare(`
        SELECT id FROM document_versions
        WHERE document_id = ? AND created_at <= ?
        ORDER BY created_at DESC
        LIMIT 1
      `).bind(documentId, timestamp).first<{ id: string }>();
      
      return row?.id || null;
    },
    
    /**
     * Compare two versions
     */
    async compare(
      versionIdA: string,
      versionIdB: string
    ): Promise<VersionDiff | null> {
      const [versionA, versionB] = await Promise.all([
        this.get(versionIdA),
        this.get(versionIdB),
      ]);
      
      if (!versionA || !versionB) return null;
      
      // Ensure A is before B
      const [before, after] = versionA.createdAt <= versionB.createdAt
        ? [versionA, versionB]
        : [versionB, versionA];
      
      const changes: VersionDiff['changes'] = [];
      
      // Compare title
      if (before.title !== after.title) {
        changes.push({
          type: 'title',
          before: before.title || '',
          after: after.title || '',
        });
      }
      
      // Compare content
      if (before.content !== after.content) {
        changes.push({
          type: 'content',
          before: before.content,
          after: after.content,
        });
      }
      
      // Compare metadata fields
      const beforeMeta = before.metadata || {};
      const afterMeta = after.metadata || {};
      const allKeys = new Set([...Object.keys(beforeMeta), ...Object.keys(afterMeta)]);
      
      for (const key of allKeys) {
        const beforeVal = JSON.stringify(beforeMeta[key] ?? '');
        const afterVal = JSON.stringify(afterMeta[key] ?? '');
        if (beforeVal !== afterVal) {
          changes.push({
            type: 'metadata',
            field: key,
            before: beforeVal,
            after: afterVal,
          });
        }
      }
      
      return {
        before: {
          versionId: before.id,
          versionNumber: before.versionNumber,
          content: before.content,
          title: before.title,
          createdAt: before.createdAt,
        },
        after: {
          versionId: after.id,
          versionNumber: after.versionNumber,
          content: after.content,
          title: after.title,
          createdAt: after.createdAt,
        },
        changes,
      };
    },
    
    /**
     * Restore to a previous version
     */
    async restore(
      documentId: string,
      versionId: string,
      context: AuditContext
    ): Promise<string> {
      const targetVersion = await this.get(versionId);
      if (!targetVersion) {
        throw new Error('Version not found');
      }
      
      // Create a new version with the old content
      const newVersionId = await this.create(documentId, {
        content: targetVersion.content,
        contentFormat: targetVersion.contentFormat as 'html' | 'json' | 'markdown',
        title: targetVersion.title || undefined,
        metadata: targetVersion.metadata || undefined,
        versionType: 'restore',
        versionNotes: `Restored from version ${targetVersion.versionNumber}`,
      }, context);
      
      // Update the document's current content
      await db.prepare(`
        UPDATE documents
        SET content = ?, title = ?, updated_at = ?
        WHERE id = ?
      `).bind(
        targetVersion.content,
        targetVersion.title,
        Date.now(),
        documentId
      ).run();
      
      // Audit log
      if (audit) {
        await audit.log({
          action: 'restore',
          actionCategory: 'content',
          resourceType: 'document',
          resourceId: documentId,
          metadata: {
            restoredFromVersionId: versionId,
            restoredFromVersionNumber: targetVersion.versionNumber,
            newVersionId,
          },
        }, context);
      }
      
      return newVersionId!;
    },
    
    /**
     * Add label to existing version
     */
    async label(
      versionId: string,
      label: string,
      notes?: string,
      context?: AuditContext
    ): Promise<void> {
      await db.prepare(`
        UPDATE document_versions
        SET version_label = ?, version_notes = COALESCE(?, version_notes)
        WHERE id = ?
      `).bind(label, notes || null, versionId).run();
      
      if (audit && context) {
        await audit.log({
          action: 'update',
          actionCategory: 'content',
          resourceType: 'document_version',
          resourceId: versionId,
          changeSummary: `Added label: "${label}"`,
        }, context);
      }
    },
    
    /**
     * Get named/labeled versions only
     */
    async getLabeled(documentId: string): Promise<VersionListItem[]> {
      const { results } = await db.prepare(`
        SELECT 
          id, version_number, created_at,
          created_by_email, created_by_name,
          title, version_type, version_label, content_size
        FROM document_versions
        WHERE document_id = ? AND version_label IS NOT NULL
        ORDER BY version_number DESC
      `).bind(documentId).all();
      
      return results.map(row => ({
        id: row.id as string,
        versionNumber: row.version_number as number,
        createdAt: row.created_at as number,
        createdByEmail: row.created_by_email as string,
        createdByName: row.created_by_name as string | null,
        title: row.title as string | null,
        versionType: row.version_type as string,
        versionLabel: row.version_label as string | null,
        contentSize: row.content_size as number,
      }));
    },
  };
}

async function computeHash(content: string): Promise<string> {
  const buffer = new TextEncoder().encode(content);
  const hash = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

---

## UI Components

### Version Panel

Sidebar panel showing version history:

```svelte
<!-- lib/components/versions/VersionPanel.svelte -->
<script lang="ts">
  import { formatDistanceToNow, format } from 'date-fns';
  import { History, Tag, RotateCcw, GitCompare, Eye } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  
  interface Props {
    documentId: string;
    currentVersionId?: string;
    onPreview: (versionId: string) => void;
    onRestore: (versionId: string) => void;
    onCompare: (versionIdA: string, versionIdB: string) => void;
  }
  
  let { documentId, currentVersionId, onPreview, onRestore, onCompare }: Props = $props();
  
  let versions = $state<VersionListItem[]>([]);
  let loading = $state(true);
  let selectedForCompare = $state<string | null>(null);
  let showLabeledOnly = $state(false);
  
  async function loadVersions() {
    loading = true;
    const endpoint = showLabeledOnly 
      ? `/api/documents/${documentId}/versions?labeled=true`
      : `/api/documents/${documentId}/versions`;
    const response = await fetch(endpoint);
    versions = await response.json();
    loading = false;
  }
  
  $effect(() => {
    loadVersions();
  });
  
  function handleCompareClick(versionId: string) {
    if (selectedForCompare === null) {
      selectedForCompare = versionId;
    } else if (selectedForCompare === versionId) {
      selectedForCompare = null;
    } else {
      onCompare(selectedForCompare, versionId);
      selectedForCompare = null;
    }
  }
  
  function getVersionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      auto: '',
      manual: 'Saved',
      publish: 'Published',
      restore: 'Restored',
    };
    return labels[type] || type;
  }
</script>

<div class="version-panel">
  <header class="panel-header">
    <h3>
      <History class="w-4 h-4" />
      Version History
    </h3>
    
    <label class="filter-toggle">
      <input type="checkbox" bind:checked={showLabeledOnly} onchange={loadVersions} />
      <Tag class="w-3 h-3" />
      Labeled only
    </label>
  </header>
  
  {#if loading}
    <div class="loading">Loading versions...</div>
  {:else if versions.length === 0}
    <div class="empty">No versions yet</div>
  {:else}
    <ul class="version-list">
      {#each versions as version (version.id)}
        {@const isSelected = selectedForCompare === version.id}
        {@const isCurrent = currentVersionId === version.id}
        
        <li class="version-item" class:selected={isSelected} class:current={isCurrent}>
          <div class="version-header">
            <span class="version-number">v{version.versionNumber}</span>
            {#if version.versionLabel}
              <span class="version-label">
                <Tag class="w-3 h-3" />
                {version.versionLabel}
              </span>
            {/if}
            {#if isCurrent}
              <span class="current-badge">Current</span>
            {/if}
          </div>
          
          <div class="version-meta">
            <span class="author">{version.createdByName || version.createdByEmail}</span>
            <time datetime={new Date(version.createdAt).toISOString()}>
              {formatDistanceToNow(version.createdAt, { addSuffix: true })}
            </time>
          </div>
          
          {#if version.versionType !== 'auto'}
            <div class="version-type">
              {getVersionTypeLabel(version.versionType)}
            </div>
          {/if}
          
          <div class="version-actions">
            <Button 
              variant="ghost" 
              size="sm"
              onclick={() => onPreview(version.id)}
              title="Preview this version"
            >
              <Eye class="w-4 h-4" />
            </Button>
            
            <Button
              variant={isSelected ? 'default' : 'ghost'}
              size="sm"
              onclick={() => handleCompareClick(version.id)}
              title={isSelected ? 'Cancel comparison' : 'Compare with another version'}
            >
              <GitCompare class="w-4 h-4" />
            </Button>
            
            {#if !isCurrent}
              <Button
                variant="ghost"
                size="sm"
                onclick={() => onRestore(version.id)}
                title="Restore this version"
              >
                <RotateCcw class="w-4 h-4" />
              </Button>
            {/if}
          </div>
        </li>
      {/each}
    </ul>
  {/if}
  
  {#if selectedForCompare}
    <div class="compare-prompt">
      Select another version to compare
      <Button variant="ghost" size="sm" onclick={() => selectedForCompare = null}>
        Cancel
      </Button>
    </div>
  {/if}
</div>

<style>
  .version-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    border-left: 1px solid var(--color-border);
    background: var(--color-bg-surface);
  }
  
  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
  }
  
  .panel-header h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    margin: 0;
  }
  
  .filter-toggle {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }
  
  .version-list {
    flex: 1;
    overflow-y: auto;
    list-style: none;
    padding: 0;
    margin: 0;
  }
  
  .version-item {
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--color-border);
    transition: background 0.15s;
  }
  
  .version-item:hover {
    background: var(--color-bg-muted);
  }
  
  .version-item.selected {
    background: var(--color-primary-light);
    border-left: 3px solid var(--color-primary);
  }
  
  .version-item.current {
    background: var(--color-success-light);
  }
  
  .version-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.25rem;
  }
  
  .version-number {
    font-weight: 600;
    font-size: 0.875rem;
  }
  
  .version-label {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--color-primary);
    background: var(--color-primary-light);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
  }
  
  .current-badge {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    color: var(--color-success);
    background: var(--color-success-light);
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
  }
  
  .version-meta {
    display: flex;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }
  
  .version-type {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-style: italic;
  }
  
  .version-actions {
    display: flex;
    gap: 0.25rem;
    margin-top: 0.5rem;
  }
  
  .compare-prompt {
    padding: 0.75rem 1rem;
    background: var(--color-warning-light);
    border-top: 1px solid var(--color-border);
    font-size: 0.875rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .loading, .empty {
    padding: 2rem;
    text-align: center;
    color: var(--color-text-muted);
  }
</style>
```

### Visual Diff View

Side-by-side comparison with highlighted changes:

```svelte
<!-- lib/components/versions/VersionDiff.svelte -->
<script lang="ts">
  import { diffWords, diffLines } from 'diff';
  import { format } from 'date-fns';
  import { X } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  
  interface VersionSnapshot {
    versionId: string;
    versionNumber: number;
    content: string;
    title: string | null;
    createdAt: number;
  }
  
  interface Props {
    before: VersionSnapshot;
    after: VersionSnapshot;
    onClose: () => void;
    onRestore?: (versionId: string) => void;
  }
  
  let { before, after, onClose, onRestore }: Props = $props();
  
  type DiffMode = 'unified' | 'split';
  let diffMode = $state<DiffMode>('split');
  
  // Compute word-level diff
  let contentDiff = $derived(diffWords(before.content, after.content));
  
  // For split view, we need to separate the changes
  let splitView = $derived(() => {
    const leftParts: Array<{ text: string; type: 'unchanged' | 'removed' }> = [];
    const rightParts: Array<{ text: string; type: 'unchanged' | 'added' }> = [];
    
    for (const part of contentDiff) {
      if (part.added) {
        rightParts.push({ text: part.value, type: 'added' });
      } else if (part.removed) {
        leftParts.push({ text: part.value, type: 'removed' });
      } else {
        leftParts.push({ text: part.value, type: 'unchanged' });
        rightParts.push({ text: part.value, type: 'unchanged' });
      }
    }
    
    return { left: leftParts, right: rightParts };
  });
</script>

<div class="diff-overlay">
  <div class="diff-container">
    <header class="diff-header">
      <h2>Compare Versions</h2>
      
      <div class="diff-controls">
        <div class="mode-toggle">
          <button 
            class:active={diffMode === 'split'}
            onclick={() => diffMode = 'split'}
          >
            Split
          </button>
          <button
            class:active={diffMode === 'unified'}
            onclick={() => diffMode = 'unified'}
          >
            Unified
          </button>
        </div>
        
        <Button variant="ghost" size="sm" onclick={onClose}>
          <X class="w-4 h-4" />
        </Button>
      </div>
    </header>
    
    <div class="diff-meta">
      <div class="version-info before">
        <span class="version-badge">v{before.versionNumber}</span>
        <time>{format(before.createdAt, 'PPpp')}</time>
        {#if onRestore}
          <Button variant="outline" size="sm" onclick={() => onRestore(before.versionId)}>
            Restore this version
          </Button>
        {/if}
      </div>
      
      <div class="arrow">→</div>
      
      <div class="version-info after">
        <span class="version-badge">v{after.versionNumber}</span>
        <time>{format(after.createdAt, 'PPpp')}</time>
      </div>
    </div>
    
    {#if before.title !== after.title}
      <div class="title-diff">
        <span class="label">Title changed:</span>
        <span class="removed">{before.title || '(untitled)'}</span>
        <span class="arrow">→</span>
        <span class="added">{after.title || '(untitled)'}</span>
      </div>
    {/if}
    
    <div class="diff-content" class:split={diffMode === 'split'}>
      {#if diffMode === 'unified'}
        <div class="unified-view">
          {#each contentDiff as part}
            <span
              class:added={part.added}
              class:removed={part.removed}
            >{part.value}</span>
          {/each}
        </div>
      {:else}
        <div class="split-view">
          <div class="split-pane left">
            <div class="pane-header">Before (v{before.versionNumber})</div>
            <div class="pane-content">
              {#each splitView.left as part}
                <span class:removed={part.type === 'removed'}>{part.text}</span>
              {/each}
            </div>
          </div>
          
          <div class="split-pane right">
            <div class="pane-header">After (v{after.versionNumber})</div>
            <div class="pane-content">
              {#each splitView.right as part}
                <span class:added={part.type === 'added'}>{part.text}</span>
              {/each}
            </div>
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>

<style>
  .diff-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .diff-container {
    width: 90vw;
    max-width: 1400px;
    max-height: 90vh;
    background: white;
    border-radius: 0.5rem;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  
  .diff-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    border-bottom: 1px solid var(--color-border);
  }
  
  .diff-header h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  
  .diff-controls {
    display: flex;
    align-items: center;
    gap: 1rem;
  }
  
  .mode-toggle {
    display: flex;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    overflow: hidden;
  }
  
  .mode-toggle button {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    background: none;
    border: none;
    cursor: pointer;
  }
  
  .mode-toggle button.active {
    background: var(--color-primary);
    color: white;
  }
  
  .diff-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding: 0.75rem 1rem;
    background: var(--color-bg-muted);
    border-bottom: 1px solid var(--color-border);
  }
  
  .version-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .version-badge {
    font-weight: 600;
    background: var(--color-primary);
    color: white;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.875rem;
  }
  
  .arrow {
    color: var(--color-text-muted);
  }
  
  .title-diff {
    padding: 0.5rem 1rem;
    background: var(--color-warning-light);
    font-size: 0.875rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
  
  .title-diff .label {
    font-weight: 500;
  }
  
  .diff-content {
    flex: 1;
    overflow-y: auto;
    padding: 1rem;
  }
  
  .unified-view {
    font-family: monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    white-space: pre-wrap;
  }
  
  .split-view {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    height: 100%;
  }
  
  .split-pane {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    overflow: hidden;
  }
  
  .pane-header {
    padding: 0.5rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 600;
    background: var(--color-bg-muted);
    border-bottom: 1px solid var(--color-border);
  }
  
  .pane-content {
    flex: 1;
    padding: 0.75rem;
    overflow-y: auto;
    font-family: monospace;
    font-size: 0.875rem;
    line-height: 1.6;
    white-space: pre-wrap;
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

### Save Version Dialog

For manual version saves with label:

```svelte
<!-- lib/components/versions/SaveVersionDialog.svelte -->
<script lang="ts">
  import { Tag, Save } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  
  interface Props {
    open: boolean;
    onSave: (label: string, notes: string) => void;
    onCancel: () => void;
  }
  
  let { open, onSave, onCancel }: Props = $props();
  
  let label = $state('');
  let notes = $state('');
  let saving = $state(false);
  
  async function handleSave() {
    if (!label.trim()) return;
    saving = true;
    await onSave(label.trim(), notes.trim());
    saving = false;
    label = '';
    notes = '';
  }
</script>

{#if open}
  <div class="dialog-overlay">
    <div class="dialog">
      <h3>
        <Tag class="w-5 h-5" />
        Save Named Version
      </h3>
      
      <p class="dialog-description">
        Create a labeled checkpoint you can easily find and restore later.
      </p>
      
      <div class="form-group">
        <label for="version-label">Version Label</label>
        <input
          id="version-label"
          type="text"
          bind:value={label}
          placeholder="e.g., Q4 Audit Submission"
          disabled={saving}
        />
      </div>
      
      <div class="form-group">
        <label for="version-notes">Notes (optional)</label>
        <textarea
          id="version-notes"
          bind:value={notes}
          placeholder="Why is this version significant?"
          rows="3"
          disabled={saving}
        ></textarea>
      </div>
      
      <div class="dialog-actions">
        <Button variant="outline" onclick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onclick={handleSave} disabled={!label.trim() || saving}>
          <Save class="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Version'}
        </Button>
      </div>
    </div>
  </div>
{/if}

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .dialog {
    width: 100%;
    max-width: 480px;
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
  }
  
  .dialog h3 {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0 0 0.5rem;
  }
  
  .dialog-description {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
  }
  
  .form-group {
    margin-bottom: 1rem;
  }
  
  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.375rem;
  }
  
  .form-group input,
  .form-group textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }
  
  .form-group textarea {
    resize: vertical;
  }
  
  .dialog-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.5rem;
  }
</style>
```

---

## Implementation Notes

### Auto-Save Strategy

Balance between version granularity and storage:

```typescript
// Debounced auto-save with version creation
let saveTimeout: number | null = null;
const DEBOUNCE_MS = 2000;

function onContentChange(content: string) {
  // Update local state immediately
  currentContent = content;
  isDirty = true;
  
  // Debounce the save
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(async () => {
    await saveDocument(content);
    isDirty = false;
  }, DEBOUNCE_MS);
}

async function saveDocument(content: string) {
  // Save to document table
  await fetch(`/api/documents/${documentId}`, {
    method: 'PATCH',
    body: JSON.stringify({ content }),
  });
  
  // Version service handles deduplication
  // (won't create new version if content unchanged)
}
```

### Version Pruning (Optional)

For very long-lived documents, consider pruning old auto versions while keeping manual/publish versions:

```sql
-- Keep last 100 auto versions, all labeled versions
DELETE FROM document_versions
WHERE document_id = ?
  AND version_type = 'auto'
  AND version_label IS NULL
  AND id NOT IN (
    SELECT id FROM document_versions
    WHERE document_id = ?
    ORDER BY version_number DESC
    LIMIT 100
  );
```

### Storage Considerations

| Metric | Estimate |
|--------|----------|
| Average document size | 10-50 KB |
| Versions per document per day | 10-50 (auto), 1-2 (manual) |
| Monthly storage per active document | ~1-5 MB |
| Deduplication savings | 40-60% typical |

For 100 active documents over 1 year: ~600 MB - 6 GB

---

## Testing Strategy

```typescript
describe('VersionService', () => {
  it('creates version on first save', async () => {
    const version = await versions.create(docId, {
      content: '<p>Hello</p>',
      contentFormat: 'html',
    }, context);
    
    expect(version).toBeDefined();
    const list = await versions.list(docId);
    expect(list).toHaveLength(1);
    expect(list[0].versionNumber).toBe(1);
  });
  
  it('skips version when content unchanged', async () => {
    await versions.create(docId, { content: '<p>Hello</p>', contentFormat: 'html' }, context);
    const second = await versions.create(docId, { content: '<p>Hello</p>', contentFormat: 'html' }, context);
    
    expect(second).toBeNull();
    const list = await versions.list(docId);
    expect(list).toHaveLength(1);
  });
  
  it('creates new version when content changes', async () => {
    await versions.create(docId, { content: '<p>Hello</p>', contentFormat: 'html' }, context);
    await versions.create(docId, { content: '<p>World</p>', contentFormat: 'html' }, context);
    
    const list = await versions.list(docId);
    expect(list).toHaveLength(2);
  });
  
  it('restores creates new version with old content', async () => {
    await versions.create(docId, { content: '<p>v1</p>', contentFormat: 'html' }, context);
    await versions.create(docId, { content: '<p>v2</p>', contentFormat: 'html' }, context);
    
    const list = await versions.list(docId);
    const v1 = list.find(v => v.versionNumber === 1)!;
    
    await versions.restore(docId, v1.id, context);
    
    const newList = await versions.list(docId);
    expect(newList).toHaveLength(3);
    expect(newList[0].versionType).toBe('restore');
  });
  
  it('compares two versions correctly', async () => {
    await versions.create(docId, { content: '<p>Hello</p>', contentFormat: 'html', title: 'Doc' }, context);
    await versions.create(docId, { content: '<p>World</p>', contentFormat: 'html', title: 'Document' }, context);
    
    const list = await versions.list(docId);
    const diff = await versions.compare(list[1].id, list[0].id);
    
    expect(diff?.changes).toContainEqual(expect.objectContaining({ type: 'title' }));
    expect(diff?.changes).toContainEqual(expect.objectContaining({ type: 'content' }));
  });
});
```

---

## Migration Path

### Adding to Existing Documents

```typescript
// scripts/migrate-versions.ts
async function migrateExistingDocuments(db: D1Database) {
  const versions = createVersionService(db);
  
  // Get all documents without versions
  const { results: docs } = await db.prepare(`
    SELECT d.id, d.content, d.title, d.created_at, d.updated_at
    FROM documents d
    LEFT JOIN document_versions v ON d.id = v.document_id
    WHERE v.id IS NULL
  `).all();
  
  for (const doc of docs) {
    // Create initial version
    await versions.create(doc.id, {
      content: doc.content,
      contentFormat: 'html',
      title: doc.title,
      versionType: 'manual',
      versionLabel: 'Initial Version',
      versionNotes: 'Created during migration from unversioned system',
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

- [01-audit-system.md](./01-audit-system.md) — Every version action is audited
- [05-workflow-engine.md](./05-workflow-engine.md) — Publish creates a version snapshot
- [03-realtime-collaboration.md](./03-realtime-collaboration.md) — Collaboration creates versions

---

*Document version: 1.0*

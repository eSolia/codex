# Hanawa: Preview Deployments Specification

Shareable staging environments for content review.

## Overview

Preview deployments let stakeholders see exactly how content will look when published—without touching production.

```
┌─────────────────────────────────────────────────────────────────┐
│  PREVIEW FLOW                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Draft → Create Preview → Unique URL → Reviewer → Feedback     │
│                                                                 │
│  Features:                                                      │
│  • Token-based access (no login required)                      │
│  • Optional password protection                                │
│  • Email restrictions                                          │
│  • View limits & expiry                                        │
│  • Built-in feedback widget                                    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

```sql
CREATE TABLE previews (
  id TEXT PRIMARY KEY,
  document_id TEXT,
  content_snapshot TEXT,            -- Frozen content
  url TEXT NOT NULL,
  access_token TEXT NOT NULL,
  password TEXT,
  allowed_emails TEXT,              -- JSON array
  max_views INTEGER,
  view_count INTEGER DEFAULT 0,
  expires_at INTEGER NOT NULL,
  name TEXT,
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  status TEXT DEFAULT 'active'
);

CREATE TABLE preview_feedback (
  id TEXT PRIMARY KEY,
  preview_id TEXT NOT NULL,
  page_path TEXT,
  feedback_type TEXT NOT NULL,      -- 'comment', 'issue', 'approval'
  content TEXT NOT NULL,
  author_email TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  created_at INTEGER NOT NULL
);
```

## API

```typescript
// lib/server/previews.ts

export function createPreviewService(db: D1Database) {
  return {
    async create(options: {
      documentId: string;
      name?: string;
      expiresIn?: number;
      password?: string;
      allowedEmails?: string[];
      maxViews?: number;
    }, context: AuditContext): Promise<Preview> {
      const id = crypto.randomUUID();
      const token = this.generateToken();
      const url = `https://preview-${id.slice(0, 8)}.hanawa-preview.pages.dev`;
      
      // Snapshot content
      const doc = await db.prepare(`SELECT content FROM documents WHERE id = ?`)
        .bind(options.documentId).first();
      
      await db.prepare(`
        INSERT INTO previews (id, document_id, content_snapshot, url, access_token, ...)
        VALUES (?, ?, ?, ?, ?, ...)
      `).bind(id, options.documentId, doc.content, url, token, ...).run();
      
      return this.get(id);
    },
    
    async validateAccess(token: string, options?: {
      email?: string;
      password?: string;
    }): Promise<{ valid: boolean; preview?: Preview; error?: string }> {
      const preview = await db.prepare(`SELECT * FROM previews WHERE access_token = ?`)
        .bind(token).first();
      
      if (!preview) return { valid: false, error: 'Not found' };
      if (preview.expires_at < Date.now()) return { valid: false, error: 'Expired' };
      if (preview.max_views && preview.view_count >= preview.max_views) {
        return { valid: false, error: 'View limit reached' };
      }
      
      // Check password, email restrictions...
      
      return { valid: true, preview };
    },
    
    async addFeedback(previewId: string, feedback: {
      type: 'comment' | 'issue' | 'approval';
      content: string;
      authorEmail: string;
      pagePath?: string;
    }): Promise<void> {
      await db.prepare(`
        INSERT INTO preview_feedback (id, preview_id, feedback_type, content, author_email, page_path, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).bind(crypto.randomUUID(), previewId, feedback.type, feedback.content, 
              feedback.authorEmail, feedback.pagePath, Date.now()).run();
    },
    
    generateToken(): string {
      const bytes = new Uint8Array(32);
      crypto.getRandomValues(bytes);
      return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    },
  };
}
```

## Preview Site Handler

```typescript
// preview-site/functions/[[path]].ts

export async function onRequest({ request, env }) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');
  
  if (!token) return renderPasswordPage();
  
  const validation = await fetch(`${env.HANAWA_API}/api/previews/validate`, {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  
  if (!validation.ok) {
    return renderErrorPage('Invalid or expired preview');
  }
  
  const { preview, content } = await validation.json();
  
  return new Response(renderWithBanner(content, preview), {
    headers: {
      'Content-Type': 'text/html',
      'X-Robots-Tag': 'noindex',
      'Cache-Control': 'no-store',
    },
  });
}
```

## UI: Create Preview Dialog

```svelte
<script lang="ts">
  let name = $state('');
  let expiresIn = $state('7d');
  let usePassword = $state(false);
  let password = $state('');
  let created = $state<Preview | null>(null);
  
  async function createPreview() {
    const response = await fetch('/api/previews', {
      method: 'POST',
      body: JSON.stringify({ documentId, name, expiresIn, password: usePassword ? password : undefined }),
    });
    created = await response.json();
  }
</script>

{#if created}
  <div class="success">
    <input readonly value="{created.url}?token={created.accessToken}" />
    <button onclick={copyLink}>Copy Link</button>
  </div>
{:else}
  <form onsubmit={createPreview}>
    <input bind:value={name} placeholder="Preview name" />
    <select bind:value={expiresIn}>
      <option value="1h">1 hour</option>
      <option value="7d">7 days</option>
      <option value="30d">30 days</option>
    </select>
    <label><input type="checkbox" bind:checked={usePassword} /> Password protect</label>
    {#if usePassword}<input type="password" bind:value={password} />{/if}
    <button type="submit">Create Preview</button>
  </form>
{/if}
```

## Feedback Widget

Embedded in preview pages:

```svelte
<script lang="ts">
  let open = $state(false);
  let type = $state<'comment' | 'issue' | 'approval'>('comment');
  let content = $state('');
  let email = $state('');
  
  async function submit() {
    await fetch(`/api/previews/${previewId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ type, content, authorEmail: email }),
    });
    open = false;
  }
</script>

<div class="feedback-widget">
  <button onclick={() => open = true}>💬 Feedback</button>
  
  {#if open}
    <div class="panel">
      <div class="type-selector">
        <button class:active={type === 'comment'} onclick={() => type = 'comment'}>Comment</button>
        <button class:active={type === 'issue'} onclick={() => type = 'issue'}>Issue</button>
        <button class:active={type === 'approval'} onclick={() => type = 'approval'}>Approve</button>
      </div>
      <input type="email" bind:value={email} placeholder="Your email" />
      <textarea bind:value={content} placeholder="Your feedback..." />
      <button onclick={submit}>Send</button>
    </div>
  {/if}
</div>
```

## Testing

```typescript
describe('PreviewService', () => {
  it('creates preview with token', async () => {
    const preview = await previews.create({ documentId: 'doc1' }, context);
    expect(preview.accessToken).toHaveLength(64);
  });
  
  it('validates password protection', async () => {
    const preview = await previews.create({ documentId: 'doc1', password: 'secret' }, context);
    
    const r1 = await previews.validateAccess(preview.accessToken);
    expect(r1.valid).toBe(false);
    
    const r2 = await previews.validateAccess(preview.accessToken, { password: 'secret' });
    expect(r2.valid).toBe(true);
  });
  
  it('respects view limits', async () => {
    const preview = await previews.create({ documentId: 'doc1', maxViews: 1 }, context);
    await previews.recordAccess(preview.id);
    
    const result = await previews.validateAccess(preview.accessToken);
    expect(result.error).toBe('View limit reached');
  });
});
```

---

*Document version: 1.0*

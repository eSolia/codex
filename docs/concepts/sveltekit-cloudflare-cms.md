# SvelteKit + Cloudflare CMS with Shareable Previews

A complete architecture for building a content management system on Cloudflare's platform with SvelteKit, featuring instant previews and secure shareable preview links.

## Overview

SvelteKit already renders your templates. By storing draft content alongside published content, you get instant previews without a separate build step—the same system serves both.

```
┌─────────────────────────────────────────────────────────────────┐
│  CORE INSIGHT                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Traditional CMS          SvelteKit CMS                        │
│  ─────────────────        ─────────────                        │
│  Content → Build → HTML   Content → SvelteKit → HTML           │
│  (separate systems)       (same system, different data source) │
│                                                                 │
│  Preview needs rebuild    Preview is just a route parameter    │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

### Infrastructure Stack

| Component | Purpose |
|-----------|---------|
| Cloudflare Pages | SvelteKit hosting |
| D1 | Content storage (drafts + published) |
| R2 | Media file storage |
| Cloudflare Access | Admin authentication |
| KV (optional) | Edge caching layer |

### Data Model

```sql
CREATE TABLE documents (
  id TEXT PRIMARY KEY,
  collection TEXT NOT NULL,
  slug TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  content TEXT NOT NULL,           -- JSON: current draft
  published_content TEXT,          -- JSON: last published version
  preview_token TEXT,              -- UUID for shareable links
  preview_expires INTEGER,         -- Unix timestamp
  preview_max_views INTEGER,       -- Optional view limit
  preview_view_count INTEGER DEFAULT 0,
  created_at INTEGER DEFAULT (unixepoch()),
  updated_at INTEGER DEFAULT (unixepoch()),
  
  UNIQUE(collection, slug)
);

CREATE INDEX idx_collection_status ON documents(collection, status);
CREATE INDEX idx_preview_token ON documents(preview_token);
```

### URL Patterns

Three ways to access content:

```
Published (public):
https://example.com/blog/my-post
→ Loads published_content, cached at edge

Editor Preview (authenticated):
https://example.com/blog/my-post?preview=true
→ Loads draft content, requires Cloudflare Access

Shareable Preview (token-based):
https://example.com/preview/abc123-def456
→ Loads draft content, validates token + expiry
→ No authentication required (link is the auth)
```

## Implementation

### CMS Service Layer

```typescript
// lib/server/cms.ts
import type { D1Database } from '@cloudflare/workers-types';

export function createCMS(db: D1Database) {
  return {
    // Public: get published content only
    async getPublished(collection: string, slug: string) {
      const doc = await db.prepare(`
        SELECT published_content as content 
        FROM documents 
        WHERE collection = ? AND slug = ? AND status = 'published'
      `).bind(collection, slug).first();
      
      return doc ? JSON.parse(doc.content) : null;
    },
    
    // Editor: get draft content (requires auth)
    async getDraft(collection: string, slug: string) {
      const doc = await db.prepare(`
        SELECT content 
        FROM documents 
        WHERE collection = ? AND slug = ?
      `).bind(collection, slug).first();
      
      return doc ? JSON.parse(doc.content) : null;
    },
    
    // Shareable: get by preview token
    async getByPreviewToken(token: string) {
      const doc = await db.prepare(`
        SELECT collection, slug, content, preview_expires, 
               preview_max_views, preview_view_count
        FROM documents 
        WHERE preview_token = ?
      `).bind(token).first();
      
      if (!doc) return null;
      if (doc.preview_expires < Date.now() / 1000) return null;
      if (doc.preview_max_views && doc.preview_view_count >= doc.preview_max_views) {
        return null;
      }
      
      return {
        collection: doc.collection,
        slug: doc.slug,
        content: JSON.parse(doc.content)
      };
    },
    
    // Generate shareable preview link
    async createPreviewLink(
      collection: string, 
      slug: string, 
      options: { expiresIn?: number; maxViews?: number } = {}
    ) {
      const token = crypto.randomUUID();
      const expires = Math.floor(Date.now() / 1000) + (options.expiresIn || 7 * 24 * 60 * 60);
      
      await db.prepare(`
        UPDATE documents 
        SET preview_token = ?, 
            preview_expires = ?, 
            preview_max_views = ?,
            preview_view_count = 0
        WHERE collection = ? AND slug = ?
      `).bind(token, expires, options.maxViews || null, collection, slug).run();
      
      return { token, expires };
    },
    
    // Record preview view
    async recordPreviewView(token: string) {
      await db.prepare(`
        UPDATE documents 
        SET preview_view_count = preview_view_count + 1
        WHERE preview_token = ?
      `).bind(token).run();
    },
    
    // Save document
    async save(collection: string, slug: string, content: object) {
      const id = crypto.randomUUID();
      const now = Math.floor(Date.now() / 1000);
      
      await db.prepare(`
        INSERT INTO documents (id, collection, slug, content, updated_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(collection, slug) DO UPDATE SET
          content = excluded.content,
          updated_at = excluded.updated_at
      `).bind(id, collection, slug, JSON.stringify(content), now).run();
    },
    
    // Publish document
    async publish(collection: string, slug: string) {
      await db.prepare(`
        UPDATE documents 
        SET status = 'published',
            published_content = content,
            updated_at = ?
        WHERE collection = ? AND slug = ?
      `).bind(Math.floor(Date.now() / 1000), collection, slug).run();
    }
  };
}
```

### Route: Public Content

```typescript
// routes/blog/[slug]/+page.server.ts
import { createCMS } from '$lib/server/cms';
import { error } from '@sveltejs/kit';

export async function load({ params, platform, url }) {
  const cms = createCMS(platform.env.DB);
  const isPreview = url.searchParams.get('preview') === 'true';
  
  // Preview mode requires authentication (handled by Cloudflare Access)
  const content = isPreview 
    ? await cms.getDraft('posts', params.slug)
    : await cms.getPublished('posts', params.slug);
  
  if (!content) {
    throw error(404, 'Post not found');
  }
  
  return { 
    post: content,
    isPreview 
  };
}
```

### Route: Shareable Preview

```typescript
// routes/preview/[token]/+page.server.ts
import { createCMS } from '$lib/server/cms';
import { error } from '@sveltejs/kit';

export async function load({ params, platform, setHeaders }) {
  const cms = createCMS(platform.env.DB);
  const preview = await cms.getByPreviewToken(params.token);
  
  if (!preview) {
    throw error(404, 'Preview link expired or invalid');
  }
  
  // Record the view
  await cms.recordPreviewView(params.token);
  
  // Prevent caching and indexing
  setHeaders({
    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
    'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
  });
  
  return {
    collection: preview.collection,
    slug: preview.slug,
    content: preview.content,
    isPreview: true
  };
}
```

```svelte
<!-- routes/preview/[token]/+page.svelte -->
<script>
  import BlogPost from '$lib/components/BlogPost.svelte';
  import PageLayout from '$lib/components/PageLayout.svelte';
  
  let { data } = $props();
  
  const templates = {
    posts: BlogPost,
    pages: PageLayout
  };
</script>

<div class="preview-banner">
  ⚠️ Preview Mode — This content is not yet published
</div>

<svelte:component this={templates[data.collection]} content={data.content} />

<style>
  .preview-banner {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    background: #f59e0b;
    color: black;
    padding: 0.5rem;
    text-align: center;
    font-weight: 500;
    z-index: 9999;
  }
</style>
```

### Admin: Preview Link Generation

```svelte
<!-- routes/admin/[collection]/[slug]/+page.svelte (partial) -->
<script>
  import { Button } from '$lib/components/ui/button';
  import { Copy, ExternalLink } from 'lucide-svelte';
  
  let { data } = $props();
  let previewUrl = $state('');
  let previewExpires = $state(null);
  let copying = $state(false);
  
  async function generatePreviewLink() {
    const response = await fetch(`/api/admin/preview-link`, {
      method: 'POST',
      body: JSON.stringify({
        collection: data.collection,
        slug: data.slug,
        expiresIn: 7 * 24 * 60 * 60 // 7 days
      })
    });
    
    const { token, expires } = await response.json();
    previewUrl = `${window.location.origin}/preview/${token}`;
    previewExpires = new Date(expires * 1000);
  }
  
  async function copyLink() {
    copying = true;
    await navigator.clipboard.writeText(previewUrl);
    setTimeout(() => copying = false, 2000);
  }
</script>

<div class="preview-section">
  <h3>Share Preview</h3>
  
  {#if previewUrl}
    <div class="preview-link-box">
      <input type="text" readonly value={previewUrl} />
      <Button variant="outline" size="sm" onclick={copyLink}>
        <Copy class="w-4 h-4" />
        {copying ? 'Copied!' : 'Copy'}
      </Button>
      <Button variant="outline" size="sm" onclick={() => window.open(previewUrl, '_blank')}>
        <ExternalLink class="w-4 h-4" />
        Open
      </Button>
    </div>
    <p class="expires">Expires: {previewExpires.toLocaleDateString()}</p>
  {:else}
    <Button onclick={generatePreviewLink}>
      Generate Shareable Preview Link
    </Button>
  {/if}
</div>
```

### Live Editor Preview

For instant in-editor preview while typing:

```svelte
<!-- routes/admin/[collection]/[slug]/+page.svelte -->
<script>
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';
  
  let content = $state({ title: '', body: '' });
  
  let renderedBody = $derived(
    DOMPurify.sanitize(marked.parse(content.body || ''))
  );
</script>

<div class="editor-layout">
  <div class="editor-pane">
    <input bind:value={content.title} placeholder="Title" />
    <textarea bind:value={content.body} placeholder="Content (Markdown)" />
  </div>
  
  <div class="preview-pane">
    <article class="prose">
      <h1>{content.title}</h1>
      {@html renderedBody}
    </article>
  </div>
</div>

<style>
  .editor-layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 2rem;
    height: calc(100vh - 4rem);
  }
  
  .preview-pane {
    overflow-y: auto;
    padding: 2rem;
    background: white;
    border-radius: 0.5rem;
  }
</style>
```

## Feature Map

```
┌─────────────────────────────────────────────────────────────────┐
│  CMS FEATURE MAP                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Editing                                                        │
│  ├── Schema-driven field rendering                             │
│  ├── Live markdown preview in editor                           │
│  ├── Media uploads to R2                                       │
│  └── Autosave drafts                                           │
│                                                                 │
│  Preview                                                        │
│  ├── Instant in-editor preview (side-by-side)                  │
│  ├── Full-page preview (?preview=true, auth required)          │
│  └── Shareable token-based preview links                       │
│                                                                 │
│  Publishing                                                     │
│  ├── Draft → Published workflow                                │
│  ├── Version history (optional)                                │
│  └── Scheduled publishing (optional: Workers Cron)             │
│                                                                 │
│  Security                                                       │
│  ├── /admin/* protected by Cloudflare Access                   │
│  ├── ?preview=true protected by Cloudflare Access              │
│  ├── /preview/[token] public but token-gated + expiring        │
│  └── All content writes require authentication                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Media Handling

### R2 Bucket Structure

```
r2-media/
├── published/           ← Public, served via custom domain
│   └── {hash}-image.jpg
└── drafts/              ← Private, served via authenticated API
    └── {uuid}-image.jpg
```

### Authenticated Media Endpoint

```typescript
// routes/api/media/[...path]/+server.ts
export async function GET({ params, platform, locals }) {
  if (!locals.user) {
    throw error(401, 'Authentication required');
  }
  
  const bucket = platform.env.DRAFTS_BUCKET;
  const object = await bucket.get(params.path);
  
  if (!object) {
    throw error(404, 'Media not found');
  }
  
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Cache-Control': 'private, no-store',
    }
  });
}
```

## Build Estimate

| Component | Effort |
|-----------|--------|
| D1 schema + CMS service | 4-6 hours |
| Admin layout + navigation | 2-3 hours |
| Field components (text, markdown, date, file) | 6-8 hours |
| Media browser (R2) | 4-6 hours |
| Preview system (all three modes) | 4-6 hours |
| Content routes + templates | Varies by site |
| **Total** | **~3-4 days** |

## Comparison: Traditional vs SvelteKit CMS

| Aspect | Lume + LumeCMS | SvelteKit + D1 CMS |
|--------|----------------|---------------------|
| Preview fidelity | Perfect (same build) | Perfect (same renderer) |
| Preview speed | Instant (VPS) or slow (CI) | Instant (same app) |
| Shareable previews | Manual URL sharing | Token-based, expiring links |
| Infrastructure | VPS or Deno Deploy | Single Cloudflare deployment |
| Template language | Vento | Svelte |
| Build complexity | Lume build step | None (dynamic rendering) |
| Edge caching | Post-build CDN | SvelteKit response caching |

## Security Considerations

See companion document: **CMS Content Security Guide** for:

- Content classification (normal, confidential, embargoed)
- Preview approval workflows
- Encryption at rest for sensitive content
- Audit logging
- Screenshot deterrence

---

*Document version: 1.0*

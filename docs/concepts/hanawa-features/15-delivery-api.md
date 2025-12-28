# Hanawa: Delivery API Specification

Content delivery API with REST, GraphQL, and edge caching.

## Overview

The delivery API is how frontend applications consume content from Hanawa. It needs to be fast, flexible, and developer-friendly.

```
┌─────────────────────────────────────────────────────────────────┐
│  DELIVERY API ARCHITECTURE                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Client Request                                                 │
│       │                                                         │
│       ▼                                                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐        │
│  │   CF Edge   │───▶│  KV Cache   │───▶│     D1      │        │
│  │   (global)  │    │  (fast)     │    │  (source)   │        │
│  └─────────────┘    └─────────────┘    └─────────────┘        │
│       │                                                         │
│       ▼                                                         │
│  REST: /api/v1/content/{collection}/{slug}                     │
│  GraphQL: /api/graphql                                          │
│  SDK: hanawa.content.get('posts', 'my-post')                   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## API Design

### REST Endpoints

```
GET /api/v1/content/{collection}
GET /api/v1/content/{collection}/{slug}
GET /api/v1/content/{collection}/{id}

Query Parameters:
  ?locale=ja-JP          # Locale filter
  ?status=published      # Status filter (default: published)
  ?fields=title,body     # Field selection
  ?include=author,tags   # Related content
  ?page=1&perPage=20     # Pagination
  ?sort=publishedAt:desc # Sorting
  ?filter[tag]=news      # Field filtering
```

### Implementation

```typescript
// lib/server/delivery.ts

interface DeliveryOptions {
  locale?: string;
  status?: 'published' | 'draft';
  fields?: string[];
  include?: string[];
}

export function createDeliveryAPI(
  db: D1Database,
  kv: KVNamespace,
  r2: R2Bucket
) {
  return {
    /**
     * Get single document
     */
    async getDocument(
      collection: string,
      slugOrId: string,
      options: DeliveryOptions = {}
    ): Promise<Document | null> {
      const cacheKey = this.buildCacheKey(collection, slugOrId, options);
      
      // Check KV cache
      const cached = await kv.get(cacheKey, 'json');
      if (cached) {
        return cached as Document;
      }
      
      // Query database
      const isUuid = /^[0-9a-f-]{36}$/.test(slugOrId);
      const whereClause = isUuid ? 'id = ?' : 'slug = ?';
      
      const doc = await db.prepare(`
        SELECT 
          id, slug, title, 
          ${options.status === 'draft' ? 'content' : 'published_content'} as content,
          metadata, locale, published_at, updated_at
        FROM documents
        WHERE collection = ? AND ${whereClause}
          AND ${options.status === 'draft' ? '1=1' : "status = 'published'"}
          ${options.locale ? 'AND locale = ?' : ''}
      `).bind(
        collection,
        slugOrId,
        ...(options.locale ? [options.locale] : [])
      ).first();
      
      if (!doc) return null;
      
      const result = this.formatDocument(doc, options);
      
      // Cache in KV (5 minute TTL for published content)
      if (options.status !== 'draft') {
        await kv.put(cacheKey, JSON.stringify(result), {
          expirationTtl: 300,
        });
      }
      
      return result;
    },
    
    /**
     * List documents
     */
    async listDocuments(
      collection: string,
      options: DeliveryOptions & {
        page?: number;
        perPage?: number;
        sort?: string;
        filters?: Record<string, unknown>;
      } = {}
    ): Promise<{
      items: Document[];
      pagination: {
        page: number;
        perPage: number;
        total: number;
        totalPages: number;
      };
    }> {
      const {
        page = 1,
        perPage = 20,
        sort = 'published_at:desc',
        filters = {},
        locale,
        status = 'published',
      } = options;
      
      // Build query
      let where = `collection = ? AND status = ?`;
      const params: unknown[] = [collection, status];
      
      if (locale) {
        where += ` AND locale = ?`;
        params.push(locale);
      }
      
      // Apply filters
      for (const [field, value] of Object.entries(filters)) {
        if (field.startsWith('metadata.')) {
          // JSON path filter
          const path = field.replace('metadata.', '');
          where += ` AND json_extract(metadata, '$.${path}') = ?`;
          params.push(value);
        } else {
          where += ` AND ${field} = ?`;
          params.push(value);
        }
      }
      
      // Parse sort
      const [sortField, sortDir] = sort.split(':');
      const sortColumn = this.mapSortField(sortField);
      const sortDirection = sortDir === 'asc' ? 'ASC' : 'DESC';
      
      // Get total count
      const countResult = await db.prepare(`
        SELECT COUNT(*) as total FROM documents WHERE ${where}
      `).bind(...params).first();
      
      const total = countResult?.total as number || 0;
      
      // Get page
      const offset = (page - 1) * perPage;
      const { results } = await db.prepare(`
        SELECT id, slug, title, 
          ${status === 'draft' ? 'content' : 'published_content'} as content,
          metadata, locale, published_at, updated_at
        FROM documents
        WHERE ${where}
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT ? OFFSET ?
      `).bind(...params, perPage, offset).all();
      
      return {
        items: results.map(r => this.formatDocument(r, options)),
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage),
        },
      };
    },
    
    /**
     * Invalidate cache
     */
    async invalidateCache(collection: string, slug?: string): Promise<void> {
      if (slug) {
        // Invalidate specific document
        const keys = await kv.list({ prefix: `content:${collection}:${slug}:` });
        for (const key of keys.keys) {
          await kv.delete(key.name);
        }
      } else {
        // Invalidate entire collection
        const keys = await kv.list({ prefix: `content:${collection}:` });
        for (const key of keys.keys) {
          await kv.delete(key.name);
        }
      }
    },
    
    // Helpers
    
    buildCacheKey(
      collection: string,
      slugOrId: string,
      options: DeliveryOptions
    ): string {
      const parts = ['content', collection, slugOrId];
      if (options.locale) parts.push(`locale:${options.locale}`);
      if (options.fields) parts.push(`fields:${options.fields.sort().join(',')}`);
      return parts.join(':');
    },
    
    mapSortField(field: string): string {
      const map: Record<string, string> = {
        publishedAt: 'published_at',
        updatedAt: 'updated_at',
        createdAt: 'created_at',
        title: 'title',
      };
      return map[field] || 'published_at';
    },
    
    formatDocument(
      row: Record<string, unknown>,
      options: DeliveryOptions
    ): Document {
      const content = JSON.parse(row.content as string || '{}');
      const metadata = JSON.parse(row.metadata as string || '{}');
      
      let result: Document = {
        id: row.id as string,
        slug: row.slug as string,
        title: row.title as string,
        locale: row.locale as string,
        publishedAt: row.published_at as number,
        updatedAt: row.updated_at as number,
        ...content,
        _metadata: metadata,
      };
      
      // Field selection
      if (options.fields && options.fields.length > 0) {
        const filtered: Record<string, unknown> = {
          id: result.id,
          slug: result.slug,
        };
        for (const field of options.fields) {
          if (field in result) {
            filtered[field] = result[field as keyof Document];
          }
        }
        result = filtered as Document;
      }
      
      return result;
    },
  };
}
```

### REST Route Handlers

```typescript
// routes/api/v1/content/[collection]/+server.ts

export async function GET({ params, url, platform }) {
  const delivery = createDeliveryAPI(
    platform.env.DB,
    platform.env.CONTENT_CACHE,
    platform.env.MEDIA
  );
  
  const options = {
    locale: url.searchParams.get('locale') || undefined,
    page: parseInt(url.searchParams.get('page') || '1'),
    perPage: Math.min(parseInt(url.searchParams.get('perPage') || '20'), 100),
    sort: url.searchParams.get('sort') || 'publishedAt:desc',
    fields: url.searchParams.get('fields')?.split(','),
    filters: Object.fromEntries(
      [...url.searchParams.entries()]
        .filter(([k]) => k.startsWith('filter['))
        .map(([k, v]) => [k.slice(7, -1), v])
    ),
  };
  
  const result = await delivery.listDocuments(params.collection, options);
  
  return json(result, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}
```

```typescript
// routes/api/v1/content/[collection]/[slug]/+server.ts

export async function GET({ params, url, platform }) {
  const delivery = createDeliveryAPI(
    platform.env.DB,
    platform.env.CONTENT_CACHE,
    platform.env.MEDIA
  );
  
  const doc = await delivery.getDocument(params.collection, params.slug, {
    locale: url.searchParams.get('locale') || undefined,
    fields: url.searchParams.get('fields')?.split(','),
  });
  
  if (!doc) {
    throw error(404, 'Document not found');
  }
  
  return json(doc, {
    headers: {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'ETag': `"${doc.updatedAt}"`,
    },
  });
}
```

---

## GraphQL API

```typescript
// lib/server/graphql.ts

import { createYoga, createSchema } from 'graphql-yoga';

const typeDefs = `
  type Query {
    document(collection: String!, slug: String!, locale: String): Document
    documents(
      collection: String!
      locale: String
      page: Int
      perPage: Int
      sort: String
      filter: DocumentFilter
    ): DocumentConnection!
  }
  
  type Document {
    id: ID!
    slug: String!
    title: String!
    content: JSON!
    locale: String
    publishedAt: DateTime
    updatedAt: DateTime!
    metadata: JSON
  }
  
  type DocumentConnection {
    items: [Document!]!
    pagination: Pagination!
  }
  
  type Pagination {
    page: Int!
    perPage: Int!
    total: Int!
    totalPages: Int!
  }
  
  input DocumentFilter {
    tag: String
    author: String
    category: String
  }
  
  scalar JSON
  scalar DateTime
`;

const resolvers = {
  Query: {
    document: async (_, args, ctx) => {
      return ctx.delivery.getDocument(args.collection, args.slug, {
        locale: args.locale,
      });
    },
    
    documents: async (_, args, ctx) => {
      return ctx.delivery.listDocuments(args.collection, {
        locale: args.locale,
        page: args.page,
        perPage: args.perPage,
        sort: args.sort,
        filters: args.filter,
      });
    },
  },
};

export function createGraphQLHandler(delivery: DeliveryAPI) {
  const schema = createSchema({ typeDefs, resolvers });
  
  return createYoga({
    schema,
    context: () => ({ delivery }),
    graphiql: process.env.NODE_ENV !== 'production',
  });
}
```

### GraphQL Route

```typescript
// routes/api/graphql/+server.ts

import { createGraphQLHandler } from '$lib/server/graphql';

export async function GET({ request, platform }) {
  const delivery = createDeliveryAPI(platform.env.DB, platform.env.KV, platform.env.R2);
  const handler = createGraphQLHandler(delivery);
  return handler.fetch(request);
}

export async function POST({ request, platform }) {
  const delivery = createDeliveryAPI(platform.env.DB, platform.env.KV, platform.env.R2);
  const handler = createGraphQLHandler(delivery);
  return handler.fetch(request);
}
```

---

## JavaScript SDK

```typescript
// sdk/hanawa-client.ts

export interface HanawaClientConfig {
  baseUrl: string;
  apiKey?: string;
  locale?: string;
}

export function createHanawaClient(config: HanawaClientConfig) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }
  
  async function request<T>(path: string, options?: RequestInit): Promise<T> {
    const response = await fetch(`${config.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  }
  
  return {
    content: {
      /**
       * Get single document
       */
      async get<T = unknown>(
        collection: string,
        slug: string,
        options?: { locale?: string; fields?: string[] }
      ): Promise<T | null> {
        const params = new URLSearchParams();
        if (options?.locale || config.locale) {
          params.set('locale', options?.locale || config.locale!);
        }
        if (options?.fields) {
          params.set('fields', options.fields.join(','));
        }
        
        const query = params.toString() ? `?${params}` : '';
        
        try {
          return await request<T>(`/api/v1/content/${collection}/${slug}${query}`);
        } catch (e) {
          if ((e as Error).message.includes('404')) return null;
          throw e;
        }
      },
      
      /**
       * List documents
       */
      async list<T = unknown>(
        collection: string,
        options?: {
          locale?: string;
          page?: number;
          perPage?: number;
          sort?: string;
          filter?: Record<string, unknown>;
        }
      ): Promise<{
        items: T[];
        pagination: { page: number; perPage: number; total: number; totalPages: number };
      }> {
        const params = new URLSearchParams();
        
        if (options?.locale || config.locale) {
          params.set('locale', options?.locale || config.locale!);
        }
        if (options?.page) params.set('page', String(options.page));
        if (options?.perPage) params.set('perPage', String(options.perPage));
        if (options?.sort) params.set('sort', options.sort);
        
        if (options?.filter) {
          for (const [key, value] of Object.entries(options.filter)) {
            params.set(`filter[${key}]`, String(value));
          }
        }
        
        const query = params.toString() ? `?${params}` : '';
        
        return request(`/api/v1/content/${collection}${query}`);
      },
    },
    
    /**
     * GraphQL query
     */
    async graphql<T = unknown>(
      query: string,
      variables?: Record<string, unknown>
    ): Promise<T> {
      const result = await request<{ data: T; errors?: unknown[] }>('/api/graphql', {
        method: 'POST',
        body: JSON.stringify({ query, variables }),
      });
      
      if (result.errors?.length) {
        throw new Error(`GraphQL Error: ${JSON.stringify(result.errors)}`);
      }
      
      return result.data;
    },
  };
}

// Usage
const hanawa = createHanawaClient({
  baseUrl: 'https://cms.example.com',
  locale: 'en',
});

// REST
const post = await hanawa.content.get('posts', 'hello-world');
const posts = await hanawa.content.list('posts', { perPage: 10 });

// GraphQL
const data = await hanawa.graphql(`
  query GetPost($slug: String!) {
    document(collection: "posts", slug: $slug) {
      title
      content
    }
  }
`, { slug: 'hello-world' });
```

---

## Edge Caching

### Cache Invalidation on Publish

```typescript
// lib/server/cache-invalidation.ts

export function setupCacheInvalidation(workflow: WorkflowEngine, delivery: DeliveryAPI) {
  workflow.on('published', async (event) => {
    const { documentId, collection, slug } = event.data;
    
    // Invalidate KV cache
    await delivery.invalidateCache(collection, slug);
    
    // Purge Cloudflare cache
    await fetch(`https://api.cloudflare.com/client/v4/zones/${ZONE_ID}/purge_cache`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        files: [
          `https://cms.example.com/api/v1/content/${collection}/${slug}`,
          `https://cms.example.com/api/v1/content/${collection}`,
        ],
      }),
    });
  });
}
```

### Cache Headers

| Endpoint | Cache-Control | Rationale |
|----------|--------------|-----------|
| Single document | `public, max-age=60, stale-while-revalidate=300` | Fresh data with fallback |
| List | `public, max-age=60, stale-while-revalidate=300` | Same as single |
| Draft | `private, no-store` | Never cache drafts |
| Preview | `private, no-store` | Never cache previews |

---

## Authentication

### API Keys

```sql
CREATE TABLE api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  
  -- Permissions
  permissions TEXT NOT NULL,        -- JSON: ['read:content', 'read:media']
  collections TEXT,                 -- JSON: null = all
  
  -- Restrictions
  allowed_origins TEXT,             -- JSON array of CORS origins
  rate_limit INTEGER DEFAULT 1000,  -- Requests per minute
  
  -- Audit
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used_at INTEGER,
  
  enabled BOOLEAN DEFAULT TRUE
);
```

### Key Validation

```typescript
async function validateApiKey(key: string): Promise<{
  valid: boolean;
  permissions?: string[];
  collections?: string[];
}> {
  const prefix = key.slice(0, 8);
  
  const keyRecord = await db.prepare(`
    SELECT * FROM api_keys WHERE key_prefix = ? AND enabled = 1
  `).bind(prefix).first();
  
  if (!keyRecord) {
    return { valid: false };
  }
  
  const keyHash = await hashKey(key);
  if (keyHash !== keyRecord.key_hash) {
    return { valid: false };
  }
  
  // Update last used
  await db.prepare(`
    UPDATE api_keys SET last_used_at = ? WHERE id = ?
  `).bind(Date.now(), keyRecord.id).run();
  
  return {
    valid: true,
    permissions: JSON.parse(keyRecord.permissions as string),
    collections: keyRecord.collections ? JSON.parse(keyRecord.collections as string) : undefined,
  };
}
```

---

## Rate Limiting

```typescript
// lib/server/rate-limit.ts

export async function checkRateLimit(
  kv: KVNamespace,
  identifier: string,
  limit: number,
  windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number; reset: number }> {
  const key = `ratelimit:${identifier}`;
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - windowSeconds;
  
  // Get current count
  const data = await kv.get(key, 'json') as { count: number; start: number } | null;
  
  if (!data || data.start < windowStart) {
    // New window
    await kv.put(key, JSON.stringify({ count: 1, start: now }), {
      expirationTtl: windowSeconds * 2,
    });
    return { allowed: true, remaining: limit - 1, reset: now + windowSeconds };
  }
  
  if (data.count >= limit) {
    return { allowed: false, remaining: 0, reset: data.start + windowSeconds };
  }
  
  // Increment
  await kv.put(key, JSON.stringify({ count: data.count + 1, start: data.start }), {
    expirationTtl: windowSeconds * 2,
  });
  
  return {
    allowed: true,
    remaining: limit - data.count - 1,
    reset: data.start + windowSeconds,
  };
}
```

---

## Testing

```typescript
describe('Delivery API', () => {
  it('returns published document', async () => {
    const doc = await delivery.getDocument('posts', 'hello-world');
    expect(doc).toBeDefined();
    expect(doc.title).toBe('Hello World');
  });
  
  it('returns null for unpublished', async () => {
    const doc = await delivery.getDocument('posts', 'draft-post');
    expect(doc).toBeNull();
  });
  
  it('filters by locale', async () => {
    const docs = await delivery.listDocuments('posts', { locale: 'ja-JP' });
    expect(docs.items.every(d => d.locale === 'ja-JP')).toBe(true);
  });
  
  it('caches in KV', async () => {
    await delivery.getDocument('posts', 'hello-world');
    
    const cached = await kv.get('content:posts:hello-world:', 'json');
    expect(cached).toBeDefined();
  });
  
  it('invalidates cache on publish', async () => {
    await delivery.invalidateCache('posts', 'hello-world');
    
    const cached = await kv.get('content:posts:hello-world:', 'json');
    expect(cached).toBeNull();
  });
});
```

---

## SDK Distribution

```json
// package.json
{
  "name": "@hanawa/client",
  "version": "1.0.0",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  }
}
```

---

## Related Documents

- [09-codex-integration.md](./09-codex-integration.md) — Semantic search API
- [10-media-library.md](./10-media-library.md) — Media delivery
- [14-preview-deployments.md](./14-preview-deployments.md) — Preview API

---

*Document version: 1.0*

# Hanawa: Codex Integration Specification

Connecting Hanawa CMS to Codex knowledge base with vector embeddings for semantic search.

## Overview

Codex is eSolia's knowledge base. Hanawa content flows into Codex, becoming searchable and accessible via Miko (the friendly interface). This integration enables:

- **Semantic search**: Find content by meaning, not just keywords
- **RAG context**: Provide relevant context to AI assistants
- **Cross-referencing**: Link related documents automatically
- **Knowledge discovery**: Surface relevant content during editing

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTENT PIPELINE                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Hanawa                 Codex                 Miko              │
│  ──────                 ─────                 ────              │
│  ┌─────────┐           ┌─────────┐           ┌─────────┐       │
│  │ Create  │──publish─▶│ Embed   │◀──query──│  Chat   │       │
│  │ Content │           │ Store   │──results─▶│Interface│       │
│  └─────────┘           │ Search  │           └─────────┘       │
│                        └─────────┘                              │
│                             │                                   │
│                             ▼                                   │
│                        Vectorize DB                             │
│                        (embeddings)                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Architecture

### Vector Storage

Using Cloudflare Vectorize for embedding storage:

```
┌─────────────────────────────────────────────────────────────────┐
│  VECTORIZE ARCHITECTURE                                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Document                  Chunks                Vectors        │
│  ────────                  ──────                ───────        │
│  ┌─────────────┐          ┌──────────┐          ┌─────────┐   │
│  │ Long form   │──split──▶│ Chunk 1  │──embed──▶│ [0.1,..]│   │
│  │ content     │          │ Chunk 2  │──embed──▶│ [0.3,..]│   │
│  │ with        │          │ Chunk 3  │──embed──▶│ [0.2,..]│   │
│  │ sections    │          │ ...      │          │ ...     │   │
│  └─────────────┘          └──────────┘          └─────────┘   │
│                                                      │          │
│  Query: "access control"                             ▼          │
│  ──────────────────────                        Similarity       │
│       │                                        Search           │
│       │                                             │           │
│       └──embed──▶ [0.15,..]──────────────────▶ Top K results   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Data Model

```sql
-- Document chunks for vector search
CREATE TABLE document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  
  -- Content
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,      -- SHA-256 for dedup
  
  -- Metadata for filtering
  collection TEXT NOT NULL,
  locale TEXT DEFAULT 'en',
  status TEXT DEFAULT 'published',
  
  -- Context
  heading_path TEXT,               -- e.g., "Overview > Key Concepts"
  chunk_type TEXT DEFAULT 'content', -- 'title', 'heading', 'content', 'list'
  
  -- Vector reference
  vector_id TEXT,                  -- ID in Vectorize
  embedded_at INTEGER,
  
  -- Timestamps
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_chunks_document ON document_chunks(document_id);
CREATE INDEX idx_chunks_vector ON document_chunks(vector_id);
CREATE INDEX idx_chunks_hash ON document_chunks(content_hash);

-- Search index metadata
CREATE TABLE search_index_status (
  document_id TEXT PRIMARY KEY,
  last_indexed_at INTEGER,
  last_indexed_version INTEGER,
  chunk_count INTEGER,
  status TEXT DEFAULT 'pending',    -- 'pending', 'indexing', 'indexed', 'error'
  error_message TEXT,
  
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);
```

### TypeScript Types

```typescript
interface DocumentChunk {
  id: string;
  documentId: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  collection: string;
  locale: string;
  status: string;
  headingPath?: string;
  chunkType: 'title' | 'heading' | 'content' | 'list';
  vectorId?: string;
  embeddedAt?: number;
}

interface SearchResult {
  documentId: string;
  chunkId: string;
  content: string;
  score: number;
  metadata: {
    collection: string;
    title: string;
    headingPath?: string;
    locale: string;
  };
}

interface RAGContext {
  chunks: SearchResult[];
  totalTokens: number;
  query: string;
}
```

---

## API Design

### Codex Service

```typescript
// lib/server/codex.ts

import type { VectorizeIndex } from '@cloudflare/workers-types';

const CHUNK_SIZE = 500;        // Target chunk size in tokens
const CHUNK_OVERLAP = 50;      // Overlap between chunks
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

export function createCodexService(
  db: D1Database,
  vectorize: VectorizeIndex,
  ai: Ai
) {
  return {
    /**
     * Index a document for search
     */
    async indexDocument(documentId: string): Promise<void> {
      // Get document
      const doc = await db.prepare(`
        SELECT id, title, content, collection, status
        FROM documents WHERE id = ?
      `).bind(documentId).first();
      
      if (!doc) throw new Error('Document not found');
      if (doc.status !== 'published') {
        // Remove from index if unpublished
        await this.removeDocument(documentId);
        return;
      }
      
      // Update status
      await db.prepare(`
        INSERT INTO search_index_status (document_id, status, last_indexed_at)
        VALUES (?, 'indexing', ?)
        ON CONFLICT(document_id) DO UPDATE SET
          status = 'indexing',
          last_indexed_at = excluded.last_indexed_at
      `).bind(documentId, Date.now()).run();
      
      try {
        // Split into chunks
        const chunks = this.splitIntoChunks(
          doc.title as string,
          doc.content as string
        );
        
        // Get existing chunks for dedup
        const { results: existing } = await db.prepare(`
          SELECT content_hash, id FROM document_chunks WHERE document_id = ?
        `).bind(documentId).all();
        
        const existingHashes = new Map(
          existing.map(r => [r.content_hash, r.id])
        );
        
        // Process each chunk
        const newChunks: DocumentChunk[] = [];
        const vectorsToInsert: { id: string; values: number[]; metadata: object }[] = [];
        
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const hash = await this.hashContent(chunk.content);
          
          // Skip if unchanged
          if (existingHashes.has(hash)) {
            existingHashes.delete(hash);
            continue;
          }
          
          const chunkId = crypto.randomUUID();
          
          // Generate embedding
          const embedding = await this.generateEmbedding(chunk.content);
          
          newChunks.push({
            id: chunkId,
            documentId,
            chunkIndex: i,
            content: chunk.content,
            contentHash: hash,
            collection: doc.collection as string,
            locale: 'en',
            status: 'published',
            headingPath: chunk.headingPath,
            chunkType: chunk.type,
            vectorId: chunkId,
            embeddedAt: Date.now(),
          });
          
          vectorsToInsert.push({
            id: chunkId,
            values: embedding,
            metadata: {
              documentId,
              collection: doc.collection,
              title: doc.title,
              headingPath: chunk.headingPath,
              chunkType: chunk.type,
            },
          });
        }
        
        // Delete removed chunks
        for (const [_, chunkId] of existingHashes) {
          await db.prepare(`DELETE FROM document_chunks WHERE id = ?`).bind(chunkId).run();
          await vectorize.deleteByIds([chunkId as string]);
        }
        
        // Insert new chunks
        for (const chunk of newChunks) {
          await db.prepare(`
            INSERT INTO document_chunks (
              id, document_id, chunk_index, content, content_hash,
              collection, locale, status, heading_path, chunk_type,
              vector_id, embedded_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            chunk.id, chunk.documentId, chunk.chunkIndex,
            chunk.content, chunk.contentHash, chunk.collection,
            chunk.locale, chunk.status, chunk.headingPath,
            chunk.chunkType, chunk.vectorId, chunk.embeddedAt,
            Date.now(), Date.now()
          ).run();
        }
        
        // Batch insert vectors
        if (vectorsToInsert.length > 0) {
          await vectorize.insert(vectorsToInsert);
        }
        
        // Update status
        await db.prepare(`
          UPDATE search_index_status
          SET status = 'indexed', chunk_count = ?, error_message = NULL
          WHERE document_id = ?
        `).bind(newChunks.length + (existing.length - existingHashes.size), documentId).run();
        
      } catch (error) {
        await db.prepare(`
          UPDATE search_index_status
          SET status = 'error', error_message = ?
          WHERE document_id = ?
        `).bind(error instanceof Error ? error.message : 'Unknown error', documentId).run();
        
        throw error;
      }
    },
    
    /**
     * Remove document from index
     */
    async removeDocument(documentId: string): Promise<void> {
      // Get chunk IDs
      const { results } = await db.prepare(`
        SELECT vector_id FROM document_chunks WHERE document_id = ?
      `).bind(documentId).all();
      
      const vectorIds = results.map(r => r.vector_id as string).filter(Boolean);
      
      // Delete from Vectorize
      if (vectorIds.length > 0) {
        await vectorize.deleteByIds(vectorIds);
      }
      
      // Delete from DB
      await db.prepare(`DELETE FROM document_chunks WHERE document_id = ?`).bind(documentId).run();
      await db.prepare(`DELETE FROM search_index_status WHERE document_id = ?`).bind(documentId).run();
    },
    
    /**
     * Search for similar content
     */
    async search(
      query: string,
      options: {
        topK?: number;
        collection?: string;
        locale?: string;
        minScore?: number;
      } = {}
    ): Promise<SearchResult[]> {
      const { topK = 10, collection, locale, minScore = 0.7 } = options;
      
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Build filter
      const filter: Record<string, string> = {};
      if (collection) filter.collection = collection;
      if (locale) filter.locale = locale;
      
      // Search Vectorize
      const results = await vectorize.query(queryEmbedding, {
        topK,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        returnMetadata: true,
      });
      
      // Filter by score and enrich
      const enrichedResults: SearchResult[] = [];
      
      for (const match of results.matches) {
        if (match.score < minScore) continue;
        
        // Get chunk content
        const chunk = await db.prepare(`
          SELECT content, heading_path FROM document_chunks WHERE vector_id = ?
        `).bind(match.id).first();
        
        if (!chunk) continue;
        
        enrichedResults.push({
          documentId: match.metadata?.documentId as string,
          chunkId: match.id,
          content: chunk.content as string,
          score: match.score,
          metadata: {
            collection: match.metadata?.collection as string,
            title: match.metadata?.title as string,
            headingPath: chunk.heading_path as string,
            locale: locale || 'en',
          },
        });
      }
      
      return enrichedResults;
    },
    
    /**
     * Get RAG context for AI
     */
    async getRAGContext(
      query: string,
      options: {
        maxTokens?: number;
        collection?: string;
      } = {}
    ): Promise<RAGContext> {
      const { maxTokens = 4000, collection } = options;
      
      const results = await this.search(query, {
        topK: 20,
        collection,
        minScore: 0.6,
      });
      
      // Select chunks up to token limit
      const selectedChunks: SearchResult[] = [];
      let totalTokens = 0;
      
      for (const result of results) {
        const chunkTokens = this.estimateTokens(result.content);
        
        if (totalTokens + chunkTokens > maxTokens) break;
        
        selectedChunks.push(result);
        totalTokens += chunkTokens;
      }
      
      return {
        chunks: selectedChunks,
        totalTokens,
        query,
      };
    },
    
    /**
     * Find related documents
     */
    async findRelated(
      documentId: string,
      options: { topK?: number } = {}
    ): Promise<{ documentId: string; title: string; score: number }[]> {
      const { topK = 5 } = options;
      
      // Get document's chunks
      const { results: chunks } = await db.prepare(`
        SELECT vector_id FROM document_chunks
        WHERE document_id = ? AND vector_id IS NOT NULL
        LIMIT 3
      `).bind(documentId).all();
      
      if (chunks.length === 0) return [];
      
      // Use first chunk for similarity
      const vectorId = chunks[0].vector_id as string;
      
      // Get the vector
      const vectors = await vectorize.getByIds([vectorId]);
      if (vectors.length === 0) return [];
      
      // Search for similar
      const results = await vectorize.query(vectors[0].values, {
        topK: topK + 10, // Get extra to filter out same document
        returnMetadata: true,
      });
      
      // Filter and deduplicate
      const seen = new Set<string>([documentId]);
      const related: { documentId: string; title: string; score: number }[] = [];
      
      for (const match of results.matches) {
        const docId = match.metadata?.documentId as string;
        
        if (!docId || seen.has(docId)) continue;
        seen.add(docId);
        
        related.push({
          documentId: docId,
          title: match.metadata?.title as string,
          score: match.score,
        });
        
        if (related.length >= topK) break;
      }
      
      return related;
    },
    
    // Helper methods
    
    splitIntoChunks(
      title: string,
      content: string
    ): { content: string; headingPath?: string; type: 'title' | 'heading' | 'content' }[] {
      const chunks: { content: string; headingPath?: string; type: 'title' | 'heading' | 'content' }[] = [];
      
      // Add title as first chunk
      chunks.push({ content: title, type: 'title' });
      
      // Parse HTML/markdown and split
      const sections = this.parseIntoSections(content);
      
      for (const section of sections) {
        if (section.content.length <= CHUNK_SIZE * 4) {
          // Small enough to be one chunk
          chunks.push({
            content: section.content,
            headingPath: section.headingPath,
            type: 'content',
          });
        } else {
          // Split into smaller chunks with overlap
          const subChunks = this.splitLongContent(section.content, CHUNK_SIZE, CHUNK_OVERLAP);
          for (const subChunk of subChunks) {
            chunks.push({
              content: subChunk,
              headingPath: section.headingPath,
              type: 'content',
            });
          }
        }
      }
      
      return chunks;
    },
    
    parseIntoSections(content: string): { content: string; headingPath: string }[] {
      // Simplified parsing - real implementation would use HTML parser
      const sections: { content: string; headingPath: string }[] = [];
      const lines = content.split('\n');
      
      let currentSection = '';
      let currentPath = '';
      
      for (const line of lines) {
        const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
        
        if (headingMatch) {
          if (currentSection.trim()) {
            sections.push({ content: currentSection.trim(), headingPath: currentPath });
          }
          currentPath = headingMatch[2];
          currentSection = line + '\n';
        } else {
          currentSection += line + '\n';
        }
      }
      
      if (currentSection.trim()) {
        sections.push({ content: currentSection.trim(), headingPath: currentPath });
      }
      
      return sections;
    },
    
    splitLongContent(content: string, targetSize: number, overlap: number): string[] {
      const words = content.split(/\s+/);
      const chunks: string[] = [];
      
      let start = 0;
      while (start < words.length) {
        const end = Math.min(start + targetSize, words.length);
        chunks.push(words.slice(start, end).join(' '));
        start = end - overlap;
      }
      
      return chunks;
    },
    
    async generateEmbedding(text: string): Promise<number[]> {
      const response = await ai.run(EMBEDDING_MODEL, {
        text: [text],
      });
      
      return response.data[0];
    },
    
    async hashContent(content: string): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(content);
      const hashBuffer = await crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    },
    
    estimateTokens(text: string): number {
      // Rough estimate: ~4 chars per token
      return Math.ceil(text.length / 4);
    },
  };
}
```

---

## Integration Points

### Auto-Index on Publish

```typescript
// In workflow service, after publishing
if (newStage.type === 'published') {
  // Queue for indexing
  ctx.waitUntil(
    codex.indexDocument(documentId)
  );
}
```

### Related Documents Widget

Show related content in editor sidebar:

```svelte
<!-- lib/components/codex/RelatedDocuments.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { FileText, ExternalLink } from 'lucide-svelte';
  
  interface Props {
    documentId: string;
  }
  
  let { documentId }: Props = $props();
  
  let related = $state<{ documentId: string; title: string; score: number }[]>([]);
  let loading = $state(true);
  
  onMount(async () => {
    const response = await fetch(`/api/codex/related/${documentId}`);
    related = await response.json();
    loading = false;
  });
</script>

<div class="related-documents">
  <h4>Related Documents</h4>
  
  {#if loading}
    <p class="loading">Finding related content...</p>
  {:else if related.length === 0}
    <p class="empty">No related documents found</p>
  {:else}
    <ul>
      {#each related as doc}
        <li>
          <a href="/admin/documents/{doc.documentId}">
            <FileText class="w-4 h-4" />
            <span>{doc.title}</span>
            <span class="score">{Math.round(doc.score * 100)}%</span>
          </a>
        </li>
      {/each}
    </ul>
  {/if}
</div>
```

### Search Component

```svelte
<!-- lib/components/codex/SemanticSearch.svelte -->
<script lang="ts">
  import { Search, FileText, ArrowRight } from 'lucide-svelte';
  import { debounce } from '$lib/utils';
  
  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let searching = $state(false);
  
  const search = debounce(async (q: string) => {
    if (q.length < 3) {
      results = [];
      return;
    }
    
    searching = true;
    const response = await fetch(`/api/codex/search?q=${encodeURIComponent(q)}`);
    results = await response.json();
    searching = false;
  }, 300);
  
  $effect(() => {
    search(query);
  });
</script>

<div class="semantic-search">
  <div class="search-input">
    <Search class="w-4 h-4" />
    <input
      type="text"
      bind:value={query}
      placeholder="Search knowledge base..."
    />
  </div>
  
  {#if results.length > 0}
    <div class="search-results">
      {#each results as result}
        <a href="/admin/documents/{result.documentId}" class="result-item">
          <div class="result-header">
            <FileText class="w-4 h-4" />
            <span class="title">{result.metadata.title}</span>
            <span class="score">{Math.round(result.score * 100)}%</span>
          </div>
          <p class="excerpt">{result.content.slice(0, 150)}...</p>
          {#if result.metadata.headingPath}
            <span class="path">{result.metadata.headingPath}</span>
          {/if}
        </a>
      {/each}
    </div>
  {/if}
</div>
```

### RAG-Enhanced AI Assistant

Provide context from Codex to the AI assistant:

```typescript
// In AI service
async generateWithContext(
  request: AIRequest,
  contextQuery?: string
): Promise<AIResponse> {
  let systemPrompt = buildSystemPrompt(request);
  
  // Add RAG context if available
  if (contextQuery) {
    const ragContext = await codex.getRAGContext(contextQuery, {
      maxTokens: 2000,
      collection: request.documentType,
    });
    
    if (ragContext.chunks.length > 0) {
      systemPrompt += `\n\nRelevant context from the knowledge base:\n`;
      
      for (const chunk of ragContext.chunks) {
        systemPrompt += `\n---\nFrom "${chunk.metadata.title}":\n${chunk.content}\n`;
      }
    }
  }
  
  return this.generate({ ...request, systemPrompt });
}
```

---

## Wrangler Configuration

```toml
# wrangler.toml

[[vectorize]]
binding = "VECTORIZE"
index_name = "codex-index"

[ai]
binding = "AI"
```

### Create Vectorize Index

```bash
wrangler vectorize create codex-index --dimensions=768 --metric=cosine
```

---

## Sync Strategies

### Real-time (on publish)

```typescript
// Trigger indexing when document is published
workflowService.on('published', async (documentId) => {
  await codex.indexDocument(documentId);
});
```

### Batch (cron)

```typescript
// Cron to catch any missed documents
export default {
  async scheduled(controller, env, ctx) {
    const { results } = await env.DB.prepare(`
      SELECT d.id
      FROM documents d
      LEFT JOIN search_index_status s ON d.id = s.document_id
      WHERE d.status = 'published'
        AND (s.document_id IS NULL OR s.status = 'error')
      LIMIT 50
    `).all();
    
    for (const doc of results) {
      await codex.indexDocument(doc.id);
    }
  },
};
```

---

## Testing Strategy

```typescript
describe('CodexService', () => {
  it('indexes document into chunks', async () => {
    await codex.indexDocument(docId);
    
    const { results } = await db.prepare(
      `SELECT COUNT(*) as count FROM document_chunks WHERE document_id = ?`
    ).bind(docId).first();
    
    expect(results.count).toBeGreaterThan(0);
  });
  
  it('finds similar documents', async () => {
    await codex.indexDocument(doc1Id);
    await codex.indexDocument(doc2Id);
    
    const results = await codex.search('access control policies');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0.7);
  });
  
  it('provides RAG context within token limit', async () => {
    const context = await codex.getRAGContext('security requirements', {
      maxTokens: 1000,
    });
    
    expect(context.totalTokens).toBeLessThanOrEqual(1000);
    expect(context.chunks.length).toBeGreaterThan(0);
  });
  
  it('removes document from index on unpublish', async () => {
    await codex.indexDocument(docId);
    
    // Unpublish
    await db.prepare(`UPDATE documents SET status = 'draft' WHERE id = ?`).bind(docId).run();
    await codex.removeDocument(docId);
    
    const { results } = await db.prepare(
      `SELECT COUNT(*) as count FROM document_chunks WHERE document_id = ?`
    ).bind(docId).first();
    
    expect(results.count).toBe(0);
  });
});
```

---

## Related Documents

- [08-ai-assistant.md](./08-ai-assistant.md) — Uses RAG context
- [hanawa-cms.md](../hanawa-cms.md) — CMS overview
- [01-audit-system.md](./01-audit-system.md) — Index operations audited

---

*Document version: 1.0*

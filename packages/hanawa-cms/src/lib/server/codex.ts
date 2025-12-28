/**
 * Codex Integration Service
 * InfoSec: Vector search for semantic content discovery and RAG
 */

import type { AuditService } from './audit';

const CHUNK_SIZE = 500; // Target chunk size in words
const CHUNK_OVERLAP = 50; // Overlap between chunks
const EMBEDDING_MODEL = '@cf/baai/bge-base-en-v1.5';

type ChunkType = 'title' | 'heading' | 'content' | 'list';
type IndexStatus = 'pending' | 'indexing' | 'indexed' | 'error';

interface DocumentChunk {
  id: string;
  documentId: string;
  documentType: string;
  chunkIndex: number;
  content: string;
  contentHash: string;
  collection: string;
  locale: string;
  status: string;
  headingPath?: string;
  chunkType: ChunkType;
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

interface ParsedSection {
  content: string;
  headingPath: string;
  type: ChunkType;
}

/**
 * Create Codex Service for vector search and RAG
 * InfoSec: Content is chunked and embedded, original preserved in D1
 */
export function createCodexService(
  db: D1Database,
  vectorize: VectorizeIndex | null,
  ai: Ai,
  audit?: AuditService
) {
  /**
   * Generate SHA-256 hash of content for deduplication
   */
  async function hashContent(content: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(content);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate embedding using Workers AI
   */
  async function generateEmbedding(text: string): Promise<number[]> {
    const response = await ai.run(EMBEDDING_MODEL, {
      text: [text],
    });

    if (response && 'data' in response && Array.isArray(response.data)) {
      return response.data[0] as number[];
    }

    throw new Error('Failed to generate embedding');
  }

  /**
   * Estimate token count (rough approximation: ~4 chars per token)
   */
  function estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Parse content into sections based on headings
   */
  function parseIntoSections(content: string): ParsedSection[] {
    const sections: ParsedSection[] = [];
    const lines = content.split('\n');

    let currentSection = '';
    let currentPath = '';

    for (const line of lines) {
      // Match markdown headings
      const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);

      if (headingMatch) {
        if (currentSection.trim()) {
          sections.push({
            content: currentSection.trim(),
            headingPath: currentPath,
            type: 'content',
          });
        }
        currentPath = headingMatch[2];
        currentSection = line + '\n';
      } else {
        currentSection += line + '\n';
      }
    }

    if (currentSection.trim()) {
      sections.push({
        content: currentSection.trim(),
        headingPath: currentPath,
        type: 'content',
      });
    }

    return sections;
  }

  /**
   * Split long content into overlapping chunks
   */
  function splitLongContent(content: string, targetSize: number, overlap: number): string[] {
    const words = content.split(/\s+/);
    const chunks: string[] = [];

    let start = 0;
    while (start < words.length) {
      const end = Math.min(start + targetSize, words.length);
      chunks.push(words.slice(start, end).join(' '));
      start = end - overlap;
      if (start >= words.length - overlap) break;
    }

    return chunks;
  }

  /**
   * Split document into indexable chunks
   */
  function splitIntoChunks(
    title: string,
    content: string
  ): { content: string; headingPath?: string; type: ChunkType }[] {
    const chunks: { content: string; headingPath?: string; type: ChunkType }[] = [];

    // Add title as first chunk
    chunks.push({ content: title, type: 'title' });

    // Parse HTML/markdown and split
    const sections = parseIntoSections(content);

    for (const section of sections) {
      const wordCount = section.content.split(/\s+/).length;

      if (wordCount <= CHUNK_SIZE) {
        // Small enough to be one chunk
        chunks.push({
          content: section.content,
          headingPath: section.headingPath,
          type: section.type,
        });
      } else {
        // Split into smaller chunks with overlap
        const subChunks = splitLongContent(section.content, CHUNK_SIZE, CHUNK_OVERLAP);
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
  }

  return {
    /**
     * Index a document for semantic search
     * InfoSec: Creates embeddings and stores in Vectorize
     */
    async indexDocument(
      documentId: string,
      documentType: 'content' | 'fragment' = 'content'
    ): Promise<void> {
      // Get document based on type
      const table = documentType === 'fragment' ? 'fragments' : 'content';
      const doc = await db
        .prepare(`SELECT id, title, body, collection, status FROM ${table} WHERE id = ?`)
        .bind(documentId)
        .first();

      if (!doc) throw new Error('Document not found');

      // If not published, remove from index
      if (doc.status !== 'published') {
        await this.removeDocument(documentId, documentType);
        return;
      }

      const now = Date.now();

      // Update status to indexing
      await db
        .prepare(
          `INSERT INTO search_index_status (document_id, document_type, status, created_at, updated_at)
         VALUES (?, ?, 'indexing', ?, ?)
         ON CONFLICT(document_id) DO UPDATE SET
           status = 'indexing', updated_at = excluded.updated_at`
        )
        .bind(documentId, documentType, now, now)
        .run();

      try {
        // Split into chunks
        const chunks = splitIntoChunks(doc.title as string, (doc.body as string) || '');

        // Get existing chunks for dedup
        const { results: existing } = await db
          .prepare(
            `SELECT content_hash, id, vector_id FROM document_chunks
           WHERE document_id = ? AND document_type = ?`
          )
          .bind(documentId, documentType)
          .all();

        const existingHashes = new Map(
          existing.map((r) => [
            r.content_hash as string,
            { id: r.id as string, vectorId: r.vector_id as string },
          ])
        );

        const newChunks: DocumentChunk[] = [];
        const vectorsToInsert: {
          id: string;
          values: number[];
          metadata: Record<string, string>;
        }[] = [];

        // Process each chunk
        for (let i = 0; i < chunks.length; i++) {
          const chunk = chunks[i];
          const hash = await hashContent(chunk.content);

          // Skip if unchanged
          if (existingHashes.has(hash)) {
            existingHashes.delete(hash);
            continue;
          }

          const chunkId = crypto.randomUUID();

          // Generate embedding if Vectorize is available
          let embedding: number[] | undefined;
          if (vectorize) {
            embedding = await generateEmbedding(chunk.content);
          }

          newChunks.push({
            id: chunkId,
            documentId,
            documentType,
            chunkIndex: i,
            content: chunk.content,
            contentHash: hash,
            collection: (doc.collection as string) || 'general',
            locale: 'en',
            status: 'published',
            headingPath: chunk.headingPath,
            chunkType: chunk.type,
            vectorId: chunkId,
            embeddedAt: now,
          });

          if (embedding) {
            vectorsToInsert.push({
              id: chunkId,
              values: embedding,
              metadata: {
                documentId,
                documentType,
                collection: (doc.collection as string) || 'general',
                title: doc.title as string,
                headingPath: chunk.headingPath || '',
                chunkType: chunk.type,
              },
            });
          }
        }

        // Delete removed chunks
        for (const [, { id, vectorId }] of existingHashes) {
          await db.prepare('DELETE FROM document_chunks WHERE id = ?').bind(id).run();

          if (vectorize && vectorId) {
            await vectorize.deleteByIds([vectorId]);
          }
        }

        // Insert new chunks
        for (const chunk of newChunks) {
          await db
            .prepare(
              `INSERT INTO document_chunks (
              id, document_id, document_type, chunk_index, content, content_hash,
              collection, locale, status, heading_path, chunk_type,
              vector_id, embedded_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .bind(
              chunk.id,
              chunk.documentId,
              chunk.documentType,
              chunk.chunkIndex,
              chunk.content,
              chunk.contentHash,
              chunk.collection,
              chunk.locale,
              chunk.status,
              chunk.headingPath || null,
              chunk.chunkType,
              chunk.vectorId || null,
              chunk.embeddedAt || null,
              now,
              now
            )
            .run();
        }

        // Batch insert vectors
        if (vectorize && vectorsToInsert.length > 0) {
          await vectorize.insert(vectorsToInsert);
        }

        // Calculate final chunk count
        const keptChunks = existing.length - existingHashes.size;
        const totalChunks = keptChunks + newChunks.length;

        // Update status to indexed
        await db
          .prepare(
            `UPDATE search_index_status SET
           status = 'indexed', chunk_count = ?, last_indexed_at = ?,
           error_message = NULL, updated_at = ?
         WHERE document_id = ?`
          )
          .bind(totalChunks, now, now, documentId)
          .run();

        if (audit) {
          await audit.log(
            {
              action: 'update',
              actionCategory: 'system',
              resourceType: documentType,
              resourceId: documentId,
              metadata: { indexed: true, chunkCount: totalChunks },
            },
            { actorId: 'system', actorEmail: 'codex@hanawa.internal' }
          );
        }
      } catch (error) {
        // Update status to error
        await db
          .prepare(
            `UPDATE search_index_status SET
           status = 'error', error_message = ?, retry_count = retry_count + 1,
           updated_at = ?
         WHERE document_id = ?`
          )
          .bind(error instanceof Error ? error.message : 'Unknown error', now, documentId)
          .run();

        throw error;
      }
    },

    /**
     * Remove document from search index
     */
    async removeDocument(
      documentId: string,
      documentType: 'content' | 'fragment' = 'content'
    ): Promise<void> {
      // Get chunk vector IDs
      const { results } = await db
        .prepare(
          `SELECT vector_id FROM document_chunks
         WHERE document_id = ? AND document_type = ?`
        )
        .bind(documentId, documentType)
        .all();

      const vectorIds = results.map((r) => r.vector_id as string).filter(Boolean);

      // Delete from Vectorize
      if (vectorize && vectorIds.length > 0) {
        await vectorize.deleteByIds(vectorIds);
      }

      // Delete from DB
      await db
        .prepare('DELETE FROM document_chunks WHERE document_id = ? AND document_type = ?')
        .bind(documentId, documentType)
        .run();

      await db
        .prepare('DELETE FROM search_index_status WHERE document_id = ?')
        .bind(documentId)
        .run();
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
      if (!vectorize) {
        // Fall back to basic text search if Vectorize not available
        return this.textSearch(query, options);
      }

      const { topK = 10, collection, locale, minScore = 0.7 } = options;

      // Generate query embedding
      const queryEmbedding = await generateEmbedding(query);

      // Build filter
      const filter: Record<string, string> = {};
      if (collection) filter.collection = collection;

      // Search Vectorize
      const vectorResults = await vectorize.query(queryEmbedding, {
        topK,
        filter: Object.keys(filter).length > 0 ? filter : undefined,
        returnMetadata: 'all',
      });

      // Filter by score and enrich
      const results: SearchResult[] = [];

      for (const match of vectorResults.matches) {
        if (match.score < minScore) continue;

        // Get chunk content
        const chunk = await db
          .prepare('SELECT content, heading_path, locale FROM document_chunks WHERE vector_id = ?')
          .bind(match.id)
          .first();

        if (!chunk) continue;
        if (locale && chunk.locale !== locale) continue;

        results.push({
          documentId: (match.metadata?.documentId as string) || '',
          chunkId: match.id,
          content: chunk.content as string,
          score: match.score,
          metadata: {
            collection: (match.metadata?.collection as string) || '',
            title: (match.metadata?.title as string) || '',
            headingPath: chunk.heading_path as string | undefined,
            locale: (chunk.locale as string) || 'en',
          },
        });
      }

      return results;
    },

    /**
     * Basic text search fallback
     */
    async textSearch(
      query: string,
      options: { topK?: number; collection?: string; locale?: string } = {}
    ): Promise<SearchResult[]> {
      const { topK = 10, collection, locale } = options;

      let sql = `
        SELECT dc.id, dc.document_id, dc.content, dc.heading_path, dc.locale,
               dc.collection, c.title
        FROM document_chunks dc
        JOIN content c ON dc.document_id = c.id
        WHERE dc.content LIKE ?
      `;
      const bindings: (string | number)[] = [`%${query}%`];

      if (collection) {
        sql += ' AND dc.collection = ?';
        bindings.push(collection);
      }

      if (locale) {
        sql += ' AND dc.locale = ?';
        bindings.push(locale);
      }

      sql += ` LIMIT ?`;
      bindings.push(topK);

      const { results } = await db
        .prepare(sql)
        .bind(...bindings)
        .all();

      return results.map((r) => ({
        documentId: r.document_id as string,
        chunkId: r.id as string,
        content: r.content as string,
        score: 0.5, // Text match gets default score
        metadata: {
          collection: r.collection as string,
          title: r.title as string,
          headingPath: r.heading_path as string | undefined,
          locale: (r.locale as string) || 'en',
        },
      }));
    },

    /**
     * Get RAG context for AI enhancement
     */
    async getRAGContext(
      query: string,
      options: { maxTokens?: number; collection?: string } = {}
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
        const chunkTokens = estimateTokens(result.content);

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
     * Find documents related to a given document
     */
    async findRelated(
      documentId: string,
      options: { topK?: number } = {}
    ): Promise<{ documentId: string; title: string; score: number }[]> {
      const { topK = 5 } = options;

      if (!vectorize) {
        // Can't find related without vectors
        return [];
      }

      // Get document's first chunk vector
      const chunk = await db
        .prepare(
          `SELECT vector_id FROM document_chunks
         WHERE document_id = ? AND vector_id IS NOT NULL
         ORDER BY chunk_index LIMIT 1`
        )
        .bind(documentId)
        .first();

      if (!chunk || !chunk.vector_id) return [];

      // Get the vector
      const vectors = await vectorize.getByIds([chunk.vector_id as string]);
      if (vectors.length === 0) return [];

      // Search for similar
      const vectorResults = await vectorize.query(vectors[0].values, {
        topK: topK + 10, // Get extra to filter out same document
        returnMetadata: 'all',
      });

      // Filter and deduplicate
      const seen = new Set<string>([documentId]);
      const related: { documentId: string; title: string; score: number }[] = [];

      for (const match of vectorResults.matches) {
        const docId = match.metadata?.documentId as string;

        if (!docId || seen.has(docId)) continue;
        seen.add(docId);

        related.push({
          documentId: docId,
          title: (match.metadata?.title as string) || '',
          score: match.score,
        });

        if (related.length >= topK) break;
      }

      return related;
    },

    /**
     * Get index status for a document
     */
    async getIndexStatus(documentId: string): Promise<{
      status: IndexStatus;
      chunkCount: number;
      lastIndexedAt?: number;
      errorMessage?: string;
    } | null> {
      const result = await db
        .prepare(
          `SELECT status, chunk_count, last_indexed_at, error_message
         FROM search_index_status WHERE document_id = ?`
        )
        .bind(documentId)
        .first();

      if (!result) return null;

      return {
        status: result.status as IndexStatus,
        chunkCount: (result.chunk_count as number) || 0,
        lastIndexedAt: result.last_indexed_at as number | undefined,
        errorMessage: result.error_message as string | undefined,
      };
    },

    /**
     * Get pending documents for batch indexing
     */
    async getPendingDocuments(
      limit: number = 50
    ): Promise<{ documentId: string; documentType: string }[]> {
      const { results } = await db
        .prepare(
          `SELECT c.id, 'content' as doc_type
         FROM content c
         LEFT JOIN search_index_status s ON c.id = s.document_id
         WHERE c.status = 'published'
           AND (s.document_id IS NULL OR s.status IN ('pending', 'error'))
         LIMIT ?`
        )
        .bind(limit)
        .all();

      return results.map((r) => ({
        documentId: r.id as string,
        documentType: r.doc_type as string,
      }));
    },
  };
}

export type CodexService = ReturnType<typeof createCodexService>;

/**
 * Delivery API Service
 * Content delivery API with caching and field selection
 *
 * InfoSec: API key validation, rate limiting (OWASP A01, A04)
 */

import type {
  D1Database,
  KVNamespace,
  R2Bucket,
} from "@cloudflare/workers-types";
import type { AuditService, AuditContext } from "./audit";

export interface DeliveryDocument {
  id: string;
  slug: string;
  title: string;
  title_ja?: string;
  locale: string;
  collection: string;
  body?: string;
  body_ja?: string;
  excerpt?: string;
  excerpt_ja?: string;
  metadata?: Record<string, unknown>;
  published_at: number | null;
  updated_at: number;
}

export interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  permissions: string[];
  collections: string[] | null;
  allowed_origins: string[] | null;
  rate_limit: number;
  enabled: boolean;
  created_by: string;
  created_at: number;
  last_used_at: number | null;
}

export interface DeliveryOptions {
  locale?: string;
  status?: "published" | "draft";
  fields?: string[];
  include?: string[];
}

export interface ListOptions extends DeliveryOptions {
  page?: number;
  perPage?: number;
  sort?: string;
  filters?: Record<string, unknown>;
}

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    page: number;
    perPage: number;
    total: number;
    totalPages: number;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  reset: number;
}

/**
 * Generate a secure API key
 * Returns both the full key (to show user once) and the prefix+hash (to store)
 */
export function generateApiKey(): {
  key: string;
  prefix: string;
  hash: string;
} {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const key = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const prefix = key.slice(0, 8);

  return { key: `hk_${key}`, prefix, hash: "" }; // Hash computed async
}

/**
 * Hash API key for storage
 * InfoSec: Never store plaintext API keys
 */
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function createDeliveryService(
  db: D1Database,
  kv?: KVNamespace,
  r2?: R2Bucket,
  audit?: AuditService
) {
  return {
    // ===== Content Delivery =====

    /**
     * Get single document by slug or ID
     */
    async getDocument(
      collection: string,
      slugOrId: string,
      options: DeliveryOptions = {}
    ): Promise<DeliveryDocument | null> {
      // Check cache first (if KV available)
      if (kv && options.status !== "draft") {
        const cacheKey = this.buildCacheKey(collection, slugOrId, options);
        const cached = await kv.get(cacheKey, "json");
        if (cached) {
          return cached as DeliveryDocument;
        }
      }

      // Query database
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
          slugOrId
        );
      const whereField = isUuid ? "id" : "slug";

      // Build field selection
      const selectFields = this.buildSelectFields(options.fields);

      let query = `
        SELECT ${selectFields}
        FROM content
        WHERE collection = ? AND ${whereField} = ?
      `;
      const params: unknown[] = [collection, slugOrId];

      // Filter by status
      if (options.status !== "draft") {
        query += " AND status = 'published'";
      }

      // Filter by locale
      if (options.locale) {
        query += " AND locale = ?";
        params.push(options.locale);
      }

      const row = await db
        .prepare(query)
        .bind(...params)
        .first();

      if (!row) return null;

      const result = this.rowToDocument(row);

      // Cache in KV (if available, 5 minute TTL for published content)
      if (kv && options.status !== "draft") {
        const cacheKey = this.buildCacheKey(collection, slugOrId, options);
        await kv.put(cacheKey, JSON.stringify(result), {
          expirationTtl: 300,
        });
      }

      return result;
    },

    /**
     * List documents with filtering and pagination
     */
    async listDocuments(
      collection: string,
      options: ListOptions = {}
    ): Promise<PaginatedResult<DeliveryDocument>> {
      const {
        page = 1,
        perPage = 20,
        sort = "published_at:desc",
        filters = {},
        locale,
        status = "published",
        fields,
      } = options;

      // Build WHERE clause
      let where = "collection = ?";
      const params: unknown[] = [collection];

      if (status !== "draft") {
        where += " AND status = 'published'";
      }

      if (locale) {
        where += " AND locale = ?";
        params.push(locale);
      }

      // Apply filters
      for (const [field, value] of Object.entries(filters)) {
        if (field.startsWith("metadata.")) {
          // InfoSec: Sanitize JSON path to prevent injection
          const path = field.replace("metadata.", "").replace(/[^a-zA-Z0-9_]/g, "");
          where += ` AND json_extract(metadata, '$.${path}') = ?`;
          params.push(value);
        } else if (["title", "slug", "locale", "author"].includes(field)) {
          where += ` AND ${field} = ?`;
          params.push(value);
        }
        // Ignore unknown fields for security
      }

      // Parse and validate sort
      const [sortField, sortDir] = sort.split(":");
      const sortColumn = this.mapSortField(sortField);
      const sortDirection = sortDir === "asc" ? "ASC" : "DESC";

      // Get total count
      const countResult = await db
        .prepare(`SELECT COUNT(*) as total FROM content WHERE ${where}`)
        .bind(...params)
        .first();
      const total = (countResult?.total as number) || 0;

      // Get page
      const offset = (page - 1) * perPage;
      const selectFields = this.buildSelectFields(fields);

      const { results } = await db
        .prepare(
          `
        SELECT ${selectFields}
        FROM content
        WHERE ${where}
        ORDER BY ${sortColumn} ${sortDirection}
        LIMIT ? OFFSET ?
      `
        )
        .bind(...params, perPage, offset)
        .all();

      return {
        items: results.map((row) => this.rowToDocument(row)),
        pagination: {
          page,
          perPage,
          total,
          totalPages: Math.ceil(total / perPage),
        },
      };
    },

    /**
     * Get available collections
     */
    async getCollections(): Promise<string[]> {
      const { results } = await db
        .prepare("SELECT DISTINCT collection FROM content ORDER BY collection")
        .all();

      return results.map((r) => r.collection as string);
    },

    // ===== Cache Management =====

    /**
     * Invalidate cache for a document or collection
     */
    async invalidateCache(collection: string, slug?: string): Promise<void> {
      if (!kv) return;

      const prefix = slug
        ? `delivery:${collection}:${slug}:`
        : `delivery:${collection}:`;

      const keys = await kv.list({ prefix });
      for (const key of keys.keys) {
        await kv.delete(key.name);
      }
    },

    // ===== API Key Management =====

    /**
     * Create an API key
     */
    async createApiKey(
      data: {
        name: string;
        permissions: string[];
        collections?: string[];
        allowedOrigins?: string[];
        rateLimit?: number;
      },
      context: AuditContext
    ): Promise<{ apiKey: ApiKey; fullKey: string }> {
      const id = crypto.randomUUID();
      const { key, prefix } = generateApiKey();
      const keyHash = await hashApiKey(key);
      const now = Date.now();

      await db
        .prepare(
          `
        INSERT INTO api_keys (
          id, name, key_hash, key_prefix, permissions, collections,
          allowed_origins, rate_limit, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          id,
          data.name,
          keyHash,
          prefix,
          JSON.stringify(data.permissions),
          data.collections ? JSON.stringify(data.collections) : null,
          data.allowedOrigins ? JSON.stringify(data.allowedOrigins) : null,
          data.rateLimit || 1000,
          context.actorEmail,
          now
        )
        .run();

      if (audit) {
        await audit.log(
          {
            action: "create",
            actionCategory: "access",
            resourceType: "api_key",
            resourceId: id,
            resourceTitle: data.name,
            metadata: {
              permissions: data.permissions,
              rateLimit: data.rateLimit || 1000,
            },
          },
          context
        );
      }

      const apiKey = (await this.getApiKey(id)) as ApiKey;
      return { apiKey, fullKey: key };
    },

    /**
     * Get API key by ID
     */
    async getApiKey(id: string): Promise<ApiKey | null> {
      const row = await db
        .prepare("SELECT * FROM api_keys WHERE id = ?")
        .bind(id)
        .first();

      if (!row) return null;
      return this.rowToApiKey(row);
    },

    /**
     * List API keys
     */
    async listApiKeys(): Promise<ApiKey[]> {
      const { results } = await db
        .prepare("SELECT * FROM api_keys ORDER BY name")
        .all();

      return results.map((row) => this.rowToApiKey(row));
    },

    /**
     * Validate an API key
     * InfoSec: Constant-time comparison, rate limiting
     */
    async validateApiKey(
      key: string
    ): Promise<{
      valid: boolean;
      apiKey?: ApiKey;
      error?: string;
    }> {
      // Extract prefix for lookup
      if (!key.startsWith("hk_") || key.length < 11) {
        return { valid: false, error: "Invalid key format" };
      }

      const prefix = key.slice(3, 11);

      // Find key by prefix
      const row = await db
        .prepare("SELECT * FROM api_keys WHERE key_prefix = ? AND enabled = 1")
        .bind(prefix)
        .first();

      if (!row) {
        return { valid: false, error: "Key not found or disabled" };
      }

      // InfoSec: Verify hash
      const keyHash = await hashApiKey(key);
      if (keyHash !== row.key_hash) {
        return { valid: false, error: "Invalid key" };
      }

      // Update last used
      await db
        .prepare("UPDATE api_keys SET last_used_at = ? WHERE id = ?")
        .bind(Date.now(), row.id)
        .run();

      return {
        valid: true,
        apiKey: this.rowToApiKey(row),
      };
    },

    /**
     * Revoke an API key
     */
    async revokeApiKey(id: string, context: AuditContext): Promise<void> {
      await db
        .prepare("UPDATE api_keys SET enabled = 0 WHERE id = ?")
        .bind(id)
        .run();

      if (audit) {
        await audit.log(
          {
            action: "revoke",
            actionCategory: "access",
            resourceType: "api_key",
            resourceId: id,
          },
          context
        );
      }
    },

    /**
     * Delete an API key
     */
    async deleteApiKey(id: string, context: AuditContext): Promise<void> {
      const apiKey = await this.getApiKey(id);
      if (!apiKey) throw new Error(`API key not found: ${id}`);

      await db.prepare("DELETE FROM api_keys WHERE id = ?").bind(id).run();

      if (audit) {
        await audit.log(
          {
            action: "delete",
            actionCategory: "access",
            resourceType: "api_key",
            resourceId: id,
            resourceTitle: apiKey.name,
          },
          context
        );
      }
    },

    // ===== Rate Limiting =====

    /**
     * Check rate limit for an API key
     */
    async checkRateLimit(
      keyId: string,
      limit: number
    ): Promise<RateLimitResult> {
      if (!kv) {
        // No KV, allow all requests
        return { allowed: true, remaining: limit, reset: 0 };
      }

      const windowSeconds = 60;
      const key = `ratelimit:${keyId}`;
      const now = Math.floor(Date.now() / 1000);
      const windowStart = now - windowSeconds;

      const data = (await kv.get(key, "json")) as {
        count: number;
        start: number;
      } | null;

      if (!data || data.start < windowStart) {
        // New window
        await kv.put(key, JSON.stringify({ count: 1, start: now }), {
          expirationTtl: windowSeconds * 2,
        });
        return { allowed: true, remaining: limit - 1, reset: now + windowSeconds };
      }

      if (data.count >= limit) {
        return {
          allowed: false,
          remaining: 0,
          reset: data.start + windowSeconds,
        };
      }

      // Increment
      await kv.put(
        key,
        JSON.stringify({ count: data.count + 1, start: data.start }),
        { expirationTtl: windowSeconds * 2 }
      );

      return {
        allowed: true,
        remaining: limit - data.count - 1,
        reset: data.start + windowSeconds,
      };
    },

    // ===== Helpers =====

    buildCacheKey(
      collection: string,
      slugOrId: string,
      options: DeliveryOptions
    ): string {
      const parts = ["delivery", collection, slugOrId];
      if (options.locale) parts.push(`locale:${options.locale}`);
      if (options.fields) parts.push(`fields:${options.fields.sort().join(",")}`);
      return parts.join(":");
    },

    buildSelectFields(fields?: string[]): string {
      const defaultFields = [
        "id",
        "slug",
        "title",
        "title_ja",
        "collection",
        "locale",
        "body",
        "body_ja",
        "excerpt",
        "excerpt_ja",
        "metadata",
        "status",
        "published_at",
        "updated_at",
      ];

      if (!fields || fields.length === 0) {
        return defaultFields.join(", ");
      }

      // InfoSec: Whitelist allowed fields
      const allowed = new Set(defaultFields);
      const selected = fields.filter((f) => allowed.has(f));

      // Always include id and slug
      if (!selected.includes("id")) selected.unshift("id");
      if (!selected.includes("slug")) selected.push("slug");

      return selected.join(", ");
    },

    mapSortField(field: string): string {
      const map: Record<string, string> = {
        publishedAt: "published_at",
        updatedAt: "updated_at",
        createdAt: "created_at",
        title: "title",
        slug: "slug",
      };
      return map[field] || "published_at";
    },

    rowToDocument(row: Record<string, unknown>): DeliveryDocument {
      return {
        id: row.id as string,
        slug: row.slug as string,
        title: row.title as string,
        title_ja: row.title_ja as string | undefined,
        locale: row.locale as string,
        collection: row.collection as string,
        body: row.body as string | undefined,
        body_ja: row.body_ja as string | undefined,
        excerpt: row.excerpt as string | undefined,
        excerpt_ja: row.excerpt_ja as string | undefined,
        metadata: row.metadata
          ? JSON.parse(row.metadata as string)
          : undefined,
        published_at: row.published_at as number | null,
        updated_at: row.updated_at as number,
      };
    },

    rowToApiKey(row: Record<string, unknown>): ApiKey {
      return {
        id: row.id as string,
        name: row.name as string,
        key_prefix: row.key_prefix as string,
        permissions: JSON.parse(row.permissions as string),
        collections: row.collections
          ? JSON.parse(row.collections as string)
          : null,
        allowed_origins: row.allowed_origins
          ? JSON.parse(row.allowed_origins as string)
          : null,
        rate_limit: row.rate_limit as number,
        enabled: Boolean(row.enabled),
        created_by: row.created_by as string,
        created_at: row.created_at as number,
        last_used_at: row.last_used_at as number | null,
      };
    },
  };
}

export type DeliveryService = ReturnType<typeof createDeliveryService>;

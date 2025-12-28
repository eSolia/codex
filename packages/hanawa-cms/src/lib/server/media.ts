/**
 * Media Service
 * Handles file uploads to R2 and asset metadata in D1
 *
 * InfoSec: File type validation, size limits (OWASP A04)
 */

import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import type { AuditService, AuditContext } from "./audit";

export interface Asset {
  id: string;
  site_id: string | null;
  filename: string;
  path: string;
  mime_type: string | null;
  size: number | null;
  alt_text: string | null;
  alt_text_ja: string | null;
  caption: string | null;
  folder: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  // Computed
  url?: string;
}

export interface UploadOptions {
  siteId?: string;
  folder?: string;
  altText?: string;
  altTextJa?: string;
  caption?: string;
  tags?: string[];
}

// InfoSec: Allowed MIME types (whitelist approach)
const ALLOWED_MIME_TYPES = new Set([
  // Images
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/svg+xml",
  "image/avif",
  // Documents
  "application/pdf",
  // Data
  "text/csv",
  "application/json",
]);

// InfoSec: Maximum file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export function createMediaService(
  db: D1Database,
  r2: R2Bucket,
  audit?: AuditService
) {
  const baseUrl = ""; // Will be set from R2 public URL or CF Images

  return {
    /**
     * Upload a file to R2 and create asset record
     */
    async upload(
      file: File,
      options: UploadOptions,
      context: AuditContext
    ): Promise<Asset> {
      // InfoSec: Validate file type
      if (!ALLOWED_MIME_TYPES.has(file.type)) {
        throw new Error(
          `File type not allowed: ${file.type}. Allowed: ${[...ALLOWED_MIME_TYPES].join(", ")}`
        );
      }

      // InfoSec: Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(
          `File too large: ${(file.size / 1024 / 1024).toFixed(2)}MB. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`
        );
      }

      // Generate unique ID and path
      const id = crypto.randomUUID();
      const timestamp = Date.now();
      const safeFilename = this.sanitizeFilename(file.name);
      const folder = options.folder || "/";
      const r2Path = `assets/${options.siteId || "global"}${folder}${timestamp}-${safeFilename}`;

      // Upload to R2
      const arrayBuffer = await file.arrayBuffer();
      await r2.put(r2Path, arrayBuffer, {
        httpMetadata: {
          contentType: file.type,
        },
        customMetadata: {
          originalName: file.name,
          uploadedBy: context.actorEmail,
        },
      });

      // Create database record
      const now = new Date().toISOString();
      await db
        .prepare(
          `
        INSERT INTO assets (id, site_id, filename, path, mime_type, size, alt_text, alt_text_ja, caption, folder, tags, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          id,
          options.siteId || null,
          safeFilename,
          r2Path,
          file.type,
          file.size,
          options.altText || null,
          options.altTextJa || null,
          options.caption || null,
          folder,
          JSON.stringify(options.tags || []),
          now,
          now
        )
        .run();

      // Audit log
      if (audit) {
        await audit.log(
          {
            action: "upload",
            actionCategory: "content",
            resourceType: "asset",
            resourceId: id,
            resourceTitle: safeFilename,
            metadata: {
              mimeType: file.type,
              size: file.size,
              folder,
            },
          },
          context
        );
      }

      return this.get(id);
    },

    /**
     * Get asset by ID
     */
    async get(id: string): Promise<Asset> {
      const row = await db
        .prepare("SELECT * FROM assets WHERE id = ?")
        .bind(id)
        .first();

      if (!row) {
        throw new Error(`Asset not found: ${id}`);
      }

      return this.rowToAsset(row);
    },

    /**
     * List assets with filtering
     */
    async list(options: {
      siteId?: string;
      folder?: string;
      mimeType?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }): Promise<{ assets: Asset[]; total: number }> {
      const conditions: string[] = [];
      const params: unknown[] = [];

      if (options.siteId) {
        conditions.push("site_id = ?");
        params.push(options.siteId);
      }

      if (options.folder) {
        conditions.push("folder = ?");
        params.push(options.folder);
      }

      if (options.mimeType) {
        conditions.push("mime_type LIKE ?");
        params.push(`${options.mimeType}%`);
      }

      if (options.search) {
        conditions.push("(filename LIKE ? OR alt_text LIKE ? OR caption LIKE ?)");
        const searchPattern = `%${options.search}%`;
        params.push(searchPattern, searchPattern, searchPattern);
      }

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

      // Get total count
      const countResult = await db
        .prepare(`SELECT COUNT(*) as total FROM assets ${whereClause}`)
        .bind(...params)
        .first();
      const total = (countResult?.total as number) || 0;

      // Get paginated results
      const limit = options.limit || 50;
      const offset = options.offset || 0;

      const { results } = await db
        .prepare(
          `SELECT * FROM assets ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`
        )
        .bind(...params, limit, offset)
        .all();

      return {
        assets: results.map((row) => this.rowToAsset(row)),
        total,
      };
    },

    /**
     * Update asset metadata
     */
    async update(
      id: string,
      updates: {
        altText?: string;
        altTextJa?: string;
        caption?: string;
        folder?: string;
        tags?: string[];
      },
      context: AuditContext
    ): Promise<Asset> {
      const setClauses: string[] = ["updated_at = datetime('now')"];
      const params: unknown[] = [];

      if (updates.altText !== undefined) {
        setClauses.push("alt_text = ?");
        params.push(updates.altText);
      }

      if (updates.altTextJa !== undefined) {
        setClauses.push("alt_text_ja = ?");
        params.push(updates.altTextJa);
      }

      if (updates.caption !== undefined) {
        setClauses.push("caption = ?");
        params.push(updates.caption);
      }

      if (updates.folder !== undefined) {
        setClauses.push("folder = ?");
        params.push(updates.folder);
      }

      if (updates.tags !== undefined) {
        setClauses.push("tags = ?");
        params.push(JSON.stringify(updates.tags));
      }

      params.push(id);

      await db
        .prepare(`UPDATE assets SET ${setClauses.join(", ")} WHERE id = ?`)
        .bind(...params)
        .run();

      if (audit) {
        await audit.log(
          {
            action: "update",
            actionCategory: "content",
            resourceType: "asset",
            resourceId: id,
            metadata: updates,
          },
          context
        );
      }

      return this.get(id);
    },

    /**
     * Delete asset (R2 + D1)
     */
    async delete(id: string, context: AuditContext): Promise<void> {
      const asset = await this.get(id);

      // Delete from R2
      await r2.delete(asset.path);

      // Delete from D1
      await db.prepare("DELETE FROM assets WHERE id = ?").bind(id).run();

      if (audit) {
        await audit.log(
          {
            action: "delete",
            actionCategory: "content",
            resourceType: "asset",
            resourceId: id,
            resourceTitle: asset.filename,
            metadata: { path: asset.path },
          },
          context
        );
      }
    },

    /**
     * Get signed URL for private access (if needed)
     */
    async getSignedUrl(id: string, expiresIn = 3600): Promise<string> {
      const asset = await this.get(id);
      // For public R2 bucket, just return the public URL
      // For private bucket, would use presigned URLs
      return `${baseUrl}/${asset.path}`;
    },

    /**
     * Get unique folders
     */
    async getFolders(siteId?: string): Promise<string[]> {
      const condition = siteId ? "WHERE site_id = ?" : "";
      const params = siteId ? [siteId] : [];

      const { results } = await db
        .prepare(
          `SELECT DISTINCT folder FROM assets ${condition} ORDER BY folder`
        )
        .bind(...params)
        .all();

      return results.map((r) => r.folder as string);
    },

    // Helper: Sanitize filename
    sanitizeFilename(filename: string): string {
      // InfoSec: Remove path traversal, special chars
      return filename
        .replace(/[^\w\s.-]/g, "")
        .replace(/\s+/g, "-")
        .toLowerCase()
        .slice(0, 100);
    },

    // Helper: Convert DB row to Asset
    rowToAsset(row: Record<string, unknown>): Asset {
      return {
        id: row.id as string,
        site_id: row.site_id as string | null,
        filename: row.filename as string,
        path: row.path as string,
        mime_type: row.mime_type as string | null,
        size: row.size as number | null,
        alt_text: row.alt_text as string | null,
        alt_text_ja: row.alt_text_ja as string | null,
        caption: row.caption as string | null,
        folder: row.folder as string,
        tags: JSON.parse((row.tags as string) || "[]"),
        created_at: row.created_at as string,
        updated_at: row.updated_at as string,
        url: `/${row.path}`, // Public URL
      };
    },
  };
}

export type MediaService = ReturnType<typeof createMediaService>;

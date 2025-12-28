/**
 * Version Service for Hanawa CMS
 * InfoSec: Full content snapshots for compliance audit trails
 *
 * Every save creates a version. Every version is restorable.
 * Content deduplication via SHA-256 prevents storage bloat.
 */

/// <reference types="@cloudflare/workers-types" />

import type { AuditService, AuditContext } from "./audit";

export type VersionType = "auto" | "manual" | "publish" | "restore";
export type ContentFormat = "html" | "json" | "markdown";

export interface VersionData {
  content: string;
  contentFormat: ContentFormat;
  title?: string;
  metadata?: Record<string, unknown>;
  versionType?: VersionType;
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

export interface VersionDetail {
  id: string;
  documentId: string;
  versionNumber: number;
  content: string;
  contentFormat: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: number;
  createdByEmail: string;
  createdByName: string | null;
  versionType: string;
  versionLabel: string | null;
  versionNotes: string | null;
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
  changes: Array<{
    type: "title" | "content" | "metadata";
    field?: string;
    before: string;
    after: string;
  }>;
}

/**
 * Compute SHA-256 hash for content deduplication
 */
async function computeHash(content: string): Promise<string> {
  const buffer = new TextEncoder().encode(content);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create a version service instance
 */
export function createVersionService(db: D1Database, audit?: AuditService) {
  return {
    /**
     * Create a new version
     * Returns null if content unchanged (for auto-saves)
     */
    async create(
      documentId: string,
      data: VersionData,
      context: AuditContext
    ): Promise<string | null> {
      // Compute content hash for deduplication
      const contentHash = await computeHash(data.content);

      // Check for duplicate content
      const lastVersion = await db
        .prepare(
          `SELECT id, content_hash, version_number
           FROM document_versions
           WHERE document_id = ?
           ORDER BY version_number DESC
           LIMIT 1`
        )
        .bind(documentId)
        .first<{ id: string; content_hash: string; version_number: number }>();

      // Skip version creation for unchanged auto-saves
      if (
        lastVersion?.content_hash === contentHash &&
        data.versionType === "auto"
      ) {
        return null;
      }

      const versionNumber = (lastVersion?.version_number || 0) + 1;
      const id = crypto.randomUUID();
      const now = Date.now();
      const contentSize = new TextEncoder().encode(data.content).length;

      await db
        .prepare(
          `INSERT INTO document_versions (
          id, document_id, version_number, created_at,
          created_by_id, created_by_email, created_by_name,
          content, content_format, content_hash,
          title, metadata,
          version_type, version_label, version_notes,
          content_size, previous_version_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          id,
          documentId,
          versionNumber,
          now,
          context.actorId,
          context.actorEmail,
          context.actorName || null,
          data.content,
          data.contentFormat,
          contentHash,
          data.title || null,
          data.metadata ? JSON.stringify(data.metadata) : null,
          data.versionType || "auto",
          data.versionLabel || null,
          data.versionNotes || null,
          contentSize,
          lastVersion?.id || null
        )
        .run();

      // Audit log
      if (audit) {
        await audit.log(
          {
            action: data.versionType === "manual" ? "create" : "update",
            actionCategory: "content",
            resourceType: "document_version",
            resourceId: id,
            resourceTitle: data.title,
            metadata: {
              documentId,
              versionNumber,
              versionType: data.versionType,
              versionLabel: data.versionLabel,
              contentSize,
            },
          },
          context
        );
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

      const { results } = await db
        .prepare(
          `SELECT
          id, version_number, created_at,
          created_by_email, created_by_name,
          title, version_type, version_label, content_size
        FROM document_versions
        WHERE document_id = ?
        ORDER BY version_number DESC
        LIMIT ? OFFSET ?`
        )
        .bind(documentId, limit, offset)
        .all();

      return results.map((row) => ({
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
    async get(versionId: string): Promise<VersionDetail | null> {
      const row = await db
        .prepare(`SELECT * FROM document_versions WHERE id = ?`)
        .bind(versionId)
        .first();

      if (!row) return null;

      return {
        id: row.id as string,
        documentId: row.document_id as string,
        versionNumber: row.version_number as number,
        content: row.content as string,
        contentFormat: row.content_format as string,
        title: row.title as string | null,
        metadata: row.metadata
          ? JSON.parse(row.metadata as string)
          : null,
        createdAt: row.created_at as number,
        createdByEmail: row.created_by_email as string,
        createdByName: row.created_by_name as string | null,
        versionType: row.version_type as string,
        versionLabel: row.version_label as string | null,
        versionNotes: row.version_notes as string | null,
      };
    },

    /**
     * Get version at specific point in time
     */
    async getAtTime(
      documentId: string,
      timestamp: number
    ): Promise<string | null> {
      const row = await db
        .prepare(
          `SELECT id FROM document_versions
           WHERE document_id = ? AND created_at <= ?
           ORDER BY created_at DESC
           LIMIT 1`
        )
        .bind(documentId, timestamp)
        .first<{ id: string }>();

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
      const [before, after] =
        versionA.createdAt <= versionB.createdAt
          ? [versionA, versionB]
          : [versionB, versionA];

      const changes: VersionDiff["changes"] = [];

      // Compare title
      if (before.title !== after.title) {
        changes.push({
          type: "title",
          before: before.title || "",
          after: after.title || "",
        });
      }

      // Compare content
      if (before.content !== after.content) {
        changes.push({
          type: "content",
          before: before.content,
          after: after.content,
        });
      }

      // Compare metadata fields
      const beforeMeta = before.metadata || {};
      const afterMeta = after.metadata || {};
      const allKeys = new Set([
        ...Object.keys(beforeMeta),
        ...Object.keys(afterMeta),
      ]);

      for (const key of allKeys) {
        const beforeVal = JSON.stringify(beforeMeta[key] ?? "");
        const afterVal = JSON.stringify(afterMeta[key] ?? "");
        if (beforeVal !== afterVal) {
          changes.push({
            type: "metadata",
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
        throw new Error("Version not found");
      }

      // Create a new version with the old content
      const newVersionId = await this.create(
        documentId,
        {
          content: targetVersion.content,
          contentFormat: targetVersion.contentFormat as ContentFormat,
          title: targetVersion.title || undefined,
          metadata: targetVersion.metadata || undefined,
          versionType: "restore",
          versionNotes: `Restored from version ${targetVersion.versionNumber}`,
        },
        context
      );

      // Update the document's current content
      await db
        .prepare(
          `UPDATE content
           SET body = ?, title = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(targetVersion.content, targetVersion.title, documentId)
        .run();

      // Audit log
      if (audit) {
        await audit.log(
          {
            action: "restore",
            actionCategory: "content",
            resourceType: "document",
            resourceId: documentId,
            metadata: {
              restoredFromVersionId: versionId,
              restoredFromVersionNumber: targetVersion.versionNumber,
              newVersionId,
            },
          },
          context
        );
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
      await db
        .prepare(
          `UPDATE document_versions
           SET version_label = ?, version_notes = COALESCE(?, version_notes)
           WHERE id = ?`
        )
        .bind(label, notes || null, versionId)
        .run();

      if (audit && context) {
        await audit.log(
          {
            action: "update",
            actionCategory: "content",
            resourceType: "document_version",
            resourceId: versionId,
            changeSummary: `Added label: "${label}"`,
          },
          context
        );
      }
    },

    /**
     * Get named/labeled versions only
     */
    async getLabeled(documentId: string): Promise<VersionListItem[]> {
      const { results } = await db
        .prepare(
          `SELECT
          id, version_number, created_at,
          created_by_email, created_by_name,
          title, version_type, version_label, content_size
        FROM document_versions
        WHERE document_id = ? AND version_label IS NOT NULL
        ORDER BY version_number DESC`
        )
        .bind(documentId)
        .all();

      return results.map((row) => ({
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
     * Get version count for a document
     */
    async count(documentId: string): Promise<number> {
      const result = await db
        .prepare(
          `SELECT COUNT(*) as count FROM document_versions WHERE document_id = ?`
        )
        .bind(documentId)
        .first<{ count: number }>();

      return result?.count || 0;
    },

    /**
     * Get latest version for a document
     */
    async getLatest(documentId: string): Promise<VersionDetail | null> {
      const row = await db
        .prepare(
          `SELECT * FROM document_versions
           WHERE document_id = ?
           ORDER BY version_number DESC
           LIMIT 1`
        )
        .bind(documentId)
        .first();

      if (!row) return null;

      return {
        id: row.id as string,
        documentId: row.document_id as string,
        versionNumber: row.version_number as number,
        content: row.content as string,
        contentFormat: row.content_format as string,
        title: row.title as string | null,
        metadata: row.metadata
          ? JSON.parse(row.metadata as string)
          : null,
        createdAt: row.created_at as number,
        createdByEmail: row.created_by_email as string,
        createdByName: row.created_by_name as string | null,
        versionType: row.version_type as string,
        versionLabel: row.version_label as string | null,
        versionNotes: row.version_notes as string | null,
      };
    },
  };
}

export type VersionService = ReturnType<typeof createVersionService>;

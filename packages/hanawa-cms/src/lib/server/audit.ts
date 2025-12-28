/**
 * Audit Service for Hanawa CMS
 * InfoSec: Comprehensive audit logging for compliance (SOC 2, ISO 27001)
 *
 * Every action in Hanawa is logged with full context for compliance auditing.
 * Includes tamper detection via SHA-256 checksums.
 */

/// <reference types="@cloudflare/workers-types" />

// Action types for audit logging
export type AuditAction =
  // Content
  | "create"
  | "update"
  | "update_field"
  | "delete"
  | "restore"
  | "archive"
  // Workflow
  | "submit_review"
  | "approve"
  | "reject"
  | "request_changes"
  | "publish"
  | "unpublish"
  | "schedule"
  | "unschedule"
  // Access
  | "view"
  | "download"
  | "export"
  | "share_preview"
  | "preview_view"
  // System
  | "login"
  | "logout"
  | "permission_grant"
  | "permission_revoke"
  | "settings_update"
  // Comments
  | "comment_create"
  | "comment_update"
  | "comment_delete"
  | "comment_resolve";

export type ActionCategory =
  | "content"
  | "workflow"
  | "access"
  | "system"
  | "comment";

export interface AuditEntry {
  action: AuditAction;
  actionCategory: ActionCategory;
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

export interface AuditLogRow {
  id: string;
  timestamp: number;
  actor: string;
  actor_email: string;
  actor_name: string | null;
  action: string;
  action_category: string;
  resource_type: string;
  resource_id: string;
  resource_title: string | null;
  collection: string | null;
  field_path: string | null;
  value_before: string | null;
  value_after: string | null;
  change_summary: string | null;
  ip_address: string | null;
  user_agent: string | null;
  session_id: string | null;
  request_id: string | null;
  metadata: string | null;
  checksum: string | null;
}

/**
 * Compute SHA-256 checksum for tamper detection
 * InfoSec: Ensures audit log integrity
 */
async function computeChecksum(
  data: Record<string, unknown>
): Promise<string> {
  const { checksum, ...rest } = data;
  const json = JSON.stringify(rest, Object.keys(rest).sort());
  const buffer = new TextEncoder().encode(json);
  const hash = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create an audit service instance
 */
export function createAuditService(db: D1Database) {
  return {
    /**
     * Log an audit entry
     * InfoSec: All actions logged with tamper-evident checksum
     */
    async log(entry: AuditEntry, context: AuditContext): Promise<string> {
      const id = crypto.randomUUID();
      const timestamp = Date.now();

      // Build the row data for checksum
      const rowData = {
        id,
        timestamp,
        actor: context.actorId,
        actor_email: context.actorEmail,
        actor_name: context.actorName || null,
        action: entry.action,
        action_category: entry.actionCategory,
        resource_type: entry.resourceType,
        resource_id: entry.resourceId,
        resource_title: entry.resourceTitle || null,
        collection: entry.collection || null,
        field_path: entry.fieldPath || null,
        value_before: entry.valueBefore
          ? JSON.stringify(entry.valueBefore)
          : null,
        value_after: entry.valueAfter ? JSON.stringify(entry.valueAfter) : null,
        change_summary: entry.changeSummary || null,
        ip_address: context.ipAddress || null,
        user_agent: context.userAgent || null,
        session_id: context.sessionId || null,
        request_id: context.requestId || null,
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      };

      // Compute integrity checksum
      const checksum = await computeChecksum(rowData);

      await db
        .prepare(
          `INSERT INTO audit_log (
          id, timestamp, user_id, actor, actor_email, actor_name,
          action, action_category,
          entity_type, entity_id, resource_type, resource_id, resource_title,
          collection, field_path,
          value_before, value_after, change_summary,
          ip_address, user_agent, session_id, request_id,
          details, metadata, checksum, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
        )
        .bind(
          id,
          timestamp,
          context.actorId,
          context.actorId,
          context.actorEmail,
          context.actorName || null,
          entry.action,
          entry.actionCategory,
          entry.resourceType,
          entry.resourceId,
          entry.resourceType,
          entry.resourceId,
          entry.resourceTitle || null,
          entry.collection || null,
          entry.fieldPath || null,
          rowData.value_before,
          rowData.value_after,
          entry.changeSummary || null,
          context.ipAddress || null,
          context.userAgent || null,
          context.sessionId || null,
          context.requestId || null,
          rowData.metadata,
          rowData.metadata,
          checksum
        )
        .run();

      return id;
    },

    /**
     * Get audit history for a specific resource
     */
    async getResourceHistory(
      resourceType: string,
      resourceId: string,
      options: {
        limit?: number;
        offset?: number;
        actions?: AuditAction[];
      } = {}
    ): Promise<AuditLogRow[]> {
      const { limit = 50, offset = 0, actions } = options;

      let query = `
        SELECT * FROM audit_log
        WHERE resource_type = ? AND resource_id = ?
      `;
      const params: unknown[] = [resourceType, resourceId];

      if (actions?.length) {
        query += ` AND action IN (${actions.map(() => "?").join(", ")})`;
        params.push(...actions);
      }

      query += ` ORDER BY timestamp DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);

      const { results } = await db
        .prepare(query)
        .bind(...params)
        .all();
      return (results as unknown) as AuditLogRow[];
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

      const { results } = await db
        .prepare(query)
        .bind(...params)
        .all();
      return (results as unknown) as AuditLogRow[];
    },

    /**
     * Search audit log with filters
     */
    async search(
      filters: {
        actions?: AuditAction[];
        categories?: ActionCategory[];
        actors?: string[];
        resourceTypes?: string[];
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
        conditions.push(
          `action IN (${filters.actions.map(() => "?").join(", ")})`
        );
        params.push(...filters.actions);
      }

      if (filters.categories?.length) {
        conditions.push(
          `action_category IN (${filters.categories.map(() => "?").join(", ")})`
        );
        params.push(...filters.categories);
      }

      if (filters.actors?.length) {
        conditions.push(
          `actor_email IN (${filters.actors.map(() => "?").join(", ")})`
        );
        params.push(...filters.actors);
      }

      if (filters.resourceTypes?.length) {
        conditions.push(
          `resource_type IN (${filters.resourceTypes.map(() => "?").join(", ")})`
        );
        params.push(...filters.resourceTypes);
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

      const whereClause = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

      // Get total count
      const countResult = await db
        .prepare(`SELECT COUNT(*) as count FROM audit_log ${whereClause}`)
        .bind(...params)
        .first<{ count: number }>();

      // Get results
      const { results } = await db
        .prepare(
          `
        SELECT * FROM audit_log
        ${whereClause}
        ORDER BY timestamp DESC
        LIMIT ? OFFSET ?
      `
        )
        .bind(...params, limit, offset)
        .all();

      return {
        entries: (results as unknown) as AuditLogRow[],
        total: countResult?.count || 0,
      };
    },

    /**
     * Verify audit log integrity
     * InfoSec: Detect tampering in audit records
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
        query += ` WHERE ${conditions.join(" AND ")}`;
      }

      const { results } = await db
        .prepare(query)
        .bind(...params)
        .all();

      let valid = 0;
      let invalid = 0;
      const invalidEntries: string[] = [];

      for (const row of (results as unknown) as AuditLogRow[]) {
        if (!row.checksum) {
          // Old entries without checksum are considered valid
          valid++;
          continue;
        }

        const rowData = {
          id: row.id,
          timestamp: row.timestamp,
          actor: row.actor,
          actor_email: row.actor_email,
          actor_name: row.actor_name,
          action: row.action,
          action_category: row.action_category,
          resource_type: row.resource_type,
          resource_id: row.resource_id,
          resource_title: row.resource_title,
          collection: row.collection,
          field_path: row.field_path,
          value_before: row.value_before,
          value_after: row.value_after,
          change_summary: row.change_summary,
          ip_address: row.ip_address,
          user_agent: row.user_agent,
          session_id: row.session_id,
          request_id: row.request_id,
          metadata: row.metadata,
        };

        const expected = await computeChecksum(rowData);
        if (expected === row.checksum) {
          valid++;
        } else {
          invalid++;
          invalidEntries.push(row.id);
        }
      }

      return { valid, invalid, entries: invalidEntries };
    },

    /**
     * Get recent activity summary
     */
    async getRecentActivity(
      limit: number = 20
    ): Promise<AuditLogRow[]> {
      const { results } = await db
        .prepare(
          `SELECT * FROM audit_log
           ORDER BY timestamp DESC
           LIMIT ?`
        )
        .bind(limit)
        .all();

      return (results as unknown) as AuditLogRow[];
    },
  };
}

export type AuditService = ReturnType<typeof createAuditService>;

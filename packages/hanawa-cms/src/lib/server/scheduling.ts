/**
 * Scheduled Publishing Service for Hanawa CMS
 * InfoSec: Time-based publication with embargo enforcement
 *
 * Supports scheduled publish/unpublish actions with:
 * - Timezone-aware scheduling
 * - Embargo protection (hard deadline before which content cannot be published)
 * - Retry logic for failed jobs
 * - Full audit trail
 */

/// <reference types="@cloudflare/workers-types" />

import type { AuditService, AuditContext } from "./audit";
import type { WorkflowService } from "./workflow";

export type ScheduledAction = "publish" | "unpublish" | "archive";
export type ScheduledStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export interface ScheduledJob {
  id: string;
  documentId: string;
  action: ScheduledAction;

  // Timing
  scheduledAt: number; // UTC timestamp
  timezone: string; // e.g., 'Asia/Tokyo'

  // Status
  status: ScheduledStatus;
  processedAt?: number;
  errorMessage?: string;
  retryCount: number;

  // Metadata
  createdBy: string;
  createdAt: number;
  cancelledBy?: string;
  cancelledAt?: number;
  notes?: string;

  // Embargo
  isEmbargo: boolean;
}

export interface ScheduleRequest {
  documentId: string;
  action: ScheduledAction;
  scheduledAt: Date | string | number;
  timezone?: string;
  isEmbargo?: boolean;
  notes?: string;
}

export interface ScheduledJobWithDocument extends ScheduledJob {
  documentTitle: string;
}

/**
 * Create a scheduling service instance
 */
export function createSchedulingService(
  db: D1Database,
  audit?: AuditService,
  workflow?: WorkflowService
) {
  return {
    /**
     * Schedule a document action
     */
    async schedule(
      request: ScheduleRequest,
      context: AuditContext
    ): Promise<ScheduledJob> {
      const id = crypto.randomUUID();
      const now = Date.now();

      // Parse scheduled time
      let scheduledAt: number;
      if (typeof request.scheduledAt === "string") {
        scheduledAt = new Date(request.scheduledAt).getTime();
      } else if (typeof request.scheduledAt === "number") {
        scheduledAt = request.scheduledAt;
      } else {
        scheduledAt = request.scheduledAt.getTime();
      }

      // Validate timing
      if (scheduledAt <= now) {
        throw new Error("Scheduled time must be in the future");
      }

      // Check for embargo conflicts on publish
      if (request.action === "publish") {
        const doc = await db
          .prepare(`SELECT embargo_until FROM content WHERE id = ?`)
          .bind(request.documentId)
          .first<{ embargo_until: number | null }>();

        if (doc?.embargo_until && scheduledAt < doc.embargo_until) {
          throw new Error(
            `Cannot schedule before embargo lifts at ${new Date(doc.embargo_until).toISOString()}`
          );
        }
      }

      // Check for existing pending jobs of the same action type
      const existing = await db
        .prepare(
          `SELECT id FROM scheduled_jobs
           WHERE document_id = ? AND action = ? AND status = 'pending'`
        )
        .bind(request.documentId, request.action)
        .first<{ id: string }>();

      if (existing) {
        // Cancel the existing job (replaced by new schedule)
        await this.cancel(existing.id, "Replaced by new schedule", context);
      }

      await db
        .prepare(
          `INSERT INTO scheduled_jobs (
            id, document_id, action, scheduled_at, timezone,
            status, is_embargo, notes, created_by, created_at, retry_count
          ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?, 0)`
        )
        .bind(
          id,
          request.documentId,
          request.action,
          scheduledAt,
          request.timezone || "UTC",
          request.isEmbargo ? 1 : 0,
          request.notes || null,
          context.actorEmail,
          now
        )
        .run();

      // If this is an embargo, update the document's embargo_until field
      if (request.isEmbargo && request.action === "publish") {
        await db
          .prepare(`UPDATE content SET embargo_until = ? WHERE id = ?`)
          .bind(scheduledAt, request.documentId)
          .run();
      }

      // Audit log
      if (audit) {
        await audit.log(
          {
            action: "schedule",
            actionCategory: "workflow",
            resourceType: "content",
            resourceId: request.documentId,
            changeSummary: `Scheduled ${request.action} for ${new Date(scheduledAt).toISOString()}`,
            metadata: {
              jobId: id,
              scheduledAt,
              scheduledAction: request.action,
              timezone: request.timezone || "UTC",
              isEmbargo: request.isEmbargo || false,
            },
          },
          context
        );
      }

      return (await this.get(id)) as ScheduledJob;
    },

    /**
     * Cancel a scheduled job
     */
    async cancel(
      jobId: string,
      reason?: string,
      context?: AuditContext
    ): Promise<void> {
      const job = await this.get(jobId);
      if (!job) throw new Error("Scheduled job not found");
      if (job.status !== "pending") {
        throw new Error("Can only cancel pending jobs");
      }

      await db
        .prepare(
          `UPDATE scheduled_jobs
           SET status = 'cancelled',
               cancelled_by = ?,
               cancelled_at = ?,
               notes = COALESCE(?, notes)
           WHERE id = ?`
        )
        .bind(
          context?.actorEmail || "system",
          Date.now(),
          reason,
          jobId
        )
        .run();

      // If this was an embargo job, clear the embargo
      if (job.isEmbargo && job.action === "publish") {
        await db
          .prepare(`UPDATE content SET embargo_until = NULL WHERE id = ?`)
          .bind(job.documentId)
          .run();
      }

      // Audit log
      if (audit && context) {
        await audit.log(
          {
            action: "unschedule",
            actionCategory: "workflow",
            resourceType: "content",
            resourceId: job.documentId,
            changeSummary: `Cancelled scheduled ${job.action}`,
            metadata: { jobId, reason },
          },
          context
        );
      }
    },

    /**
     * Get pending jobs due for processing
     */
    async getDueJobs(): Promise<ScheduledJob[]> {
      const { results } = await db
        .prepare(
          `SELECT * FROM scheduled_jobs
           WHERE status = 'pending' AND scheduled_at <= ?
           ORDER BY scheduled_at ASC
           LIMIT 100`
        )
        .bind(Date.now())
        .all();

      return results.map((row) => this.rowToJob(row));
    },

    /**
     * Process a single scheduled job
     */
    async processJob(
      jobId: string
    ): Promise<{ success: boolean; error?: string }> {
      const job = await this.get(jobId);
      if (!job) return { success: false, error: "Job not found" };
      if (job.status !== "pending") {
        return { success: false, error: "Job not pending" };
      }

      // Mark as processing
      await db
        .prepare(`UPDATE scheduled_jobs SET status = 'processing' WHERE id = ?`)
        .bind(jobId)
        .run();

      try {
        const systemContext: AuditContext = {
          actorId: "system",
          actorEmail: "scheduler@hanawa.internal",
          actorName: "Scheduled Task",
        };

        if (job.action === "publish") {
          // Try to use workflow if available, otherwise direct update
          if (workflow) {
            const result = await workflow.submit(
              job.documentId,
              `Scheduled publish (job ${jobId})`,
              systemContext
            );
            if (!result.success) {
              throw new Error(result.error || "Workflow transition failed");
            }
          } else {
            // Direct publish
            await db
              .prepare(
                `UPDATE content
                 SET status = 'published', published_at = ?, updated_at = ?
                 WHERE id = ?`
              )
              .bind(Date.now(), Date.now(), job.documentId)
              .run();
          }

          if (audit) {
            await audit.log(
              {
                action: "publish",
                actionCategory: "workflow",
                resourceType: "content",
                resourceId: job.documentId,
                changeSummary: "Scheduled publish executed",
                metadata: { jobId },
              },
              systemContext
            );
          }
        } else if (job.action === "unpublish") {
          await db
            .prepare(
              `UPDATE content
               SET status = 'draft', published_at = NULL, updated_at = ?
               WHERE id = ?`
            )
            .bind(Date.now(), job.documentId)
            .run();

          if (audit) {
            await audit.log(
              {
                action: "unpublish",
                actionCategory: "workflow",
                resourceType: "content",
                resourceId: job.documentId,
                changeSummary: "Scheduled unpublish executed",
                metadata: { jobId },
              },
              systemContext
            );
          }
        } else if (job.action === "archive") {
          await db
            .prepare(
              `UPDATE content
               SET status = 'archived', updated_at = ?
               WHERE id = ?`
            )
            .bind(Date.now(), job.documentId)
            .run();

          if (audit) {
            await audit.log(
              {
                action: "archive",
                actionCategory: "workflow",
                resourceType: "content",
                resourceId: job.documentId,
                changeSummary: "Scheduled archive executed",
                metadata: { jobId },
              },
              systemContext
            );
          }
        }

        // Mark completed
        await db
          .prepare(
            `UPDATE scheduled_jobs
             SET status = 'completed', processed_at = ?
             WHERE id = ?`
          )
          .bind(Date.now(), jobId)
          .run();

        return { success: true };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        // Update retry count and potentially fail
        const newRetryCount = job.retryCount + 1;
        const maxRetries = 3;

        if (newRetryCount >= maxRetries) {
          await db
            .prepare(
              `UPDATE scheduled_jobs
               SET status = 'failed', error_message = ?, retry_count = ?
               WHERE id = ?`
            )
            .bind(errorMessage, newRetryCount, jobId)
            .run();
        } else {
          // Reset to pending for retry
          await db
            .prepare(
              `UPDATE scheduled_jobs
               SET status = 'pending', error_message = ?, retry_count = ?
               WHERE id = ?`
            )
            .bind(errorMessage, newRetryCount, jobId)
            .run();
        }

        return { success: false, error: errorMessage };
      }
    },

    /**
     * Get a scheduled job by ID
     */
    async get(jobId: string): Promise<ScheduledJob | null> {
      const row = await db
        .prepare(`SELECT * FROM scheduled_jobs WHERE id = ?`)
        .bind(jobId)
        .first();

      return row ? this.rowToJob(row) : null;
    },

    /**
     * Get all scheduled jobs for a document
     */
    async getForDocument(documentId: string): Promise<ScheduledJob[]> {
      const { results } = await db
        .prepare(
          `SELECT * FROM scheduled_jobs
           WHERE document_id = ?
           ORDER BY scheduled_at DESC`
        )
        .bind(documentId)
        .all();

      return results.map((row) => this.rowToJob(row));
    },

    /**
     * Get pending scheduled job for a document (if any)
     */
    async getPendingForDocument(
      documentId: string
    ): Promise<ScheduledJob | null> {
      const row = await db
        .prepare(
          `SELECT * FROM scheduled_jobs
           WHERE document_id = ? AND status = 'pending'
           ORDER BY scheduled_at ASC
           LIMIT 1`
        )
        .bind(documentId)
        .first();

      return row ? this.rowToJob(row) : null;
    },

    /**
     * Get upcoming scheduled publications
     */
    async getUpcoming(
      options: { limit?: number; includeAll?: boolean } = {}
    ): Promise<ScheduledJobWithDocument[]> {
      const { limit = 20, includeAll = false } = options;

      let query = `
        SELECT sj.*, c.title as document_title
        FROM scheduled_jobs sj
        JOIN content c ON sj.document_id = c.id
        WHERE sj.status = 'pending'
      `;

      const params: (number | string)[] = [];

      if (!includeAll) {
        query += ` AND sj.scheduled_at > ?`;
        params.push(Date.now());
      }

      query += ` ORDER BY sj.scheduled_at ASC LIMIT ?`;
      params.push(limit);

      const { results } = await db.prepare(query).bind(...params).all();

      return results.map((row) => ({
        ...this.rowToJob(row),
        documentTitle: (row.document_title as string) || "Untitled",
      }));
    },

    /**
     * Get recently processed jobs
     */
    async getRecent(
      options: { limit?: number; status?: ScheduledStatus } = {}
    ): Promise<ScheduledJobWithDocument[]> {
      const { limit = 20, status } = options;

      let query = `
        SELECT sj.*, c.title as document_title
        FROM scheduled_jobs sj
        JOIN content c ON sj.document_id = c.id
      `;

      const params: (number | string)[] = [];

      if (status) {
        query += ` WHERE sj.status = ?`;
        params.push(status);
      }

      query += ` ORDER BY COALESCE(sj.processed_at, sj.scheduled_at) DESC LIMIT ?`;
      params.push(limit);

      const { results } = await db.prepare(query).bind(...params).all();

      return results.map((row) => ({
        ...this.rowToJob(row),
        documentTitle: (row.document_title as string) || "Untitled",
      }));
    },

    /**
     * Check embargo status for a document
     */
    async isUnderEmbargo(
      documentId: string
    ): Promise<{ embargoed: boolean; until?: number }> {
      const doc = await db
        .prepare(`SELECT embargo_until FROM content WHERE id = ?`)
        .bind(documentId)
        .first<{ embargo_until: number | null }>();

      if (!doc?.embargo_until) {
        return { embargoed: false };
      }

      const now = Date.now();
      const until = doc.embargo_until;

      return {
        embargoed: now < until,
        until,
      };
    },

    /**
     * Clear embargo for a document
     */
    async clearEmbargo(
      documentId: string,
      context: AuditContext
    ): Promise<void> {
      await db
        .prepare(`UPDATE content SET embargo_until = NULL WHERE id = ?`)
        .bind(documentId)
        .run();

      if (audit) {
        await audit.log(
          {
            action: "update",
            actionCategory: "workflow",
            resourceType: "content",
            resourceId: documentId,
            changeSummary: "Embargo cleared",
            metadata: { embargoCleared: true },
          },
          context
        );
      }
    },

    /**
     * Get job counts by status
     */
    async getCounts(): Promise<Record<ScheduledStatus, number>> {
      const result = await db
        .prepare(
          `SELECT
            SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
            SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
            SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
            SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
            SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled
           FROM scheduled_jobs`
        )
        .first<{
          pending: number;
          processing: number;
          completed: number;
          failed: number;
          cancelled: number;
        }>();

      return {
        pending: result?.pending || 0,
        processing: result?.processing || 0,
        completed: result?.completed || 0,
        failed: result?.failed || 0,
        cancelled: result?.cancelled || 0,
      };
    },

    // Helper: Convert database row to ScheduledJob
    rowToJob(row: Record<string, unknown>): ScheduledJob {
      return {
        id: row.id as string,
        documentId: row.document_id as string,
        action: row.action as ScheduledAction,
        scheduledAt: row.scheduled_at as number,
        timezone: (row.timezone as string) || "UTC",
        status: row.status as ScheduledStatus,
        processedAt: row.processed_at as number | undefined,
        errorMessage: row.error_message as string | undefined,
        retryCount: (row.retry_count as number) || 0,
        createdBy: row.created_by as string,
        createdAt: row.created_at as number,
        cancelledBy: row.cancelled_by as string | undefined,
        cancelledAt: row.cancelled_at as number | undefined,
        notes: row.notes as string | undefined,
        isEmbargo: Boolean(row.is_embargo),
      };
    },
  };
}

export type SchedulingService = ReturnType<typeof createSchedulingService>;

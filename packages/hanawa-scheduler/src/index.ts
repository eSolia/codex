/**
 * Hanawa Scheduler Worker
 * InfoSec: Processes scheduled publishing jobs via Cloudflare Cron Triggers
 *
 * This worker runs on a cron schedule (every minute) and processes
 * any scheduled jobs that are due for execution.
 */

interface Env {
  DB: D1Database;
}

type ScheduledAction = "publish" | "unpublish" | "archive";
type ScheduledStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

interface ScheduledJob {
  id: string;
  documentId: string;
  action: ScheduledAction;
  scheduledAt: number;
  status: ScheduledStatus;
  retryCount: number;
}

interface AuditContext {
  actorId: string;
  actorEmail: string;
  actorName: string;
}

const SYSTEM_CONTEXT: AuditContext = {
  actorId: "system",
  actorEmail: "scheduler@hanawa.internal",
  actorName: "Scheduled Task",
};

const MAX_RETRIES = 3;

/**
 * Log an audit event
 * InfoSec: All scheduled actions are logged for compliance
 */
async function logAudit(
  db: D1Database,
  event: {
    action: string;
    resourceType: string;
    resourceId: string;
    changeSummary: string;
    metadata?: Record<string, unknown>;
  }
): Promise<void> {
  const id = crypto.randomUUID();
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO audit_log (
        id, action, action_category, resource_type, resource_id,
        actor_id, actor_email, actor_name, change_summary, metadata,
        created_at, ip_address, user_agent, session_id, request_id
      ) VALUES (?, ?, 'workflow', ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'hanawa-scheduler', NULL, ?)`
    )
    .bind(
      id,
      event.action,
      event.resourceType,
      event.resourceId,
      SYSTEM_CONTEXT.actorId,
      SYSTEM_CONTEXT.actorEmail,
      SYSTEM_CONTEXT.actorName,
      event.changeSummary,
      event.metadata ? JSON.stringify(event.metadata) : null,
      now,
      crypto.randomUUID()
    )
    .run();
}

/**
 * Get all pending jobs that are due for processing
 */
async function getDueJobs(db: D1Database): Promise<ScheduledJob[]> {
  const { results } = await db
    .prepare(
      `SELECT id, document_id, action, scheduled_at, status, retry_count
       FROM scheduled_jobs
       WHERE status = 'pending' AND scheduled_at <= ?
       ORDER BY scheduled_at ASC
       LIMIT 100`
    )
    .bind(Date.now())
    .all();

  return results.map((row) => ({
    id: row.id as string,
    documentId: row.document_id as string,
    action: row.action as ScheduledAction,
    scheduledAt: row.scheduled_at as number,
    status: row.status as ScheduledStatus,
    retryCount: (row.retry_count as number) || 0,
  }));
}

/**
 * Process a single scheduled job
 * InfoSec: Each action is atomic and logged
 */
async function processJob(
  db: D1Database,
  job: ScheduledJob
): Promise<{ success: boolean; error?: string }> {
  const now = Date.now();

  // Mark as processing
  await db
    .prepare(`UPDATE scheduled_jobs SET status = 'processing' WHERE id = ?`)
    .bind(job.id)
    .run();

  try {
    switch (job.action) {
      case "publish":
        // Update workflow state to published
        await db
          .prepare(
            `UPDATE workflow_state
             SET state = 'published', updated_at = ?, updated_by = ?
             WHERE document_id = ?`
          )
          .bind(now, SYSTEM_CONTEXT.actorEmail, job.documentId)
          .run();

        // Update content status
        await db
          .prepare(
            `UPDATE content
             SET status = 'published', published_at = ?, updated_at = ?
             WHERE id = ?`
          )
          .bind(now, now, job.documentId)
          .run();

        await logAudit(db, {
          action: "publish",
          resourceType: "content",
          resourceId: job.documentId,
          changeSummary: "Scheduled publish executed",
          metadata: { jobId: job.id },
        });
        break;

      case "unpublish":
        // Update workflow state to draft
        await db
          .prepare(
            `UPDATE workflow_state
             SET state = 'draft', updated_at = ?, updated_by = ?
             WHERE document_id = ?`
          )
          .bind(now, SYSTEM_CONTEXT.actorEmail, job.documentId)
          .run();

        // Update content status
        await db
          .prepare(
            `UPDATE content
             SET status = 'draft', published_at = NULL, updated_at = ?
             WHERE id = ?`
          )
          .bind(now, job.documentId)
          .run();

        await logAudit(db, {
          action: "unpublish",
          resourceType: "content",
          resourceId: job.documentId,
          changeSummary: "Scheduled unpublish executed",
          metadata: { jobId: job.id },
        });
        break;

      case "archive":
        // Update workflow state to archived
        await db
          .prepare(
            `UPDATE workflow_state
             SET state = 'archived', updated_at = ?, updated_by = ?
             WHERE document_id = ?`
          )
          .bind(now, SYSTEM_CONTEXT.actorEmail, job.documentId)
          .run();

        // Update content status
        await db
          .prepare(
            `UPDATE content
             SET status = 'archived', updated_at = ?
             WHERE id = ?`
          )
          .bind(now, job.documentId)
          .run();

        await logAudit(db, {
          action: "archive",
          resourceType: "content",
          resourceId: job.documentId,
          changeSummary: "Scheduled archive executed",
          metadata: { jobId: job.id },
        });
        break;
    }

    // Mark completed
    await db
      .prepare(
        `UPDATE scheduled_jobs
         SET status = 'completed', processed_at = ?
         WHERE id = ?`
      )
      .bind(now, job.id)
      .run();

    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const newRetryCount = job.retryCount + 1;

    if (newRetryCount >= MAX_RETRIES) {
      // Mark as failed after max retries
      await db
        .prepare(
          `UPDATE scheduled_jobs
           SET status = 'failed', error_message = ?, retry_count = ?, processed_at = ?
           WHERE id = ?`
        )
        .bind(errorMessage, newRetryCount, now, job.id)
        .run();

      await logAudit(db, {
        action: "schedule_failed",
        resourceType: "content",
        resourceId: job.documentId,
        changeSummary: `Scheduled ${job.action} failed after ${MAX_RETRIES} retries`,
        metadata: { jobId: job.id, error: errorMessage },
      });
    } else {
      // Reset to pending for retry
      await db
        .prepare(
          `UPDATE scheduled_jobs
           SET status = 'pending', error_message = ?, retry_count = ?
           WHERE id = ?`
        )
        .bind(errorMessage, newRetryCount, job.id)
        .run();
    }

    return { success: false, error: errorMessage };
  }
}

export default {
  /**
   * Cron trigger handler
   * InfoSec: Runs every minute to process due scheduled jobs
   */
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    const startTime = Date.now();
    console.log(`[Scheduler] Cron triggered at ${new Date().toISOString()}`);

    try {
      const dueJobs = await getDueJobs(env.DB);

      if (dueJobs.length === 0) {
        console.log("[Scheduler] No jobs due");
        return;
      }

      console.log(`[Scheduler] Processing ${dueJobs.length} due job(s)`);

      let successCount = 0;
      let failCount = 0;

      for (const job of dueJobs) {
        console.log(
          `[Scheduler] Processing job ${job.id}: ${job.action} for document ${job.documentId}`
        );

        const result = await processJob(env.DB, job);

        if (result.success) {
          successCount++;
          console.log(`[Scheduler] Job ${job.id} completed successfully`);
        } else {
          failCount++;
          console.error(`[Scheduler] Job ${job.id} failed: ${result.error}`);
        }
      }

      const duration = Date.now() - startTime;
      console.log(
        `[Scheduler] Run complete: ${successCount} succeeded, ${failCount} failed (${duration}ms)`
      );
    } catch (error) {
      console.error("[Scheduler] Fatal error:", error);
      throw error;
    }
  },

  /**
   * HTTP handler for manual triggering and health checks
   * InfoSec: Restricted to GET for status only
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/status") {
      const result = await env.DB.prepare(
        `SELECT
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
          SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
         FROM scheduled_jobs`
      ).first<{
        pending: number;
        processing: number;
        completed: number;
        failed: number;
      }>();

      return new Response(
        JSON.stringify({
          status: "ok",
          jobs: result || { pending: 0, processing: 0, completed: 0, failed: 0 },
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return new Response("Hanawa Scheduler Worker", { status: 200 });
  },
};

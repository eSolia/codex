/**
 * Scheduled Job Processor for Hanawa CMS
 * InfoSec: Processes due scheduled jobs via Cloudflare Cron Triggers
 *
 * Configure in wrangler.jsonc:
 * "triggers": { "crons": ["* * * * *"] }  // Every minute
 *
 * This handler runs separately from the Pages application
 * and processes any scheduled jobs that are due.
 */

/// <reference types="@cloudflare/workers-types" />

import { createSchedulingService } from "$lib/server/scheduling";
import { createAuditService } from "$lib/server/audit";
import { createWorkflowService } from "$lib/server/workflow";
import { createVersionService } from "$lib/server/versions";

interface Env {
  DB: D1Database;
}

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    console.log(`[Scheduled] Cron triggered at ${new Date().toISOString()}`);

    const audit = createAuditService(env.DB);
    const versions = createVersionService(env.DB, audit);
    const workflow = createWorkflowService(env.DB, audit, versions);
    const scheduling = createSchedulingService(env.DB, audit, workflow);

    // Get all due jobs
    const dueJobs = await scheduling.getDueJobs();

    if (dueJobs.length === 0) {
      console.log("[Scheduled] No jobs due");
      return;
    }

    console.log(`[Scheduled] Processing ${dueJobs.length} due job(s)`);

    // Process each job
    for (const job of dueJobs) {
      console.log(
        `[Scheduled] Processing job ${job.id}: ${job.action} for document ${job.documentId}`
      );

      const result = await scheduling.processJob(job.id);

      if (result.success) {
        console.log(`[Scheduled] Job ${job.id} completed successfully`);
      } else {
        console.error(`[Scheduled] Job ${job.id} failed: ${result.error}`);
      }
    }

    console.log("[Scheduled] Cron run complete");
  },
};

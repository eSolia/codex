# Hanawa: Scheduled Publishing Specification

Time-based publication with embargo support.

## Overview

Scheduled publishing allows content to go live at a predetermined time—essential for coordinated releases, embargoed content, and timezone-aware publication.

```
┌─────────────────────────────────────────────────────────────────┐
│  SCHEDULED PUBLISHING FLOW                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  NOW                              SCHEDULED TIME                │
│  ───                              ──────────────                │
│                                                                 │
│  [Content Ready] ──schedule──▶ [Queue] ──cron──▶ [Published]   │
│                                   │                             │
│                                   │ Embargo flag                │
│                                   │ "Do not publish before"     │
│                                   │                             │
│                                   ▼                             │
│                            Preview available                    │
│                            (with watermark)                     │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Schema Additions

```sql
-- Scheduled jobs table
CREATE TABLE scheduled_jobs (
  id TEXT PRIMARY KEY,
  
  -- Target
  document_id TEXT NOT NULL,
  action TEXT NOT NULL,               -- 'publish', 'unpublish', 'archive'
  
  -- Timing
  scheduled_at INTEGER NOT NULL,      -- Unix timestamp (UTC)
  timezone TEXT DEFAULT 'UTC',        -- Original timezone for display
  
  -- Status
  status TEXT DEFAULT 'pending',      -- 'pending', 'processing', 'completed', 'failed', 'cancelled'
  processed_at INTEGER,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Metadata
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  cancelled_by TEXT,
  cancelled_at INTEGER,
  notes TEXT,
  
  -- Embargo
  is_embargo BOOLEAN DEFAULT FALSE,   -- Hard embargo: cannot be published before this time
  
  FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
);

CREATE INDEX idx_scheduled_pending ON scheduled_jobs(status, scheduled_at)
  WHERE status = 'pending';
CREATE INDEX idx_scheduled_document ON scheduled_jobs(document_id);

-- Add to documents table
ALTER TABLE documents ADD COLUMN scheduled_publish_at INTEGER;
ALTER TABLE documents ADD COLUMN scheduled_unpublish_at INTEGER;
ALTER TABLE documents ADD COLUMN embargo_until INTEGER;
```

### TypeScript Types

```typescript
interface ScheduledJob {
  id: string;
  documentId: string;
  action: 'publish' | 'unpublish' | 'archive';
  
  // Timing
  scheduledAt: number;          // UTC timestamp
  timezone: string;             // e.g., 'Asia/Tokyo'
  
  // Status
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
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

interface ScheduleRequest {
  documentId: string;
  action: 'publish' | 'unpublish';
  scheduledAt: Date | string;
  timezone?: string;
  isEmbargo?: boolean;
  notes?: string;
}
```

---

## API Design

### Scheduling Service

```typescript
// lib/server/scheduling.ts

import type { D1Database } from '@cloudflare/workers-types';

export function createSchedulingService(
  db: D1Database,
  audit: AuditService,
  workflow: WorkflowService,
  versions: VersionService
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
      const scheduledAt = typeof request.scheduledAt === 'string'
        ? new Date(request.scheduledAt).getTime()
        : request.scheduledAt.getTime();
      
      // Validate timing
      if (scheduledAt <= now) {
        throw new Error('Scheduled time must be in the future');
      }
      
      // Check for embargo conflicts
      if (request.action === 'publish') {
        const doc = await db.prepare(
          `SELECT embargo_until FROM documents WHERE id = ?`
        ).bind(request.documentId).first();
        
        if (doc?.embargo_until && scheduledAt < doc.embargo_until) {
          throw new Error('Cannot schedule before embargo lifts');
        }
      }
      
      // Check for existing pending jobs
      const existing = await db.prepare(`
        SELECT id FROM scheduled_jobs
        WHERE document_id = ? AND action = ? AND status = 'pending'
      `).bind(request.documentId, request.action).first();
      
      if (existing) {
        // Cancel the existing job
        await this.cancel(existing.id as string, 'Replaced by new schedule', context);
      }
      
      await db.prepare(`
        INSERT INTO scheduled_jobs (
          id, document_id, action, scheduled_at, timezone,
          status, is_embargo, notes, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', ?, ?, ?, ?)
      `).bind(
        id,
        request.documentId,
        request.action,
        scheduledAt,
        request.timezone || 'UTC',
        request.isEmbargo || false,
        request.notes || null,
        context.actorEmail,
        now
      ).run();
      
      // Update document with scheduled time
      const timeField = request.action === 'publish' 
        ? 'scheduled_publish_at' 
        : 'scheduled_unpublish_at';
      
      await db.prepare(`
        UPDATE documents SET ${timeField} = ? WHERE id = ?
      `).bind(scheduledAt, request.documentId).run();
      
      // If embargo, set embargo_until
      if (request.isEmbargo && request.action === 'publish') {
        await db.prepare(`
          UPDATE documents SET embargo_until = ? WHERE id = ?
        `).bind(scheduledAt, request.documentId).run();
      }
      
      await audit.log({
        action: 'schedule',
        actionCategory: 'workflow',
        resourceType: 'document',
        resourceId: request.documentId,
        changeSummary: `Scheduled ${request.action} for ${new Date(scheduledAt).toISOString()}`,
        metadata: { jobId: id, scheduledAt, action: request.action, isEmbargo: request.isEmbargo },
      }, context);
      
      return this.get(id) as Promise<ScheduledJob>;
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
      if (!job) throw new Error('Job not found');
      if (job.status !== 'pending') throw new Error('Can only cancel pending jobs');
      
      await db.prepare(`
        UPDATE scheduled_jobs
        SET status = 'cancelled', cancelled_by = ?, cancelled_at = ?, notes = COALESCE(?, notes)
        WHERE id = ?
      `).bind(
        context?.actorEmail || 'system',
        Date.now(),
        reason,
        jobId
      ).run();
      
      // Clear document scheduled time
      const timeField = job.action === 'publish' 
        ? 'scheduled_publish_at' 
        : 'scheduled_unpublish_at';
      
      await db.prepare(`
        UPDATE documents SET ${timeField} = NULL WHERE id = ?
      `).bind(job.documentId).run();
      
      if (context) {
        await audit.log({
          action: 'unschedule',
          actionCategory: 'workflow',
          resourceType: 'document',
          resourceId: job.documentId,
          changeSummary: `Cancelled scheduled ${job.action}`,
          metadata: { jobId, reason },
        }, context);
      }
    },
    
    /**
     * Get pending jobs due for processing
     */
    async getDueJobs(): Promise<ScheduledJob[]> {
      const { results } = await db.prepare(`
        SELECT * FROM scheduled_jobs
        WHERE status = 'pending' AND scheduled_at <= ?
        ORDER BY scheduled_at ASC
        LIMIT 100
      `).bind(Date.now()).all();
      
      return results.map(this.rowToJob);
    },
    
    /**
     * Process a single job
     */
    async processJob(jobId: string): Promise<{ success: boolean; error?: string }> {
      const job = await this.get(jobId);
      if (!job) return { success: false, error: 'Job not found' };
      if (job.status !== 'pending') return { success: false, error: 'Job not pending' };
      
      // Mark as processing
      await db.prepare(`
        UPDATE scheduled_jobs SET status = 'processing' WHERE id = ?
      `).bind(jobId).run();
      
      try {
        const systemContext: AuditContext = {
          actorId: 'system',
          actorEmail: 'scheduler@hanawa.internal',
          actorName: 'Scheduled Task',
        };
        
        if (job.action === 'publish') {
          // Execute publish via workflow
          await workflow.executeTransition(
            job.documentId,
            'publish', // This assumes a publish transition exists
            `Scheduled publish (job ${jobId})`,
            systemContext
          );
        } else if (job.action === 'unpublish') {
          // Unpublish
          await db.prepare(`
            UPDATE documents SET status = 'draft', published_at = NULL WHERE id = ?
          `).bind(job.documentId).run();
          
          await audit.log({
            action: 'unpublish',
            actionCategory: 'workflow',
            resourceType: 'document',
            resourceId: job.documentId,
            changeSummary: 'Scheduled unpublish',
          }, systemContext);
        }
        
        // Mark completed
        await db.prepare(`
          UPDATE scheduled_jobs SET status = 'completed', processed_at = ? WHERE id = ?
        `).bind(Date.now(), jobId).run();
        
        // Clear scheduled time from document
        const timeField = job.action === 'publish' 
          ? 'scheduled_publish_at' 
          : 'scheduled_unpublish_at';
        
        await db.prepare(`
          UPDATE documents SET ${timeField} = NULL WHERE id = ?
        `).bind(job.documentId).run();
        
        return { success: true };
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        // Update retry count and potentially fail
        const newRetryCount = job.retryCount + 1;
        const maxRetries = 3;
        
        if (newRetryCount >= maxRetries) {
          await db.prepare(`
            UPDATE scheduled_jobs 
            SET status = 'failed', error_message = ?, retry_count = ?
            WHERE id = ?
          `).bind(errorMessage, newRetryCount, jobId).run();
        } else {
          await db.prepare(`
            UPDATE scheduled_jobs 
            SET status = 'pending', error_message = ?, retry_count = ?
            WHERE id = ?
          `).bind(errorMessage, newRetryCount, jobId).run();
        }
        
        return { success: false, error: errorMessage };
      }
    },
    
    /**
     * Get job by ID
     */
    async get(jobId: string): Promise<ScheduledJob | null> {
      const row = await db.prepare(`
        SELECT * FROM scheduled_jobs WHERE id = ?
      `).bind(jobId).first();
      
      return row ? this.rowToJob(row) : null;
    },
    
    /**
     * Get jobs for a document
     */
    async getForDocument(documentId: string): Promise<ScheduledJob[]> {
      const { results } = await db.prepare(`
        SELECT * FROM scheduled_jobs
        WHERE document_id = ?
        ORDER BY scheduled_at DESC
      `).bind(documentId).all();
      
      return results.map(this.rowToJob);
    },
    
    /**
     * Get upcoming scheduled publications
     */
    async getUpcoming(
      options: { limit?: number; includeAll?: boolean } = {}
    ): Promise<(ScheduledJob & { documentTitle: string })[]> {
      const { limit = 20, includeAll = false } = options;
      
      let query = `
        SELECT sj.*, d.title as document_title
        FROM scheduled_jobs sj
        JOIN documents d ON sj.document_id = d.id
        WHERE sj.status = 'pending'
      `;
      
      if (!includeAll) {
        query += ` AND sj.scheduled_at > ?`;
      }
      
      query += ` ORDER BY sj.scheduled_at ASC LIMIT ?`;
      
      const params = includeAll ? [limit] : [Date.now(), limit];
      const { results } = await db.prepare(query).bind(...params).all();
      
      return results.map(row => ({
        ...this.rowToJob(row),
        documentTitle: row.document_title as string,
      }));
    },
    
    /**
     * Check embargo status
     */
    async isUnderEmbargo(documentId: string): Promise<{
      embargoed: boolean;
      until?: number;
      canScheduleBefore?: boolean;
    }> {
      const doc = await db.prepare(`
        SELECT embargo_until FROM documents WHERE id = ?
      `).bind(documentId).first();
      
      if (!doc?.embargo_until) {
        return { embargoed: false };
      }
      
      const now = Date.now();
      const until = doc.embargo_until as number;
      
      return {
        embargoed: now < until,
        until,
        canScheduleBefore: false,
      };
    },
    
    rowToJob(row: Record<string, unknown>): ScheduledJob {
      return {
        id: row.id as string,
        documentId: row.document_id as string,
        action: row.action as 'publish' | 'unpublish' | 'archive',
        scheduledAt: row.scheduled_at as number,
        timezone: row.timezone as string,
        status: row.status as ScheduledJob['status'],
        processedAt: row.processed_at as number | undefined,
        errorMessage: row.error_message as string | undefined,
        retryCount: row.retry_count as number,
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
```

### Cron Trigger

```typescript
// src/scheduled.ts - Cloudflare Workers Cron Trigger

export default {
  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ) {
    const scheduling = createSchedulingService(env.DB, ...);
    
    // Get all due jobs
    const dueJobs = await scheduling.getDueJobs();
    
    console.log(`Processing ${dueJobs.length} scheduled jobs`);
    
    // Process each job
    for (const job of dueJobs) {
      const result = await scheduling.processJob(job.id);
      
      if (!result.success) {
        console.error(`Job ${job.id} failed: ${result.error}`);
      } else {
        console.log(`Job ${job.id} completed: ${job.action} for ${job.documentId}`);
      }
    }
  },
};
```

### Wrangler Cron Configuration

```toml
# wrangler.toml

[triggers]
crons = ["* * * * *"]  # Every minute
```

---

## UI Components

### Schedule Dialog

```svelte
<!-- lib/components/scheduling/ScheduleDialog.svelte -->
<script lang="ts">
  import { format, addDays, addHours, startOfHour } from 'date-fns';
  import { formatInTimeZone } from 'date-fns-tz';
  import { Calendar, Clock, AlertTriangle } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  
  interface Props {
    documentId: string;
    documentTitle: string;
    currentStatus: string;
    embargoUntil?: number;
    existingSchedule?: ScheduledJob;
    onSchedule: (request: ScheduleRequest) => void;
    onCancel: () => void;
    onClose: () => void;
  }
  
  let { 
    documentId, 
    documentTitle, 
    currentStatus, 
    embargoUntil, 
    existingSchedule,
    onSchedule, 
    onCancel,
    onClose 
  }: Props = $props();
  
  // Default to next hour
  let scheduledDate = $state(
    format(addHours(startOfHour(new Date()), 1), "yyyy-MM-dd'T'HH:mm")
  );
  let timezone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);
  let action = $state<'publish' | 'unpublish'>('publish');
  let isEmbargo = $state(false);
  let notes = $state('');
  
  // Quick select options
  const quickOptions = [
    { label: 'In 1 hour', getValue: () => addHours(new Date(), 1) },
    { label: 'Tomorrow 9am', getValue: () => {
      const tomorrow = addDays(new Date(), 1);
      tomorrow.setHours(9, 0, 0, 0);
      return tomorrow;
    }},
    { label: 'Next Monday 9am', getValue: () => {
      const date = new Date();
      const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
      const monday = addDays(date, daysUntilMonday);
      monday.setHours(9, 0, 0, 0);
      return monday;
    }},
  ];
  
  function setQuickOption(getValue: () => Date) {
    scheduledDate = format(getValue(), "yyyy-MM-dd'T'HH:mm");
  }
  
  let scheduledTime = $derived(new Date(scheduledDate).getTime());
  let isValidTime = $derived(scheduledTime > Date.now());
  let isBeforeEmbargo = $derived(embargoUntil && scheduledTime < embargoUntil);
  
  function handleSubmit() {
    if (!isValidTime || isBeforeEmbargo) return;
    
    onSchedule({
      documentId,
      action,
      scheduledAt: scheduledDate,
      timezone,
      isEmbargo,
      notes: notes || undefined,
    });
  }
</script>

<div class="dialog-overlay">
  <div class="schedule-dialog">
    <header>
      <h2>Schedule Publication</h2>
      <p class="document-title">{documentTitle}</p>
    </header>
    
    {#if existingSchedule}
      <div class="existing-schedule">
        <AlertTriangle class="w-4 h-4" />
        <span>
          Currently scheduled to {existingSchedule.action} on 
          {format(existingSchedule.scheduledAt, 'PPp')}
        </span>
        <Button variant="ghost" size="sm" onclick={() => onCancel()}>
          Cancel existing
        </Button>
      </div>
    {/if}
    
    <div class="form-section">
      <label>Action</label>
      <div class="action-buttons">
        <button
          class="action-option"
          class:selected={action === 'publish'}
          onclick={() => action = 'publish'}
        >
          Publish
        </button>
        <button
          class="action-option"
          class:selected={action === 'unpublish'}
          onclick={() => action = 'unpublish'}
          disabled={currentStatus !== 'published'}
        >
          Unpublish
        </button>
      </div>
    </div>
    
    <div class="form-section">
      <label>Quick Select</label>
      <div class="quick-options">
        {#each quickOptions as option}
          <Button 
            variant="outline" 
            size="sm"
            onclick={() => setQuickOption(option.getValue)}
          >
            {option.label}
          </Button>
        {/each}
      </div>
    </div>
    
    <div class="form-section">
      <label for="schedule-datetime">
        <Calendar class="w-4 h-4" />
        Date & Time
      </label>
      <input
        id="schedule-datetime"
        type="datetime-local"
        bind:value={scheduledDate}
      />
      
      {#if !isValidTime}
        <p class="error">Scheduled time must be in the future</p>
      {/if}
      
      {#if isBeforeEmbargo}
        <p class="error">
          Cannot schedule before embargo lifts ({format(embargoUntil, 'PPp')})
        </p>
      {/if}
    </div>
    
    <div class="form-section">
      <label for="timezone">Timezone</label>
      <select id="timezone" bind:value={timezone}>
        <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
        <option value="America/New_York">America/New_York (ET)</option>
        <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
        <option value="Europe/London">Europe/London (GMT/BST)</option>
        <option value="UTC">UTC</option>
      </select>
    </div>
    
    {#if action === 'publish'}
      <div class="form-section">
        <label class="checkbox-label">
          <input type="checkbox" bind:checked={isEmbargo} />
          <span>
            <strong>Embargo</strong> — Content cannot be published before this time
          </span>
        </label>
      </div>
    {/if}
    
    <div class="form-section">
      <label for="notes">Notes (optional)</label>
      <textarea
        id="notes"
        bind:value={notes}
        placeholder="e.g., Coordinated with press release"
        rows="2"
      ></textarea>
    </div>
    
    <footer>
      <Button variant="outline" onclick={onClose}>
        Cancel
      </Button>
      <Button 
        onclick={handleSubmit}
        disabled={!isValidTime || isBeforeEmbargo}
      >
        <Clock class="w-4 h-4 mr-1" />
        Schedule {action === 'publish' ? 'Publish' : 'Unpublish'}
      </Button>
    </footer>
  </div>
</div>

<style>
  .dialog-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
  }
  
  .schedule-dialog {
    width: 100%;
    max-width: 480px;
    background: white;
    border-radius: 0.5rem;
    padding: 1.5rem;
  }
  
  header h2 {
    margin: 0 0 0.25rem;
  }
  
  .document-title {
    color: var(--color-text-muted);
    font-size: 0.875rem;
    margin: 0;
  }
  
  .existing-schedule {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem;
    background: var(--color-warning-light);
    border-radius: 0.375rem;
    margin: 1rem 0;
    font-size: 0.875rem;
  }
  
  .form-section {
    margin-bottom: 1rem;
  }
  
  .form-section label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    font-weight: 500;
    margin-bottom: 0.375rem;
  }
  
  .action-buttons {
    display: flex;
    gap: 0.5rem;
  }
  
  .action-option {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    background: white;
    cursor: pointer;
    font-weight: 500;
  }
  
  .action-option.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-light);
    color: var(--color-primary);
  }
  
  .action-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .quick-options {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }
  
  input[type="datetime-local"],
  select,
  textarea {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--color-border);
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }
  
  .error {
    color: var(--color-danger);
    font-size: 0.75rem;
    margin-top: 0.25rem;
  }
  
  .checkbox-label {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    cursor: pointer;
  }
  
  .checkbox-label input {
    margin-top: 0.25rem;
  }
  
  footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1.5rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-border);
  }
</style>
```

### Publication Calendar

```svelte
<!-- lib/components/scheduling/PublicationCalendar.svelte -->
<script lang="ts">
  import { 
    startOfMonth, endOfMonth, eachDayOfInterval, 
    format, isSameDay, isSameMonth, isToday 
  } from 'date-fns';
  import { ChevronLeft, ChevronRight, FileText } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  
  interface Props {
    scheduledJobs: (ScheduledJob & { documentTitle: string })[];
    onDateSelect: (date: Date) => void;
    onJobClick: (job: ScheduledJob) => void;
  }
  
  let { scheduledJobs, onDateSelect, onJobClick }: Props = $props();
  
  let currentMonth = $state(new Date());
  
  let days = $derived(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  });
  
  function getJobsForDay(day: Date) {
    return scheduledJobs.filter(job => 
      isSameDay(new Date(job.scheduledAt), day)
    );
  }
  
  function previousMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1);
  }
  
  function nextMonth() {
    currentMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1);
  }
</script>

<div class="publication-calendar">
  <header class="calendar-header">
    <Button variant="ghost" size="sm" onclick={previousMonth}>
      <ChevronLeft class="w-4 h-4" />
    </Button>
    <h3>{format(currentMonth, 'MMMM yyyy')}</h3>
    <Button variant="ghost" size="sm" onclick={nextMonth}>
      <ChevronRight class="w-4 h-4" />
    </Button>
  </header>
  
  <div class="calendar-grid">
    <div class="weekday-headers">
      {#each ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as day}
        <div class="weekday">{day}</div>
      {/each}
    </div>
    
    <div class="days-grid">
      {#each days as day}
        {@const dayJobs = getJobsForDay(day)}
        
        <button
          class="day-cell"
          class:today={isToday(day)}
          class:has-jobs={dayJobs.length > 0}
          onclick={() => onDateSelect(day)}
        >
          <span class="day-number">{format(day, 'd')}</span>
          
          {#if dayJobs.length > 0}
            <div class="day-jobs">
              {#each dayJobs.slice(0, 2) as job}
                <button
                  class="job-indicator"
                  class:publish={job.action === 'publish'}
                  class:unpublish={job.action === 'unpublish'}
                  onclick|stopPropagation={() => onJobClick(job)}
                  title="{job.documentTitle} - {job.action}"
                >
                  <FileText class="w-3 h-3" />
                </button>
              {/each}
              {#if dayJobs.length > 2}
                <span class="more-jobs">+{dayJobs.length - 2}</span>
              {/if}
            </div>
          {/if}
        </button>
      {/each}
    </div>
  </div>
</div>

<style>
  .publication-calendar {
    background: var(--color-bg-surface);
    border: 1px solid var(--color-border);
    border-radius: 0.5rem;
    padding: 1rem;
  }
  
  .calendar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
  }
  
  .calendar-header h3 {
    margin: 0;
    font-size: 1rem;
  }
  
  .weekday-headers {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }
  
  .weekday {
    text-align: center;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--color-text-muted);
    padding: 0.25rem;
  }
  
  .days-grid {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0.25rem;
  }
  
  .day-cell {
    aspect-ratio: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.25rem;
    border: none;
    background: transparent;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: background 0.15s;
  }
  
  .day-cell:hover {
    background: var(--color-bg-muted);
  }
  
  .day-cell.today {
    background: var(--color-primary-light);
  }
  
  .day-cell.today .day-number {
    color: var(--color-primary);
    font-weight: 600;
  }
  
  .day-number {
    font-size: 0.875rem;
  }
  
  .day-jobs {
    display: flex;
    gap: 0.125rem;
    margin-top: 0.125rem;
  }
  
  .job-indicator {
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    border: none;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }
  
  .job-indicator.publish {
    background: var(--color-success-light);
    color: var(--color-success);
  }
  
  .job-indicator.unpublish {
    background: var(--color-warning-light);
    color: var(--color-warning);
  }
  
  .more-jobs {
    font-size: 0.625rem;
    color: var(--color-text-muted);
  }
</style>
```

---

## Testing Strategy

```typescript
describe('SchedulingService', () => {
  it('creates a scheduled publish job', async () => {
    const job = await scheduling.schedule({
      documentId: docId,
      action: 'publish',
      scheduledAt: new Date(Date.now() + 3600000), // 1 hour from now
    }, context);
    
    expect(job.status).toBe('pending');
    expect(job.action).toBe('publish');
  });
  
  it('rejects scheduling before embargo', async () => {
    // Set embargo
    await db.prepare(`
      UPDATE documents SET embargo_until = ? WHERE id = ?
    `).bind(Date.now() + 86400000, docId).run(); // 24 hours from now
    
    await expect(scheduling.schedule({
      documentId: docId,
      action: 'publish',
      scheduledAt: new Date(Date.now() + 3600000), // 1 hour (before embargo)
    }, context)).rejects.toThrow('embargo');
  });
  
  it('processes due jobs', async () => {
    // Create job in the past
    await scheduling.schedule({
      documentId: docId,
      action: 'publish',
      scheduledAt: new Date(Date.now() - 1000), // 1 second ago
    }, context);
    
    const dueJobs = await scheduling.getDueJobs();
    expect(dueJobs).toHaveLength(1);
    
    const result = await scheduling.processJob(dueJobs[0].id);
    expect(result.success).toBe(true);
    
    // Verify document is published
    const doc = await db.prepare(`SELECT status FROM documents WHERE id = ?`).bind(docId).first();
    expect(doc?.status).toBe('published');
  });
  
  it('cancels existing job when rescheduling', async () => {
    const job1 = await scheduling.schedule({
      documentId: docId,
      action: 'publish',
      scheduledAt: new Date(Date.now() + 3600000),
    }, context);
    
    const job2 = await scheduling.schedule({
      documentId: docId,
      action: 'publish',
      scheduledAt: new Date(Date.now() + 7200000),
    }, context);
    
    const job1After = await scheduling.get(job1.id);
    expect(job1After?.status).toBe('cancelled');
    
    const job2After = await scheduling.get(job2.id);
    expect(job2After?.status).toBe('pending');
  });
});
```

---

## Related Documents

- [05-workflow-engine.md](./05-workflow-engine.md) — Workflow integration
- [01-audit-system.md](./01-audit-system.md) — Scheduling actions are audited
- [cms-content-security.md](../cms-content-security.md) — Embargo enforcement

---

*Document version: 1.0*

# Hanawa: Webhooks & Integrations Specification

Event-driven integrations with external services.

## Overview

Webhooks let external systems react to CMS events in real-time. Combined with Cloudflare Queues for reliability, this enables powerful integrations without polling.

```
┌─────────────────────────────────────────────────────────────────┐
│  WEBHOOK ARCHITECTURE                                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  CMS Event                Queue                 Delivery        │
│  ─────────                ─────                 ────────        │
│  ┌─────────┐            ┌─────────┐           ┌─────────┐      │
│  │ Publish │──enqueue──▶│  Queue  │──process─▶│ Webhook │      │
│  │ Comment │            │ (retry) │           │  URLs   │      │
│  │ Upload  │            └─────────┘           └─────────┘      │
│  └─────────┘                 │                     │           │
│                              │                     ▼           │
│                              │               ┌──────────┐      │
│                              └─retry────────▶│  Slack   │      │
│                                on failure    │  Email   │      │
│                                              │  Zapier  │      │
│                                              └──────────┘      │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Schema

```sql
-- Webhook endpoints
CREATE TABLE webhooks (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  
  -- Authentication
  secret TEXT,                      -- For HMAC signing
  auth_type TEXT DEFAULT 'none',    -- 'none', 'bearer', 'basic', 'hmac'
  auth_value TEXT,                  -- Token or credentials
  
  -- Filtering
  events TEXT NOT NULL,             -- JSON array of event types
  collections TEXT,                 -- JSON array, null = all
  
  -- Status
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Retry config
  max_retries INTEGER DEFAULT 3,
  retry_delay INTEGER DEFAULT 60,   -- Seconds
  
  -- Stats
  last_triggered_at INTEGER,
  last_success_at INTEGER,
  last_failure_at INTEGER,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  -- Audit
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_webhooks_enabled ON webhooks(enabled);

-- Webhook delivery log
CREATE TABLE webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL,
  
  -- Event
  event_type TEXT NOT NULL,
  event_id TEXT NOT NULL,
  payload TEXT NOT NULL,            -- JSON
  
  -- Delivery
  status TEXT DEFAULT 'pending',    -- 'pending', 'success', 'failed', 'retrying'
  attempts INTEGER DEFAULT 0,
  
  -- Response
  response_status INTEGER,
  response_body TEXT,
  response_time_ms INTEGER,
  
  -- Timing
  created_at INTEGER NOT NULL,
  delivered_at INTEGER,
  next_retry_at INTEGER,
  
  FOREIGN KEY (webhook_id) REFERENCES webhooks(id) ON DELETE CASCADE
);

CREATE INDEX idx_deliveries_webhook ON webhook_deliveries(webhook_id, created_at DESC);
CREATE INDEX idx_deliveries_pending ON webhook_deliveries(status, next_retry_at)
  WHERE status IN ('pending', 'retrying');

-- Integration configs (Slack, Email, etc.)
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,               -- 'slack', 'email', 'teams'
  name TEXT NOT NULL,
  config TEXT NOT NULL,             -- JSON config
  enabled BOOLEAN DEFAULT TRUE,
  
  -- Filtering
  events TEXT NOT NULL,             -- JSON array
  collections TEXT,                 -- JSON array
  
  created_by TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

### Event Types

```typescript
type WebhookEvent =
  // Document events
  | 'document.created'
  | 'document.updated'
  | 'document.published'
  | 'document.unpublished'
  | 'document.deleted'
  | 'document.archived'
  
  // Workflow events
  | 'workflow.submitted'
  | 'workflow.approved'
  | 'workflow.rejected'
  | 'workflow.stage_changed'
  
  // Comment events
  | 'comment.created'
  | 'comment.resolved'
  | 'comment.mention'
  
  // Media events
  | 'media.uploaded'
  | 'media.deleted'
  
  // User events
  | 'user.invited'
  | 'user.removed';

interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: number;
  
  // Resource data
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
  
  // Context
  actor: {
    id: string;
    email: string;
    name?: string;
  };
  
  // Previous state (for updates)
  previous?: Record<string, unknown>;
}
```

---

## API Design

### Webhook Service

```typescript
// lib/server/webhooks.ts

export function createWebhookService(
  db: D1Database,
  queue: Queue
) {
  return {
    /**
     * Create a new webhook
     */
    async create(
      data: {
        name: string;
        url: string;
        events: WebhookEvent[];
        secret?: string;
        authType?: 'none' | 'bearer' | 'basic' | 'hmac';
        authValue?: string;
        collections?: string[];
      },
      context: AuditContext
    ): Promise<Webhook> {
      const id = crypto.randomUUID();
      const now = Date.now();
      
      // Validate URL
      try {
        new URL(data.url);
      } catch {
        throw new Error('Invalid webhook URL');
      }
      
      await db.prepare(`
        INSERT INTO webhooks (
          id, name, url, secret, auth_type, auth_value,
          events, collections, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id, data.name, data.url, data.secret || null,
        data.authType || 'none', data.authValue || null,
        JSON.stringify(data.events),
        data.collections ? JSON.stringify(data.collections) : null,
        context.actorEmail, now, now
      ).run();
      
      return this.get(id) as Promise<Webhook>;
    },
    
    /**
     * Trigger webhooks for an event
     */
    async trigger(
      event: WebhookEvent,
      payload: Omit<WebhookPayload, 'id' | 'event' | 'timestamp'>
    ): Promise<void> {
      // Find matching webhooks
      const { results } = await db.prepare(`
        SELECT * FROM webhooks WHERE enabled = 1
      `).all();
      
      const matchingWebhooks = results.filter(webhook => {
        const events = JSON.parse(webhook.events as string);
        if (!events.includes(event)) return false;
        
        // Check collection filter
        if (webhook.collections) {
          const collections = JSON.parse(webhook.collections as string);
          if (!collections.includes(payload.data.type)) return false;
        }
        
        return true;
      });
      
      // Enqueue deliveries
      const fullPayload: WebhookPayload = {
        id: crypto.randomUUID(),
        event,
        timestamp: Date.now(),
        ...payload,
      };
      
      for (const webhook of matchingWebhooks) {
        await queue.send({
          type: 'webhook_delivery',
          webhookId: webhook.id,
          payload: fullPayload,
        });
        
        // Log delivery attempt
        await db.prepare(`
          INSERT INTO webhook_deliveries (
            id, webhook_id, event_type, event_id, payload, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          crypto.randomUUID(),
          webhook.id,
          event,
          fullPayload.id,
          JSON.stringify(fullPayload),
          Date.now()
        ).run();
      }
    },
    
    /**
     * Deliver a webhook (called by queue consumer)
     */
    async deliver(
      webhookId: string,
      payload: WebhookPayload,
      deliveryId: string
    ): Promise<{ success: boolean; statusCode?: number; error?: string }> {
      const webhook = await this.get(webhookId);
      if (!webhook || !webhook.enabled) {
        return { success: false, error: 'Webhook not found or disabled' };
      }
      
      const startTime = Date.now();
      
      try {
        // Build request
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'X-Webhook-ID': webhook.id,
          'X-Event-Type': payload.event,
          'X-Delivery-ID': deliveryId,
          'X-Timestamp': String(payload.timestamp),
        };
        
        // Add authentication
        if (webhook.authType === 'bearer' && webhook.authValue) {
          headers['Authorization'] = `Bearer ${webhook.authValue}`;
        } else if (webhook.authType === 'basic' && webhook.authValue) {
          headers['Authorization'] = `Basic ${btoa(webhook.authValue)}`;
        } else if (webhook.authType === 'hmac' && webhook.secret) {
          const signature = await this.signPayload(payload, webhook.secret);
          headers['X-Signature'] = signature;
        }
        
        // Send request
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
        });
        
        const responseTime = Date.now() - startTime;
        const responseBody = await response.text();
        
        // Update delivery record
        await db.prepare(`
          UPDATE webhook_deliveries
          SET status = ?, attempts = attempts + 1,
              response_status = ?, response_body = ?, response_time_ms = ?,
              delivered_at = ?
          WHERE id = ?
        `).bind(
          response.ok ? 'success' : 'failed',
          response.status,
          responseBody.slice(0, 1000), // Limit stored response
          responseTime,
          Date.now(),
          deliveryId
        ).run();
        
        // Update webhook stats
        await db.prepare(`
          UPDATE webhooks
          SET last_triggered_at = ?,
              ${response.ok ? 'last_success_at' : 'last_failure_at'} = ?,
              ${response.ok ? 'success_count' : 'failure_count'} = ${response.ok ? 'success_count' : 'failure_count'} + 1
          WHERE id = ?
        `).bind(Date.now(), Date.now(), webhookId).run();
        
        return {
          success: response.ok,
          statusCode: response.status,
          error: response.ok ? undefined : `HTTP ${response.status}`,
        };
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        await db.prepare(`
          UPDATE webhook_deliveries
          SET status = 'failed', attempts = attempts + 1, response_body = ?
          WHERE id = ?
        `).bind(errorMessage, deliveryId).run();
        
        return { success: false, error: errorMessage };
      }
    },
    
    /**
     * Sign payload with HMAC
     */
    async signPayload(payload: WebhookPayload, secret: string): Promise<string> {
      const encoder = new TextEncoder();
      const data = encoder.encode(JSON.stringify(payload));
      const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', key, data);
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    },
    
    /**
     * Test a webhook
     */
    async test(webhookId: string): Promise<{
      success: boolean;
      statusCode?: number;
      responseTime?: number;
      error?: string;
    }> {
      const testPayload: WebhookPayload = {
        id: 'test-' + crypto.randomUUID(),
        event: 'document.updated',
        timestamp: Date.now(),
        data: {
          id: 'test-doc',
          type: 'test',
          attributes: { title: 'Test Document' },
        },
        actor: {
          id: 'system',
          email: 'test@hanawa.internal',
          name: 'Webhook Test',
        },
      };
      
      return this.deliver(webhookId, testPayload, 'test-delivery');
    },
    
    /**
     * Get delivery history
     */
    async getDeliveries(
      webhookId: string,
      options: { page?: number; perPage?: number } = {}
    ): Promise<WebhookDelivery[]> {
      const { page = 1, perPage = 20 } = options;
      const offset = (page - 1) * perPage;
      
      const { results } = await db.prepare(`
        SELECT * FROM webhook_deliveries
        WHERE webhook_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `).bind(webhookId, perPage, offset).all();
      
      return results.map(this.rowToDelivery);
    },
    
    /**
     * Retry failed deliveries
     */
    async retryFailed(deliveryId: string): Promise<void> {
      const delivery = await db.prepare(`
        SELECT * FROM webhook_deliveries WHERE id = ?
      `).bind(deliveryId).first();
      
      if (!delivery) throw new Error('Delivery not found');
      
      const payload = JSON.parse(delivery.payload as string);
      
      await queue.send({
        type: 'webhook_delivery',
        webhookId: delivery.webhook_id,
        payload,
        deliveryId,
        isRetry: true,
      });
      
      await db.prepare(`
        UPDATE webhook_deliveries SET status = 'retrying' WHERE id = ?
      `).bind(deliveryId).run();
    },
    
    // Standard CRUD
    async get(id: string): Promise<Webhook | null> {
      const row = await db.prepare(`SELECT * FROM webhooks WHERE id = ?`).bind(id).first();
      return row ? this.rowToWebhook(row) : null;
    },
    
    async list(): Promise<Webhook[]> {
      const { results } = await db.prepare(`SELECT * FROM webhooks ORDER BY name`).all();
      return results.map(this.rowToWebhook);
    },
    
    async update(id: string, data: Partial<Webhook>): Promise<Webhook> {
      // Implementation
      return this.get(id) as Promise<Webhook>;
    },
    
    async delete(id: string): Promise<void> {
      await db.prepare(`DELETE FROM webhooks WHERE id = ?`).bind(id).run();
    },
    
    rowToWebhook(row: Record<string, unknown>): Webhook {
      return {
        id: row.id as string,
        name: row.name as string,
        url: row.url as string,
        secret: row.secret as string | undefined,
        authType: row.auth_type as string,
        authValue: row.auth_value as string | undefined,
        events: JSON.parse(row.events as string),
        collections: row.collections ? JSON.parse(row.collections as string) : undefined,
        enabled: Boolean(row.enabled),
        maxRetries: row.max_retries as number,
        lastTriggeredAt: row.last_triggered_at as number | undefined,
        successCount: row.success_count as number,
        failureCount: row.failure_count as number,
        createdAt: row.created_at as number,
      };
    },
    
    rowToDelivery(row: Record<string, unknown>): WebhookDelivery {
      return {
        id: row.id as string,
        webhookId: row.webhook_id as string,
        eventType: row.event_type as string,
        payload: JSON.parse(row.payload as string),
        status: row.status as string,
        attempts: row.attempts as number,
        responseStatus: row.response_status as number | undefined,
        responseBody: row.response_body as string | undefined,
        responseTimeMs: row.response_time_ms as number | undefined,
        createdAt: row.created_at as number,
        deliveredAt: row.delivered_at as number | undefined,
      };
    },
  };
}
```

---

## Built-in Integrations

### Slack Integration

```typescript
// lib/server/integrations/slack.ts

interface SlackConfig {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconEmoji?: string;
}

export function createSlackIntegration(config: SlackConfig) {
  return {
    async send(event: WebhookEvent, payload: WebhookPayload): Promise<void> {
      const message = this.formatMessage(event, payload);
      
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: config.channel,
          username: config.username || 'Hanawa CMS',
          icon_emoji: config.iconEmoji || ':newspaper:',
          ...message,
        }),
      });
    },
    
    formatMessage(event: WebhookEvent, payload: WebhookPayload) {
      const baseUrl = 'https://cms.example.com';
      
      switch (event) {
        case 'document.published':
          return {
            text: `📢 Document Published`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${payload.data.attributes.title}* was published by ${payload.actor.name || payload.actor.email}`,
                },
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: 'View Document' },
                    url: `${baseUrl}/admin/documents/${payload.data.id}`,
                  },
                ],
              },
            ],
          };
        
        case 'workflow.submitted':
          return {
            text: `📝 Review Requested`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*${payload.data.attributes.title}* needs review\nSubmitted by ${payload.actor.name || payload.actor.email}`,
                },
              },
              {
                type: 'actions',
                elements: [
                  {
                    type: 'button',
                    text: { type: 'plain_text', text: 'Review Now' },
                    style: 'primary',
                    url: `${baseUrl}/admin/documents/${payload.data.id}`,
                  },
                ],
              },
            ],
          };
        
        case 'comment.mention':
          return {
            text: `💬 You were mentioned`,
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `${payload.actor.name || payload.actor.email} mentioned you in a comment on *${payload.data.attributes.documentTitle}*:\n>${payload.data.attributes.excerpt}`,
                },
              },
            ],
          };
        
        default:
          return {
            text: `${event}: ${payload.data.attributes.title || payload.data.id}`,
          };
      }
    },
  };
}
```

### Email Digest Integration

```typescript
// lib/server/integrations/email-digest.ts

interface DigestConfig {
  recipients: string[];
  frequency: 'daily' | 'weekly';
  sendTime: string;  // HH:MM in UTC
  timezone: string;
}

export function createEmailDigestIntegration(
  db: D1Database,
  emailService: EmailService,
  config: DigestConfig
) {
  return {
    /**
     * Collect events for digest
     */
    async collectEvent(event: WebhookEvent, payload: WebhookPayload): Promise<void> {
      await db.prepare(`
        INSERT INTO digest_events (id, event_type, payload, created_at)
        VALUES (?, ?, ?, ?)
      `).bind(
        crypto.randomUUID(),
        event,
        JSON.stringify(payload),
        Date.now()
      ).run();
    },
    
    /**
     * Send digest (called by cron)
     */
    async sendDigest(): Promise<void> {
      const since = this.getDigestPeriodStart();
      
      const { results } = await db.prepare(`
        SELECT * FROM digest_events
        WHERE created_at >= ?
        ORDER BY created_at ASC
      `).bind(since).all();
      
      if (results.length === 0) return;
      
      // Group by event type
      const grouped = this.groupEvents(results);
      
      // Generate email content
      const html = this.generateEmailHtml(grouped);
      
      // Send to recipients
      for (const recipient of config.recipients) {
        await emailService.send({
          to: recipient,
          subject: `Hanawa CMS ${config.frequency} Digest`,
          html,
        });
      }
      
      // Clear processed events
      await db.prepare(`
        DELETE FROM digest_events WHERE created_at >= ?
      `).bind(since).run();
    },
    
    getDigestPeriodStart(): number {
      const now = new Date();
      if (config.frequency === 'daily') {
        now.setDate(now.getDate() - 1);
      } else {
        now.setDate(now.getDate() - 7);
      }
      return now.getTime();
    },
    
    groupEvents(events: any[]): Record<string, any[]> {
      const grouped: Record<string, any[]> = {};
      
      for (const event of events) {
        const type = event.event_type;
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(JSON.parse(event.payload));
      }
      
      return grouped;
    },
    
    generateEmailHtml(grouped: Record<string, any[]>): string {
      let html = `
        <h1>Hanawa CMS Activity Summary</h1>
        <p>Here's what happened in the last ${config.frequency === 'daily' ? '24 hours' : 'week'}:</p>
      `;
      
      if (grouped['document.published']) {
        html += `
          <h2>📢 Published (${grouped['document.published'].length})</h2>
          <ul>
            ${grouped['document.published'].map(p => `
              <li><strong>${p.data.attributes.title}</strong> by ${p.actor.email}</li>
            `).join('')}
          </ul>
        `;
      }
      
      if (grouped['workflow.submitted']) {
        html += `
          <h2>📝 Pending Review (${grouped['workflow.submitted'].length})</h2>
          <ul>
            ${grouped['workflow.submitted'].map(p => `
              <li><strong>${p.data.attributes.title}</strong></li>
            `).join('')}
          </ul>
        `;
      }
      
      if (grouped['comment.created']) {
        html += `
          <h2>💬 New Comments (${grouped['comment.created'].length})</h2>
        `;
      }
      
      return html;
    },
  };
}
```

---

## Queue Consumer

```typescript
// src/queue-consumer.ts

export default {
  async queue(
    batch: MessageBatch<WebhookQueueMessage>,
    env: Env
  ): Promise<void> {
    const webhookService = createWebhookService(env.DB, env.WEBHOOK_QUEUE);
    
    for (const message of batch.messages) {
      const { type, webhookId, payload, deliveryId } = message.body;
      
      if (type === 'webhook_delivery') {
        const result = await webhookService.deliver(
          webhookId,
          payload,
          deliveryId || crypto.randomUUID()
        );
        
        if (result.success) {
          message.ack();
        } else {
          // Retry with backoff
          message.retry({ delaySeconds: 60 * (message.attempts || 1) });
        }
      }
    }
  },
};
```

### Wrangler Configuration

```toml
# wrangler.toml

[[queues.producers]]
queue = "webhook-delivery"
binding = "WEBHOOK_QUEUE"

[[queues.consumers]]
queue = "webhook-delivery"
max_batch_size = 10
max_retries = 3
dead_letter_queue = "webhook-dlq"
```

---

## UI Components

### Webhook Manager

```svelte
<!-- lib/components/webhooks/WebhookManager.svelte -->
<script lang="ts">
  import { Plus, Play, Trash2, CheckCircle, XCircle, Clock } from 'lucide-svelte';
  import { Button } from '$lib/components/ui/button';
  import WebhookForm from './WebhookForm.svelte';
  import DeliveryLog from './DeliveryLog.svelte';
  
  let webhooks = $state<Webhook[]>([]);
  let selectedWebhook = $state<Webhook | null>(null);
  let showForm = $state(false);
  let testing = $state<string | null>(null);
  
  async function loadWebhooks() {
    const response = await fetch('/api/webhooks');
    webhooks = await response.json();
  }
  
  async function testWebhook(id: string) {
    testing = id;
    try {
      const response = await fetch(`/api/webhooks/${id}/test`, { method: 'POST' });
      const result = await response.json();
      // Show result toast
    } finally {
      testing = null;
    }
  }
  
  async function deleteWebhook(id: string) {
    if (!confirm('Delete this webhook?')) return;
    await fetch(`/api/webhooks/${id}`, { method: 'DELETE' });
    loadWebhooks();
  }
  
  $effect(() => {
    loadWebhooks();
  });
</script>

<div class="webhook-manager">
  <header>
    <h2>Webhooks</h2>
    <Button onclick={() => showForm = true}>
      <Plus class="w-4 h-4" />
      Add Webhook
    </Button>
  </header>
  
  <div class="webhook-list">
    {#each webhooks as webhook}
      <div class="webhook-card">
        <div class="webhook-header">
          <div class="webhook-info">
            <h3>{webhook.name}</h3>
            <code class="url">{webhook.url}</code>
          </div>
          
          <div class="webhook-status">
            {#if webhook.enabled}
              <span class="status enabled">
                <CheckCircle class="w-4 h-4" />
                Enabled
              </span>
            {:else}
              <span class="status disabled">
                <XCircle class="w-4 h-4" />
                Disabled
              </span>
            {/if}
          </div>
        </div>
        
        <div class="webhook-meta">
          <span class="events">
            {webhook.events.length} event{webhook.events.length !== 1 ? 's' : ''}
          </span>
          <span class="stats">
            <CheckCircle class="w-3 h-3" /> {webhook.successCount}
            <XCircle class="w-3 h-3" /> {webhook.failureCount}
          </span>
          {#if webhook.lastTriggeredAt}
            <span class="last-triggered">
              <Clock class="w-3 h-3" />
              Last triggered {new Date(webhook.lastTriggeredAt).toLocaleDateString()}
            </span>
          {/if}
        </div>
        
        <div class="webhook-actions">
          <Button 
            variant="outline" 
            size="sm"
            onclick={() => testWebhook(webhook.id)}
            disabled={testing === webhook.id}
          >
            <Play class="w-4 h-4" />
            {testing === webhook.id ? 'Testing...' : 'Test'}
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onclick={() => selectedWebhook = webhook}
          >
            View Logs
          </Button>
          <Button 
            variant="ghost" 
            size="sm"
            onclick={() => deleteWebhook(webhook.id)}
          >
            <Trash2 class="w-4 h-4" />
          </Button>
        </div>
      </div>
    {/each}
  </div>
</div>

{#if showForm}
  <WebhookForm
    onSave={() => {
      showForm = false;
      loadWebhooks();
    }}
    onClose={() => showForm = false}
  />
{/if}

{#if selectedWebhook}
  <DeliveryLog
    webhookId={selectedWebhook.id}
    onClose={() => selectedWebhook = null}
  />
{/if}
```

---

## Testing Strategy

```typescript
describe('WebhookService', () => {
  it('triggers matching webhooks', async () => {
    const webhook = await webhooks.create({
      name: 'Test',
      url: 'https://example.com/webhook',
      events: ['document.published'],
    }, context);
    
    await webhooks.trigger('document.published', {
      data: { id: 'doc1', type: 'post', attributes: { title: 'Test' } },
      actor: { id: 'user1', email: 'test@example.com' },
    });
    
    // Check queue received message
    const messages = await queue.getMessages();
    expect(messages).toHaveLength(1);
    expect(messages[0].webhookId).toBe(webhook.id);
  });
  
  it('filters by collection', async () => {
    await webhooks.create({
      name: 'Posts Only',
      url: 'https://example.com/webhook',
      events: ['document.published'],
      collections: ['posts'],
    }, context);
    
    // This should NOT trigger
    await webhooks.trigger('document.published', {
      data: { id: 'doc1', type: 'pages', attributes: {} },
      actor: { id: 'user1', email: 'test@example.com' },
    });
    
    const messages = await queue.getMessages();
    expect(messages).toHaveLength(0);
  });
  
  it('signs payload with HMAC', async () => {
    const webhook = await webhooks.create({
      name: 'Signed',
      url: 'https://example.com/webhook',
      events: ['document.updated'],
      authType: 'hmac',
      secret: 'test-secret',
    }, context);
    
    const payload = { id: '1', event: 'document.updated', timestamp: Date.now() };
    const signature = await webhooks.signPayload(payload, 'test-secret');
    
    expect(signature).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

---

## Related Documents

- [01-audit-system.md](./01-audit-system.md) — Events trigger webhooks
- [05-workflow-engine.md](./05-workflow-engine.md) — Workflow events
- [04-comments-system.md](./04-comments-system.md) — Comment events

---

*Document version: 1.0*

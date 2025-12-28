/**
 * Webhook Service
 * Event-driven integrations with external services
 *
 * InfoSec: HMAC signing, URL validation, rate limiting (OWASP A01, A03)
 */

import type { D1Database } from "@cloudflare/workers-types";
import type { AuditService, AuditContext } from "./audit";

// Event types that can trigger webhooks
export type WebhookEvent =
  | "document.created"
  | "document.updated"
  | "document.published"
  | "document.unpublished"
  | "document.deleted"
  | "document.archived"
  | "workflow.submitted"
  | "workflow.approved"
  | "workflow.rejected"
  | "workflow.stage_changed"
  | "comment.created"
  | "comment.resolved"
  | "comment.mention"
  | "media.uploaded"
  | "media.deleted";

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string | null;
  auth_type: "none" | "bearer" | "basic" | "hmac";
  auth_value: string | null;
  events: WebhookEvent[];
  collections: string[] | null;
  enabled: boolean;
  max_retries: number;
  retry_delay: number;
  last_triggered_at: number | null;
  last_success_at: number | null;
  last_failure_at: number | null;
  success_count: number;
  failure_count: number;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface WebhookDelivery {
  id: string;
  webhook_id: string;
  event_type: string;
  event_id: string;
  payload: string;
  status: "pending" | "success" | "failed" | "retrying";
  attempts: number;
  response_status: number | null;
  response_body: string | null;
  response_time_ms: number | null;
  created_at: number;
  delivered_at: number | null;
  next_retry_at: number | null;
}

export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: number;
  data: {
    id: string;
    type: string;
    attributes: Record<string, unknown>;
    relationships?: Record<string, unknown>;
  };
  actor: {
    id: string;
    email: string;
    name?: string;
  };
  previous?: Record<string, unknown>;
}

export interface Integration {
  id: string;
  type: "slack" | "email" | "teams";
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  events: WebhookEvent[];
  collections: string[] | null;
  created_by: string;
  created_at: number;
  updated_at: number;
}

export interface CreateWebhookOptions {
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  authType?: "none" | "bearer" | "basic" | "hmac";
  authValue?: string;
  collections?: string[];
  maxRetries?: number;
  retryDelay?: number;
}

export interface DeliveryResult {
  success: boolean;
  statusCode?: number;
  responseTime?: number;
  error?: string;
}

/**
 * Sign payload with HMAC-SHA256
 * InfoSec: Cryptographic signature for webhook authenticity
 */
async function signPayload(
  payload: WebhookPayload,
  secret: string
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(JSON.stringify(payload));
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", key, data);
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Validate URL is HTTPS and not private/localhost
 * InfoSec: Prevent SSRF attacks (OWASP A10)
 */
function validateWebhookUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid webhook URL");
  }

  // InfoSec: Require HTTPS
  if (parsed.protocol !== "https:") {
    throw new Error("Webhook URL must use HTTPS");
  }

  // InfoSec: Block localhost and private IPs
  const hostname = parsed.hostname.toLowerCase();
  const blockedPatterns = [
    "localhost",
    "127.0.0.1",
    "0.0.0.0",
    "::1",
    "10.",
    "192.168.",
    "172.16.",
    "172.17.",
    "172.18.",
    "172.19.",
    "172.20.",
    "172.21.",
    "172.22.",
    "172.23.",
    "172.24.",
    "172.25.",
    "172.26.",
    "172.27.",
    "172.28.",
    "172.29.",
    "172.30.",
    "172.31.",
    "169.254.",
  ];

  for (const pattern of blockedPatterns) {
    if (hostname === pattern || hostname.startsWith(pattern)) {
      throw new Error("Webhook URL cannot target private networks");
    }
  }
}

export function createWebhookService(db: D1Database, audit?: AuditService) {
  return {
    /**
     * Create a new webhook
     */
    async create(
      options: CreateWebhookOptions,
      context: AuditContext
    ): Promise<Webhook> {
      // InfoSec: Validate URL before storing
      validateWebhookUrl(options.url);

      const id = crypto.randomUUID();
      const now = Date.now();

      await db
        .prepare(
          `
        INSERT INTO webhooks (
          id, name, url, secret, auth_type, auth_value,
          events, collections, max_retries, retry_delay,
          created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          id,
          options.name,
          options.url,
          options.secret || null,
          options.authType || "none",
          options.authValue || null,
          JSON.stringify(options.events),
          options.collections ? JSON.stringify(options.collections) : null,
          options.maxRetries || 3,
          options.retryDelay || 60,
          context.actorEmail,
          now,
          now
        )
        .run();

      if (audit) {
        await audit.log(
          {
            action: "create",
            actionCategory: "system",
            resourceType: "webhook",
            resourceId: id,
            resourceTitle: options.name,
            metadata: {
              url: options.url,
              events: options.events,
              authType: options.authType || "none",
            },
          },
          context
        );
      }

      return this.get(id) as Promise<Webhook>;
    },

    /**
     * Get webhook by ID
     */
    async get(id: string): Promise<Webhook | null> {
      const row = await db
        .prepare("SELECT * FROM webhooks WHERE id = ?")
        .bind(id)
        .first();

      if (!row) return null;
      return this.rowToWebhook(row);
    },

    /**
     * List all webhooks
     */
    async list(): Promise<Webhook[]> {
      const { results } = await db
        .prepare("SELECT * FROM webhooks ORDER BY name")
        .all();

      return results.map((row) => this.rowToWebhook(row));
    },

    /**
     * Update webhook
     */
    async update(
      id: string,
      updates: Partial<CreateWebhookOptions> & { enabled?: boolean },
      context: AuditContext
    ): Promise<Webhook> {
      if (updates.url) {
        validateWebhookUrl(updates.url);
      }

      const setClauses: string[] = ["updated_at = ?"];
      const params: unknown[] = [Date.now()];

      if (updates.name !== undefined) {
        setClauses.push("name = ?");
        params.push(updates.name);
      }
      if (updates.url !== undefined) {
        setClauses.push("url = ?");
        params.push(updates.url);
      }
      if (updates.secret !== undefined) {
        setClauses.push("secret = ?");
        params.push(updates.secret);
      }
      if (updates.authType !== undefined) {
        setClauses.push("auth_type = ?");
        params.push(updates.authType);
      }
      if (updates.authValue !== undefined) {
        setClauses.push("auth_value = ?");
        params.push(updates.authValue);
      }
      if (updates.events !== undefined) {
        setClauses.push("events = ?");
        params.push(JSON.stringify(updates.events));
      }
      if (updates.collections !== undefined) {
        setClauses.push("collections = ?");
        params.push(
          updates.collections ? JSON.stringify(updates.collections) : null
        );
      }
      if (updates.enabled !== undefined) {
        setClauses.push("enabled = ?");
        params.push(updates.enabled ? 1 : 0);
      }
      if (updates.maxRetries !== undefined) {
        setClauses.push("max_retries = ?");
        params.push(updates.maxRetries);
      }
      if (updates.retryDelay !== undefined) {
        setClauses.push("retry_delay = ?");
        params.push(updates.retryDelay);
      }

      params.push(id);

      await db
        .prepare(`UPDATE webhooks SET ${setClauses.join(", ")} WHERE id = ?`)
        .bind(...params)
        .run();

      if (audit) {
        await audit.log(
          {
            action: "update",
            actionCategory: "system",
            resourceType: "webhook",
            resourceId: id,
            metadata: updates,
          },
          context
        );
      }

      return this.get(id) as Promise<Webhook>;
    },

    /**
     * Delete webhook
     */
    async delete(id: string, context: AuditContext): Promise<void> {
      const webhook = await this.get(id);
      if (!webhook) throw new Error(`Webhook not found: ${id}`);

      await db.prepare("DELETE FROM webhooks WHERE id = ?").bind(id).run();

      if (audit) {
        await audit.log(
          {
            action: "delete",
            actionCategory: "system",
            resourceType: "webhook",
            resourceId: id,
            resourceTitle: webhook.name,
          },
          context
        );
      }
    },

    /**
     * Trigger webhooks for an event
     */
    async trigger(
      event: WebhookEvent,
      data: Omit<WebhookPayload, "id" | "event" | "timestamp">
    ): Promise<void> {
      // Find matching enabled webhooks
      const { results } = await db
        .prepare("SELECT * FROM webhooks WHERE enabled = 1")
        .all();

      const matchingWebhooks = results.filter((row) => {
        const events = JSON.parse(row.events as string) as WebhookEvent[];
        if (!events.includes(event)) return false;

        // Check collection filter
        if (row.collections) {
          const collections = JSON.parse(row.collections as string) as string[];
          if (!collections.includes(data.data.type)) return false;
        }

        return true;
      });

      if (matchingWebhooks.length === 0) return;

      // Build full payload
      const fullPayload: WebhookPayload = {
        id: crypto.randomUUID(),
        event,
        timestamp: Date.now(),
        ...data,
      };

      // Deliver to each matching webhook
      for (const row of matchingWebhooks) {
        const webhook = this.rowToWebhook(row);
        const deliveryId = crypto.randomUUID();

        // Create delivery record
        await db
          .prepare(
            `
          INSERT INTO webhook_deliveries (
            id, webhook_id, event_type, event_id, payload, created_at
          ) VALUES (?, ?, ?, ?, ?, ?)
        `
          )
          .bind(
            deliveryId,
            webhook.id,
            event,
            fullPayload.id,
            JSON.stringify(fullPayload),
            Date.now()
          )
          .run();

        // Attempt delivery (fire and forget for now)
        this.deliver(webhook, fullPayload, deliveryId).catch(() => {
          // Errors are logged in the delivery record
        });
      }
    },

    /**
     * Deliver a webhook
     */
    async deliver(
      webhook: Webhook,
      payload: WebhookPayload,
      deliveryId: string
    ): Promise<DeliveryResult> {
      const startTime = Date.now();

      try {
        // Build headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          "X-Webhook-ID": webhook.id,
          "X-Event-Type": payload.event,
          "X-Delivery-ID": deliveryId,
          "X-Timestamp": String(payload.timestamp),
          "User-Agent": "Hanawa-CMS-Webhook/1.0",
        };

        // InfoSec: Add authentication
        if (webhook.auth_type === "bearer" && webhook.auth_value) {
          headers["Authorization"] = `Bearer ${webhook.auth_value}`;
        } else if (webhook.auth_type === "basic" && webhook.auth_value) {
          headers["Authorization"] = `Basic ${btoa(webhook.auth_value)}`;
        } else if (webhook.auth_type === "hmac" && webhook.secret) {
          const signature = await signPayload(payload, webhook.secret);
          headers["X-Signature"] = signature;
          headers["X-Signature-Algorithm"] = "sha256";
        }

        // Send request
        const response = await fetch(webhook.url, {
          method: "POST",
          headers,
          body: JSON.stringify(payload),
        });

        const responseTime = Date.now() - startTime;
        const responseBody = await response.text();

        // Update delivery record
        await db
          .prepare(
            `
          UPDATE webhook_deliveries
          SET status = ?, attempts = attempts + 1,
              response_status = ?, response_body = ?, response_time_ms = ?,
              delivered_at = ?
          WHERE id = ?
        `
          )
          .bind(
            response.ok ? "success" : "failed",
            response.status,
            responseBody.slice(0, 1000), // Limit stored response
            responseTime,
            Date.now(),
            deliveryId
          )
          .run();

        // Update webhook stats
        await db
          .prepare(
            `
          UPDATE webhooks
          SET last_triggered_at = ?,
              ${response.ok ? "last_success_at" : "last_failure_at"} = ?,
              ${response.ok ? "success_count = success_count + 1" : "failure_count = failure_count + 1"}
          WHERE id = ?
        `
          )
          .bind(Date.now(), Date.now(), webhook.id)
          .run();

        return {
          success: response.ok,
          statusCode: response.status,
          responseTime,
          error: response.ok ? undefined : `HTTP ${response.status}`,
        };
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";

        await db
          .prepare(
            `
          UPDATE webhook_deliveries
          SET status = 'failed', attempts = attempts + 1, response_body = ?
          WHERE id = ?
        `
          )
          .bind(errorMessage, deliveryId)
          .run();

        await db
          .prepare(
            `
          UPDATE webhooks
          SET last_triggered_at = ?, last_failure_at = ?, failure_count = failure_count + 1
          WHERE id = ?
        `
          )
          .bind(Date.now(), Date.now(), webhook.id)
          .run();

        return { success: false, error: errorMessage };
      }
    },

    /**
     * Test a webhook
     */
    async test(webhookId: string): Promise<DeliveryResult> {
      const webhook = await this.get(webhookId);
      if (!webhook) throw new Error(`Webhook not found: ${webhookId}`);

      const testPayload: WebhookPayload = {
        id: `test-${crypto.randomUUID()}`,
        event: "document.updated",
        timestamp: Date.now(),
        data: {
          id: "test-doc",
          type: "test",
          attributes: { title: "Test Document" },
        },
        actor: {
          id: "system",
          email: "test@hanawa.internal",
          name: "Webhook Test",
        },
      };

      return this.deliver(webhook, testPayload, `test-${crypto.randomUUID()}`);
    },

    /**
     * Get delivery history for a webhook
     */
    async getDeliveries(
      webhookId: string,
      options: { page?: number; perPage?: number } = {}
    ): Promise<{ deliveries: WebhookDelivery[]; total: number }> {
      const page = options.page || 1;
      const perPage = options.perPage || 20;
      const offset = (page - 1) * perPage;

      const countResult = await db
        .prepare(
          "SELECT COUNT(*) as total FROM webhook_deliveries WHERE webhook_id = ?"
        )
        .bind(webhookId)
        .first();
      const total = (countResult?.total as number) || 0;

      const { results } = await db
        .prepare(
          `
        SELECT * FROM webhook_deliveries
        WHERE webhook_id = ?
        ORDER BY created_at DESC
        LIMIT ? OFFSET ?
      `
        )
        .bind(webhookId, perPage, offset)
        .all();

      return {
        deliveries: results.map((row) => this.rowToDelivery(row)),
        total,
      };
    },

    /**
     * Retry a failed delivery
     */
    async retryDelivery(deliveryId: string): Promise<DeliveryResult> {
      const row = await db
        .prepare("SELECT * FROM webhook_deliveries WHERE id = ?")
        .bind(deliveryId)
        .first();

      if (!row) throw new Error(`Delivery not found: ${deliveryId}`);

      const webhook = await this.get(row.webhook_id as string);
      if (!webhook) throw new Error("Associated webhook not found");

      const payload = JSON.parse(row.payload as string) as WebhookPayload;

      // Update status to retrying
      await db
        .prepare("UPDATE webhook_deliveries SET status = 'retrying' WHERE id = ?")
        .bind(deliveryId)
        .run();

      return this.deliver(webhook, payload, deliveryId);
    },

    // ===== Integration Management =====

    /**
     * Create an integration (Slack, Email, Teams)
     */
    async createIntegration(
      data: {
        type: "slack" | "email" | "teams";
        name: string;
        config: Record<string, unknown>;
        events: WebhookEvent[];
        collections?: string[];
      },
      context: AuditContext
    ): Promise<Integration> {
      const id = crypto.randomUUID();
      const now = Date.now();

      await db
        .prepare(
          `
        INSERT INTO integrations (
          id, type, name, config, events, collections, created_by, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .bind(
          id,
          data.type,
          data.name,
          JSON.stringify(data.config),
          JSON.stringify(data.events),
          data.collections ? JSON.stringify(data.collections) : null,
          context.actorEmail,
          now,
          now
        )
        .run();

      if (audit) {
        await audit.log(
          {
            action: "create",
            actionCategory: "system",
            resourceType: "integration",
            resourceId: id,
            resourceTitle: data.name,
            metadata: { type: data.type },
          },
          context
        );
      }

      return this.getIntegration(id) as Promise<Integration>;
    },

    /**
     * Get integration by ID
     */
    async getIntegration(id: string): Promise<Integration | null> {
      const row = await db
        .prepare("SELECT * FROM integrations WHERE id = ?")
        .bind(id)
        .first();

      if (!row) return null;
      return this.rowToIntegration(row);
    },

    /**
     * List integrations
     */
    async listIntegrations(type?: string): Promise<Integration[]> {
      let query = "SELECT * FROM integrations";
      const params: string[] = [];

      if (type) {
        query += " WHERE type = ?";
        params.push(type);
      }

      query += " ORDER BY name";

      const { results } = await db
        .prepare(query)
        .bind(...params)
        .all();

      return results.map((row) => this.rowToIntegration(row));
    },

    /**
     * Delete integration
     */
    async deleteIntegration(id: string, context: AuditContext): Promise<void> {
      const integration = await this.getIntegration(id);
      if (!integration) throw new Error(`Integration not found: ${id}`);

      await db.prepare("DELETE FROM integrations WHERE id = ?").bind(id).run();

      if (audit) {
        await audit.log(
          {
            action: "delete",
            actionCategory: "system",
            resourceType: "integration",
            resourceId: id,
            resourceTitle: integration.name,
          },
          context
        );
      }
    },

    // ===== Row Converters =====

    rowToWebhook(row: Record<string, unknown>): Webhook {
      return {
        id: row.id as string,
        name: row.name as string,
        url: row.url as string,
        secret: row.secret as string | null,
        auth_type: row.auth_type as "none" | "bearer" | "basic" | "hmac",
        auth_value: row.auth_value as string | null,
        events: JSON.parse(row.events as string),
        collections: row.collections
          ? JSON.parse(row.collections as string)
          : null,
        enabled: Boolean(row.enabled),
        max_retries: row.max_retries as number,
        retry_delay: row.retry_delay as number,
        last_triggered_at: row.last_triggered_at as number | null,
        last_success_at: row.last_success_at as number | null,
        last_failure_at: row.last_failure_at as number | null,
        success_count: row.success_count as number,
        failure_count: row.failure_count as number,
        created_by: row.created_by as string,
        created_at: row.created_at as number,
        updated_at: row.updated_at as number,
      };
    },

    rowToDelivery(row: Record<string, unknown>): WebhookDelivery {
      return {
        id: row.id as string,
        webhook_id: row.webhook_id as string,
        event_type: row.event_type as string,
        event_id: row.event_id as string,
        payload: row.payload as string,
        status: row.status as "pending" | "success" | "failed" | "retrying",
        attempts: row.attempts as number,
        response_status: row.response_status as number | null,
        response_body: row.response_body as string | null,
        response_time_ms: row.response_time_ms as number | null,
        created_at: row.created_at as number,
        delivered_at: row.delivered_at as number | null,
        next_retry_at: row.next_retry_at as number | null,
      };
    },

    rowToIntegration(row: Record<string, unknown>): Integration {
      return {
        id: row.id as string,
        type: row.type as "slack" | "email" | "teams",
        name: row.name as string,
        config: JSON.parse(row.config as string),
        enabled: Boolean(row.enabled),
        events: JSON.parse(row.events as string),
        collections: row.collections
          ? JSON.parse(row.collections as string)
          : null,
        created_by: row.created_by as string,
        created_at: row.created_at as number,
        updated_at: row.updated_at as number,
      };
    },
  };
}

export type WebhookService = ReturnType<typeof createWebhookService>;

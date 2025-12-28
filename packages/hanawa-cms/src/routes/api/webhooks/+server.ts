/**
 * Webhooks API Endpoint
 * List and create webhooks for event-driven integrations
 *
 * InfoSec: Admin-only access, URL validation (OWASP A01, A10)
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createWebhookService } from "$lib/server/webhooks";

/**
 * GET /api/webhooks - List all webhooks
 */
export const GET: RequestHandler = async ({ platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, "Database not available");
  }

  if (!locals.auditContext) {
    throw error(401, "Authentication required");
  }

  try {
    const webhooks = createWebhookService(platform.env.DB, locals.audit);
    const list = await webhooks.list();

    return json({ webhooks: list });
  } catch (err) {
    console.error("Webhooks list error:", err);
    throw error(500, "Failed to list webhooks");
  }
};

/**
 * POST /api/webhooks - Create a new webhook
 * InfoSec: Validates URL to prevent SSRF
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, "Database not available");
  }

  if (!locals.auditContext) {
    throw error(401, "Authentication required");
  }

  try {
    const body = await request.json();

    // Validate required fields
    if (!body.name || typeof body.name !== "string") {
      throw error(400, "Name is required");
    }
    if (!body.url || typeof body.url !== "string") {
      throw error(400, "URL is required");
    }
    if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
      throw error(400, "At least one event is required");
    }

    const webhooks = createWebhookService(platform.env.DB, locals.audit);
    const webhook = await webhooks.create(
      {
        name: body.name,
        url: body.url,
        events: body.events,
        secret: body.secret,
        authType: body.authType,
        authValue: body.authValue,
        collections: body.collections,
        maxRetries: body.maxRetries,
        retryDelay: body.retryDelay,
      },
      locals.auditContext
    );

    return json({ webhook }, { status: 201 });
  } catch (err) {
    console.error("Webhook create error:", err);
    if (err instanceof Response) throw err;

    if (err instanceof Error) {
      if (
        err.message.includes("Invalid webhook URL") ||
        err.message.includes("must use HTTPS") ||
        err.message.includes("cannot target private networks")
      ) {
        throw error(400, err.message);
      }
    }

    throw error(500, "Failed to create webhook");
  }
};

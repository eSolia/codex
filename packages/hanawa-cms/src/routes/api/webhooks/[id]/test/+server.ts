/**
 * Webhook Test API Endpoint
 * Test webhook delivery with a sample payload
 *
 * InfoSec: Admin-only, rate-limited (OWASP A01, A04)
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createWebhookService } from "$lib/server/webhooks";

/**
 * POST /api/webhooks/[id]/test - Test webhook delivery
 */
export const POST: RequestHandler = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, "Database not available");
  }

  if (!locals.auditContext) {
    throw error(401, "Authentication required");
  }

  try {
    const webhooks = createWebhookService(platform.env.DB, locals.audit);
    const result = await webhooks.test(params.id);

    return json({
      success: result.success,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      error: result.error,
    });
  } catch (err) {
    console.error("Webhook test error:", err);
    if (err instanceof Response) throw err;

    if (err instanceof Error && err.message.includes("not found")) {
      throw error(404, "Webhook not found");
    }

    throw error(500, "Failed to test webhook");
  }
};

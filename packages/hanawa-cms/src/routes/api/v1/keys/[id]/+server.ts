/**
 * Single API Key Management Endpoint
 * Revoke and delete API keys
 *
 * InfoSec: Admin-only access (OWASP A01)
 */

import { json, error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { createDeliveryService } from "$lib/server/delivery";

/**
 * GET /api/v1/keys/[id] - Get API key details (not the key itself)
 */
export const GET: RequestHandler = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, "Database not available");
  }

  if (!locals.auditContext) {
    throw error(401, "Authentication required");
  }

  try {
    const delivery = createDeliveryService(
      platform.env.DB,
      platform.env.KV,
      platform.env.R2,
      locals.audit
    );
    const key = await delivery.getApiKey(params.id);

    if (!key) {
      throw error(404, "API key not found");
    }

    return json({ key });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("API key get error:", err);
    throw error(500, "Failed to get API key");
  }
};

/**
 * PATCH /api/v1/keys/[id] - Revoke an API key
 * InfoSec: Revoked keys cannot be used but remain for audit
 */
export const PATCH: RequestHandler = async ({
  params,
  request,
  platform,
  locals,
}) => {
  if (!platform?.env?.DB) {
    throw error(500, "Database not available");
  }

  if (!locals.auditContext) {
    throw error(401, "Authentication required");
  }

  try {
    const body = await request.json();

    if (body.action !== "revoke") {
      throw error(400, "Only 'revoke' action is supported");
    }

    const delivery = createDeliveryService(
      platform.env.DB,
      platform.env.KV,
      platform.env.R2,
      locals.audit
    );
    await delivery.revokeApiKey(params.id, locals.auditContext);

    return json({ success: true, message: "API key revoked" });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error("API key revoke error:", err);
    throw error(500, "Failed to revoke API key");
  }
};

/**
 * DELETE /api/v1/keys/[id] - Permanently delete an API key
 */
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, "Database not available");
  }

  if (!locals.auditContext) {
    throw error(401, "Authentication required");
  }

  try {
    const delivery = createDeliveryService(
      platform.env.DB,
      platform.env.KV,
      platform.env.R2,
      locals.audit
    );
    await delivery.deleteApiKey(params.id, locals.auditContext);

    return json({ success: true });
  } catch (err) {
    if (err instanceof Response) throw err;

    if (err instanceof Error && err.message.includes("not found")) {
      throw error(404, "API key not found");
    }

    console.error("API key delete error:", err);
    throw error(500, "Failed to delete API key");
  }
};

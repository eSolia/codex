/**
 * Single Webhook API Endpoint
 * Get, update, and delete individual webhooks
 *
 * InfoSec: Admin-only access (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createWebhookService } from '$lib/server/webhooks';

/**
 * GET /api/webhooks/[id] - Get webhook by ID
 */
export const GET: RequestHandler = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    const webhooks = createWebhookService(platform.env.DB, locals.audit);
    const webhook = await webhooks.get(params.id);

    if (!webhook) {
      throw error(404, 'Webhook not found');
    }

    return json({ webhook });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error('Webhook get error:', err);
    throw error(500, 'Failed to get webhook');
  }
};

/**
 * PUT /api/webhooks/[id] - Update webhook
 */
export const PUT: RequestHandler = async ({ params, request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const webhooks = createWebhookService(platform.env.DB, locals.audit);

    const webhook = await webhooks.update(params.id, body, locals.auditContext);

    return json({ webhook });
  } catch (err) {
    console.error('Webhook update error:', err);
    if (err instanceof Response) throw err;

    if (err instanceof Error) {
      if (
        err.message.includes('Invalid webhook URL') ||
        err.message.includes('must use HTTPS') ||
        err.message.includes('cannot target private networks')
      ) {
        throw error(400, err.message);
      }
    }

    throw error(500, 'Failed to update webhook');
  }
};

/**
 * DELETE /api/webhooks/[id] - Delete webhook
 */
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    const webhooks = createWebhookService(platform.env.DB, locals.audit);
    await webhooks.delete(params.id, locals.auditContext);

    return json({ success: true });
  } catch (err) {
    console.error('Webhook delete error:', err);
    if (err instanceof Response) throw err;

    if (err instanceof Error && err.message.includes('not found')) {
      throw error(404, 'Webhook not found');
    }

    throw error(500, 'Failed to delete webhook');
  }
};

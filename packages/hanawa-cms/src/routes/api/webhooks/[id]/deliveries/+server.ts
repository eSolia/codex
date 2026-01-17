/**
 * Webhook Deliveries API Endpoint
 * Get delivery history and retry failed deliveries
 *
 * InfoSec: Admin-only access (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createWebhookService } from '$lib/server/webhooks';

/**
 * GET /api/webhooks/[id]/deliveries - Get delivery history
 */
export const GET: RequestHandler = async ({ params, url, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    const page = parseInt(url.searchParams.get('page') || '1');
    const perPage = Math.min(parseInt(url.searchParams.get('perPage') || '20'), 100);

    const webhooks = createWebhookService(platform.env.DB, locals.audit);
    const result = await webhooks.getDeliveries(params.id, { page, perPage });

    return json({
      deliveries: result.deliveries,
      total: result.total,
      page,
      perPage,
      totalPages: Math.ceil(result.total / perPage),
    });
  } catch (err) {
    console.error('Deliveries list error:', err);
    throw error(500, 'Failed to list deliveries');
  }
};

/**
 * POST /api/webhooks/[id]/deliveries - Retry a failed delivery
 */
export const POST: RequestHandler = async ({ params: _params, request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    const body = (await request.json()) as { deliveryId?: string };

    if (!body.deliveryId) {
      throw error(400, 'deliveryId is required');
    }

    const webhooks = createWebhookService(platform.env.DB, locals.audit);
    const result = await webhooks.retryDelivery(body.deliveryId);

    return json({
      success: result.success,
      statusCode: result.statusCode,
      responseTime: result.responseTime,
      error: result.error,
    });
  } catch (err) {
    console.error('Delivery retry error:', err);
    if (err instanceof Response) throw err;

    if (err instanceof Error && err.message.includes('not found')) {
      throw error(404, 'Delivery not found');
    }

    throw error(500, 'Failed to retry delivery');
  }
};

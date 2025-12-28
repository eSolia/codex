/**
 * Integrations API Endpoint
 * Manage built-in integrations (Slack, Email, Teams)
 *
 * InfoSec: Admin-only access (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createWebhookService } from '$lib/server/webhooks';

/**
 * GET /api/integrations - List integrations
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    const type = url.searchParams.get('type') || undefined;
    const webhooks = createWebhookService(platform.env.DB, locals.audit);
    const integrations = await webhooks.listIntegrations(type);

    return json({ integrations });
  } catch (err) {
    console.error('Integrations list error:', err);
    throw error(500, 'Failed to list integrations');
  }
};

/**
 * POST /api/integrations - Create an integration
 */
export const POST: RequestHandler = async ({ request, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    const body = (await request.json()) as {
      type?: string;
      name?: string;
      config?: Record<string, unknown>;
      events?: string[];
      collections?: string[];
    };

    // Validate required fields
    if (!body.type || !['slack', 'email', 'teams'].includes(body.type)) {
      throw error(400, 'Invalid type (must be: slack, email, teams)');
    }
    if (!body.name) {
      throw error(400, 'Name is required');
    }
    if (!body.config || typeof body.config !== 'object') {
      throw error(400, 'Config is required');
    }
    if (!body.events || !Array.isArray(body.events) || body.events.length === 0) {
      throw error(400, 'At least one event is required');
    }

    const webhooks = createWebhookService(platform.env.DB, locals.audit);
    const integration = await webhooks.createIntegration(
      {
        type: body.type as 'slack' | 'email' | 'teams',
        name: body.name,
        config: body.config,
        events: body.events as import('$lib/server/webhooks').WebhookEvent[],
        collections: body.collections,
      },
      locals.auditContext
    );

    return json({ integration }, { status: 201 });
  } catch (err) {
    console.error('Integration create error:', err);
    if (err instanceof Response) throw err;
    throw error(500, 'Failed to create integration');
  }
};

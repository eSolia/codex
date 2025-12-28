/**
 * API Keys Management Endpoint
 * Create and list API keys for delivery API access
 *
 * InfoSec: Admin-only, key shown only once (OWASP A01, A02)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDeliveryService } from '$lib/server/delivery';

/**
 * GET /api/v1/keys - List API keys (without the actual key values)
 */
export const GET: RequestHandler = async ({ platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    // Note: Type assertion needed due to workers-types version mismatch
    const delivery = createDeliveryService(
      platform.env.DB,
      platform.env.KV as unknown as import('@cloudflare/workers-types').KVNamespace | undefined,
      platform.env.R2 as unknown as import('@cloudflare/workers-types').R2Bucket | undefined,
      locals.audit
    );
    const keys = await delivery.listApiKeys();

    return json({ keys });
  } catch (err) {
    console.error('API keys list error:', err);
    throw error(500, 'Failed to list API keys');
  }
};

/**
 * POST /api/v1/keys - Create a new API key
 * InfoSec: The full key is only returned once - store it securely
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
      name?: string;
      permissions?: string[];
      collections?: string[];
      allowedOrigins?: string[];
      rateLimit?: number;
    };

    // Validate required fields
    if (!body.name || typeof body.name !== 'string') {
      throw error(400, 'Name is required');
    }

    // Validate permissions
    const validPermissions = ['read:content', 'read:media'];
    const permissions = body.permissions || ['read:content'];
    for (const perm of permissions) {
      if (!validPermissions.includes(perm)) {
        throw error(400, `Invalid permission: ${perm}`);
      }
    }

    // Note: Type assertion needed due to workers-types version mismatch
    const delivery = createDeliveryService(
      platform.env.DB,
      platform.env.KV as unknown as import('@cloudflare/workers-types').KVNamespace | undefined,
      platform.env.R2 as unknown as import('@cloudflare/workers-types').R2Bucket | undefined,
      locals.audit
    );

    const result = await delivery.createApiKey(
      {
        name: body.name,
        permissions,
        collections: body.collections,
        allowedOrigins: body.allowedOrigins,
        rateLimit: body.rateLimit,
      },
      locals.auditContext
    );

    return json(
      {
        key: result.apiKey,
        // InfoSec: This is the ONLY time the full key is shown
        // The user must save it now - it cannot be retrieved later
        fullKey: result.fullKey,
        warning: 'Store this key securely. It will not be shown again.',
      },
      { status: 201 }
    );
  } catch (err) {
    console.error('API key create error:', err);
    if (err instanceof Response) throw err;
    throw error(500, 'Failed to create API key');
  }
};

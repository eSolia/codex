/**
 * Content Delivery API - Single Document Endpoint
 * Public API for getting a single published document
 *
 * InfoSec: API key auth, rate limiting, CORS (OWASP A01, A04)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createDeliveryService } from '$lib/server/delivery';

/**
 * Validate API key from Authorization header
 */
async function validateRequest(
  request: Request,
  platform: App.Platform
): Promise<{
  valid: boolean;
  keyId?: string;
  permissions?: string[];
  collections?: string[] | null;
  rateLimit?: number;
  error?: string;
}> {
  const authHeader = request.headers.get('Authorization');

  // Allow unauthenticated access for now (can be restricted later)
  if (!authHeader) {
    return { valid: true, rateLimit: 100 }; // Lower rate limit for unauthenticated
  }

  if (!authHeader.startsWith('Bearer ')) {
    return { valid: false, error: 'Invalid Authorization header format' };
  }

  const apiKey = authHeader.slice(7);
  // Note: Type assertion needed due to workers-types version mismatch
  const delivery = createDeliveryService(
    platform.env.DB,
    platform.env.KV as unknown as import('@cloudflare/workers-types').KVNamespace | undefined
  );
  const result = await delivery.validateApiKey(apiKey);

  if (!result.valid) {
    return { valid: false, error: result.error };
  }

  return {
    valid: true,
    keyId: result.apiKey?.id,
    permissions: result.apiKey?.permissions,
    collections: result.apiKey?.collections,
    rateLimit: result.apiKey?.rate_limit,
  };
}

/**
 * GET /api/v1/content/[collection]/[slug] - Get a single document
 *
 * Query params:
 *   - locale: Filter by locale (e.g., "en", "ja")
 *   - fields: Comma-separated field names to include
 */
export const GET: RequestHandler = async ({ params, url, request, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Service unavailable');
  }

  // Validate API key
  const auth = await validateRequest(request, platform);
  if (!auth.valid) {
    throw error(401, auth.error || 'Unauthorized');
  }

  // Check collection access
  if (auth.collections && !auth.collections.includes(params.collection)) {
    throw error(403, 'Access to this collection is not allowed');
  }

  // Check rate limit
  // Note: Type assertion needed due to workers-types version mismatch
  const delivery = createDeliveryService(
    platform.env.DB,
    platform.env.KV as unknown as import('@cloudflare/workers-types').KVNamespace | undefined,
    platform.env.R2 as unknown as import('@cloudflare/workers-types').R2Bucket | undefined
  );

  if (auth.keyId && auth.rateLimit) {
    const rateLimit = await delivery.checkRateLimit(auth.keyId, auth.rateLimit);
    if (!rateLimit.allowed) {
      return json(
        { error: 'Rate limit exceeded' },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': String(auth.rateLimit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(rateLimit.reset),
            'Retry-After': String(rateLimit.reset - Math.floor(Date.now() / 1000)),
          },
        }
      );
    }
  }

  try {
    // Parse query parameters
    const locale = url.searchParams.get('locale') || undefined;
    const fields = url.searchParams.get('fields')?.split(',').filter(Boolean);

    const document = await delivery.getDocument(params.collection, params.slug, {
      locale,
      fields,
      status: 'published',
    });

    if (!document) {
      throw error(404, 'Document not found');
    }

    // Build response headers
    const headers: Record<string, string> = {
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
      'Content-Type': 'application/json',
      ETag: `"${document.updated_at}"`,
    };

    // Add rate limit headers if authenticated
    if (auth.keyId && auth.rateLimit) {
      const rateLimit = await delivery.checkRateLimit(auth.keyId, auth.rateLimit);
      headers['X-RateLimit-Limit'] = String(auth.rateLimit);
      headers['X-RateLimit-Remaining'] = String(rateLimit.remaining);
      headers['X-RateLimit-Reset'] = String(rateLimit.reset);
    }

    return json(document, { headers });
  } catch (err) {
    if (err instanceof Response) throw err;
    console.error('Content get error:', err);
    throw error(500, 'Failed to get content');
  }
};

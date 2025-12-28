/**
 * Individual Asset API Endpoint
 * Handles get, update, and delete operations for a single asset
 *
 * InfoSec: Authorization checks, audit logging (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/media/:id - Get single asset
 */
export const GET: RequestHandler = async ({ params, locals }) => {
  if (!locals.media) {
    throw error(500, 'Media service not available');
  }

  try {
    const asset = await locals.media.get(params.id);
    return json(asset);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      throw error(404, 'Asset not found');
    }
    console.error('Media get error:', err);
    throw error(500, 'Failed to get asset');
  }
};

/**
 * PATCH /api/media/:id - Update asset metadata
 */
export const PATCH: RequestHandler = async ({ params, request, locals }) => {
  if (!locals.media) {
    throw error(500, 'Media service not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    const updates = (await request.json()) as Record<string, unknown>;

    // InfoSec: Only allow updating specific fields
    const allowedFields = ['altText', 'altTextJa', 'caption', 'folder', 'tags'];
    const sanitizedUpdates: Record<string, unknown> = {};

    for (const key of Object.keys(updates)) {
      if (allowedFields.includes(key)) {
        sanitizedUpdates[key] = updates[key];
      }
    }

    if (Object.keys(sanitizedUpdates).length === 0) {
      throw error(400, 'No valid fields to update');
    }

    const asset = await locals.media.update(params.id, sanitizedUpdates, locals.auditContext);

    return json(asset);
  } catch (err) {
    if (err instanceof Response) throw err;
    if (err instanceof Error && err.message.includes('not found')) {
      throw error(404, 'Asset not found');
    }
    console.error('Media update error:', err);
    throw error(500, 'Failed to update asset');
  }
};

/**
 * DELETE /api/media/:id - Delete asset from R2 and D1
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
  if (!locals.media) {
    throw error(500, 'Media service not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    await locals.media.delete(params.id, locals.auditContext);
    return new Response(null, { status: 204 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      throw error(404, 'Asset not found');
    }
    console.error('Media delete error:', err);
    throw error(500, 'Failed to delete asset');
  }
};

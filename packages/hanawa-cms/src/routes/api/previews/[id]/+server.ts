/**
 * Individual Preview API Endpoint
 * Get, update, and revoke previews
 *
 * InfoSec: Authorization checks, audit logging (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPreviewService } from '$lib/server/previews';

/**
 * GET /api/previews/:id - Get preview details
 */
export const GET: RequestHandler = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  try {
    const previews = createPreviewService(platform.env.DB, locals.audit);
    const preview = await previews.get(params.id);

    return json(preview);
  } catch (err) {
    if (err instanceof Error && err.message.includes('not found')) {
      throw error(404, 'Preview not found');
    }
    console.error('Preview get error:', err);
    throw error(500, 'Failed to get preview');
  }
};

/**
 * DELETE /api/previews/:id - Revoke a preview
 */
export const DELETE: RequestHandler = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  if (!locals.auditContext) {
    throw error(401, 'Authentication required');
  }

  try {
    const previews = createPreviewService(platform.env.DB, locals.audit);
    await previews.revoke(params.id, locals.auditContext);

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('Preview revoke error:', err);
    throw error(500, 'Failed to revoke preview');
  }
};

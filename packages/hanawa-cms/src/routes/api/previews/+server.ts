/**
 * Previews API Endpoint
 * Create and list preview URLs
 *
 * InfoSec: Token-based access, expiry controls (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPreviewService } from '$lib/server/previews';

/**
 * GET /api/previews - List active previews
 */
export const GET: RequestHandler = async ({ url, platform, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const documentId = url.searchParams.get('documentId');
  const previews = createPreviewService(platform.env.DB, locals.audit);

  try {
    const result = documentId
      ? await previews.listForDocument(documentId)
      : await previews.listActive();

    return json({ previews: result });
  } catch (err) {
    console.error('Previews list error:', err);
    throw error(500, 'Failed to list previews');
  }
};

/**
 * POST /api/previews - Create a new preview
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
      documentId?: string;
      name?: string;
      expiresIn?: string;
      password?: string;
      allowedEmails?: string[];
      maxViews?: number;
    };

    // Validate required fields
    if (!body.documentId) {
      throw error(400, 'documentId is required');
    }

    const previews = createPreviewService(platform.env.DB, locals.audit);

    const preview = await previews.create(
      {
        documentId: body.documentId,
        name: body.name,
        expiresIn: body.expiresIn,
        password: body.password,
        allowedEmails: body.allowedEmails,
        maxViews: body.maxViews,
      },
      locals.auditContext
    );

    return json(preview, { status: 201 });
  } catch (err) {
    console.error('Preview create error:', err);
    if (err instanceof Response) throw err;
    if (err instanceof Error && err.message.includes('not found')) {
      throw error(404, err.message);
    }
    throw error(500, 'Failed to create preview');
  }
};

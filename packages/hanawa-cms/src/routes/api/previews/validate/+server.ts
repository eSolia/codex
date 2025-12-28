/**
 * Preview Validation Endpoint
 * Validates access token and returns content if authorized
 *
 * InfoSec: Token validation, password check, email restriction (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createPreviewService } from '$lib/server/previews';

/**
 * POST /api/previews/validate - Validate access to a preview
 */
export const POST: RequestHandler = async ({ request, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  try {
    const body = (await request.json()) as {
      token?: string;
      email?: string;
      password?: string;
    };

    if (!body.token) {
      throw error(400, 'token is required');
    }

    const previews = createPreviewService(platform.env.DB);

    const result = await previews.validateAccess(body.token, {
      email: body.email,
      password: body.password,
    });

    if (!result.valid) {
      return json(
        { valid: false, error: result.error },
        { status: result.error === 'Password required' ? 401 : 403 }
      );
    }

    // Record the view
    if (result.preview) {
      await previews.recordView(result.preview.id);
    }

    return json({
      valid: true,
      preview: {
        id: result.preview!.id,
        name: result.preview!.name,
        document_id: result.preview!.document_id,
        expires_at: result.preview!.expires_at,
      },
      content: result.content,
    });
  } catch (err) {
    console.error('Preview validate error:', err);
    if (err instanceof Response) throw err;
    throw error(500, 'Failed to validate preview');
  }
};

/**
 * Diagram Metadata API Endpoint
 * Returns R2 metadata for a diagram (export timestamp, size, etc.)
 *
 * GET /api/diagrams/:id/meta - Get metadata without fetching content
 *
 * InfoSec: Public endpoint (no auth), read-only, serves only from diagrams/ prefix (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /api/diagrams/:id/meta - Get R2 metadata for diagram
 */
export const GET: RequestHandler = async ({ params, platform }) => {
  // Strip .svg extension if present
  let id = params.id;
  if (id.endsWith('.svg')) {
    id = id.slice(0, -4);
  }

  // InfoSec: Validate ID format to prevent path traversal (OWASP A03)
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw error(400, 'Invalid diagram ID');
  }

  const r2 = platform?.env?.R2;
  if (!r2) {
    throw error(503, 'Storage service unavailable');
  }

  const r2Key = `diagrams/${id}.svg`;

  try {
    const head = await r2.head(r2Key);

    if (!head) {
      return json({
        exists: false,
        id,
        path: r2Key,
      });
    }

    // Return metadata
    return json({
      exists: true,
      id,
      path: r2Key,
      size: head.size,
      etag: head.etag,
      uploaded: head.uploaded?.toISOString() || null,
      // Custom metadata set during upload
      source: head.customMetadata?.source || null,
      uploadedAt: head.customMetadata?.uploadedAt || null,
    });
  } catch (err) {
    console.error(`Failed to fetch diagram metadata for ${id}:`, err);
    throw error(500, 'Failed to retrieve diagram metadata');
  }
};

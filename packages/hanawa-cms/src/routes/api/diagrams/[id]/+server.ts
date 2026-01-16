/**
 * Diagram SVG API Endpoint
 * Serves SVG diagrams from R2 storage
 *
 * GET /api/diagrams/:id - Fetch SVG from R2 and serve with caching
 *
 * InfoSec: Public endpoint (no auth), read-only, serves only from diagrams/ prefix (OWASP A01)
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Cache duration: 1 hour in browser, 1 day at edge
const CACHE_CONTROL = 'public, max-age=3600, s-maxage=86400';

// R2 key prefix - only serve from this path
const R2_PREFIX = 'diagrams';

/**
 * GET /api/diagrams/:id - Serve SVG from R2
 * ID can be with or without .svg extension
 *
 * InfoSec: Path traversal prevention - only allows alphanumeric, hyphen, underscore in ID
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

  // Get R2 bucket from platform
  const r2 = platform?.env?.R2;
  if (!r2) {
    console.error('R2 bucket not available');
    throw error(503, 'Storage service unavailable');
  }

  // Construct R2 key - InfoSec: Restricted to diagrams/ prefix only
  const r2Key = `${R2_PREFIX}/${id}.svg`;

  try {
    // Fetch from R2
    const object = await r2.get(r2Key);

    if (!object) {
      throw error(404, `Diagram not found: ${id}`);
    }

    // Get the SVG content
    const svgContent = await object.text();

    // Return SVG with appropriate headers
    return new Response(svgContent, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Cache-Control': CACHE_CONTROL,
        // InfoSec: Prevent SVG from executing scripts when served
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
        'X-Content-Type-Options': 'nosniff',
        // Allow embedding in documents
        'Access-Control-Allow-Origin': '*',
        // ETag for conditional requests
        ETag: object.etag,
      },
    });
  } catch (err) {
    // Re-throw SvelteKit HttpError (has status property)
    if (typeof err === 'object' && err !== null && 'status' in err) {
      throw err;
    }

    // Check if it's a "not found" type error from R2
    if (err instanceof Error) {
      if (err.message.includes('not found') || err.message.includes('NoSuchKey')) {
        throw error(404, `Diagram not found: ${id}`);
      }
    }

    console.error(`Failed to fetch diagram ${id}:`, err);
    throw error(500, 'Failed to retrieve diagram');
  }
};

/**
 * HEAD /api/diagrams/:id - Check if diagram exists
 */
export const HEAD: RequestHandler = async ({ params, platform }) => {
  let id = params.id;
  if (id.endsWith('.svg')) {
    id = id.slice(0, -4);
  }

  // InfoSec: Validate ID format (OWASP A03)
  if (!id || !/^[a-zA-Z0-9_-]+$/.test(id)) {
    throw error(400, 'Invalid diagram ID');
  }

  const r2 = platform?.env?.R2;
  if (!r2) {
    throw error(503, 'Storage service unavailable');
  }

  const r2Key = `${R2_PREFIX}/${id}.svg`;

  try {
    const head = await r2.head(r2Key);

    if (!head) {
      throw error(404, `Diagram not found: ${id}`);
    }

    return new Response(null, {
      status: 200,
      headers: {
        'Content-Type': 'image/svg+xml',
        'Content-Length': String(head.size),
        'Cache-Control': CACHE_CONTROL,
        ETag: head.etag,
      },
    });
  } catch (err) {
    if (err instanceof Response) throw err;
    throw error(404, `Diagram not found: ${id}`);
  }
};

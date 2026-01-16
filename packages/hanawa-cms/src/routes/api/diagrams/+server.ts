/**
 * Diagrams List API Endpoint
 * Lists available diagrams from R2 storage
 *
 * GET /api/diagrams - List all diagrams in the diagrams/ prefix
 *
 * InfoSec: Public endpoint, read-only (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// R2 key prefix
const R2_PREFIX = 'diagrams';

interface DiagramInfo {
  id: string;
  url: string;
  size: number;
  uploaded: string;
  etag: string;
}

/**
 * GET /api/diagrams - List available diagrams
 */
export const GET: RequestHandler = async ({ platform, url }) => {
  const r2 = platform?.env?.R2;
  if (!r2) {
    throw error(503, 'Storage service unavailable');
  }

  // Optional limit parameter
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '100'), 1000);

  try {
    // List objects in diagrams/ prefix
    const listed = await r2.list({
      prefix: `${R2_PREFIX}/`,
      limit,
    });

    const diagrams: DiagramInfo[] = listed.objects
      .filter((obj) => obj.key.endsWith('.svg'))
      .map((obj) => {
        // Extract ID from key (diagrams/foo.svg -> foo)
        const id = obj.key.replace(`${R2_PREFIX}/`, '').replace('.svg', '');

        return {
          id,
          url: `/api/diagrams/${id}.svg`,
          size: obj.size,
          uploaded: obj.uploaded.toISOString(),
          etag: obj.etag,
        };
      });

    return json({
      diagrams,
      count: diagrams.length,
      truncated: listed.truncated,
    });
  } catch (err) {
    console.error('Failed to list diagrams:', err);
    throw error(500, 'Failed to list diagrams');
  }
};

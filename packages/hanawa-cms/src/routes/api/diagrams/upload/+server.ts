/**
 * Upload Mermaid SVG to R2
 * POST /api/diagrams/upload
 *
 * InfoSec: Validates SVG content, sanitizes input (OWASP A03)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, platform }) => {
  if (!platform?.env?.R2) {
    throw error(500, 'R2 storage not available');
  }

  let body: { id: string; svg: string; source?: string };
  try {
    body = await request.json();
  } catch {
    throw error(400, 'Invalid JSON body');
  }

  const { id, svg, source } = body;

  // InfoSec: Validate inputs
  if (!id || typeof id !== 'string') {
    throw error(400, 'Missing or invalid diagram ID');
  }

  if (!svg || typeof svg !== 'string') {
    throw error(400, 'Missing or invalid SVG content');
  }

  // InfoSec: Basic SVG validation - must start with <svg
  const trimmedSvg = svg.trim();
  if (!trimmedSvg.startsWith('<svg') && !trimmedSvg.startsWith('<?xml')) {
    throw error(400, 'Invalid SVG content');
  }

  // InfoSec: Sanitize ID to prevent path traversal
  const sanitizedId = id.replace(/[^a-zA-Z0-9_-]/g, '');
  if (!sanitizedId) {
    throw error(400, 'Invalid diagram ID after sanitization');
  }

  const r2Key = `diagrams/${sanitizedId}.svg`;

  try {
    // Upload SVG to R2
    await platform.env.R2.put(r2Key, svg, {
      httpMetadata: {
        contentType: 'image/svg+xml',
      },
      customMetadata: {
        source: source ? 'mermaid' : 'unknown',
        uploadedAt: new Date().toISOString(),
      },
    });

    console.log(`[Diagrams] Uploaded SVG to R2: ${r2Key}`);

    return json({
      success: true,
      path: r2Key,
      url: `/api/diagrams/${sanitizedId}`,
    });
  } catch (err) {
    console.error('[Diagrams] R2 upload error:', err);
    throw error(500, 'Failed to upload SVG to R2');
  }
};

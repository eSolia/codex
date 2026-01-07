/**
 * Debug endpoint to inspect CF Access headers
 * REMOVE IN PRODUCTION
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ request, locals }) => {
  // Get all headers
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    // Only show cf-* headers and a few others for security
    if (key.startsWith('cf-') || key === 'cookie' || key === 'host') {
      headers[key] = key === 'cookie' ? '[REDACTED]' : value;
    }
  });

  return json({
    headers,
    localsUser: locals.user ?? null,
    cfAccessEmail: request.headers.get('cf-access-authenticated-user-email'),
    cfAccessJwt: request.headers.get('cf-access-jwt-assertion') ? '[PRESENT]' : null
  });
};

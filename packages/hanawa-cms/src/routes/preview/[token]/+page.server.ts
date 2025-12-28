/**
 * Preview Page Server Load
 * Secure preview with token validation and audit logging
 *
 * InfoSec: Token validation, IP checking, view counting (OWASP A01, A09)
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
  validatePreviewToken,
  getPreviewSecurityHeaders,
  logAuditEvent,
} from '$lib/server/security';

export const load: PageServerLoad = async ({ params, platform, request, setHeaders }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;
  const clientIp =
    request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || 'unknown';

  const result = await validatePreviewToken(db, params.token, clientIp);

  if (!result.valid) {
    // Log the failed access attempt
    await logAuditEvent(
      db,
      'preview_access_denied',
      null,
      'preview',
      params.token,
      { reason: result.reason, clientIp },
      clientIp,
      request.headers.get('user-agent') || undefined
    );

    const messages: Record<string, string> = {
      invalid_token: 'This preview link is invalid or has been revoked.',
      expired: 'This preview link has expired.',
      max_views_exceeded: 'This preview link has reached its maximum number of views.',
      ip_not_allowed: 'Access from your IP address is not permitted.',
    };

    throw error(403, messages[result.reason || ''] || 'Access denied');
  }

  // Set security headers to prevent caching and indexing
  const securityHeaders = getPreviewSecurityHeaders();
  for (const [key, value] of Object.entries(securityHeaders)) {
    setHeaders({ [key]: value });
  }

  // Log successful access
  await logAuditEvent(
    db,
    'preview_viewed',
    null,
    'preview',
    params.token,
    { sensitivity: result.sensitivity },
    clientIp,
    request.headers.get('user-agent') || undefined
  );

  return {
    content: result.content,
    sensitivity: result.sensitivity,
    // For watermarking - in production, get from Access JWT
    viewerEmail: 'viewer@example.com',
    documentId: params.token,
  };
};

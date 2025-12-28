/**
 * Audit Log API Endpoint
 * Receives security events from client-side components
 *
 * InfoSec: Validates input, logs security events (OWASP A09)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { logAuditEvent } from '$lib/server/security';

export const POST: RequestHandler = async ({ request, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;

  try {
    const body = (await request.json()) as {
      event?: string;
      timestamp?: number;
      sensitivity?: string;
      viewerEmail?: string;
      documentId?: string;
    };

    // InfoSec: Validate required fields
    if (!body.event || !body.timestamp) {
      throw error(400, 'Missing required fields');
    }

    // InfoSec: Validate event types (whitelist approach)
    const allowedEvents = [
      'screenshot_attempt',
      'tab_unfocus',
      'window_blur',
      'view_started',
      'view_ended',
      'copy_attempt',
      'print_attempt',
    ];

    if (!allowedEvents.includes(body.event)) {
      throw error(400, 'Invalid event type');
    }

    const clientIp =
      request.headers.get('cf-connecting-ip') ||
      request.headers.get('x-forwarded-for') ||
      'unknown';

    await logAuditEvent(
      db,
      `client_${body.event}`,
      body.viewerEmail || null,
      body.documentId ? 'preview' : 'unknown',
      body.documentId || 'unknown',
      {
        sensitivity: body.sensitivity,
        clientTimestamp: body.timestamp,
      },
      clientIp,
      request.headers.get('user-agent') || undefined
    );

    return json({ success: true });
  } catch (err) {
    console.error('Audit log error:', err);
    if (err instanceof Response) throw err;
    throw error(500, 'Failed to log event');
  }
};

/**
 * Content Security Controls
 * Implements defense-in-depth for sensitive content
 *
 * InfoSec: OWASP A01 (Access Control), A08 (Data Integrity)
 * Reference: docs/concepts/cms-content-security.md
 */

/// <reference types="@cloudflare/workers-types" />

export type SensitivityLevel = 'normal' | 'confidential' | 'embargoed';

/**
 * Security configuration by sensitivity level
 */
export const securityLevels = {
  normal: {
    watermark: false,
    shortcutDetection: false,
    blurOnUnfocus: false,
    forensicMarking: false,
    viewAgreement: false,
    maxViewDuration: null,
    alertOnView: false,
    previewTokenExpiry: 7 * 24 * 60 * 60, // 7 days
    previewMaxViews: null,
    previewIpRestrict: false,
    encryptAtRest: false,
  },
  confidential: {
    watermark: true,
    shortcutDetection: true,
    blurOnUnfocus: false,
    forensicMarking: true,
    viewAgreement: false,
    maxViewDuration: 30 * 60 * 1000, // 30 minutes
    alertOnView: false,
    previewTokenExpiry: 24 * 60 * 60, // 24 hours
    previewMaxViews: 10,
    previewIpRestrict: true, // Recommended
    encryptAtRest: true,
  },
  embargoed: {
    watermark: true,
    shortcutDetection: true,
    blurOnUnfocus: true,
    forensicMarking: true,
    viewAgreement: true,
    maxViewDuration: 10 * 60 * 1000, // 10 minutes
    alertOnView: true,
    previewTokenExpiry: 4 * 60 * 60, // 4 hours
    previewMaxViews: 3,
    previewIpRestrict: true, // Required
    encryptAtRest: true,
  },
} as const;

export type SecurityConfig = (typeof securityLevels)[SensitivityLevel];

/**
 * Preview token generation with security constraints
 * InfoSec: Tokens are cryptographically random (OWASP A02)
 */
export async function createPreviewToken(
  db: D1Database,
  contentId: string,
  sensitivity: SensitivityLevel,
  requestedBy: string,
  options: {
    expiresIn?: number;
    maxViews?: number;
    ipRestrict?: string[];
  } = {}
): Promise<{ token: string; expires: number }> {
  const config = securityLevels[sensitivity];

  // InfoSec: Check if embargoed content allows preview
  if (sensitivity === 'embargoed') {
    const content = await db
      .prepare('SELECT embargo_until FROM content WHERE id = ?')
      .bind(contentId)
      .first<{ embargo_until: number | null }>();

    if (content?.embargo_until && Date.now() / 1000 < content.embargo_until) {
      throw new Error('Content under embargo. Preview not available.');
    }
  }

  // InfoSec: Check if confidential content is approved for preview
  if (sensitivity === 'confidential') {
    const content = await db
      .prepare('SELECT approved_for_preview FROM content WHERE id = ?')
      .bind(contentId)
      .first<{ approved_for_preview: number }>();

    if (!content?.approved_for_preview) {
      throw new Error('Confidential content requires approval before preview sharing.');
    }
  }

  const token = crypto.randomUUID();
  const expires = Math.floor(Date.now() / 1000) + (options.expiresIn || config.previewTokenExpiry);

  await db
    .prepare(
      `
    UPDATE content SET
      preview_token = ?,
      preview_expires = ?,
      preview_max_views = ?,
      preview_view_count = 0,
      preview_ip_allowlist = ?,
      preview_created_by = ?,
      preview_created_at = ?
    WHERE id = ?
  `
    )
    .bind(
      token,
      expires,
      options.maxViews || config.previewMaxViews || null,
      options.ipRestrict ? JSON.stringify(options.ipRestrict) : null,
      requestedBy,
      Math.floor(Date.now() / 1000),
      contentId
    )
    .run();

  // Audit log
  await logAuditEvent(db, 'preview_created', requestedBy, 'content', contentId, {
    expires,
    maxViews: options.maxViews || config.previewMaxViews,
    ipRestrict: options.ipRestrict,
  });

  return { token, expires };
}

/**
 * Validate preview token with security checks
 * InfoSec: Token validation prevents unauthorized access (OWASP A01)
 */
export async function validatePreviewToken(
  db: D1Database,
  token: string,
  clientIp: string
): Promise<{
  valid: boolean;
  reason?: string;
  content?: string;
  sensitivity?: SensitivityLevel;
}> {
  const doc = await db
    .prepare(
      `
    SELECT
      body, sensitivity, preview_expires, preview_max_views,
      preview_view_count, preview_ip_allowlist
    FROM content
    WHERE preview_token = ?
  `
    )
    .bind(token)
    .first<{
      body: string;
      sensitivity: SensitivityLevel;
      preview_expires: number;
      preview_max_views: number | null;
      preview_view_count: number;
      preview_ip_allowlist: string | null;
    }>();

  if (!doc) {
    return { valid: false, reason: 'invalid_token' };
  }

  if (doc.preview_expires < Date.now() / 1000) {
    return { valid: false, reason: 'expired' };
  }

  if (doc.preview_max_views && doc.preview_view_count >= doc.preview_max_views) {
    return { valid: false, reason: 'max_views_exceeded' };
  }

  if (doc.preview_ip_allowlist) {
    const allowed = JSON.parse(doc.preview_ip_allowlist) as string[];
    if (!allowed.includes(clientIp)) {
      await logAuditEvent(db, 'preview_ip_rejected', null, 'preview', token, {
        clientIp,
        allowed,
      });
      return { valid: false, reason: 'ip_not_allowed' };
    }
  }

  // Increment view count
  await db
    .prepare(
      'UPDATE content SET preview_view_count = preview_view_count + 1 WHERE preview_token = ?'
    )
    .bind(token)
    .run();

  return {
    valid: true,
    content: doc.body,
    sensitivity: doc.sensitivity,
  };
}

/**
 * Request preview approval for confidential content
 * InfoSec: Implements approval workflow (OWASP A04)
 */
export async function requestPreviewApproval(
  db: D1Database,
  contentId: string,
  requestedBy: string
): Promise<void> {
  await db
    .prepare(
      `
    UPDATE content SET
      preview_approval_requested = 1,
      preview_approval_requested_by = ?,
      preview_approval_requested_at = ?
    WHERE id = ?
  `
    )
    .bind(requestedBy, Math.floor(Date.now() / 1000), contentId)
    .run();

  await logAuditEvent(db, 'preview_approval_requested', requestedBy, 'content', contentId, {});
}

/**
 * Approve preview for confidential content
 * InfoSec: Implements approval workflow (OWASP A04)
 */
export async function approvePreview(
  db: D1Database,
  contentId: string,
  approvedBy: string
): Promise<void> {
  await db
    .prepare(
      `
    UPDATE content SET
      approved_for_preview = 1,
      preview_approved_by = ?,
      preview_approved_at = ?
    WHERE id = ?
  `
    )
    .bind(approvedBy, Math.floor(Date.now() / 1000), contentId)
    .run();

  await logAuditEvent(db, 'preview_approved', approvedBy, 'content', contentId, {});
}

/**
 * Comprehensive audit logging
 * InfoSec: Security event logging (OWASP A09)
 */
export async function logAuditEvent(
  db: D1Database,
  action: string,
  actor: string | null,
  resourceType: string,
  resourceId: string,
  details: Record<string, unknown>,
  ip?: string,
  userAgent?: string
): Promise<void> {
  const id = crypto.randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);

  await db
    .prepare(
      `
    INSERT INTO audit_log (id, timestamp, action, actor, ip_address, user_agent, resource_type, resource_id, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .bind(
      id,
      timestamp,
      action,
      actor,
      ip || null,
      userAgent || null,
      resourceType,
      resourceId,
      JSON.stringify(details)
    )
    .run();
}

/**
 * Content encryption utilities
 * InfoSec: Encryption at rest for sensitive content (OWASP A02)
 */
export async function encryptContent(
  content: string,
  key: CryptoKey
): Promise<{ encrypted: string; iv: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(content);

  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);

  return {
    encrypted: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptContent(
  encrypted: string,
  iv: string,
  key: CryptoKey
): Promise<string> {
  const encryptedBytes = Uint8Array.from(atob(encrypted), (c) => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(iv), (c) => c.charCodeAt(0));

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    encryptedBytes
  );

  return new TextDecoder().decode(decrypted);
}

/**
 * Generate encryption key from secret
 * InfoSec: Key derivation (OWASP A02)
 */
export async function deriveKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('hanawa-cms-salt'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Set security headers for preview pages
 * InfoSec: Cache and indexing prevention (OWASP A05)
 */
export function getPreviewSecurityHeaders(): Record<string, string> {
  return {
    'Cache-Control': 'private, no-store, no-cache, must-revalidate',
    'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "frame-ancestors 'none'",
  };
}

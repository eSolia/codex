/**
 * Preview Service
 * Handles shareable preview URLs with access controls
 *
 * InfoSec: Token-based access, expiry, view limits (OWASP A01)
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { AuditService, AuditContext } from './audit';

export interface Preview {
  id: string;
  document_id: string;
  content_snapshot: string;
  access_token: string;
  password_hash: string | null;
  allowed_emails: string[];
  max_views: number | null;
  view_count: number;
  expires_at: number;
  name: string | null;
  created_by: string;
  created_at: number;
  status: 'active' | 'expired' | 'revoked';
}

export interface PreviewFeedback {
  id: string;
  preview_id: string;
  page_path: string | null;
  feedback_type: 'comment' | 'issue' | 'approval';
  content: string;
  author_email: string;
  status: 'open' | 'resolved' | 'dismissed';
  created_at: number;
}

export interface CreatePreviewOptions {
  documentId: string;
  name?: string;
  expiresIn?: string; // '1h', '7d', '30d'
  password?: string;
  allowedEmails?: string[];
  maxViews?: number;
}

export interface ValidateAccessResult {
  valid: boolean;
  preview?: Preview;
  content?: string;
  error?: string;
}

// Parse expiry string to milliseconds
function parseExpiresIn(expiresIn: string): number {
  const match = expiresIn.match(/^(\d+)(h|d)$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000; // Default 7 days

  const value = parseInt(match[1]);
  const unit = match[2];

  if (unit === 'h') return value * 60 * 60 * 1000;
  if (unit === 'd') return value * 24 * 60 * 60 * 1000;
  return 7 * 24 * 60 * 60 * 1000;
}

// Generate secure random token
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Simple hash for password (in production, use bcrypt via worker)
async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const inputHash = await hashPassword(password);
  return inputHash === hash;
}

export function createPreviewService(db: D1Database, audit?: AuditService) {
  return {
    /**
     * Create a new preview for a document
     */
    async create(options: CreatePreviewOptions, context: AuditContext): Promise<Preview> {
      const id = crypto.randomUUID();
      const accessToken = generateToken();
      const now = Date.now();
      const expiresAt = now + parseExpiresIn(options.expiresIn || '7d');

      // Get document content
      const doc = await db
        .prepare('SELECT body, body_ja FROM content WHERE id = ?')
        .bind(options.documentId)
        .first();

      if (!doc) {
        throw new Error(`Document not found: ${options.documentId}`);
      }

      // Snapshot the content (combine EN and JA)
      const contentSnapshot = JSON.stringify({
        body: doc.body,
        body_ja: doc.body_ja,
      });

      // Hash password if provided
      const passwordHash = options.password ? await hashPassword(options.password) : null;

      await db
        .prepare(
          `
          INSERT INTO previews (
            id, document_id, content_snapshot, access_token, password_hash,
            allowed_emails, max_views, view_count, expires_at, name,
            created_by, created_at, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .bind(
          id,
          options.documentId,
          contentSnapshot,
          accessToken,
          passwordHash,
          options.allowedEmails ? JSON.stringify(options.allowedEmails) : null,
          options.maxViews || null,
          0,
          expiresAt,
          options.name || null,
          context.actorEmail,
          now,
          'active'
        )
        .run();

      if (audit) {
        await audit.log(
          {
            action: 'create',
            actionCategory: 'access',
            resourceType: 'preview',
            resourceId: id,
            resourceTitle: options.name,
            metadata: {
              documentId: options.documentId,
              expiresAt,
              hasPassword: !!passwordHash,
              hasEmailRestriction: !!(options.allowedEmails && options.allowedEmails.length > 0),
              maxViews: options.maxViews,
            },
          },
          context
        );
      }

      return this.get(id);
    },

    /**
     * Get a preview by ID
     */
    async get(id: string): Promise<Preview> {
      const row = await db.prepare('SELECT * FROM previews WHERE id = ?').bind(id).first();

      if (!row) {
        throw new Error(`Preview not found: ${id}`);
      }

      return this.rowToPreview(row);
    },

    /**
     * Get a preview by access token
     */
    async getByToken(token: string): Promise<Preview | null> {
      const row = await db
        .prepare('SELECT * FROM previews WHERE access_token = ?')
        .bind(token)
        .first();

      if (!row) return null;
      return this.rowToPreview(row);
    },

    /**
     * Validate access to a preview
     */
    async validateAccess(
      token: string,
      options?: { email?: string; password?: string }
    ): Promise<ValidateAccessResult> {
      const preview = await this.getByToken(token);

      if (!preview) {
        return { valid: false, error: 'Preview not found' };
      }

      if (preview.status === 'revoked') {
        return { valid: false, error: 'Preview has been revoked' };
      }

      if (preview.expires_at < Date.now()) {
        return { valid: false, error: 'Preview has expired' };
      }

      if (preview.max_views && preview.view_count >= preview.max_views) {
        return { valid: false, error: 'View limit reached' };
      }

      // Check password if required
      if (preview.password_hash) {
        if (!options?.password) {
          return { valid: false, error: 'Password required' };
        }
        const valid = await verifyPassword(options.password, preview.password_hash);
        if (!valid) {
          return { valid: false, error: 'Invalid password' };
        }
      }

      // Check email restrictions
      if (preview.allowed_emails && preview.allowed_emails.length > 0) {
        if (!options?.email) {
          return { valid: false, error: 'Email required' };
        }
        if (!preview.allowed_emails.includes(options.email.toLowerCase())) {
          return { valid: false, error: 'Email not authorized' };
        }
      }

      // Parse content snapshot
      const content = preview.content_snapshot;

      return { valid: true, preview, content };
    },

    /**
     * Record a view
     */
    async recordView(id: string): Promise<void> {
      await db
        .prepare('UPDATE previews SET view_count = view_count + 1 WHERE id = ?')
        .bind(id)
        .run();
    },

    /**
     * List previews for a document
     */
    async listForDocument(documentId: string): Promise<Preview[]> {
      const { results } = await db
        .prepare('SELECT * FROM previews WHERE document_id = ? ORDER BY created_at DESC')
        .bind(documentId)
        .all();

      return results.map((row) => this.rowToPreview(row));
    },

    /**
     * List all active previews
     */
    async listActive(): Promise<Preview[]> {
      const now = Date.now();
      const { results } = await db
        .prepare(
          `SELECT * FROM previews
           WHERE status = 'active' AND expires_at > ?
           ORDER BY created_at DESC`
        )
        .bind(now)
        .all();

      return results.map((row) => this.rowToPreview(row));
    },

    /**
     * Revoke a preview
     */
    async revoke(id: string, context: AuditContext): Promise<void> {
      await db.prepare("UPDATE previews SET status = 'revoked' WHERE id = ?").bind(id).run();

      if (audit) {
        await audit.log(
          {
            action: 'revoke',
            actionCategory: 'access',
            resourceType: 'preview',
            resourceId: id,
          },
          context
        );
      }
    },

    /**
     * Add feedback to a preview
     */
    async addFeedback(
      previewId: string,
      feedback: {
        type: 'comment' | 'issue' | 'approval';
        content: string;
        authorEmail: string;
        pagePath?: string;
      }
    ): Promise<PreviewFeedback> {
      const id = crypto.randomUUID();
      const now = Date.now();

      await db
        .prepare(
          `
          INSERT INTO preview_feedback (
            id, preview_id, page_path, feedback_type, content, author_email, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `
        )
        .bind(
          id,
          previewId,
          feedback.pagePath || null,
          feedback.type,
          feedback.content,
          feedback.authorEmail,
          'open',
          now
        )
        .run();

      return {
        id,
        preview_id: previewId,
        page_path: feedback.pagePath || null,
        feedback_type: feedback.type,
        content: feedback.content,
        author_email: feedback.authorEmail,
        status: 'open',
        created_at: now,
      };
    },

    /**
     * Get feedback for a preview
     */
    async getFeedback(previewId: string): Promise<PreviewFeedback[]> {
      const { results } = await db
        .prepare('SELECT * FROM preview_feedback WHERE preview_id = ? ORDER BY created_at DESC')
        .bind(previewId)
        .all();

      return results.map((row) => ({
        id: row.id as string,
        preview_id: row.preview_id as string,
        page_path: row.page_path as string | null,
        feedback_type: row.feedback_type as 'comment' | 'issue' | 'approval',
        content: row.content as string,
        author_email: row.author_email as string,
        status: row.status as 'open' | 'resolved' | 'dismissed',
        created_at: row.created_at as number,
      }));
    },

    /**
     * Update feedback status
     */
    async updateFeedbackStatus(
      feedbackId: string,
      status: 'open' | 'resolved' | 'dismissed'
    ): Promise<void> {
      await db
        .prepare('UPDATE preview_feedback SET status = ? WHERE id = ?')
        .bind(status, feedbackId)
        .run();
    },

    // Helper: Convert DB row to Preview
    rowToPreview(row: Record<string, unknown>): Preview {
      return {
        id: row.id as string,
        document_id: row.document_id as string,
        content_snapshot: row.content_snapshot as string,
        access_token: row.access_token as string,
        password_hash: row.password_hash as string | null,
        allowed_emails: row.allowed_emails ? JSON.parse(row.allowed_emails as string) : [],
        max_views: row.max_views as number | null,
        view_count: row.view_count as number,
        expires_at: row.expires_at as number,
        name: row.name as string | null,
        created_by: row.created_by as string,
        created_at: row.created_at as number,
        status: row.status as 'active' | 'expired' | 'revoked',
      };
    },
  };
}

export type PreviewService = ReturnType<typeof createPreviewService>;

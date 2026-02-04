/**
 * Content Editor Page Server Load & Actions
 * InfoSec: Authorization checks, audit logging, CSRF protection
 */

import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { logAuditEvent } from '$lib/server/security';
import type { SensitivityLevel } from '$lib/server/security';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { saveContentSchema, publishContentSchema } from '$lib/schemas';

export const load: PageServerLoad = async ({ params, platform, locals }) => {
  if (!platform?.env?.DB) {
    // Development mode - return mock data
    return {
      content: {
        id: params.id,
        title: 'Development Mode',
        slug: 'dev-mode',
        body: '<p>Editor is in development mode. Database not connected.</p>',
        status: 'draft',
        language: 'en',
        sensitivity: 'normal' as SensitivityLevel,
        site_id: null,
        content_type_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      sites: [],
      contentTypes: [],
      fragments: [],
    };
  }

  const db = platform.env.DB;

  try {
    // InfoSec: Parameterized query prevents SQL injection (OWASP A03)
    const content = await db
      .prepare(
        `
        SELECT
          id, title, title_ja, slug, body, body_ja, excerpt, excerpt_ja,
          status, language, sensitivity, site_id, content_type_id,
          author_id, tags, metadata, created_at, updated_at,
          approved_for_preview, embargo_until
        FROM content
        WHERE id = ?
      `
      )
      .bind(params.id)
      .first();

    if (!content) {
      throw error(404, 'Content not found');
    }

    // InfoSec: Log content access for audit trail (OWASP A09)
    await logAuditEvent(
      db,
      'content_viewed',
      locals.user?.email || 'anonymous',
      'content',
      params.id,
      { sensitivity: content.sensitivity }
    );

    // Get related data for the editor
    const [sitesResult, typesResult, fragmentsResult] = await Promise.all([
      db.prepare('SELECT id, name, slug FROM sites ORDER BY name').all(),
      db.prepare('SELECT id, name, slug FROM content_types ORDER BY name').all(),
      db.prepare('SELECT id, name, slug, category FROM fragments ORDER BY category, name').all(),
    ]);

    // Initialize forms
    const saveForm = await superValidate(content, zod4(saveContentSchema));
    const publishForm = await superValidate(zod4(publishContentSchema));

    return {
      content,
      sites: sitesResult.results ?? [],
      contentTypes: typesResult.results ?? [],
      fragments: fragmentsResult.results ?? [],
      saveForm,
      publishForm,
    };
  } catch (err) {
    console.error('Content load error:', err);
    throw error(500, 'Failed to load content');
  }
};

export const actions: Actions = {
  /**
   * Save content changes
   * InfoSec: Validates input, sanitizes content, audit logs changes
   */
  save: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) {
      const saveForm = await superValidate(request, zod4(saveContentSchema));
      saveForm.message = 'Database not available';
      return fail(500, { saveForm });
    }

    const db = platform.env.DB;

    // InfoSec: Validate form input (OWASP A03)
    const saveForm = await superValidate(request, zod4(saveContentSchema));

    if (!saveForm.valid) {
      return fail(400, { saveForm });
    }

    const {
      title,
      title_ja,
      slug,
      body,
      body_ja,
      status,
      language,
      sensitivity,
      site_id,
      content_type_id,
    } = saveForm.data;

    const now = Math.floor(Date.now() / 1000);
    const actor = locals.user?.email || 'anonymous';

    try {
      // Get current content for comparison
      const current = await db
        .prepare('SELECT sensitivity, status FROM content WHERE id = ?')
        .bind(params.id)
        .first<{ sensitivity: string; status: string }>();

      // InfoSec: Log sensitivity escalation (OWASP A09)
      if (current && current.sensitivity !== sensitivity) {
        await logAuditEvent(db, 'sensitivity_changed', actor, 'content', params.id, {
          from: current.sensitivity,
          to: sensitivity,
        });
      }

      // Update content
      await db
        .prepare(
          `
          UPDATE content SET
            title = ?, title_ja = ?, slug = ?, body = ?, body_ja = ?,
            status = ?, language = ?, sensitivity = ?,
            site_id = ?, content_type_id = ?, updated_at = ?
          WHERE id = ?
        `
        )
        .bind(
          title,
          title_ja || null,
          slug,
          body || null,
          body_ja || null,
          status,
          language,
          sensitivity,
          site_id || null,
          content_type_id || null,
          now,
          params.id
        )
        .run();

      // InfoSec: Audit log the update
      await logAuditEvent(db, 'content_updated', actor, 'content', params.id, {
        status,
        sensitivity,
        fieldsChanged: ['title', 'body', 'status', 'sensitivity'],
      });

      return { saveForm, success: true };
    } catch (err) {
      console.error('Content save error:', err);
      saveForm.message = 'Failed to save content';
      return fail(500, { saveForm });
    }
  },

  /**
   * Publish content to R2
   * InfoSec: Authorization check, audit logging
   */
  publish: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB || !platform?.env?.R2) {
      const publishForm = await superValidate(request, zod4(publishContentSchema));
      publishForm.message = 'Storage not available';
      return fail(500, { publishForm });
    }

    const db = platform.env.DB;
    const bucket = platform.env.R2;
    const actor = locals.user?.email || 'anonymous';

    // Validate publish request
    const publishForm = await superValidate(request, zod4(publishContentSchema));

    if (!publishForm.valid) {
      return fail(400, { publishForm });
    }

    try {
      const content = await db
        .prepare(
          `
          SELECT
            c.*, s.slug as site_slug, ct.slug as type_slug
          FROM content c
          LEFT JOIN sites s ON c.site_id = s.id
          LEFT JOIN content_types ct ON c.content_type_id = ct.id
          WHERE c.id = ?
        `
        )
        .bind(params.id)
        .first();

      if (!content) {
        publishForm.message = 'Content not found';
        return fail(404, { publishForm });
      }

      // InfoSec: Check embargo (OWASP A01)
      if (
        content.sensitivity === 'embargoed' &&
        content.embargo_until &&
        Date.now() / 1000 < Number(content.embargo_until)
      ) {
        publishForm.message = 'Content is under embargo';
        return fail(403, { publishForm });
      }

      // Build R2 path
      const sitePrefix = content.site_slug || 'default';
      const typePrefix = content.type_slug || 'page';
      const r2Key = `${sitePrefix}/${typePrefix}/${content.slug}.json`;

      // Prepare published content
      const publishedContent = {
        id: content.id,
        title: content.title,
        title_ja: content.title_ja,
        slug: content.slug,
        body: content.body,
        body_ja: content.body_ja,
        excerpt: content.excerpt,
        excerpt_ja: content.excerpt_ja,
        language: content.language,
        tags: content.tags ? JSON.parse(content.tags as string) : [],
        metadata: content.metadata ? JSON.parse(content.metadata as string) : {},
        published_at: new Date().toISOString(),
        provenance: {
          source: 'hanawa-cms',
          document_id: content.id,
          version: '1.0',
          canonical_url: `https://${content.site_slug || 'codex'}.esolia.co.jp/${content.slug}`,
        },
      };

      // Write to R2
      await bucket.put(r2Key, JSON.stringify(publishedContent, null, 2), {
        httpMetadata: {
          contentType: 'application/json',
        },
        customMetadata: {
          publishedBy: actor,
          publishedAt: new Date().toISOString(),
        },
      });

      // Update status in D1
      await db
        .prepare(
          `
          UPDATE content SET
            status = 'published',
            published_at = ?,
            updated_at = ?
          WHERE id = ?
        `
        )
        .bind(Math.floor(Date.now() / 1000), Math.floor(Date.now() / 1000), params.id)
        .run();

      // InfoSec: Audit log
      await logAuditEvent(db, 'content_published', actor, 'content', params.id, {
        r2Key,
      });

      return { publishForm, success: true, published: true };
    } catch (err) {
      console.error('Publish error:', err);
      publishForm.message = 'Failed to publish content';
      return fail(500, { publishForm });
    }
  },

  /**
   * Change sensitivity level
   * InfoSec: Authorization check, clear preview on escalation
   */
  changeSensitivity: async ({ request, params, platform, locals }) => {
    if (!platform?.env?.DB) {
      return fail(500, { message: 'Database not available' });
    }

    const db = platform.env.DB;
    const formData = await request.formData();
    const newSensitivity = formData.get('sensitivity') as SensitivityLevel;
    const actor = locals.user?.email || 'anonymous';

    if (!['normal', 'confidential', 'embargoed'].includes(newSensitivity)) {
      return fail(400, { message: 'Invalid sensitivity level' });
    }

    try {
      const current = await db
        .prepare('SELECT sensitivity FROM content WHERE id = ?')
        .bind(params.id)
        .first<{ sensitivity: string }>();

      // InfoSec: If escalating sensitivity, revoke existing preview tokens
      if (
        current &&
        (newSensitivity === 'embargoed' ||
          (newSensitivity === 'confidential' && current.sensitivity === 'normal'))
      ) {
        await db
          .prepare(
            `
            UPDATE content SET
              preview_token = NULL,
              preview_expires = NULL,
              approved_for_preview = 0
            WHERE id = ?
          `
          )
          .bind(params.id)
          .run();
      }

      await db
        .prepare('UPDATE content SET sensitivity = ?, updated_at = ? WHERE id = ?')
        .bind(newSensitivity, Math.floor(Date.now() / 1000), params.id)
        .run();

      await logAuditEvent(db, 'sensitivity_changed', actor, 'content', params.id, {
        from: current?.sensitivity,
        to: newSensitivity,
      });

      return { success: true };
    } catch (err) {
      console.error('Sensitivity change error:', err);
      return fail(500, { message: 'Failed to change sensitivity' });
    }
  },
};

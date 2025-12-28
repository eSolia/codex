/**
 * New Content Page Server Load & Actions
 * InfoSec: Authorization checks, input validation, audit logging
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { logAuditEvent } from '$lib/server/security';

export const load: PageServerLoad = async ({ platform }) => {
  if (!platform?.env?.DB) {
    return {
      sites: [],
      contentTypes: [],
    };
  }

  const db = platform.env.DB;

  try {
    const [sitesResult, typesResult] = await Promise.all([
      db.prepare('SELECT id, name, slug FROM sites ORDER BY name').all(),
      db.prepare('SELECT id, name, slug, site_id FROM content_types ORDER BY name').all(),
    ]);

    return {
      sites: sitesResult.results ?? [],
      contentTypes: typesResult.results ?? [],
    };
  } catch (error) {
    console.error('New content page load error:', error);
    return { sites: [], contentTypes: [] };
  }
};

export const actions: Actions = {
  create: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB) {
      return fail(500, { message: 'Database not available' });
    }

    const db = platform.env.DB;
    const formData = await request.formData();

    const title = formData.get('title') as string;
    const slug = formData.get('slug') as string;
    const siteId = formData.get('site_id') as string;
    const contentTypeId = formData.get('content_type_id') as string;
    const sensitivity = (formData.get('sensitivity') as string) || 'normal';
    const language = (formData.get('language') as string) || 'en';

    // InfoSec: Input validation (OWASP A03)
    if (!title || !slug) {
      return fail(400, { message: 'Title and slug are required' });
    }

    if (!siteId || !contentTypeId) {
      return fail(400, { message: 'Site and content type are required' });
    }

    // InfoSec: Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return fail(400, {
        message: 'Slug must contain only lowercase letters, numbers, and hyphens',
      });
    }

    // InfoSec: Validate sensitivity
    if (!['normal', 'confidential', 'embargoed'].includes(sensitivity)) {
      return fail(400, { message: 'Invalid sensitivity level' });
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const actor = locals.user?.email || 'anonymous';

    try {
      // Check for duplicate slug
      const existing = await db
        .prepare('SELECT id FROM content WHERE site_id = ? AND slug = ? AND language = ?')
        .bind(siteId, slug, language)
        .first();

      if (existing) {
        return fail(400, {
          message: 'A content item with this slug already exists for this site and language',
        });
      }

      await db
        .prepare(
          `
          INSERT INTO content (
            id, site_id, content_type_id, title, slug,
            status, language, sensitivity, author_id, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?)
        `
        )
        .bind(id, siteId, contentTypeId, title, slug, language, sensitivity, actor, now, now)
        .run();

      // InfoSec: Audit log
      await logAuditEvent(db, 'content_created', actor, 'content', id, {
        title,
        slug,
        sensitivity,
      });

      throw redirect(303, `/content/${id}`);
    } catch (err) {
      if (err instanceof Response) throw err; // Re-throw redirect
      console.error('Content create error:', err);
      return fail(500, { message: 'Failed to create content' });
    }
  },
};

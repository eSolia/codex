/**
 * New Content Page Server Load & Actions
 * InfoSec: Authorization checks, input validation, audit logging
 */

import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { logAuditEvent } from '$lib/server/security';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { createContentSchema } from '$lib/schemas';

export const load: PageServerLoad = async ({ platform }) => {
  const form = await superValidate(zod4(createContentSchema));

  if (!platform?.env?.DB) {
    return {
      form,
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
      form,
      sites: sitesResult.results ?? [],
      contentTypes: typesResult.results ?? [],
    };
  } catch (error) {
    console.error('New content page load error:', error);
    return { form, sites: [], contentTypes: [] };
  }
};

export const actions: Actions = {
  create: async ({ request, platform, locals }) => {
    if (!platform?.env?.DB) {
      const form = await superValidate(request, zod4(createContentSchema));
      form.message = 'Database not available';
      return fail(500, { form });
    }

    const db = platform.env.DB;

    // InfoSec: Validate form input (OWASP A03)
    const form = await superValidate(request, zod4(createContentSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const { title, slug, site_id, content_type_id, sensitivity, language } = form.data;

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const actor = locals.user?.email || 'anonymous';

    try {
      // Check for duplicate slug
      const existing = await db
        .prepare('SELECT id FROM content WHERE site_id = ? AND slug = ? AND language = ?')
        .bind(site_id, slug, language)
        .first();

      if (existing) {
        form.message = 'A content item with this slug already exists for this site and language';
        return fail(400, { form });
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
        .bind(id, site_id, content_type_id, title, slug, language, sensitivity, actor, now, now)
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
      form.message = 'Failed to create content';
      return fail(500, { form });
    }
  },
};

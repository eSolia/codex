/**
 * New Standard Page — Server
 * Creates a new coding standard in R2 + D1 standards_index.
 * InfoSec: Input validation and parameterized queries (OWASP A03)
 */

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { createStandardSchema } from '$lib/schemas';
import { buildStandardMarkdown } from '$lib/server/frontmatter';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod4(createStandardSchema));
  return { form };
};

export const actions: Actions = {
  default: async ({ platform, request }) => {
    if (!platform?.env?.DB || !platform?.env?.R2) {
      const form = await superValidate(request, zod4(createStandardSchema));
      form.message = 'Database or R2 not available';
      return fail(500, { form });
    }

    const db = platform.env.DB;
    const r2 = platform.env.R2;

    // InfoSec: Validate form input (OWASP A03)
    const form = await superValidate(request, zod4(createStandardSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const { slug, title, category, tags, summary } = form.data;

    try {
      // Check slug doesn't already exist
      const existing = await db
        .prepare('SELECT slug FROM standards_index WHERE slug = ?')
        .bind(slug)
        .first();

      if (existing) {
        form.message = `Standard "${slug}" already exists`;
        return fail(409, { form });
      }

      // Parse tags
      const tagArray = (tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const cat = category || 'guides';
      const r2Key = `standards/${slug}.md`;

      // Build and write markdown to R2
      const md = buildStandardMarkdown(
        {
          slug,
          title,
          category: cat,
          status: 'draft',
          tags: tagArray.length > 0 ? tagArray : undefined,
          summary: summary || undefined,
          created: new Date().toISOString().split('T')[0],
        },
        '\n'
      );
      await r2.put(r2Key, md, { httpMetadata: { contentType: 'text/markdown' } });

      // Insert into D1 standards_index
      await db
        .prepare(
          `INSERT INTO standards_index (
            slug, title, category, tags, summary, status,
            r2_key, author, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          slug,
          title,
          cat,
          JSON.stringify(tagArray),
          summary || null,
          'draft',
          r2Key,
          null // author set by user later
        )
        .run();

      throw redirect(303, `/standards/${slug}`);
    } catch (err) {
      if (err instanceof Response) throw err;
      if ((err as { status?: number }).status === 303) throw err;
      console.error('Standard create error:', err);
      form.message = err instanceof Error ? err.message : 'Failed to create standard';
      return fail(500, { form });
    }
  },
};

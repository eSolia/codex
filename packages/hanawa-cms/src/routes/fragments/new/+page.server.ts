/**
 * New Fragment Page Server Actions
 * InfoSec: Input validation and parameterized queries (OWASP A03)
 */

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { createFragmentSchema } from '$lib/schemas';

function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `frag_${timestamp}${random}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod4(createFragmentSchema));
  return { form };
};

export const actions: Actions = {
  default: async ({ platform, request }) => {
    if (!platform?.env?.DB) {
      const form = await superValidate(request, zod4(createFragmentSchema));
      form.message = 'Database not available';
      return fail(500, { form });
    }

    const db = platform.env.DB;

    // InfoSec: Validate form input (OWASP A03)
    const form = await superValidate(request, zod4(createFragmentSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const { name, category, description, content_en, content_ja, tags } = form.data;

    const id = generateId();
    const slug = slugify(name);

    // Parse tags
    const tagArray = (tags || '')
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    try {
      await db
        .prepare(
          `INSERT INTO fragments (
            id, name, slug, category, description,
            content_en, content_ja, is_bilingual,
            tags, version, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          id,
          name,
          slug,
          category || null,
          description || null,
          content_en || null,
          content_ja || null,
          content_en && content_ja ? 1 : 0,
          JSON.stringify(tagArray),
          '1.0',
          'active'
        )
        .run();

      throw redirect(303, `/fragments/${id}`);
    } catch (err) {
      if (err instanceof Response) throw err;
      console.error('Fragment create error:', err);
      form.message = 'Failed to create fragment';
      return fail(500, { form });
    }
  },
};

/**
 * New Fragment Page — Server
 * Creates a new fragment in R2 + D1 fragment_index.
 * InfoSec: Input validation and parameterized queries (OWASP A03)
 */

import type { Actions, PageServerLoad } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { createFragmentSchema } from '$lib/schemas';
import { buildFragmentMarkdown } from '$lib/server/frontmatter';

export const load: PageServerLoad = async () => {
  const form = await superValidate(zod4(createFragmentSchema));
  return { form };
};

export const actions: Actions = {
  default: async ({ platform, request }) => {
    if (!platform?.env?.DB || !platform?.env?.R2) {
      const form = await superValidate(request, zod4(createFragmentSchema));
      form.message = 'Database or R2 not available';
      return fail(500, { form });
    }

    const db = platform.env.DB;
    const r2 = platform.env.R2;

    // InfoSec: Validate form input (OWASP A03)
    const form = await superValidate(request, zod4(createFragmentSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const { id, title_en, title_ja, category, type, tags } = form.data;

    try {
      // Check ID doesn't already exist
      const existing = await db
        .prepare('SELECT id FROM fragment_index WHERE id = ?')
        .bind(id)
        .first();

      if (existing) {
        form.message = `Fragment "${id}" already exists`;
        return fail(409, { form });
      }

      // Parse tags
      const tagArray = (tags || '')
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      const cat = category || 'uncategorized';
      const r2KeyEn = `fragments/${cat}/${id}.en.md`;
      const r2KeyJa = title_ja ? `fragments/${cat}/${id}.ja.md` : null;

      // Build and write EN markdown to R2
      const mdEn = buildFragmentMarkdown(
        {
          id,
          language: 'en',
          title: title_en,
          category: cat,
          type: type || undefined,
          status: 'draft',
          tags: tagArray.length > 0 ? tagArray : undefined,
          sensitivity: 'normal',
          created: new Date().toISOString().split('T')[0],
        },
        '\n'
      );
      await r2.put(r2KeyEn, mdEn, { httpMetadata: { contentType: 'text/markdown' } });

      // Build and write JA markdown if title provided
      if (title_ja && r2KeyJa) {
        const mdJa = buildFragmentMarkdown(
          {
            id,
            language: 'ja',
            title: title_ja,
            category: cat,
            type: type || undefined,
            status: 'draft',
            tags: tagArray.length > 0 ? tagArray : undefined,
            sensitivity: 'normal',
            created: new Date().toISOString().split('T')[0],
          },
          '\n'
        );
        await r2.put(r2KeyJa, mdJa, { httpMetadata: { contentType: 'text/markdown' } });
      }

      // Insert into D1 fragment_index
      await db
        .prepare(
          `INSERT INTO fragment_index (
            id, category, title_en, title_ja, type, version, status,
            tags, has_en, has_ja, r2_key_en, r2_key_ja,
            sensitivity, author, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`
        )
        .bind(
          id,
          cat,
          title_en,
          title_ja || null,
          type || null,
          '2025-01',
          'draft',
          JSON.stringify(tagArray),
          1, // has_en — always created
          title_ja ? 1 : 0,
          r2KeyEn,
          r2KeyJa,
          'normal',
          null // author set by user later
          // created_at and updated_at use datetime('now')
        )
        .run();

      throw redirect(303, `/fragments/${id}`);
    } catch (err) {
      if (err instanceof Response) throw err;
      if ((err as { status?: number }).status === 303) throw err;
      console.error('Fragment create error:', err);
      form.message = err instanceof Error ? err.message : 'Failed to create fragment';
      return fail(500, { form });
    }
  },
};

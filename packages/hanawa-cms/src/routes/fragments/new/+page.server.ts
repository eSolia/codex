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
      const form = await superValidate(zod4(createFragmentSchema));
      form.message = 'Database or R2 not available';
      return fail(500, { form });
    }

    const db = platform.env.DB;
    const r2 = platform.env.R2;

    // Read formData once, then pass to superValidate and extract imported content
    const formData = await request.formData();

    // InfoSec: Validate form input (OWASP A03)
    const form = await superValidate(formData, zod4(createFragmentSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const { id, title_en, title_ja, category, type, tags } = form.data;

    // Extract optional imported content from form data
    const importedContentEn = formData.get('imported_content_en')?.toString() || '';
    const importedContentJa = formData.get('imported_content_ja')?.toString() || '';

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
      const r2KeyJa = `fragments/${cat}/${id}.ja.md`;

      // Build and write EN markdown to R2 (include imported content if available)
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
        importedContentEn || '\n'
      );
      await r2.put(r2KeyEn, mdEn, { httpMetadata: { contentType: 'text/markdown' } });

      // Build and write JA markdown if title or imported JA content provided
      const hasJa = title_ja || importedContentJa;
      if (hasJa && r2KeyJa) {
        const mdJa = buildFragmentMarkdown(
          {
            id,
            language: 'ja',
            title: title_ja || title_en,
            category: cat,
            type: type || undefined,
            status: 'draft',
            tags: tagArray.length > 0 ? tagArray : undefined,
            sensitivity: 'normal',
            created: new Date().toISOString().split('T')[0],
          },
          importedContentJa || '\n'
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
          hasJa ? 1 : 0,
          r2KeyEn,
          hasJa ? r2KeyJa : null,
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

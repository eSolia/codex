/**
 * Standard Edit Page — Server
 * Loads metadata from D1 standards_index, content from R2.
 * Saves back to R2 and updates D1 index.
 *
 * InfoSec: Parameterized queries (OWASP A03), input validation
 */

import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { saveStandardSchema, renameStandardSchema, deleteStandardSchema } from '$lib/schemas';
import { parseFrontmatter, buildStandardMarkdown } from '$lib/server/frontmatter';

interface StandardsIndexRow {
  slug: string;
  title: string;
  category: string | null;
  tags: string;
  summary: string | null;
  status: string;
  r2_key: string | null;
  author: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export const load: PageServerLoad = async ({ platform, params }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;
  const r2 = platform.env.R2;
  const standardSlug = params.slug;

  try {
    // 1. Load metadata from D1 standards_index
    const meta = await db
      .prepare('SELECT * FROM standards_index WHERE slug = ?')
      .bind(standardSlug)
      .first<StandardsIndexRow>();

    if (!meta) {
      throw error(404, 'Standard not found');
    }

    // 2. Load markdown content from R2
    let content = '';
    let existingFrontmatter: Record<string, unknown> = {};

    if (r2 && meta.r2_key) {
      try {
        const obj = await r2.get(meta.r2_key);
        if (obj) {
          const text = await obj.text();
          const parsed = parseFrontmatter(text);
          existingFrontmatter = parsed.frontmatter;
          content = parsed.body;
        }
      } catch (err) {
        console.warn(`[Standard] Failed to load from R2: ${meta.r2_key}`, err);
      }
    }

    // Parse tags JSON
    let tags: string[] = [];
    try {
      tags = JSON.parse(meta.tags || '[]');
    } catch {
      tags = [];
    }

    // 3. Initialize forms
    const saveForm = await superValidate(
      {
        title: meta.title || '',
        category: meta.category || '',
        status: meta.status as 'production' | 'draft' | 'deprecated' | 'archived',
        tags: JSON.stringify(tags),
        summary: meta.summary || '',
        author: meta.author || '',
        content,
      },
      zod4(saveStandardSchema)
    );

    const renameForm = await superValidate(zod4(renameStandardSchema));
    const deleteForm = await superValidate(zod4(deleteStandardSchema));

    return {
      standard: {
        ...meta,
        tags,
        content,
        frontmatter: existingFrontmatter,
      },
      saveForm,
      renameForm,
      deleteForm,
    };
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      throw err;
    }
    console.error('Standard load error:', err);
    throw error(500, 'Failed to load standard');
  }
};

export const actions: Actions = {
  save: async ({ platform, params, request, locals }) => {
    if (!platform?.env?.DB || !platform?.env?.R2) {
      const saveForm = await superValidate(request, zod4(saveStandardSchema));
      saveForm.message = 'Database or R2 not available';
      return fail(500, { saveForm });
    }

    const db = platform.env.DB;
    const r2 = platform.env.R2;

    // InfoSec: Validate form input (OWASP A03)
    const saveForm = await superValidate(request, zod4(saveStandardSchema));

    if (!saveForm.valid) {
      return fail(400, { saveForm });
    }

    const { title, category, status, tags, summary, author, content } = saveForm.data;

    try {
      // Parse tags
      let tagArray: string[];
      try {
        tagArray = JSON.parse(tags || '[]');
        if (!Array.isArray(tagArray)) tagArray = [];
      } catch {
        tagArray = [];
      }

      // Get current metadata
      const current = await db
        .prepare('SELECT * FROM standards_index WHERE slug = ?')
        .bind(params.slug)
        .first<StandardsIndexRow>();

      if (!current) {
        saveForm.message = 'Standard not found';
        return fail(404, { saveForm });
      }

      const cat = category || current.category || 'guides';
      const r2Key = `standards/${params.slug}.md`;

      // Get existing frontmatter for fields we don't edit
      let existingFm: Record<string, unknown> = {};
      if (current.r2_key) {
        try {
          const obj = await r2.get(current.r2_key);
          if (obj) {
            existingFm = parseFrontmatter(await obj.text()).frontmatter;
          }
          // eslint-disable-next-line esolia/no-silent-catch -- Non-fatal R2 read
        } catch {
          /* ignore */
        }
      }

      // Build and write markdown to R2
      const md = buildStandardMarkdown(
        {
          slug: params.slug,
          title: title || params.slug,
          category: cat,
          status: status || 'production',
          tags: tagArray.length > 0 ? tagArray : undefined,
          summary: summary || undefined,
          author: author || (existingFm.author as string) || undefined,
          created: (existingFm.created as string) || undefined,
        },
        content || ''
      );
      await r2.put(r2Key, md, { httpMetadata: { contentType: 'text/markdown' } });

      // Update D1 standards_index
      await db
        .prepare(
          `UPDATE standards_index
           SET title = ?, category = ?, tags = ?, summary = ?,
               status = ?, r2_key = ?, author = ?,
               updated_at = datetime('now')
           WHERE slug = ?`
        )
        .bind(
          title || null,
          cat,
          JSON.stringify(tagArray),
          summary || null,
          status || 'production',
          r2Key,
          author || null,
          params.slug
        )
        .run();

      // Audit log (non-blocking)
      try {
        if (locals.audit && locals.auditContext) {
          await locals.audit.log(
            {
              action: 'update',
              actionCategory: 'content',
              resourceType: 'standard',
              resourceId: params.slug,
              resourceTitle: title || params.slug,
              changeSummary: `Updated standard "${title || params.slug}"`,
            },
            locals.auditContext
          );
        }
      } catch (auditErr) {
        console.warn('Audit logging failed (non-fatal):', auditErr);
      }

      return { saveForm, success: true };
    } catch (err) {
      console.error('[Standard Save] Error:', err);
      saveForm.message = err instanceof Error ? err.message : 'Unknown error';
      return fail(500, { saveForm });
    }
  },

  rename: async ({ platform, params, request }) => {
    if (!platform?.env?.DB || !platform?.env?.R2) {
      const renameForm = await superValidate(request, zod4(renameStandardSchema));
      renameForm.message = 'Database or R2 not available';
      return fail(500, { renameForm });
    }

    const db = platform.env.DB;
    const r2 = platform.env.R2;

    const renameForm = await superValidate(request, zod4(renameStandardSchema));

    if (!renameForm.valid) {
      return fail(400, { renameForm });
    }

    const { new_slug } = renameForm.data;

    try {
      // Check new slug doesn't exist
      const existing = await db
        .prepare('SELECT slug FROM standards_index WHERE slug = ?')
        .bind(new_slug)
        .first();

      if (existing) {
        renameForm.message = `Standard "${new_slug}" already exists`;
        return fail(409, { renameForm });
      }

      // Get current metadata
      const current = await db
        .prepare('SELECT * FROM standards_index WHERE slug = ?')
        .bind(params.slug)
        .first<StandardsIndexRow>();

      if (!current) {
        renameForm.message = 'Standard not found';
        return fail(404, { renameForm });
      }

      const newR2Key = `standards/${new_slug}.md`;

      // Copy R2 file with updated frontmatter slug
      if (current.r2_key) {
        const obj = await r2.get(current.r2_key);
        if (obj) {
          const text = await obj.text();
          const { frontmatter, body } = parseFrontmatter(text);

          const md = buildStandardMarkdown(
            {
              slug: new_slug,
              title: (frontmatter.title as string) || new_slug,
              category: (frontmatter.category as string) || undefined,
              status: (frontmatter.status as string) || undefined,
              tags: frontmatter.tags as string[] | undefined,
              summary: (frontmatter.summary as string) || undefined,
              author: (frontmatter.author as string) || undefined,
              created: (frontmatter.created as string) || undefined,
            },
            body
          );
          await r2.put(newR2Key, md, { httpMetadata: { contentType: 'text/markdown' } });
          await r2.delete(current.r2_key);
        }
      }

      // Update D1: delete old row, insert new
      await db.batch([
        db.prepare('DELETE FROM standards_index WHERE slug = ?').bind(params.slug),
        db
          .prepare(
            `INSERT INTO standards_index (slug, title, category, tags, summary, status, r2_key, author, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          )
          .bind(
            new_slug,
            current.title,
            current.category,
            current.tags,
            current.summary,
            current.status,
            newR2Key,
            current.author,
            current.created_at
          ),
      ]);

      throw redirect(303, `/standards/${new_slug}`);
    } catch (err) {
      if ((err as { status?: number }).status === 303) throw err;
      console.error('[Standard Rename] Error:', err);
      renameForm.message = err instanceof Error ? err.message : 'Unknown error';
      return fail(500, { renameForm });
    }
  },

  delete: async ({ platform, params, locals }) => {
    if (!platform?.env?.DB) {
      throw error(500, 'Database not available');
    }

    const db = platform.env.DB;
    const r2 = platform.env.R2;

    try {
      // Get metadata for R2 cleanup
      const current = await db
        .prepare('SELECT * FROM standards_index WHERE slug = ?')
        .bind(params.slug)
        .first<StandardsIndexRow>();

      // Delete R2 object
      if (r2 && current?.r2_key) {
        try {
          await r2.delete(current.r2_key);
        } catch (err) {
          console.warn(`Failed to delete R2 key ${current.r2_key}:`, err);
        }
      }

      // Delete from D1
      await db.prepare('DELETE FROM standards_index WHERE slug = ?').bind(params.slug).run();

      // Audit log
      try {
        if (locals.audit && locals.auditContext) {
          await locals.audit.log(
            {
              action: 'delete',
              actionCategory: 'content',
              resourceType: 'standard',
              resourceId: params.slug,
              resourceTitle: current?.title || params.slug,
              changeSummary: `Deleted standard "${current?.title || params.slug}"`,
            },
            locals.auditContext
          );
        }
      } catch (auditErr) {
        console.warn('Audit logging failed (non-fatal):', auditErr);
      }

      throw redirect(303, '/standards');
    } catch (err) {
      if ((err as { status?: number }).status === 303) throw err;
      console.error('Standard delete error:', err);
      throw error(500, 'Failed to delete standard');
    }
  },
};

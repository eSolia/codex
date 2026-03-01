/**
 * Fragment Edit Page — Server
 * Loads metadata from D1 fragment_index, content from R2.
 * Saves back to R2 and updates D1 index.
 *
 * InfoSec: Parameterized queries (OWASP A03), input validation
 */

import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { saveFragmentSchema, renameFragmentSchema, deleteFragmentSchema } from '$lib/schemas';
import { parseFrontmatter, buildFragmentMarkdown } from '$lib/server/frontmatter';
import { runQCCheck, storeQCResults } from '$lib/server/qc';

interface FragmentIndexRow {
  id: string;
  category: string | null;
  title_en: string | null;
  title_ja: string | null;
  type: string | null;
  version: string | null;
  status: string;
  tags: string;
  has_en: number;
  has_ja: number;
  r2_key_en: string | null;
  r2_key_ja: string | null;
  sensitivity: string;
  author: string | null;
  created_at: string | null;
  updated_at: string | null;
  last_qc_at: string | null;
  qc_score: number | null;
  qc_issues: string | null;
}

export const load: PageServerLoad = async ({ platform, params }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;
  const r2 = platform.env.R2;
  const fragmentId = params.id;

  try {
    // 1. Load metadata from D1 fragment_index
    const meta = await db
      .prepare('SELECT * FROM fragment_index WHERE id = ?')
      .bind(fragmentId)
      .first<FragmentIndexRow>();

    if (!meta) {
      throw error(404, 'Fragment not found');
    }

    // 2. Load markdown content from R2
    let contentEn = '';
    let contentJa = '';
    let frontmatterEn: Record<string, unknown> = {};
    let frontmatterJa: Record<string, unknown> = {};

    if (r2 && meta.r2_key_en) {
      try {
        const obj = await r2.get(meta.r2_key_en);
        if (obj) {
          const text = await obj.text();
          const parsed = parseFrontmatter(text);
          frontmatterEn = parsed.frontmatter;
          contentEn = parsed.body;
        }
      } catch (err) {
        console.warn(`[Fragment] Failed to load EN from R2: ${meta.r2_key_en}`, err);
      }
    }

    if (r2 && meta.r2_key_ja) {
      try {
        const obj = await r2.get(meta.r2_key_ja);
        if (obj) {
          const text = await obj.text();
          const parsed = parseFrontmatter(text);
          frontmatterJa = parsed.frontmatter;
          contentJa = parsed.body;
        }
      } catch (err) {
        console.warn(`[Fragment] Failed to load JA from R2: ${meta.r2_key_ja}`, err);
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
        title_en: meta.title_en || '',
        title_ja: meta.title_ja || '',
        category: meta.category || '',
        type: meta.type || '',
        status: meta.status as 'production' | 'draft' | 'deprecated' | 'archived',
        sensitivity: (meta.sensitivity || 'normal') as 'normal' | 'confidential' | 'embargoed',
        tags: JSON.stringify(tags),
        author: meta.author || '',
        version: meta.version || '',
        content_en: contentEn,
        content_ja: contentJa,
      },
      zod4(saveFragmentSchema)
    );

    const renameForm = await superValidate(zod4(renameFragmentSchema));
    const deleteForm = await superValidate(zod4(deleteFragmentSchema));

    // Parse QC issues from JSON
    let qcIssues: unknown[] = [];
    try {
      qcIssues = meta.qc_issues ? JSON.parse(meta.qc_issues) : [];
    } catch {
      qcIssues = [];
    }

    return {
      fragment: {
        ...meta,
        tags,
        content_en: contentEn,
        content_ja: contentJa,
        frontmatter_en: frontmatterEn,
        frontmatter_ja: frontmatterJa,
        qc_issues: qcIssues,
      },
      saveForm,
      renameForm,
      deleteForm,
    };
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      throw err;
    }
    console.error('Fragment load error:', err);
    throw error(500, 'Failed to load fragment');
  }
};

export const actions: Actions = {
  save: async ({ platform, params, request, locals }) => {
    if (!platform?.env?.DB || !platform?.env?.R2) {
      const saveForm = await superValidate(request, zod4(saveFragmentSchema));
      saveForm.message = 'Database or R2 not available';
      return fail(500, { saveForm });
    }

    const db = platform.env.DB;
    const r2 = platform.env.R2;

    // InfoSec: Validate form input (OWASP A03)
    const saveForm = await superValidate(request, zod4(saveFragmentSchema));

    if (!saveForm.valid) {
      return fail(400, { saveForm });
    }

    const {
      title_en,
      title_ja,
      category,
      type,
      status,
      sensitivity,
      tags,
      author,
      version,
      content_en,
      content_ja,
    } = saveForm.data;

    // Auto-bump version: YYYYMMDDA, B, C... increments on same-day saves
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, ''); // e.g., "20260228"
    let effectiveVersion: string;
    if (version && version.startsWith(today) && version.length === 9) {
      // Same day — increment the letter suffix
      const currentLetter = version.charAt(8);
      const nextLetter = String.fromCharCode(currentLetter.charCodeAt(0) + 1);
      effectiveVersion = today + nextLetter;
    } else {
      effectiveVersion = today + 'A';
    }

    try {
      // Parse tags
      let tagArray: string[];
      try {
        tagArray = JSON.parse(tags || '[]');
        if (!Array.isArray(tagArray)) tagArray = [];
      } catch {
        tagArray = [];
      }

      // Get current metadata for R2 keys
      const current = await db
        .prepare('SELECT * FROM fragment_index WHERE id = ?')
        .bind(params.id)
        .first<FragmentIndexRow>();

      if (!current) {
        saveForm.message = 'Fragment not found';
        return fail(404, { saveForm });
      }

      const cat = category || current.category || 'uncategorized';
      const r2KeyEn = `fragments/${cat}/${params.id}.en.md`;
      const r2KeyJa = `fragments/${cat}/${params.id}.ja.md`;

      // Get existing frontmatter for fields we don't edit
      let existingFmEn: Record<string, unknown> = {};
      let existingFmJa: Record<string, unknown> = {};

      if (current.r2_key_en) {
        try {
          const obj = await r2.get(current.r2_key_en);
          if (obj) {
            existingFmEn = parseFrontmatter(await obj.text()).frontmatter;
          }
          // eslint-disable-next-line esolia/no-silent-catch -- Non-fatal R2 read
        } catch {
          /* ignore */
        }
      }
      if (current.r2_key_ja) {
        try {
          const obj = await r2.get(current.r2_key_ja);
          if (obj) {
            existingFmJa = parseFrontmatter(await obj.text()).frontmatter;
          }
          // eslint-disable-next-line esolia/no-silent-catch -- Non-fatal R2 read
        } catch {
          /* ignore */
        }
      }

      // Build and write EN markdown to R2
      if (title_en || content_en) {
        const mdEn = buildFragmentMarkdown(
          {
            id: params.id,
            language: 'en',
            title: title_en || params.id,
            category: cat,
            type: type || (existingFmEn.type as string) || undefined,
            version: effectiveVersion || (existingFmEn.version as string) || undefined,
            status: status || 'production',
            tags: tagArray.length > 0 ? tagArray : undefined,
            sensitivity: sensitivity || 'normal',
            author: author || (existingFmEn.author as string) || undefined,
            created: (existingFmEn.created as string) || undefined,
            diagramFormat: (existingFmEn.diagram_format as string) || undefined,
          },
          content_en || ''
        );
        await r2.put(r2KeyEn, mdEn, { httpMetadata: { contentType: 'text/markdown' } });

        // If category changed, remove old R2 key
        if (current.r2_key_en && current.r2_key_en !== r2KeyEn) {
          await r2.delete(current.r2_key_en);
        }
      }

      // Build and write JA markdown to R2
      if (title_ja || content_ja) {
        const mdJa = buildFragmentMarkdown(
          {
            id: params.id,
            language: 'ja',
            title: title_ja || params.id,
            category: cat,
            type: type || (existingFmJa.type as string) || undefined,
            version: effectiveVersion || (existingFmJa.version as string) || undefined,
            status: status || 'production',
            tags: tagArray.length > 0 ? tagArray : undefined,
            sensitivity: sensitivity || 'normal',
            author: author || (existingFmJa.author as string) || undefined,
            created: (existingFmJa.created as string) || undefined,
            diagramFormat: (existingFmJa.diagram_format as string) || undefined,
          },
          content_ja || ''
        );
        await r2.put(r2KeyJa, mdJa, { httpMetadata: { contentType: 'text/markdown' } });

        // If category changed, remove old R2 key
        if (current.r2_key_ja && current.r2_key_ja !== r2KeyJa) {
          await r2.delete(current.r2_key_ja);
        }
      }

      // Update D1 fragment_index
      await db
        .prepare(
          `UPDATE fragment_index
           SET title_en = ?, title_ja = ?, category = ?, type = ?,
               version = ?, status = ?, tags = ?, sensitivity = ?,
               author = ?, has_en = ?, has_ja = ?,
               r2_key_en = ?, r2_key_ja = ?,
               updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          title_en || null,
          title_ja || null,
          cat,
          type || null,
          effectiveVersion || null,
          status || 'production',
          JSON.stringify(tagArray),
          sensitivity || 'normal',
          author || null,
          title_en || content_en ? 1 : 0,
          title_ja || content_ja ? 1 : 0,
          title_en || content_en ? r2KeyEn : null,
          title_ja || content_ja ? r2KeyJa : null,
          params.id
        )
        .run();

      // Audit log (non-blocking)
      try {
        if (locals.audit && locals.auditContext) {
          await locals.audit.log(
            {
              action: 'update',
              actionCategory: 'content',
              resourceType: 'fragment',
              resourceId: params.id,
              resourceTitle: title_en || title_ja || params.id,
              changeSummary: `Updated fragment "${title_en || params.id}"`,
            },
            locals.auditContext
          );
        }
      } catch (auditErr) {
        console.warn('Audit logging failed (non-fatal):', auditErr);
      }

      return { saveForm, success: true };
    } catch (err) {
      console.error('[Fragment Save] Error:', err);
      saveForm.message = err instanceof Error ? err.message : 'Unknown error';
      return fail(500, { saveForm });
    }
  },

  rename: async ({ platform, params, request }) => {
    if (!platform?.env?.DB || !platform?.env?.R2) {
      const renameForm = await superValidate(request, zod4(renameFragmentSchema));
      renameForm.message = 'Database or R2 not available';
      return fail(500, { renameForm });
    }

    const db = platform.env.DB;
    const r2 = platform.env.R2;

    const renameForm = await superValidate(request, zod4(renameFragmentSchema));

    if (!renameForm.valid) {
      return fail(400, { renameForm });
    }

    const { new_id, new_category } = renameForm.data;

    try {
      // Check new ID doesn't exist
      const existing = await db
        .prepare('SELECT id FROM fragment_index WHERE id = ?')
        .bind(new_id)
        .first();

      if (existing) {
        renameForm.message = `Fragment "${new_id}" already exists`;
        return fail(409, { renameForm });
      }

      // Get current metadata
      const current = await db
        .prepare('SELECT * FROM fragment_index WHERE id = ?')
        .bind(params.id)
        .first<FragmentIndexRow>();

      if (!current) {
        renameForm.message = 'Fragment not found';
        return fail(404, { renameForm });
      }

      const cat = new_category || current.category || 'uncategorized';
      const newR2KeyEn = `fragments/${cat}/${new_id}.en.md`;
      const newR2KeyJa = `fragments/${cat}/${new_id}.ja.md`;

      // Copy EN from old to new R2 key (with updated frontmatter)
      if (current.r2_key_en) {
        const obj = await r2.get(current.r2_key_en);
        if (obj) {
          const text = await obj.text();
          const { frontmatter, body } = parseFrontmatter(text);
          frontmatter.id = new_id;
          if (new_category) frontmatter.category = new_category;

          const md = buildFragmentMarkdown(
            {
              id: new_id,
              language: 'en',
              title: (frontmatter.title as string) || new_id,
              category: cat,
              type: frontmatter.type as string | undefined,
              version: frontmatter.version as string | undefined,
              status: frontmatter.status as string | undefined,
              tags: frontmatter.tags as string[] | undefined,
              sensitivity: frontmatter.sensitivity as string | undefined,
              author: frontmatter.author as string | undefined,
              created: frontmatter.created as string | undefined,
              diagramFormat: frontmatter.diagram_format as string | undefined,
            },
            body
          );
          await r2.put(newR2KeyEn, md, { httpMetadata: { contentType: 'text/markdown' } });
          await r2.delete(current.r2_key_en);
        }
      }

      // Copy JA from old to new R2 key
      if (current.r2_key_ja) {
        const obj = await r2.get(current.r2_key_ja);
        if (obj) {
          const text = await obj.text();
          const { frontmatter, body } = parseFrontmatter(text);
          frontmatter.id = new_id;
          if (new_category) frontmatter.category = new_category;

          const md = buildFragmentMarkdown(
            {
              id: new_id,
              language: 'ja',
              title: (frontmatter.title as string) || new_id,
              category: cat,
              type: frontmatter.type as string | undefined,
              version: frontmatter.version as string | undefined,
              status: frontmatter.status as string | undefined,
              tags: frontmatter.tags as string[] | undefined,
              sensitivity: frontmatter.sensitivity as string | undefined,
              author: frontmatter.author as string | undefined,
              created: frontmatter.created as string | undefined,
              diagramFormat: frontmatter.diagram_format as string | undefined,
            },
            body
          );
          await r2.put(newR2KeyJa, md, { httpMetadata: { contentType: 'text/markdown' } });
          await r2.delete(current.r2_key_ja);
        }
      }

      // Update D1: delete old row, insert new
      await db.batch([
        db.prepare('DELETE FROM fragment_index WHERE id = ?').bind(params.id),
        db
          .prepare(
            `INSERT INTO fragment_index (id, category, title_en, title_ja, type, version, status, tags, has_en, has_ja, r2_key_en, r2_key_ja, sensitivity, author, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
          )
          .bind(
            new_id,
            cat,
            current.title_en,
            current.title_ja,
            current.type,
            current.version,
            current.status,
            current.tags,
            current.has_en,
            current.has_ja,
            current.has_en ? newR2KeyEn : null,
            current.has_ja ? newR2KeyJa : null,
            current.sensitivity,
            current.author,
            current.created_at
          ),
      ]);

      throw redirect(303, `/fragments/${new_id}`);
    } catch (err) {
      if ((err as { status?: number }).status === 303) throw err;
      console.error('[Fragment Rename] Error:', err);
      renameForm.message = err instanceof Error ? err.message : 'Unknown error';
      return fail(500, { renameForm });
    }
  },

  // AI Translate title or content between EN/JA
  aiTranslate: async ({ request, locals }) => {
    if (!locals.ai) {
      return fail(500, { error: 'AI service not available' });
    }

    const formData = await request.formData();
    const text = formData.get('text')?.toString() || '';
    const sourceLocale = formData.get('source_locale')?.toString() as 'en' | 'ja';
    const field = formData.get('field')?.toString() || '';

    if (!text || !sourceLocale) {
      return fail(400, { error: 'Text and source locale are required' });
    }

    // InfoSec: Validate locale enum (OWASP A03)
    if (!['en', 'ja'].includes(sourceLocale)) {
      return fail(400, { error: 'Invalid source locale' });
    }

    const targetLocale = sourceLocale === 'en' ? 'ja' : 'en';
    const userEmail = locals.user?.email || 'anonymous';

    try {
      const translated = await locals.ai.translate(text, sourceLocale, targetLocale, userEmail);
      return { success: true, translated, targetLocale, field };
    } catch (err) {
      console.error('Translation failed:', err);
      return fail(500, { error: 'Translation failed' });
    }
  },

  qcCheck: async ({ platform, params, request }) => {
    if (!platform?.env?.DB || !platform?.env?.AI) {
      return fail(500, { qcError: 'AI or database not available' });
    }

    const db = platform.env.DB;
    const ai = platform.env.AI;

    const formData = await request.formData();
    const contentEn = formData.get('qc_content_en')?.toString() || '';
    const contentJa = formData.get('qc_content_ja')?.toString() || '';
    const userEmail = formData.get('qc_user_email')?.toString() || 'anonymous';

    // Run QC on whichever content is available, preferring EN
    const content = contentEn || contentJa;
    if (!content.trim()) {
      return fail(400, { qcError: 'No content to check' });
    }

    const language = contentEn ? 'en' : 'ja';

    try {
      const result = await runQCCheck(ai, db, content, language, userEmail, params.id);
      await storeQCResults(db, params.id, result);

      return {
        qcResult: {
          score: result.score,
          issues: result.issues,
          checkedAt: result.checkedAt,
        },
      };
    } catch (err) {
      console.error('[QC Check] Error:', err);
      return fail(500, { qcError: err instanceof Error ? err.message : 'QC check failed' });
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
        .prepare('SELECT * FROM fragment_index WHERE id = ?')
        .bind(params.id)
        .first<FragmentIndexRow>();

      // Delete R2 objects
      if (r2 && current) {
        if (current.r2_key_en) {
          try {
            await r2.delete(current.r2_key_en);
          } catch (err) {
            console.warn(`Failed to delete R2 key ${current.r2_key_en}:`, err);
          }
        }
        if (current.r2_key_ja) {
          try {
            await r2.delete(current.r2_key_ja);
          } catch (err) {
            console.warn(`Failed to delete R2 key ${current.r2_key_ja}:`, err);
          }
        }
      }

      // Delete from D1
      await db.prepare('DELETE FROM fragment_index WHERE id = ?').bind(params.id).run();

      // Audit log
      try {
        if (locals.audit && locals.auditContext) {
          await locals.audit.log(
            {
              action: 'delete',
              actionCategory: 'content',
              resourceType: 'fragment',
              resourceId: params.id,
              resourceTitle: current?.title_en || params.id,
              changeSummary: `Deleted fragment "${current?.title_en || params.id}"`,
            },
            locals.auditContext
          );
        }
      } catch (auditErr) {
        console.warn('Audit logging failed (non-fatal):', auditErr);
      }

      throw redirect(303, '/fragments');
    } catch (err) {
      if ((err as { status?: number }).status === 303) throw err;
      console.error('Fragment delete error:', err);
      throw error(500, 'Failed to delete fragment');
    }
  },
};

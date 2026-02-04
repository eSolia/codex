/**
 * Fragment Detail Page Server Load
 * InfoSec: Parameterized queries prevent SQL injection (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { createVersionService, type VersionListItem } from '$lib/server/versions';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { saveFragmentSchema, deleteFragmentSchema } from '$lib/schemas';

interface FragmentRow {
  id: string;
  site_id: string;
  name: string;
  slug: string;
  content_en: string | null;
  content_ja: string | null;
  description: string | null;
  category: string | null;
  tags: string | null;
  version: number;
  status: string;
  is_bilingual: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  diagram_source: string | null;
}

export const load: PageServerLoad = async ({ platform, params, locals }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;
  const fragmentId = params.id;

  try {
    const result = await db
      .prepare('SELECT * FROM fragments WHERE id = ?')
      .bind(fragmentId)
      .first<FragmentRow>();

    if (!result) {
      throw error(404, 'Fragment not found');
    }

    // Parse JSON fields
    const fragment = {
      ...result,
      tags: result.tags ? JSON.parse(result.tags) : ([] as string[]),
    };

    // Load version history
    let versions: VersionListItem[] = [];
    try {
      const versionService = locals.versions || createVersionService(db);
      versions = await versionService.list(fragmentId, { limit: 50 });
    } catch (vErr) {
      console.warn('Could not load versions:', vErr);
    }

    // Initialize forms
    const saveForm = await superValidate(
      {
        name: fragment.name,
        content_en: fragment.content_en || '',
        content_ja: fragment.content_ja || '',
        description: fragment.description || '',
        category: fragment.category || '',
        tags: JSON.stringify(fragment.tags),
      },
      zod4(saveFragmentSchema)
    );
    const deleteForm = await superValidate(zod4(deleteFragmentSchema));

    return { fragment, versions, saveForm, deleteForm };
  } catch (err) {
    if ((err as { status?: number }).status === 404) {
      throw err;
    }
    console.error('Fragment load error:', err);
    throw error(500, 'Failed to load fragment');
  }
};

export const actions: Actions = {
  update: async ({ platform, params, request, locals }) => {
    try {
      console.log('[Fragment Update] Action started for:', params.id);

      if (!platform?.env?.DB) {
        console.error('[Fragment Update] Database not available');
        const saveForm = await superValidate(request, zod4(saveFragmentSchema));
        saveForm.message = 'Database not available';
        return fail(500, { saveForm });
      }

      const db = platform.env.DB;

      // InfoSec: Validate form input (OWASP A03)
      const saveForm = await superValidate(request, zod4(saveFragmentSchema));

      if (!saveForm.valid) {
        return fail(400, { saveForm });
      }

      const { name, content_encoding, description, category, tags } = saveForm.data;
      let { content_en, content_ja } = saveForm.data;

      // Decode base64 content if encoded (bypasses WAF for HTML content)
      if (content_encoding === 'base64') {
        try {
          if (content_en) {
            content_en = decodeURIComponent(escape(atob(content_en)));
          }
          if (content_ja) {
            content_ja = decodeURIComponent(escape(atob(content_ja)));
          }
        } catch (decodeErr) {
          console.error('[Fragment Update] Base64 decode error:', decodeErr);
          saveForm.message = 'Failed to decode content';
          return fail(400, { saveForm });
        }
      }

      console.log(`[Fragment Update] Name: ${name}`);
      console.log(`[Fragment Update] Content EN length: ${content_en?.length || 0}`);
      console.log(`[Fragment Update] Content JA length: ${content_ja?.length || 0}`);

      // Parse and validate tags
      let tagArray: string[];
      try {
        tagArray = JSON.parse(tags || '[]');
        if (!Array.isArray(tagArray)) tagArray = [];
      } catch {
        tagArray = [];
      }

      console.log(`[Fragment Update] Starting update for ${params.id}`);

      // Get current state for version comparison
      const current = await db
        .prepare('SELECT * FROM fragments WHERE id = ?')
        .bind(params.id)
        .first<{ name: string; content_en: string | null; content_ja: string | null }>();

      console.log(`[Fragment Update] Current fragment found: ${!!current}`);

      // Update fragment
      const updateResult = await db
        .prepare(
          `UPDATE fragments
           SET name = ?, content_en = ?, content_ja = ?, description = ?,
               category = ?, tags = ?, is_bilingual = ?, updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          name,
          content_en || null,
          content_ja || null,
          description || null,
          category || null,
          JSON.stringify(tagArray),
          content_en && content_ja ? 1 : 0,
          params.id
        )
        .run();

      console.log(`[Fragment Update] Update successful, changes: ${updateResult.meta?.changes}`);

      // Create version if content changed (non-blocking)
      try {
        if (locals.versions && locals.auditContext) {
          const newContent = JSON.stringify({
            name,
            content_en: content_en,
            content_ja: content_ja,
          });
          const oldContent = current
            ? JSON.stringify({
                name: current.name,
                content_en: current.content_en,
                content_ja: current.content_ja,
              })
            : null;

          if (newContent !== oldContent) {
            await locals.versions.create(
              params.id,
              {
                content: newContent,
                contentFormat: 'json',
                title: name,
                versionType: 'manual',
              },
              locals.auditContext
            );
          }
        }
      } catch (versionErr) {
        console.warn('Version creation failed (non-fatal):', versionErr);
      }

      // Log audit event (non-blocking)
      try {
        if (locals.audit && locals.auditContext) {
          await locals.audit.log(
            {
              action: 'update',
              actionCategory: 'content',
              resourceType: 'fragment',
              resourceId: params.id,
              resourceTitle: name,
              changeSummary: `Updated fragment "${name}"`,
            },
            locals.auditContext
          );
        }
      } catch (auditErr) {
        console.warn('Audit logging failed (non-fatal):', auditErr);
      }

      console.log(`[Fragment Update] Completed successfully`);
      return { saveForm, success: true };
    } catch (err) {
      console.error('[Fragment Update] Error:', err);
      console.error(
        '[Fragment Update] Error message:',
        err instanceof Error ? err.message : String(err)
      );
      console.error(
        '[Fragment Update] Error stack:',
        err instanceof Error ? err.stack : 'no stack'
      );
      const saveForm = await superValidate(zod4(saveFragmentSchema));
      saveForm.message = err instanceof Error ? err.message : 'Unknown error';
      return fail(500, { saveForm });
    }
  },

  delete: async ({ platform, params, locals }) => {
    if (!platform?.env?.DB) {
      throw error(500, 'Database not available');
    }

    const db = platform.env.DB;

    try {
      // Get fragment name for audit
      const fragment = await db
        .prepare('SELECT name FROM fragments WHERE id = ?')
        .bind(params.id)
        .first<{ name: string }>();

      await db.prepare('DELETE FROM fragments WHERE id = ?').bind(params.id).run();

      // Log audit event
      if (locals.audit && locals.auditContext) {
        await locals.audit.log(
          {
            action: 'delete',
            actionCategory: 'content',
            resourceType: 'fragment',
            resourceId: params.id,
            resourceTitle: fragment?.name,
            changeSummary: `Deleted fragment "${fragment?.name || params.id}"`,
          },
          locals.auditContext
        );
      }

      throw redirect(303, '/fragments');
    } catch (err) {
      if ((err as { status?: number }).status === 303) {
        throw err;
      }
      console.error('Fragment delete error:', err);
      throw error(500, 'Failed to delete fragment');
    }
  },
};

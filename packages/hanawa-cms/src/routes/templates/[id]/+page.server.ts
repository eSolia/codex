/**
 * Template Edit Page Server
 * InfoSec: Input validation, parameterized queries (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { saveTemplateSchema, deleteTemplateSchema } from '$lib/schemas';

interface Template {
  id: string;
  name: string;
  name_ja: string | null;
  description: string | null;
  description_ja: string | null;
  document_type: string;
  default_fragments: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Fragment {
  id: string;
  name: string;
  slug: string;
  category: string;
}

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;
  const { id } = params;

  try {
    // InfoSec: Parameterized query (OWASP A03)
    const template = await db
      .prepare('SELECT * FROM templates WHERE id = ?')
      .bind(id)
      .first<Template>();

    if (!template) {
      throw error(404, 'Template not found');
    }

    // Load available fragments
    const fragmentsResult = await db
      .prepare(
        `SELECT id, name, slug, category
         FROM fragments
         WHERE category IN ('proposals', 'capabilities', 'services', 'terms', 'closing', 'company')
         ORDER BY category, name`
      )
      .all<Fragment>();

    // Initialize forms - convert null to empty string for optional fields
    const saveForm = await superValidate(
      {
        name: template.name,
        name_ja: template.name_ja || '',
        description: template.description || '',
        description_ja: template.description_ja || '',
        document_type: template.document_type as
          | 'proposal'
          | 'report'
          | 'quote'
          | 'sow'
          | 'assessment',
        is_default: template.is_default,
        fragments: template.default_fragments || '',
      },
      zod4(saveTemplateSchema)
    );
    const deleteForm = await superValidate(zod4(deleteTemplateSchema));

    return {
      template,
      availableFragments: fragmentsResult.results ?? [],
      saveForm,
      deleteForm,
    };
  } catch (err) {
    if ((err as { status?: number })?.status === 404) {
      throw err;
    }
    console.error('Failed to load template:', err);
    throw error(500, 'Failed to load template');
  }
};

export const actions: Actions = {
  // Update template
  update: async ({ params, request, platform }) => {
    if (!platform?.env?.DB) {
      const saveForm = await superValidate(request, zod4(saveTemplateSchema));
      saveForm.message = 'Database not available';
      return fail(500, { saveForm });
    }

    const db = platform.env.DB;

    // InfoSec: Validate form input (OWASP A03)
    const saveForm = await superValidate(request, zod4(saveTemplateSchema));

    if (!saveForm.valid) {
      return fail(400, { saveForm });
    }

    const { name, name_ja, description, description_ja, document_type, is_default, fragments } =
      saveForm.data;

    // InfoSec: Validate fragments JSON structure
    try {
      const fragmentArray = JSON.parse(fragments || '[]');
      if (!Array.isArray(fragmentArray)) {
        saveForm.message = 'Invalid fragments format';
        return fail(400, { saveForm });
      }
    } catch {
      saveForm.message = 'Invalid fragments JSON';
      return fail(400, { saveForm });
    }

    try {
      // If this is marked as default, unset other defaults for this type
      if (is_default) {
        await db
          .prepare(
            'UPDATE templates SET is_default = FALSE WHERE document_type = ? AND is_default = TRUE AND id != ?'
          )
          .bind(document_type, params.id)
          .run();
      }

      // InfoSec: Parameterized update (OWASP A03)
      await db
        .prepare(
          `UPDATE templates SET
            name = ?, name_ja = ?, description = ?, description_ja = ?,
            document_type = ?, default_fragments = ?, is_default = ?,
            updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          name,
          name_ja || null,
          description || null,
          description_ja || null,
          document_type,
          fragments || '[]',
          is_default,
          params.id
        )
        .run();

      return { saveForm, success: true };
    } catch (err) {
      console.error('Failed to update template:', err);
      saveForm.message = 'Failed to update template';
      return fail(500, { saveForm });
    }
  },

  // Delete template
  delete: async ({ params, platform }) => {
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;

    try {
      await db.prepare('DELETE FROM templates WHERE id = ?').bind(params.id).run();

      redirect(303, '/templates');
    } catch (err) {
      // Re-throw redirects
      if (err instanceof Response || (err as { status?: number })?.status === 303) {
        throw err;
      }

      console.error('Delete failed:', err);
      return fail(500, { error: 'Failed to delete template' });
    }
  },

  // Duplicate template
  duplicate: async ({ params, platform }) => {
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;

    try {
      // Load existing template
      const template = await db
        .prepare('SELECT * FROM templates WHERE id = ?')
        .bind(params.id)
        .first<Template>();

      if (!template) {
        return fail(404, { error: 'Template not found' });
      }

      // Generate new ID
      const newId = `tpl_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

      // Create duplicate (not default, with "Copy of" prefix)
      await db
        .prepare(
          `INSERT INTO templates (
            id, name, name_ja, description, description_ja,
            document_type, default_fragments, is_default, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, FALSE, TRUE)`
        )
        .bind(
          newId,
          `Copy of ${template.name}`,
          template.name_ja ? `${template.name_ja}のコピー` : null,
          template.description,
          template.description_ja,
          template.document_type,
          template.default_fragments
        )
        .run();

      redirect(303, `/templates/${newId}`);
    } catch (err) {
      // Re-throw redirects
      if (err instanceof Response || (err as { status?: number })?.status === 303) {
        throw err;
      }

      console.error('Duplicate failed:', err);
      return fail(500, { error: 'Failed to duplicate template' });
    }
  },
};

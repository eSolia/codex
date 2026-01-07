/**
 * Template Edit Page Server
 * InfoSec: Input validation, parameterized queries (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { error, fail, redirect } from '@sveltejs/kit';

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

    return {
      template,
      availableFragments: fragmentsResult.results ?? [],
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
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;
    const formData = await request.formData();

    const name = formData.get('name')?.toString().trim();
    const nameJa = formData.get('name_ja')?.toString().trim() || null;
    const description = formData.get('description')?.toString().trim() || null;
    const descriptionJa = formData.get('description_ja')?.toString().trim() || null;
    const documentType = formData.get('document_type')?.toString() || 'proposal';
    const isDefault = formData.get('is_default') === 'true';
    const fragmentsJson = formData.get('fragments')?.toString() || '[]';

    if (!name) {
      return fail(400, { error: 'Template name is required' });
    }

    // InfoSec: Validate document_type enum (OWASP A03)
    const validTypes = ['proposal', 'report', 'quote', 'sow', 'assessment'];
    if (!validTypes.includes(documentType)) {
      return fail(400, { error: 'Invalid document type' });
    }

    // InfoSec: Validate fragments JSON structure
    try {
      const fragments = JSON.parse(fragmentsJson);
      if (!Array.isArray(fragments)) {
        return fail(400, { error: 'Invalid fragments format' });
      }
    } catch {
      return fail(400, { error: 'Invalid fragments JSON' });
    }

    try {
      // If this is marked as default, unset other defaults for this type
      if (isDefault) {
        await db
          .prepare(
            'UPDATE templates SET is_default = FALSE WHERE document_type = ? AND is_default = TRUE AND id != ?'
          )
          .bind(documentType, params.id)
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
          nameJa,
          description,
          descriptionJa,
          documentType,
          fragmentsJson,
          isDefault,
          params.id
        )
        .run();

      return { success: true, message: 'Template updated' };
    } catch (err) {
      console.error('Failed to update template:', err);
      return fail(500, { error: 'Failed to update template' });
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

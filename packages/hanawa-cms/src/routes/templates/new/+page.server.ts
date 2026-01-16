/**
 * New Template Page Server
 * InfoSec: Input validation with parameterized queries (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

interface Fragment {
  id: string;
  name: string;
  slug: string;
  category: string;
}

export const load: PageServerLoad = async ({ platform }) => {
  if (!platform?.env?.DB) {
    return { availableFragments: [] };
  }

  const db = platform.env.DB;

  try {
    // Load available fragments from all relevant categories
    const fragmentsResult = await db
      .prepare(
        `SELECT id, name, slug, category
         FROM fragments
         WHERE category IN ('proposals', 'capabilities', 'services', 'terms', 'closing', 'company')
         ORDER BY category, name`
      )
      .all<Fragment>();

    return {
      availableFragments: fragmentsResult.results ?? [],
    };
  } catch (error) {
    console.error('Failed to load fragments:', error);
    return { availableFragments: [] };
  }
};

export const actions: Actions = {
  default: async ({ request, platform }) => {
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;
    const formData = await request.formData();

    // InfoSec: Extract and validate form fields (OWASP A03)
    const name = formData.get('name')?.toString().trim();
    const nameJa = formData.get('name_ja')?.toString().trim() || null;
    const description = formData.get('description')?.toString().trim() || null;
    const descriptionJa = formData.get('description_ja')?.toString().trim() || null;
    const documentType = formData.get('document_type')?.toString() || 'proposal';
    const isDefault = formData.get('is_default') === 'true';
    const fragmentsJson = formData.get('fragments')?.toString() || '[]';

    // Validation
    if (!name) {
      return fail(400, { error: 'Template name is required', name });
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

    // Generate unique ID
    const id = `tpl_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

    try {
      // If this is marked as default, unset other defaults for this type
      if (isDefault) {
        await db
          .prepare(
            'UPDATE templates SET is_default = FALSE WHERE document_type = ? AND is_default = TRUE'
          )
          .bind(documentType)
          .run();
      }

      // InfoSec: Parameterized insert (OWASP A03)
      await db
        .prepare(
          `INSERT INTO templates (
            id, name, name_ja, description, description_ja,
            document_type, default_fragments, is_default, is_active
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, TRUE)`
        )
        .bind(id, name, nameJa, description, descriptionJa, documentType, fragmentsJson, isDefault)
        .run();

      // Redirect to the template editor
      redirect(303, `/templates/${id}`);
    } catch (error) {
      // Re-throw redirects
      if (error instanceof Response || (error as { status?: number })?.status === 303) {
        throw error;
      }

      console.error('Failed to create template:', error);
      return fail(500, {
        error: 'Failed to create template',
        name,
      });
    }
  },
};

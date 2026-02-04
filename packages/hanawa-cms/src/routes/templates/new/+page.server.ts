/**
 * New Template Page Server
 * InfoSec: Input validation with parameterized queries (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { createTemplateSchema } from '$lib/schemas';

interface Fragment {
  id: string;
  name: string;
  slug: string;
  category: string;
}

export const load: PageServerLoad = async ({ platform }) => {
  const form = await superValidate(zod4(createTemplateSchema));

  if (!platform?.env?.DB) {
    return { form, availableFragments: [] };
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
      form,
      availableFragments: fragmentsResult.results ?? [],
    };
  } catch (error) {
    console.error('Failed to load fragments:', error);
    return { form, availableFragments: [] };
  }
};

export const actions: Actions = {
  default: async ({ request, platform }) => {
    if (!platform?.env?.DB) {
      const form = await superValidate(request, zod4(createTemplateSchema));
      form.message = 'Database not available';
      return fail(500, { form });
    }

    const db = platform.env.DB;

    // InfoSec: Validate form input (OWASP A03)
    const form = await superValidate(request, zod4(createTemplateSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const { name, name_ja, description, description_ja, document_type, is_default, fragments } =
      form.data;

    // InfoSec: Validate fragments JSON structure
    try {
      const fragmentArray = JSON.parse(fragments || '[]');
      if (!Array.isArray(fragmentArray)) {
        form.message = 'Invalid fragments format';
        return fail(400, { form });
      }
    } catch {
      form.message = 'Invalid fragments JSON';
      return fail(400, { form });
    }

    // Generate unique ID
    const id = `tpl_${Date.now().toString(36)}_${crypto.randomUUID().slice(0, 8)}`;

    try {
      // If this is marked as default, unset other defaults for this type
      if (is_default) {
        await db
          .prepare(
            'UPDATE templates SET is_default = FALSE WHERE document_type = ? AND is_default = TRUE'
          )
          .bind(document_type)
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
        .bind(
          id,
          name,
          name_ja || null,
          description || null,
          description_ja || null,
          document_type,
          fragments || '[]',
          is_default
        )
        .run();

      // Redirect to the template editor
      redirect(303, `/templates/${id}`);
    } catch (err) {
      // Re-throw redirects
      if (err instanceof Response) throw err;

      console.error('Failed to create template:', err);
      form.message = 'Failed to create template';
      return fail(500, { form });
    }
  },
};

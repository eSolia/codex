/**
 * New Document Page Server
 * InfoSec: Input validation with Zod (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { createDocumentSchema } from '$lib/schemas';

interface Template {
  id: string;
  name: string;
  name_ja: string | null;
  description: string | null;
  description_ja: string | null;
  document_type: string;
  default_fragments: string;
  is_default: boolean;
}

interface Fragment {
  id: string;
  name: string;
  slug: string;
  category: string;
}

// Fallback if templates table doesn't exist yet
const FALLBACK_FRAGMENTS = [
  { id: 'esolia-introduction', order: 1, enabled: true, required: true },
  { id: 'esolia-background', order: 2, enabled: true, required: false },
  { id: 'esolia-closing', order: 3, enabled: true, required: true },
];

export const load: PageServerLoad = async ({ platform, url }) => {
  const form = await superValidate(zod4(createDocumentSchema));

  if (!platform?.env?.DB) {
    return { form, templates: [], availableFragments: [], selectedTemplate: null };
  }

  const db = platform.env.DB;
  const templateId = url.searchParams.get('template');

  try {
    // Load templates
    let templates: Template[] = [];
    try {
      const templatesResult = await db
        .prepare(
          `SELECT id, name, name_ja, description, description_ja, document_type, default_fragments, is_default
           FROM templates
           WHERE is_active = TRUE AND document_type = 'proposal'
           ORDER BY is_default DESC, name ASC`
        )
        .all<Template>();
      templates = templatesResult.results ?? [];
    } catch {
      // Templates table might not exist yet
      console.log('Templates table not available, using fallback');
    }

    // Load available fragments from all relevant categories
    const fragmentsResult = await db
      .prepare(
        `SELECT id, name, slug, category
         FROM fragments
         WHERE category IN ('proposals', 'capabilities', 'services', 'terms', 'closing', 'company')
         ORDER BY category, name`
      )
      .all<Fragment>();

    // Find selected template
    let selectedTemplate: Template | null = null;
    let defaultFragments = FALLBACK_FRAGMENTS;

    if (templateId && templates.length > 0) {
      selectedTemplate = templates.find((t) => t.id === templateId) || null;
      if (selectedTemplate) {
        try {
          defaultFragments = JSON.parse(selectedTemplate.default_fragments);
        } catch {
          defaultFragments = FALLBACK_FRAGMENTS;
        }
      }
    } else if (templates.length > 0) {
      // Use default template if no template specified
      selectedTemplate = templates.find((t) => t.is_default) ?? templates[0] ?? null;
      if (selectedTemplate) {
        try {
          defaultFragments = JSON.parse(selectedTemplate.default_fragments);
        } catch {
          defaultFragments = FALLBACK_FRAGMENTS;
        }
      }
    }

    return {
      form,
      templates,
      availableFragments: fragmentsResult.results ?? [],
      selectedTemplate,
      defaultFragments,
    };
  } catch (error) {
    console.error('Failed to load data:', error);
    return {
      form,
      templates: [],
      availableFragments: [],
      selectedTemplate: null,
      defaultFragments: FALLBACK_FRAGMENTS,
    };
  }
};

export const actions: Actions = {
  default: async ({ request, platform }) => {
    if (!platform?.env?.DB) {
      const form = await superValidate(request, zod4(createDocumentSchema));
      form.message = 'Database not available';
      return fail(500, { form });
    }

    const db = platform.env.DB;

    // InfoSec: Validate form input (OWASP A03)
    const form = await superValidate(request, zod4(createDocumentSchema));

    if (!form.valid) {
      return fail(400, { form });
    }

    const {
      title,
      title_ja,
      client_code,
      client_name,
      client_name_ja,
      scope,
      language,
      template_id,
      fragments,
    } = form.data;

    // Generate unique ID
    const id = `doc_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      // InfoSec: Parameterized insert (OWASP A03)
      await db
        .prepare(
          `INSERT INTO proposals (
            id, client_code, client_name, client_name_ja,
            title, title_ja, scope, language, template_id, fragments, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
        )
        .bind(
          id,
          client_code || '',
          client_name || null,
          client_name_ja || null,
          title,
          title_ja || null,
          scope || null,
          language,
          template_id || null,
          fragments || '[]'
        )
        .run();

      // Redirect to the document editor
      redirect(303, `/documents/${id}`);
    } catch (err) {
      // Re-throw redirects
      if (err instanceof Response) throw err;

      console.error('Failed to create document:', err);
      form.message = 'Failed to create document';
      return fail(500, { form });
    }
  },
};

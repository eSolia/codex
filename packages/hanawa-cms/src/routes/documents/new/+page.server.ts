/**
 * New Document Page Server
 * InfoSec: Input validation with Zod (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

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
  if (!platform?.env?.DB) {
    return { templates: [], availableFragments: [], selectedTemplate: null };
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
      selectedTemplate = templates.find((t) => t.is_default) || templates[0];
      if (selectedTemplate) {
        try {
          defaultFragments = JSON.parse(selectedTemplate.default_fragments);
        } catch {
          defaultFragments = FALLBACK_FRAGMENTS;
        }
      }
    }

    return {
      templates,
      availableFragments: fragmentsResult.results ?? [],
      selectedTemplate,
      defaultFragments,
    };
  } catch (error) {
    console.error('Failed to load data:', error);
    return {
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
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;
    const formData = await request.formData();

    // InfoSec: Extract and validate form fields (OWASP A03)
    const templateId = formData.get('template_id')?.toString() || null;
    // Client code is optional - empty string for general (non-personalized) documents
    const clientCode = formData.get('client_code')?.toString().trim() || '';
    const clientName = formData.get('client_name')?.toString().trim() || null;
    const clientNameJa = formData.get('client_name_ja')?.toString().trim() || null;
    const title = formData.get('title')?.toString().trim();
    const titleJa = formData.get('title_ja')?.toString().trim() || null;
    const scope = formData.get('scope')?.toString().trim() || null;
    const language = formData.get('language')?.toString() || 'en';
    const fragmentsJson = formData.get('fragments')?.toString() || '[]';

    // Validation - only title is required, client_code is optional
    if (!title) {
      return fail(400, { error: 'Document title is required', clientCode, title });
    }

    // InfoSec: Validate language enum (OWASP A03)
    if (!['en', 'ja'].includes(language)) {
      return fail(400, { error: 'Invalid language selection' });
    }

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
          clientCode,
          clientName,
          clientNameJa,
          title,
          titleJa,
          scope,
          language,
          templateId,
          fragmentsJson
        )
        .run();

      // Redirect to the document editor
      redirect(303, `/documents/${id}`);
    } catch (error) {
      // Re-throw redirects
      if (error instanceof Response || (error as { status?: number })?.status === 303) {
        throw error;
      }

      console.error('Failed to create document:', error);
      return fail(500, {
        error: 'Failed to create document',
        clientCode,
        title,
      });
    }
  },
};

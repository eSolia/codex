/**
 * New Document Page Server
 * InfoSec: Input validation with Zod (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { fail, redirect } from '@sveltejs/kit';

// Default fragments in presentation order
const DEFAULT_FRAGMENTS = [
  { id: 'esolia-introduction', order: 1, enabled: true },
  { id: 'esolia-profile', order: 2, enabled: true },
  { id: 'esolia-background', order: 3, enabled: true },
  { id: 'esolia-project-types', order: 4, enabled: true },
  { id: 'esolia-support-types', order: 5, enabled: true },
  { id: 'esolia-service-mechanics', order: 6, enabled: true },
  { id: 'esolia-agreement-characteristics', order: 7, enabled: true },
  { id: 'esolia-closing', order: 8, enabled: true },
];

export const load: PageServerLoad = async ({ platform }) => {
  if (!platform?.env?.DB) {
    return { fragments: [] };
  }

  const db = platform.env.DB;

  try {
    // InfoSec: Parameterized query (OWASP A03)
    const result = await db
      .prepare(
        `SELECT id, name, slug, category
         FROM fragments
         WHERE category = 'proposals'
         ORDER BY name`
      )
      .all();

    return {
      availableFragments: result.results ?? [],
      defaultFragments: DEFAULT_FRAGMENTS,
    };
  } catch (error) {
    console.error('Failed to load fragments:', error);
    return {
      availableFragments: [],
      defaultFragments: DEFAULT_FRAGMENTS,
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
    const clientCode = formData.get('client_code')?.toString().trim();
    const clientName = formData.get('client_name')?.toString().trim() || null;
    const clientNameJa = formData.get('client_name_ja')?.toString().trim() || null;
    const title = formData.get('title')?.toString().trim();
    const titleJa = formData.get('title_ja')?.toString().trim() || null;
    const scope = formData.get('scope')?.toString().trim() || null;
    const language = formData.get('language')?.toString() || 'en';
    const fragmentsJson = formData.get('fragments')?.toString() || '[]';

    // Validation
    if (!clientCode) {
      return fail(400, { error: 'Client code is required', clientCode, title });
    }

    if (!title) {
      return fail(400, { error: 'Document title is required', clientCode, title });
    }

    // InfoSec: Validate language enum (OWASP A03)
    if (!['en', 'ja'].includes(language)) {
      return fail(400, { error: 'Invalid language selection' });
    }

    // Generate unique ID
    const id = `prop_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    try {
      // InfoSec: Parameterized insert (OWASP A03)
      await db
        .prepare(
          `INSERT INTO proposals (
            id, client_code, client_name, client_name_ja,
            title, title_ja, scope, language, fragments, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
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
          fragmentsJson
        )
        .run();

      // Redirect to the document editor
      throw redirect(303, `/documents/${id}`);
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

/**
 * Templates List Page Server
 * InfoSec: Parameterized queries (OWASP A03)
 */

import type { PageServerLoad } from './$types';

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

export const load: PageServerLoad = async ({ platform, url }) => {
  if (!platform?.env?.DB) {
    return { templates: [] };
  }

  const db = platform.env.DB;
  const typeFilter = url.searchParams.get('type') || '';

  try {
    let query = 'SELECT * FROM templates WHERE is_active = TRUE';
    const params: string[] = [];

    if (typeFilter) {
      query += ' AND document_type = ?';
      params.push(typeFilter);
    }

    query += ' ORDER BY is_default DESC, name ASC';

    const result = await db
      .prepare(query)
      .bind(...params)
      .all<Template>();

    return {
      templates: result.results ?? [],
      typeFilter,
    };
  } catch (error) {
    console.error('Failed to load templates:', error);
    return { templates: [], typeFilter };
  }
};

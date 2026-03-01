/**
 * Fragment List API
 * Returns fragments from fragment_index for the fragment picker.
 *
 * GET /api/fragments
 *   - Returns list of production fragments with id, title, category
 *   - Optional ?category= filter
 *   - Optional ?search= filter
 *
 * InfoSec: No sensitive data exposed (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface FragmentSummary {
  id: string;
  title_en: string | null;
  title_ja: string | null;
  category: string;
  has_en: number;
  has_ja: number;
  tags: string | null;
}

export const GET: RequestHandler = async ({ url, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');

  try {
    let query = `SELECT id, title_en, title_ja, category, has_en, has_ja, tags
                 FROM fragment_index WHERE status = ?`;
    const params: string[] = ['production'];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (id LIKE ? OR title_en LIKE ? OR title_ja LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }

    query += ' ORDER BY category, title_en';

    // InfoSec: Parameterized query (OWASP A03)
    const result = await db
      .prepare(query)
      .bind(...params)
      .all<FragmentSummary>();

    // Group by category for UX
    const grouped = (result.results ?? []).reduce(
      (acc, frag) => {
        const cat = frag.category || 'uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(frag);
        return acc;
      },
      {} as Record<string, FragmentSummary[]>
    );

    return json({
      fragments: result.results ?? [],
      grouped,
      total: result.results?.length ?? 0,
    });
  } catch (err) {
    console.error('[FragmentList] Error:', err);
    throw error(500, 'Failed to fetch fragments');
  }
};

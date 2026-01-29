/**
 * Fragment List API
 * Returns fragments for the fragment picker
 *
 * GET /api/fragments
 *   - Returns list of all fragments with id, name, category
 *   - Optional ?category= filter
 *   - Optional ?search= filter
 *
 * InfoSec: No sensitive data exposed (OWASP A01)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface FragmentSummary {
  id: string;
  name: string;
  category: string;
  is_bilingual: number;
}

export const GET: RequestHandler = async ({ url, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;
  const category = url.searchParams.get('category');
  const search = url.searchParams.get('search');

  try {
    let query = 'SELECT id, name, category, is_bilingual FROM fragments WHERE status = ?';
    const params: string[] = ['active'];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }

    if (search) {
      query += ' AND (id LIKE ? OR name LIKE ?)';
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern);
    }

    query += ' ORDER BY category, name';

    // InfoSec: Parameterized query (OWASP A03)
    const result = await db
      .prepare(query)
      .bind(...params)
      .all<FragmentSummary>();

    // Group by category for better UX
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

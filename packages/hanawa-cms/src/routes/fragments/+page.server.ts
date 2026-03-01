/**
 * Fragments List Page Server Load
 * Queries fragment_index (markdown-first, R2-backed fragments).
 * InfoSec: Parameterized queries prevent SQL injection (OWASP A03)
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url }) => {
  if (!platform?.env?.DB) {
    return { fragments: [], categories: [], tags: [] };
  }

  const db = platform.env.DB;

  // InfoSec: Validate filter parameters
  const categoryFilter = url.searchParams.get('category');
  const tagFilter = url.searchParams.get('tag');
  const searchQuery = url.searchParams.get('q');

  try {
    let query = `
      SELECT id, category, title_en, title_ja, type, version, status,
             tags, has_en, has_ja, sensitivity, author, updated_at
      FROM fragment_index
      WHERE 1=1
    `;
    const params: string[] = [];

    if (categoryFilter) {
      query += ' AND category = ?';
      params.push(categoryFilter);
    }
    if (tagFilter) {
      // Tags stored as JSON array, search within
      query += ' AND tags LIKE ?';
      params.push(`%"${tagFilter}"%`);
    }
    if (searchQuery) {
      query += ' AND (title_en LIKE ? OR title_ja LIKE ? OR id LIKE ? OR tags LIKE ?)';
      params.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
    }

    query += ' ORDER BY category, title_en ASC LIMIT 200';

    const fragmentsResult = await db
      .prepare(query)
      .bind(...params)
      .all();

    // Get unique categories
    const categoriesResult = await db
      .prepare('SELECT DISTINCT category FROM fragment_index ORDER BY category')
      .all();

    // Get unique tags — extract from JSON arrays
    const tagsResult = await db
      .prepare("SELECT DISTINCT tags FROM fragment_index WHERE tags IS NOT NULL AND tags != '[]'")
      .all();

    // Parse and dedupe tags
    const allTags = new Set<string>();
    for (const row of (tagsResult.results ?? []) as { tags: string }[]) {
      try {
        const parsed = JSON.parse(row.tags);
        if (Array.isArray(parsed)) {
          parsed.forEach((t: string) => allTags.add(t));
        }
        // eslint-disable-next-line esolia/no-silent-catch -- Invalid JSON in tags is non-fatal
      } catch {
        // Skip invalid JSON
      }
    }

    const sortedTags = Array.from(allTags).sort((a, b) => a.localeCompare(b));

    return {
      fragments: fragmentsResult.results ?? [],
      categories: ((categoriesResult.results ?? []) as { category: string }[]).map(
        (r) => r.category
      ),
      tags: sortedTags,
      currentCategory: categoryFilter,
      currentTag: tagFilter,
      currentSearch: searchQuery,
    };
  } catch (error) {
    console.error('Fragments load error:', error);
    return { fragments: [], categories: [], tags: [] };
  }
};

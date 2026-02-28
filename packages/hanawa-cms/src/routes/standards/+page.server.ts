/**
 * Standards List Page Server Load
 * Queries standards_index (monolingual coding/workflow standards).
 * InfoSec: Parameterized queries prevent SQL injection (OWASP A03)
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url }) => {
  if (!platform?.env?.DB) {
    return { standards: [], categories: [], tags: [] };
  }

  const db = platform.env.DB;

  // InfoSec: Validate filter parameters
  const categoryFilter = url.searchParams.get('category');
  const tagFilter = url.searchParams.get('tag');
  const searchQuery = url.searchParams.get('q');

  try {
    let query = `
      SELECT slug, title, category, tags, summary, status, author, updated_at
      FROM standards_index
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
      query += ' AND (title LIKE ? OR slug LIKE ? OR summary LIKE ? OR tags LIKE ?)';
      params.push(`%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`, `%${searchQuery}%`);
    }

    query += ' ORDER BY category, title ASC LIMIT 200';

    const standardsResult = await db
      .prepare(query)
      .bind(...params)
      .all();

    // Get unique categories
    const categoriesResult = await db
      .prepare('SELECT DISTINCT category FROM standards_index ORDER BY category')
      .all();

    // Get unique tags — extract from JSON arrays
    const tagsResult = await db
      .prepare("SELECT DISTINCT tags FROM standards_index WHERE tags IS NOT NULL AND tags != '[]'")
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
      standards: standardsResult.results ?? [],
      categories: ((categoriesResult.results ?? []) as { category: string }[]).map(
        (r) => r.category
      ),
      tags: sortedTags,
      currentCategory: categoryFilter,
      currentTag: tagFilter,
      currentSearch: searchQuery,
    };
  } catch (err) {
    console.error('Standards load error:', err);
    return { standards: [], categories: [], tags: [] };
  }
};

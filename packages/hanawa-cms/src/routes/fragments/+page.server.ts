/**
 * Fragments List Page Server Load
 * InfoSec: Parameterized queries prevent SQL injection (OWASP A03)
 */

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ platform, url }) => {
  if (!platform?.env?.DB) {
    return { fragments: [], categories: [] };
  }

  const db = platform.env.DB;

  // InfoSec: Validate filter parameters
  const categoryFilter = url.searchParams.get("category");
  const searchQuery = url.searchParams.get("q");

  try {
    let query = `
      SELECT id, name, slug, category, description, is_bilingual, created_at, updated_at
      FROM fragments
      WHERE 1=1
    `;
    const params: string[] = [];

    if (categoryFilter) {
      query += " AND category = ?";
      params.push(categoryFilter);
    }
    if (searchQuery) {
      query += " AND (name LIKE ? OR description LIKE ?)";
      params.push(`%${searchQuery}%`, `%${searchQuery}%`);
    }

    query += " ORDER BY category, name ASC LIMIT 100";

    const fragmentsResult = await db.prepare(query).bind(...params).all();

    // Get unique categories
    const categoriesResult = await db
      .prepare("SELECT DISTINCT category FROM fragments ORDER BY category")
      .all();

    return {
      fragments: fragmentsResult.results ?? [],
      categories: (categoriesResult.results ?? []).map(
        (r: { category: string }) => r.category
      ),
    };
  } catch (error) {
    console.error("Fragments load error:", error);
    return { fragments: [], categories: [] };
  }
};

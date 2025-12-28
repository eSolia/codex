/**
 * Content List Page Server Load
 * InfoSec: Parameterized queries prevent SQL injection (OWASP A03)
 */

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ platform, url }) => {
  if (!platform?.env?.DB) {
    return { content: [], sites: [], contentTypes: [] };
  }

  const db = platform.env.DB;

  // InfoSec: Validate filter parameters (OWASP A03)
  const siteFilter = url.searchParams.get("site");
  const statusFilter = url.searchParams.get("status");
  const typeFilter = url.searchParams.get("type");

  try {
    // Build query with filters
    let query = `
      SELECT
        c.id, c.title, c.slug, c.status, c.language, c.created_at, c.updated_at,
        s.name as site_name, s.slug as site_slug,
        ct.name as content_type_name
      FROM content c
      LEFT JOIN sites s ON c.site_id = s.id
      LEFT JOIN content_types ct ON c.content_type_id = ct.id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (siteFilter) {
      query += " AND s.slug = ?";
      params.push(siteFilter);
    }
    if (statusFilter) {
      query += " AND c.status = ?";
      params.push(statusFilter);
    }
    if (typeFilter) {
      query += " AND ct.slug = ?";
      params.push(typeFilter);
    }

    query += " ORDER BY c.updated_at DESC LIMIT 50";

    const contentResult = await db.prepare(query).bind(...params).all();

    // Get sites and content types for filters
    const [sitesResult, typesResult] = await Promise.all([
      db.prepare("SELECT id, name, slug FROM sites ORDER BY name").all(),
      db
        .prepare("SELECT id, name, slug FROM content_types ORDER BY name")
        .all(),
    ]);

    return {
      content: contentResult.results ?? [],
      sites: sitesResult.results ?? [],
      contentTypes: typesResult.results ?? [],
    };
  } catch (error) {
    console.error("Content load error:", error);
    return { content: [], sites: [], contentTypes: [] };
  }
};

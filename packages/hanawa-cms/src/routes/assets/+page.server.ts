/**
 * Assets List Page Server Load
 * InfoSec: Parameterized queries prevent SQL injection (OWASP A03)
 */

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ platform, url }) => {
  if (!platform?.env?.DB) {
    return { assets: [], sites: [] };
  }

  const db = platform.env.DB;

  // InfoSec: Validate filter parameters
  const siteFilter = url.searchParams.get("site");
  const typeFilter = url.searchParams.get("type");

  try {
    let query = `
      SELECT
        a.id, a.filename, a.mime_type, a.size, a.alt_text, a.created_at,
        s.name as site_name
      FROM assets a
      LEFT JOIN sites s ON a.site_id = s.id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (siteFilter) {
      query += " AND s.slug = ?";
      params.push(siteFilter);
    }
    if (typeFilter) {
      query += " AND a.mime_type LIKE ?";
      params.push(`${typeFilter}/%`);
    }

    query += " ORDER BY a.created_at DESC LIMIT 100";

    const assetsResult = await db.prepare(query).bind(...params).all();

    const sitesResult = await db
      .prepare("SELECT id, name, slug FROM sites ORDER BY name")
      .all();

    return {
      assets: assetsResult.results ?? [],
      sites: sitesResult.results ?? [],
    };
  } catch (error) {
    console.error("Assets load error:", error);
    return { assets: [], sites: [] };
  }
};

/**
 * Site Detail Page Server Load
 * InfoSec: Parameterized queries prevent SQL injection (OWASP A03)
 */

import type { PageServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;
  const { id } = params;

  try {
    // InfoSec: Parameterized query prevents SQL injection
    const siteResult = await db
      .prepare(
        `SELECT id, name, slug, domain, description, default_language, languages, created_at, updated_at
         FROM sites
         WHERE id = ?`
      )
      .bind(id)
      .first();

    if (!siteResult) {
      throw error(404, 'Site not found');
    }

    // Get content types for this site
    const contentTypesResult = await db
      .prepare(
        `SELECT id, name, slug, description
         FROM content_types
         WHERE site_id = ?
         ORDER BY name ASC`
      )
      .bind(id)
      .all();

    // Get recent content for this site
    const contentResult = await db
      .prepare(
        `SELECT c.id, c.title, c.slug, c.status, c.updated_at, ct.name as content_type_name
         FROM content c
         LEFT JOIN content_types ct ON c.content_type_id = ct.id
         WHERE c.site_id = ?
         ORDER BY c.updated_at DESC
         LIMIT 10`
      )
      .bind(id)
      .all();

    return {
      site: siteResult,
      contentTypes: contentTypesResult.results ?? [],
      recentContent: contentResult.results ?? [],
    };
  } catch (err) {
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }
    console.error('Site load error:', err);
    throw error(500, 'Failed to load site');
  }
};

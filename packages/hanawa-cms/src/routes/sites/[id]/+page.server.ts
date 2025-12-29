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
        `SELECT id, name, slug, domain, description, status, created_at, updated_at
         FROM sites
         WHERE id = ?`
      )
      .bind(id)
      .first();

    if (!siteResult) {
      throw error(404, 'Site not found');
    }

    // Get collections for this site
    const collectionsResult = await db
      .prepare(
        `SELECT id, name, slug, description
         FROM collections
         WHERE site_id = ?
         ORDER BY name ASC`
      )
      .bind(id)
      .all();

    // Get recent content for this site
    const contentResult = await db
      .prepare(
        `SELECT d.id, d.title, d.slug, d.status, d.updated_at, c.name as collection_name
         FROM documents d
         LEFT JOIN collections c ON d.collection_id = c.id
         WHERE c.site_id = ?
         ORDER BY d.updated_at DESC
         LIMIT 10`
      )
      .bind(id)
      .all();

    return {
      site: siteResult,
      collections: collectionsResult.results ?? [],
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

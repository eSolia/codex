/**
 * Proposals List Page Server Load
 * InfoSec: Parameterized queries prevent SQL injection (OWASP A03)
 */

import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ platform, url }) => {
  if (!platform?.env?.DB) {
    return { proposals: [] };
  }

  const db = platform.env.DB;

  // InfoSec: Validate filter parameters (OWASP A03)
  const statusFilter = url.searchParams.get('status');

  try {
    let query = `
      SELECT
        id, client_code, client_name, title, scope, language, status,
        share_id, shared_at, created_at, updated_at
      FROM proposals
      WHERE 1=1
    `;
    const params: string[] = [];

    if (statusFilter) {
      query += ' AND status = ?';
      params.push(statusFilter);
    }

    query += ' ORDER BY updated_at DESC LIMIT 50';

    const result = await db
      .prepare(query)
      .bind(...params)
      .all();

    return {
      proposals: result.results ?? [],
    };
  } catch (error) {
    console.error('Proposals load error:', error);
    return { proposals: [] };
  }
};

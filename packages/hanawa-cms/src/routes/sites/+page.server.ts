/**
 * Sites List Page Server Load
 * InfoSec: Parameterized queries prevent SQL injection (OWASP A03)
 */

import type { PageServerLoad } from "./$types";

export const load: PageServerLoad = async ({ platform }) => {
  if (!platform?.env?.DB) {
    return { sites: [] };
  }

  const db = platform.env.DB;

  try {
    const result = await db
      .prepare(
        `SELECT id, name, slug, domain, description, status, created_at, updated_at
         FROM sites
         ORDER BY name ASC`
      )
      .all();

    return {
      sites: result.results ?? [],
    };
  } catch (error) {
    console.error("Sites load error:", error);
    return { sites: [] };
  }
};

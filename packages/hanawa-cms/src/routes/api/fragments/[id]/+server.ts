/**
 * Single Fragment API
 * Returns fragment metadata and content from R2.
 *
 * GET /api/fragments/[id]
 *   - Returns { metadata, content_en, content_ja }
 *   - Used by FragmentPicker for preview, and external tools
 *
 * InfoSec: No sensitive data exposed; parameterized queries (OWASP A01, A03)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseFrontmatter } from '$lib/server/frontmatter';

interface FragmentIndexRow {
  id: string;
  category: string | null;
  title_en: string | null;
  title_ja: string | null;
  type: string | null;
  version: string | null;
  status: string;
  tags: string;
  has_en: number;
  has_ja: number;
  r2_key_en: string | null;
  r2_key_ja: string | null;
  sensitivity: string;
  author: string | null;
  updated_at: string | null;
}

export const GET: RequestHandler = async ({ params, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;
  const r2 = platform.env.R2;

  try {
    const meta = await db
      .prepare('SELECT * FROM fragment_index WHERE id = ?')
      .bind(params.id)
      .first<FragmentIndexRow>();

    if (!meta) {
      throw error(404, 'Fragment not found');
    }

    let contentEn = '';
    let contentJa = '';

    // Load content from R2
    if (r2) {
      if (meta.r2_key_en) {
        try {
          const obj = await r2.get(meta.r2_key_en);
          if (obj) {
            const { body } = parseFrontmatter(await obj.text());
            contentEn = body;
          }
          // eslint-disable-next-line esolia/no-silent-catch -- Non-fatal R2 read
        } catch {
          /* skip */
        }
      }
      if (meta.r2_key_ja) {
        try {
          const obj = await r2.get(meta.r2_key_ja);
          if (obj) {
            const { body } = parseFrontmatter(await obj.text());
            contentJa = body;
          }
          // eslint-disable-next-line esolia/no-silent-catch -- Non-fatal R2 read
        } catch {
          /* skip */
        }
      }
    }

    // Parse tags
    let tags: string[] = [];
    try {
      tags = JSON.parse(meta.tags || '[]');
      // eslint-disable-next-line esolia/no-silent-catch -- Invalid JSON fallback
    } catch {
      /* skip */
    }

    return json({
      metadata: {
        id: meta.id,
        category: meta.category,
        title_en: meta.title_en,
        title_ja: meta.title_ja,
        type: meta.type,
        version: meta.version,
        status: meta.status,
        tags,
        has_en: meta.has_en,
        has_ja: meta.has_ja,
        sensitivity: meta.sensitivity,
        author: meta.author,
        updated_at: meta.updated_at,
      },
      content_en: contentEn,
      content_ja: contentJa,
    });
  } catch (err) {
    if ((err as { status?: number }).status === 404) throw err;
    console.error('[Fragment API] Error:', err);
    throw error(500, 'Failed to fetch fragment');
  }
};

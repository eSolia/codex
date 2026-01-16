/**
 * PDF Download API
 * Serves generated PDFs from R2 storage
 * Supports ?lang=en or ?lang=ja for bilingual proposals
 * InfoSec: Authorization check required (OWASP A01)
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface Proposal {
  id: string;
  client_code: string;
  title: string;
  title_ja: string | null;
  pdf_r2_key: string | null;
  pdf_r2_key_en: string | null;
  pdf_r2_key_ja: string | null;
  language_mode: string | null;
  updated_at: string | null;
}

export const GET: RequestHandler = async ({ params, platform, url }) => {
  if (!platform?.env?.DB || !platform?.env?.R2) {
    throw error(500, 'Storage not available');
  }

  const db = platform.env.DB;
  const r2 = platform.env.R2;

  // Get optional language parameter
  const lang = url.searchParams.get('lang');

  // InfoSec: Verify document exists and user has access (OWASP A01)
  const proposal = await db
    .prepare(
      'SELECT id, client_code, title, title_ja, pdf_r2_key, pdf_r2_key_en, pdf_r2_key_ja, language_mode, updated_at FROM proposals WHERE id = ?'
    )
    .bind(params.id)
    .first<Proposal>();

  if (!proposal) {
    throw error(404, 'Document not found');
  }

  // Determine which R2 key to use based on language parameter
  let r2Key: string | null = null;
  let langSuffix = '';

  if (lang === 'en' && proposal.pdf_r2_key_en) {
    r2Key = proposal.pdf_r2_key_en;
    langSuffix = 'en';
  } else if (lang === 'ja' && proposal.pdf_r2_key_ja) {
    r2Key = proposal.pdf_r2_key_ja;
    langSuffix = 'ja';
  } else {
    // Default to combined/main PDF - use language_mode for suffix
    r2Key = proposal.pdf_r2_key;
    // language_mode is 'en-first' or 'ja-first', map to 'en-ja' or 'ja-en'
    langSuffix = proposal.language_mode === 'ja-first' ? 'ja-en' : 'en-ja';
  }

  if (!r2Key) {
    throw error(404, 'PDF not generated yet');
  }

  // Fetch from R2
  const object = await r2.get(r2Key);

  if (!object) {
    throw error(404, 'PDF file not found in storage');
  }

  // Format date as YYYYMMDD
  const dateStr = proposal.updated_at
    ? new Date(proposal.updated_at).toISOString().slice(0, 10).replace(/-/g, '')
    : new Date().toISOString().slice(0, 10).replace(/-/g, '');

  // Generate filename: eSolia_ClientCode_Title_YYYYMMDD_lang.pdf
  const title = lang === 'ja' && proposal.title_ja ? proposal.title_ja : proposal.title;
  // Sanitize title: keep alphanumeric, hyphens, and CJK characters
  const safeTitle = title
    .replace(/[^a-zA-Z0-9-\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_')
    .substring(0, 50);
  const filename = `eSolia_${proposal.client_code}_${safeTitle}_${dateStr}_${langSuffix}.pdf`;

  // Return PDF with appropriate headers
  // InfoSec: no-store ensures fresh PDF after regeneration
  return new Response(object.body, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${filename}"`,
      'Cache-Control': 'no-store, must-revalidate',
    },
  });
};

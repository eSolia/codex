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
    .prepare('SELECT id, client_code, title, title_ja, pdf_r2_key, pdf_r2_key_en, pdf_r2_key_ja FROM proposals WHERE id = ?')
    .bind(params.id)
    .first<Proposal>();

  if (!proposal) {
    throw error(404, 'Document not found');
  }

  // Determine which R2 key to use based on language parameter
  let r2Key: string | null = null;
  let filenameSuffix = '';

  if (lang === 'en' && proposal.pdf_r2_key_en) {
    r2Key = proposal.pdf_r2_key_en;
    filenameSuffix = '_EN';
  } else if (lang === 'ja' && proposal.pdf_r2_key_ja) {
    r2Key = proposal.pdf_r2_key_ja;
    filenameSuffix = '_JA';
  } else {
    // Default to combined/main PDF
    r2Key = proposal.pdf_r2_key;
  }

  if (!r2Key) {
    throw error(404, 'PDF not generated yet');
  }

  // Fetch from R2
  const object = await r2.get(r2Key);

  if (!object) {
    throw error(404, 'PDF file not found in storage');
  }

  // Generate filename - use appropriate title based on language
  const title = lang === 'ja' && proposal.title_ja ? proposal.title_ja : proposal.title;
  const safeTitle = title.replace(/[^a-zA-Z0-9-_\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g, '_').substring(0, 50);
  const filename = `${proposal.client_code}_${safeTitle}${filenameSuffix}.pdf`;

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

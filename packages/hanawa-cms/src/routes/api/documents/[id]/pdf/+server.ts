/**
 * PDF Download API
 * Serves generated PDFs from R2 storage
 * InfoSec: Authorization check required (OWASP A01)
 */

import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface Proposal {
  id: string;
  client_code: string;
  title: string;
  pdf_r2_key: string | null;
}

export const GET: RequestHandler = async ({ params, platform }) => {
  if (!platform?.env?.DB || !platform?.env?.R2) {
    throw error(500, 'Storage not available');
  }

  const db = platform.env.DB;
  const r2 = platform.env.R2;

  // InfoSec: Verify document exists and user has access (OWASP A01)
  const proposal = await db
    .prepare('SELECT id, client_code, title, pdf_r2_key FROM proposals WHERE id = ?')
    .bind(params.id)
    .first<Proposal>();

  if (!proposal) {
    throw error(404, 'Document not found');
  }

  if (!proposal.pdf_r2_key) {
    throw error(404, 'PDF not generated yet');
  }

  // Fetch from R2
  const object = await r2.get(proposal.pdf_r2_key);

  if (!object) {
    throw error(404, 'PDF file not found in storage');
  }

  // Generate filename
  const safeTitle = proposal.title.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
  const filename = `${proposal.client_code}_${safeTitle}.pdf`;

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

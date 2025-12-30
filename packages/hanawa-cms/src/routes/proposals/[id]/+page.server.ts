/**
 * Proposal Detail/Edit Page Server
 * InfoSec: Input validation, parameterized queries (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';

interface Fragment {
  id: string;
  order: number;
  enabled: boolean;
}

interface Proposal {
  id: string;
  client_code: string;
  client_name: string | null;
  client_name_ja: string | null;
  title: string;
  title_ja: string | null;
  scope: string | null;
  language: string;
  template_id: string | null;
  fragments: string;
  custom_sections: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  pdf_generated_at: string | null;
  pdf_r2_key: string | null;
  share_id: string | null;
  share_url: string | null;
  share_pin: string | null;
  shared_at: string | null;
  shared_to_email: string | null;
  shared_to_name: string | null;
  share_expires_at: string | null;
  provenance: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

interface FragmentContent {
  id: string;
  name: string;
  slug: string;
  category: string;
  content_en: string | null;
  content_ja: string | null;
}

export const load: PageServerLoad = async ({ params, platform }) => {
  if (!platform?.env?.DB) {
    throw error(500, 'Database not available');
  }

  const db = platform.env.DB;
  const { id } = params;

  try {
    // InfoSec: Parameterized query (OWASP A03)
    const result = await db
      .prepare('SELECT * FROM proposals WHERE id = ?')
      .bind(id)
      .first<Proposal>();

    if (!result) {
      throw error(404, 'Proposal not found');
    }

    // Parse fragments JSON
    let fragments: Fragment[] = [];
    try {
      fragments = JSON.parse(result.fragments || '[]');
    } catch {
      fragments = [];
    }

    // Load fragment content for enabled fragments
    const enabledFragmentIds = fragments.filter((f) => f.enabled).map((f) => f.id);

    let fragmentContents: FragmentContent[] = [];
    if (enabledFragmentIds.length > 0) {
      // InfoSec: Build parameterized query for IN clause
      const placeholders = enabledFragmentIds.map(() => '?').join(',');
      const fragmentResult = await db
        .prepare(
          `SELECT id, name, slug, category, content_en, content_ja
           FROM fragments
           WHERE id IN (${placeholders})`
        )
        .bind(...enabledFragmentIds)
        .all<FragmentContent>();

      fragmentContents = fragmentResult.results ?? [];
    }

    return {
      proposal: result,
      fragments,
      fragmentContents,
    };
  } catch (err) {
    if ((err as { status?: number })?.status === 404) {
      throw err;
    }
    console.error('Failed to load proposal:', err);
    throw error(500, 'Failed to load proposal');
  }
};

export const actions: Actions = {
  // Update proposal details
  update: async ({ params, request, platform }) => {
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;
    const formData = await request.formData();

    const clientCode = formData.get('client_code')?.toString().trim();
    const clientName = formData.get('client_name')?.toString().trim() || null;
    const clientNameJa = formData.get('client_name_ja')?.toString().trim() || null;
    const title = formData.get('title')?.toString().trim();
    const titleJa = formData.get('title_ja')?.toString().trim() || null;
    const scope = formData.get('scope')?.toString().trim() || null;
    const language = formData.get('language')?.toString() || 'en';
    const fragmentsJson = formData.get('fragments')?.toString() || '[]';
    const customSections = formData.get('custom_sections')?.toString() || null;

    if (!clientCode || !title) {
      return fail(400, { error: 'Client code and title are required' });
    }

    try {
      // InfoSec: Parameterized update (OWASP A03)
      await db
        .prepare(
          `UPDATE proposals SET
            client_code = ?, client_name = ?, client_name_ja = ?,
            title = ?, title_ja = ?, scope = ?, language = ?,
            fragments = ?, custom_sections = ?,
            updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          clientCode,
          clientName,
          clientNameJa,
          title,
          titleJa,
          scope,
          language,
          fragmentsJson,
          customSections,
          params.id
        )
        .run();

      return { success: true, message: 'Proposal updated' };
    } catch (err) {
      console.error('Failed to update proposal:', err);
      return fail(500, { error: 'Failed to update proposal' });
    }
  },

  // Update workflow status
  updateStatus: async ({ params, request, platform }) => {
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;
    const formData = await request.formData();
    const status = formData.get('status')?.toString();
    const reviewNotes = formData.get('review_notes')?.toString() || null;

    // InfoSec: Validate status enum (OWASP A03)
    const validStatuses = ['draft', 'review', 'approved', 'shared', 'archived'];
    if (!status || !validStatuses.includes(status)) {
      return fail(400, { error: 'Invalid status' });
    }

    try {
      if (status === 'approved' || status === 'review') {
        await db
          .prepare(
            `UPDATE proposals SET
              status = ?, review_notes = ?,
              reviewed_at = datetime('now'),
              updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(status, reviewNotes, params.id)
          .run();
      } else {
        await db
          .prepare(
            `UPDATE proposals SET
              status = ?, updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(status, params.id)
          .run();
      }

      return { success: true, message: `Status updated to ${status}` };
    } catch (err) {
      console.error('Failed to update status:', err);
      return fail(500, { error: 'Failed to update status' });
    }
  },

  // Generate PDF
  generatePdf: async ({ params, platform, fetch }) => {
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;
    const pdfApiKey = platform.env.PDF_API_KEY;

    if (!pdfApiKey) {
      return fail(500, { error: 'PDF API key not configured' });
    }

    try {
      // Load proposal
      const proposal = await db
        .prepare('SELECT * FROM proposals WHERE id = ?')
        .bind(params.id)
        .first<Proposal>();

      if (!proposal) {
        return fail(404, { error: 'Proposal not found' });
      }

      // Parse fragments
      let fragments: Fragment[] = [];
      try {
        fragments = JSON.parse(proposal.fragments || '[]');
      } catch {
        fragments = [];
      }

      // Load fragment contents
      const enabledFragmentIds = fragments
        .filter((f) => f.enabled)
        .sort((a, b) => a.order - b.order)
        .map((f) => f.id);

      let fragmentContents: FragmentContent[] = [];
      if (enabledFragmentIds.length > 0) {
        const placeholders = enabledFragmentIds.map(() => '?').join(',');
        const result = await db
          .prepare(
            `SELECT id, name, slug, category, content_en, content_ja
             FROM fragments
             WHERE id IN (${placeholders})`
          )
          .bind(...enabledFragmentIds)
          .all<FragmentContent>();

        fragmentContents = result.results ?? [];
      }

      // Build content map for ordering
      const contentMap = new Map(fragmentContents.map((f) => [f.id, f]));
      const lang = proposal.language || 'en';

      // Assemble markdown content
      let markdown = `# ${lang === 'ja' && proposal.title_ja ? proposal.title_ja : proposal.title}\n\n`;

      if (proposal.scope) {
        markdown += `## Scope\n\n${proposal.scope}\n\n`;
      }

      // Add fragments in order
      for (const fragId of enabledFragmentIds) {
        const content = contentMap.get(fragId);
        if (content) {
          const fragContent =
            lang === 'ja' && content.content_ja ? content.content_ja : content.content_en;

          if (fragContent) {
            markdown += fragContent + '\n\n';
          }
        }
      }

      // Add custom sections
      if (proposal.custom_sections) {
        markdown += proposal.custom_sections + '\n\n';
      }

      // Build provenance metadata
      const provenance = {
        source: 'esolia-codex',
        document_id: proposal.id,
        version: '1.0',
        created: proposal.created_at,
        modified: new Date().toISOString(),
        author: 'eSolia Inc.',
        language: lang,
        license: 'Proprietary - eSolia Inc.',
        client_code: proposal.client_code,
        fragments_used: enabledFragmentIds,
      };

      // Call PDF Worker
      const pdfResponse = await fetch('https://pdf.esolia.co.jp/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pdfApiKey}`,
        },
        body: JSON.stringify({
          markdown,
          options: {
            title: proposal.title,
            author: 'eSolia Inc.',
            subject: `Proposal for ${proposal.client_name || proposal.client_code}`,
            provenance,
          },
        }),
      });

      if (!pdfResponse.ok) {
        const errorText = await pdfResponse.text();
        console.error('PDF generation failed:', errorText);
        return fail(500, { error: 'PDF generation failed' });
      }

      // Get the PDF data
      const pdfData = await pdfResponse.arrayBuffer();

      // Store in R2 if available
      let r2Key: string | null = null;
      if (platform.env.R2) {
        r2Key = `proposals/${proposal.client_code}/${proposal.id}.pdf`;
        await platform.env.R2.put(r2Key, pdfData, {
          httpMetadata: {
            contentType: 'application/pdf',
          },
          customMetadata: {
            proposalId: proposal.id,
            clientCode: proposal.client_code,
            generatedAt: new Date().toISOString(),
          },
        });
      }

      // Update proposal with PDF info
      await db
        .prepare(
          `UPDATE proposals SET
            pdf_generated_at = datetime('now'),
            pdf_r2_key = ?,
            provenance = ?,
            updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(r2Key, JSON.stringify(provenance), params.id)
        .run();

      return {
        success: true,
        message: 'PDF generated successfully',
        pdfKey: r2Key,
      };
    } catch (err) {
      console.error('PDF generation error:', err);
      return fail(500, { error: 'Failed to generate PDF' });
    }
  },

  // Share via Courier
  share: async ({ params, request, platform }) => {
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;
    const formData = await request.formData();

    const recipientEmail = formData.get('recipient_email')?.toString().trim();
    const recipientName = formData.get('recipient_name')?.toString().trim() || null;
    const expiresInDays = parseInt(formData.get('expires_in_days')?.toString() || '7', 10);

    if (!recipientEmail) {
      return fail(400, { error: 'Recipient email is required' });
    }

    // InfoSec: Basic email validation (OWASP A03)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(recipientEmail)) {
      return fail(400, { error: 'Invalid email address' });
    }

    try {
      // Load proposal
      const proposal = await db
        .prepare('SELECT * FROM proposals WHERE id = ?')
        .bind(params.id)
        .first<Proposal>();

      if (!proposal) {
        return fail(404, { error: 'Proposal not found' });
      }

      if (!proposal.pdf_r2_key) {
        return fail(400, { error: 'Generate PDF before sharing' });
      }

      // Generate share PIN (6 digits)
      const pin = Math.floor(100000 + Math.random() * 900000).toString();

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Generate share ID
      const shareId = `share_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Build share URL (Courier format)
      const shareUrl = `https://courier.esolia.co.jp/s/${shareId}`;

      // TODO: Call Courier API to create share
      // For now, store the share info locally
      // In production, this would call the Nexus/Courier API

      // Update proposal with share info
      await db
        .prepare(
          `UPDATE proposals SET
            share_id = ?,
            share_url = ?,
            share_pin = ?,
            shared_at = datetime('now'),
            shared_to_email = ?,
            shared_to_name = ?,
            share_expires_at = ?,
            status = 'shared',
            updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          shareId,
          shareUrl,
          pin,
          recipientEmail,
          recipientName,
          expiresAt.toISOString(),
          params.id
        )
        .run();

      return {
        success: true,
        message: 'Share link created',
        shareUrl,
        pin,
        expiresAt: expiresAt.toISOString(),
      };
    } catch (err) {
      console.error('Share creation error:', err);
      return fail(500, { error: 'Failed to create share' });
    }
  },

  // Delete proposal
  delete: async ({ params, platform }) => {
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;

    try {
      await db.prepare('DELETE FROM proposals WHERE id = ?').bind(params.id).run();

      return { success: true, redirect: '/proposals' };
    } catch (err) {
      console.error('Delete failed:', err);
      return fail(500, { error: 'Failed to delete proposal' });
    }
  },
};

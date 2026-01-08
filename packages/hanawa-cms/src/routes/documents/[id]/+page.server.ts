/**
 * Document Detail/Edit Page Server
 * InfoSec: Input validation, parameterized queries (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';

/**
 * Basic markdown to HTML converter
 * InfoSec: Only used for server-side PDF generation, output not displayed in browser
 */
function markdownToHtml(markdown: string): string {
  let html = markdown;

  // If content already looks like HTML (starts with < tag), pass through unchanged
  // InfoSec: Fragment HTML is authored in CMS (trusted), sanitized on save
  const trimmed = html.trim();
  if (trimmed.startsWith('<') && (trimmed.startsWith('<p') || trimmed.startsWith('<h') || trimmed.startsWith('<div') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<table'))) {
    return html;
  }

  // Escape HTML entities first (prevent XSS in case output is ever displayed)
  // InfoSec: HTML entity encoding (OWASP A03)
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Headers (must be at start of line)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Links (after escaping, brackets are safe)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Wrap consecutive <li> tags in <ul>
  html = html.replace(/(<li>.*<\/li>\n?)+/g, (match) => {
    return '<ul>' + match + '</ul>';
  });

  // Tables (basic support)
  const tableRegex = /\|(.+)\|\n\|[-:|]+\|\n((?:\|.+\|\n?)+)/g;
  html = html.replace(tableRegex, (_, header, rows) => {
    const headerCells = header
      .split('|')
      .filter((c: string) => c.trim())
      .map((c: string) => `<th>${c.trim()}</th>`)
      .join('');
    const bodyRows = rows
      .trim()
      .split('\n')
      .map((row: string) => {
        const cells = row
          .split('|')
          .filter((c: string) => c.trim())
          .map((c: string) => `<td>${c.trim()}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');
    return `<table><thead><tr>${headerCells}</tr></thead><tbody>${bodyRows}</tbody></table>`;
  });

  // Paragraphs (double newlines)
  html = html
    .split(/\n\n+/)
    .map((block) => {
      const trimmed = block.trim();
      // Don't wrap if already a block element
      if (
        trimmed.startsWith('<h') ||
        trimmed.startsWith('<ul') ||
        trimmed.startsWith('<ol') ||
        trimmed.startsWith('<table') ||
        trimmed.startsWith('<hr') ||
        trimmed.startsWith('<div')
      ) {
        return trimmed;
      }
      return trimmed ? `<p>${trimmed}</p>` : '';
    })
    .join('\n');

  // Single newlines to <br> within paragraphs
  html = html.replace(/(<p>.*?)<\/p>/gs, (match) => {
    return match.replace(/\n/g, '<br>\n');
  });

  return html;
}

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
  contact_name: string | null;
  contact_name_ja: string | null;
  title: string;
  title_ja: string | null;
  scope: string | null;
  scope_ja: string | null;
  language: string;
  language_mode: string;
  template_id: string | null;
  fragments: string;
  custom_sections: string | null;
  cover_letter_en: string | null;
  cover_letter_ja: string | null;
  status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  pdf_generated_at: string | null;
  pdf_r2_key: string | null;
  pdf_r2_key_en: string | null;
  pdf_r2_key_ja: string | null;
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
      throw error(404, 'Document not found');
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

    // Load ALL available fragments for the "Add Fragment" feature
    const allFragmentsResult = await db
      .prepare(
        `SELECT id, name, slug, category, content_en, content_ja
         FROM fragments
         ORDER BY category, name`
      )
      .all<FragmentContent>();

    const availableFragments = allFragmentsResult.results ?? [];

    // Load cover letter boilerplate templates
    const boilerplateResult = await db
      .prepare(
        `SELECT id, name, slug, category, content_en, content_ja
         FROM fragments
         WHERE category = 'cover-letter'
         ORDER BY name`
      )
      .all<FragmentContent>();

    const boilerplates = boilerplateResult.results ?? [];

    return {
      proposal: result,
      fragments,
      fragmentContents,
      availableFragments,
      boilerplates,
    };
  } catch (err) {
    if ((err as { status?: number })?.status === 404) {
      throw err;
    }
    console.error('Failed to load document:', err);
    throw error(500, 'Failed to load document');
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
    const contactName = formData.get('contact_name')?.toString().trim() || null;
    const contactNameJa = formData.get('contact_name_ja')?.toString().trim() || null;
    const title = formData.get('title')?.toString().trim();
    const titleJa = formData.get('title_ja')?.toString().trim() || null;
    const scope = formData.get('scope')?.toString().trim() || null;
    const scopeJa = formData.get('scope_ja')?.toString().trim() || null;
    const languageMode = formData.get('language_mode')?.toString() || 'en';
    const fragmentsJson = formData.get('fragments')?.toString() || '[]';
    const coverLetterEn = formData.get('cover_letter_en')?.toString() || null;
    const coverLetterJa = formData.get('cover_letter_ja')?.toString() || null;

    if (!clientCode || !title) {
      return fail(400, { error: 'Client code and title are required' });
    }

    // InfoSec: Validate language_mode enum (OWASP A03)
    const validModes = ['en', 'ja', 'both_en_first', 'both_ja_first'];
    if (!validModes.includes(languageMode)) {
      return fail(400, { error: 'Invalid language mode' });
    }

    try {
      // InfoSec: Parameterized update (OWASP A03)
      await db
        .prepare(
          `UPDATE proposals SET
            client_code = ?, client_name = ?, client_name_ja = ?,
            contact_name = ?, contact_name_ja = ?,
            title = ?, title_ja = ?, scope = ?, scope_ja = ?, language_mode = ?,
            fragments = ?, cover_letter_en = ?, cover_letter_ja = ?,
            updated_at = datetime('now')
           WHERE id = ?`
        )
        .bind(
          clientCode,
          clientName,
          clientNameJa,
          contactName,
          contactNameJa,
          title,
          titleJa,
          scope,
          scopeJa,
          languageMode,
          fragmentsJson,
          coverLetterEn,
          coverLetterJa,
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
  generatePdf: async ({ params, platform }) => {
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;
    const pdfService = platform.env.PDF_SERVICE;

    if (!pdfService) {
      return fail(500, { error: 'PDF service not configured' });
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

      // Determine language mode and primary language
      const langMode = proposal.language_mode || 'en';
      const isBilingual = langMode.startsWith('both_');
      const firstLang = langMode === 'both_ja_first' ? 'ja' : 'en';
      const secondLang = firstLang === 'en' ? 'ja' : 'en';
      const primaryLang = isBilingual ? firstLang : langMode === 'ja' ? 'ja' : 'en';

      // Get current date formatted for JST
      const now = new Date();
      const dateFormattedEn = now.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Tokyo',
      });
      const dateFormattedJa = now.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'Asia/Tokyo',
      });
      // Date string for filename (JST)
      const dateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Tokyo' }).replace(/-/g, '');

      // Helper: Build content section for a language
      // Note: proposal is guaranteed non-null here (checked above)
      const proposalData = proposal;
      function buildSection(lang: 'en' | 'ja'): string {
        let section = '';

        // Cover letter (use new bilingual fields, fall back to custom_sections)
        const coverLetter =
          lang === 'ja' ? proposalData.cover_letter_ja : proposalData.cover_letter_en;
        if (coverLetter) {
          // Cover letters are HTML from Tiptap, already formatted
          section += `<div class="cover-letter">${coverLetter}</div>\n<hr>\n`;
        } else if (!isBilingual && proposalData.custom_sections) {
          // Fall back to custom_sections for single-language proposals
          section += markdownToHtml(proposalData.custom_sections) + '\n<hr>\n';
        }

        // Scope (use language-specific scope)
        const scopeContent = lang === 'ja' ? (proposalData.scope_ja || proposalData.scope) : proposalData.scope;
        if (scopeContent) {
          section += `<h2>${lang === 'ja' ? 'スコープ' : 'Scope'}</h2>\n<p>${scopeContent}</p>\n`;
        }

        // Fragments in order
        for (const fragId of enabledFragmentIds) {
          const content = contentMap.get(fragId);
          if (content) {
            const fragContent =
              lang === 'ja' && content.content_ja ? content.content_ja : content.content_en;
            if (fragContent) {
              section += markdownToHtml(fragContent) + '\n';
            }
          }
        }

        return section;
      }

      // Build provenance metadata
      const provenance = {
        source: 'esolia-codex',
        document_id: proposal.id,
        version: '1.0',
        created: proposal.created_at,
        modified: new Date().toISOString(),
        author: 'eSolia Inc.',
        language: isBilingual ? 'bilingual' : primaryLang,
        license: 'Proprietary - eSolia Inc.',
        client_code: proposal.client_code,
        fragments_used: enabledFragmentIds,
      };

      // eSolia logo SVG (dark blue, horizontal)
      const esoliaLogoSvg = `<svg width="160" height="59" viewBox="0 0 531 195" xmlns="http://www.w3.org/2000/svg">
        <g transform="translate(39.1401, 37)" fill="none" fill-rule="evenodd">
          <path d="M156.657,52.998C147.81,52.656 139.181,54.04 131.058,56.877C132.812,45.67 132.677,32.026 128.98,15.586L127.844,10.512L123.041,12.49C103.935,20.354 89.655,35.493 82.833,55.123C76.647,72.934 77.724,92.052 85.706,106.261L86.147,107.044C85.494,110.44 85.111,113.837 85.164,117.168L85.188,118.934L86.895,119.375C88.237,119.729 90.297,120 92.94,120C97.772,120 104.524,119.081 112.276,115.997C127.809,109.822 148.487,94.383 158.805,55.917L159.559,53.11L156.657,52.998Z" fill="#FFBC68"/>
          <path d="M43.468,5.831L41.467,4.412L40.802,6.625C31.967,36.074 48.989,49.712 56.718,54.203L58.384,55.174L59.125,53.532C66.954,36.127 61.103,18.298 43.468,5.831" fill="#2D2F63"/>
          <g transform="translate(68.3362, 0)">
            <path d="M31.708,101.172C22.473,104.845 14.892,105.157 10.96,104.686C11.03,102.444 11.336,100.171 11.748,97.899C17.411,97.429 27.458,91.919 35.723,82.631C37.482,80.653 39.142,78.534 40.655,76.339C44.752,70.4 48.825,62.253 51.203,51.641C58.608,48.703 66.524,47.114 74.671,47.067C64.629,81.577 45.87,95.539 31.708,101.172M45.752,54.113C43.781,61.276 40.855,67.88 36.841,73.708C35.434,75.744 33.892,77.71 32.256,79.547C25.063,87.64 17.117,91.96 12.873,93.043C15.669,83.225 21.437,73.566 29.56,65.679C34.445,60.935 39.908,57.085 45.752,54.113M8.364,46.131C14.703,27.861 27.947,13.758 45.67,6.376C49.096,21.763 49.467,35.889 47.059,48.409C39.513,51.747 32.479,56.373 26.328,62.353C18.229,70.223 12.272,79.776 9.047,89.624C3.49,77.039 3.149,61.141 8.364,46.131M52.204,46.361C53.958,35.148 53.822,21.51 50.132,5.07L48.996,-0.004L44.187,1.974C25.08,9.832 10.801,24.977 3.985,44.607C-2.208,62.418 -1.13,81.536 6.851,95.745L7.293,96.528C6.639,99.924 6.263,103.321 6.31,106.652L6.339,108.418L8.046,108.859C9.382,109.213 11.448,109.483 14.085,109.483C18.918,109.483 25.669,108.565 33.421,105.481C48.954,99.306 69.638,83.867 79.957,45.401L80.71,42.594L77.808,42.482C68.955,42.14 60.326,43.524 52.204,46.361" fill="#2D2F63"/>
          </g>
          <path d="M0,37.696C5.038,69.14 32.903,97.381 61.18,95.998C60.609,68.734 32.032,38.944 0,37.696" fill="#2D2F63"/>
          <path d="M192.311,55.627C193.341,48.793 197.555,46.079 202.235,46.079C207.662,46.079 211.405,50.294 211.688,55.627L192.311,55.627ZM202.046,32.6C186.79,32.6 176.872,43.831 176.872,58.993C176.872,76.499 188.567,85.858 206.914,85.858C212.435,85.858 217.492,85.204 221.983,83.615L220.764,72.102C217.397,73.32 213.842,73.879 209.534,73.879C200.734,73.879 194.93,70.978 193.064,64.521L224.884,64.521C225.255,62.831 225.355,60.589 225.355,58.528C225.355,44.767 217.586,32.6 202.046,32.6Z" fill="#2D2F63"/>
          <path d="M260.156,44.769C252.387,42.992 250.05,41.302 250.05,38.218C250.05,34.568 253.323,32.414 259.874,32.414C265.96,32.414 271.105,33.538 276.443,35.222L277.285,19.312C272.04,17.157 267.361,16.033 259.032,16.033C241.904,16.033 234.511,25.204 234.511,37.376C234.511,49.919 241.904,55.064 254.818,57.872C262.311,59.555 265.583,61.244 265.583,65.082C265.583,69.102 261.84,71.445 254.258,71.445C247.054,71.445 240.408,69.856 236.006,67.984L235.258,82.116C240.873,84.265 245.647,85.86 255.194,85.86C273.259,85.86 281.123,76.684 281.123,64.705C281.123,52.35 273.353,47.671 260.156,44.769" fill="#2D2F63"/>
          <path d="M316.017,72.474C309.466,72.474 304.598,67.606 304.598,60.025C304.598,52.726 309.372,47.481 316.017,47.481C322.569,47.481 327.53,52.726 327.53,60.025C327.53,67.606 322.663,72.474 316.017,72.474M316.017,32.601C300.29,32.601 289.341,43.738 289.341,59.183C289.341,74.534 300.384,85.859 316.017,85.859C331.833,85.859 342.693,74.534 342.693,59.183C342.693,43.738 331.833,32.601 316.017,32.601" fill="#2D2F63"/>
          <polygon fill="#2D2F63" points="354.185 84.642 368.694 84.642 368.694 13.509 354.185 13.509"/>
          <path d="M390.121,11.727C384.977,11.727 381.227,15.1 381.227,20.338C381.227,25.577 385.065,28.95 390.121,28.95C395.177,28.95 399.015,25.577 399.015,20.338C399.015,15.1 395.365,11.727 390.121,11.727" fill="#2D2F63"/>
          <polygon fill="#2D2F63" points="382.915 84.642 397.424 84.642 397.424 33.822 382.915 33.822"/>
          <path d="M438.787,70.789C437.38,73.879 434.384,76.405 430.264,76.405C426.715,76.405 423.901,74.815 423.901,71.443C423.901,67.234 426.897,66.016 431.765,64.891C434.855,64.238 437.286,63.302 438.787,62.555L438.787,70.789ZM430.829,32.6C423.06,32.6 416.414,34.472 412.017,36.815L413.047,51.324C417.538,49.264 423.248,47.48 429.328,47.48C435.603,47.48 438.599,49.358 438.599,52.348C438.599,53.661 438.222,54.408 436.633,55.062C434.667,55.815 432.419,56.374 428.304,57.122C417.444,58.905 408.739,62.084 408.739,72.938C408.739,81.461 414.825,85.858 423.248,85.858C430.735,85.858 435.044,82.956 438.787,78.465L438.787,84.639L453.573,84.639L453.573,53.661C453.573,39.993 446.745,32.6 430.829,32.6Z" fill="#2D2F63"/>
        </g>
      </svg>`;

      // Shared CSS styles for all PDFs
      const pdfStyles = `
    @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Sans+JP:wght@400;500;600;700&display=swap');
    body {
      font-family: 'IBM Plex Sans', 'IBM Plex Sans JP', sans-serif;
      line-height: 1.6;
      color: #2D2F63;
      max-width: 800px;
      margin: 0 auto;
      padding: 40px;
    }
    h1 { color: #2D2F63; border-bottom: 2px solid #FFBC68; padding-bottom: 10px; margin-top: 0; }
    h2 { color: #2D2F63; margin-top: 30px; }
    h3 { color: #4a4c7a; }
    table { border-collapse: collapse; width: 100%; margin: 20px 0; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    ul, ol { margin: 10px 0; padding-left: 20px; }
    li { margin: 5px 0; }
    strong { color: #2D2F63; }
    hr { border: none; border-top: 1px solid #ddd; margin: 30px 0; }
    a { color: #2D2F63; }
    .logo { margin-bottom: 30px; }
    .header { margin-bottom: 40px; }
    .client-name { font-size: 1.1em; color: #666; margin-top: 10px; }
    .cover-letter { margin-bottom: 20px; }
    .cover-letter p { margin: 10px 0; }
    .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; display: flex; justify-content: space-between; align-items: center; }
    h2 { page-break-before: auto; page-break-after: avoid; }
    h3 { page-break-after: avoid; }
    ul, ol, table { page-break-inside: avoid; }
    @media print { body { padding: 0; } .logo { margin-bottom: 20px; } }
      `.trim();

      // Helper: Build complete single-language HTML document
      function buildSingleLanguageHtml(lang: 'en' | 'ja'): string {
        const contactName = lang === 'ja' ? (proposalData.contact_name_ja || proposalData.contact_name) : proposalData.contact_name;
        const clientName = lang === 'ja' ? (proposalData.client_name_ja || proposalData.client_name) : proposalData.client_name;
        const title = lang === 'ja' && proposalData.title_ja ? proposalData.title_ja : proposalData.title;
        const dateFormatted = lang === 'ja' ? dateFormattedJa : dateFormattedEn;
        const confidential = lang === 'ja' ? '機密' : 'Confidential';

        return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${pdfStyles}</style>
</head>
<body>
  <div class="logo">${esoliaLogoSvg}</div>
  <div class="header">
    <h1>${title}</h1>
    ${contactName || clientName ? `<p class="client-name">${lang === 'ja' ? '宛先' : 'Prepared for'}: <strong>${[contactName, clientName].filter(Boolean).join(', ')}</strong></p>` : ''}
    <p class="client-name">${lang === 'ja' ? '日付' : 'Date'}: ${dateFormatted}</p>
  </div>
  <section>${buildSection(lang)}</section>
  <div class="footer">
    <span>© ${new Date().getFullYear()} eSolia Inc. | ${confidential}</span>
  </div>
</body>
</html>`;
      }

      // Build HTML content based on language mode
      // InfoSec: HTML content is server-generated, cover letters are from Tiptap (sanitized)
      let bodyContent = '';

      // For bilingual proposals, use the new pdf-lib merge approach
      if (isBilingual) {
        // Generate separate EN and JA HTML documents
        const htmlEn = buildSingleLanguageHtml('en');
        const htmlJa = buildSingleLanguageHtml('ja');

        // PDF footer template
        const footerTemplate = `
          <div style="width: 100%; font-size: 9px; font-family: 'IBM Plex Sans', sans-serif; color: #666; padding: 0 20mm; display: flex; justify-content: space-between; align-items: center;">
            <span>eSolia Inc. — CONFIDENTIAL / 機密 — ${dateStr}</span>
            <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
          </div>
        `;

        // Call bilingual PDF endpoint
        const bilingualResponse = await pdfService.fetch('https://pdf-worker/pdf/bilingual', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            htmlEn,
            htmlJa,
            toc: {
              title: proposal.title,
              titleJa: proposal.title_ja,
              clientName: [proposal.contact_name, proposal.client_name].filter(Boolean).join(', ') || undefined,
              date: dateFormattedEn,
              dateJa: dateFormattedJa,
            },
            options: {
              displayHeaderFooter: true,
              headerTemplate: '<div></div>',
              footerTemplate,
              margin: { top: '20mm', right: '20mm', bottom: '25mm', left: '20mm' },
            },
            firstLanguage: firstLang,
          }),
        });

        if (!bilingualResponse.ok) {
          const errorText = await bilingualResponse.text();
          console.error('Bilingual PDF generation failed:', errorText);
          return fail(500, { error: 'Bilingual PDF generation failed' });
        }

        // Parse response (base64 encoded PDFs)
        const bilingualResult = await bilingualResponse.json() as {
          combined: string;
          english: string;
          japanese: string;
          pageInfo: { tocPages: number; englishPages: number; japanesePages: number; totalPages: number };
        };

        // Decode base64 to ArrayBuffer
        function base64ToArrayBuffer(base64: string): ArrayBuffer {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          return bytes.buffer;
        }

        const combinedPdf = base64ToArrayBuffer(bilingualResult.combined);
        const englishPdf = base64ToArrayBuffer(bilingualResult.english);
        const japanesePdf = base64ToArrayBuffer(bilingualResult.japanese);

        // Store all 3 PDFs in R2
        let r2KeyCombined: string | null = null;
        let r2KeyEn: string | null = null;
        let r2KeyJa: string | null = null;

        if (platform.env.R2) {
          const basePath = `proposals/${proposal.client_code}/${proposal.id}`;
          r2KeyCombined = `${basePath}.pdf`;
          r2KeyEn = `${basePath}_en.pdf`;
          r2KeyJa = `${basePath}_ja.pdf`;

          const metadata = {
            proposalId: proposal.id,
            clientCode: proposal.client_code,
            generatedAt: new Date().toISOString(),
          };

          await Promise.all([
            platform.env.R2.put(r2KeyCombined, combinedPdf, {
              httpMetadata: { contentType: 'application/pdf' },
              customMetadata: { ...metadata, pdfType: 'combined' },
            }),
            platform.env.R2.put(r2KeyEn, englishPdf, {
              httpMetadata: { contentType: 'application/pdf' },
              customMetadata: { ...metadata, pdfType: 'english' },
            }),
            platform.env.R2.put(r2KeyJa, japanesePdf, {
              httpMetadata: { contentType: 'application/pdf' },
              customMetadata: { ...metadata, pdfType: 'japanese' },
            }),
          ]);
        }

        // Update proposal with all 3 PDF keys
        await db
          .prepare(
            `UPDATE proposals SET
              pdf_generated_at = datetime('now'),
              pdf_r2_key = ?,
              pdf_r2_key_en = ?,
              pdf_r2_key_ja = ?,
              provenance = ?,
              updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(r2KeyCombined, r2KeyEn, r2KeyJa, JSON.stringify(provenance), params.id)
          .run();

        return {
          success: true,
          message: 'Bilingual PDFs generated successfully',
          pdfKey: r2KeyCombined,
          pdfKeyEn: r2KeyEn,
          pdfKeyJa: r2KeyJa,
          pageInfo: bilingualResult.pageInfo,
        };
      } else {
        // Single language mode
        const contactName = primaryLang === 'ja' ? (proposal.contact_name_ja || proposal.contact_name) : proposal.contact_name;
        const clientName = primaryLang === 'ja' ? (proposal.client_name_ja || proposal.client_name) : proposal.client_name;

        bodyContent = `
  <div class="header">
    <h1>${primaryLang === 'ja' && proposal.title_ja ? proposal.title_ja : proposal.title}</h1>
    ${contactName || clientName ? `<p class="client-name">${primaryLang === 'ja' ? '宛先' : 'Prepared for'}: <strong>${[contactName, clientName].filter(Boolean).join(', ')}</strong></p>` : ''}
    <p class="client-name">${primaryLang === 'ja' ? '日付' : 'Date'}: ${primaryLang === 'ja' ? dateFormattedJa : dateFormattedEn}</p>
  </div>

  <section>
    ${buildSection(primaryLang as 'en' | 'ja')}
  </section>`;
      }

      // Build the full HTML document (single-language only - bilingual returned above)
      const html = `<!DOCTYPE html>
<html lang="${primaryLang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${proposal.title}</title>
  <style>${pdfStyles}</style>
</head>
<body>
  <div class="logo">${esoliaLogoSvg}</div>
  ${bodyContent}
  <div class="footer">
    <span>© ${new Date().getFullYear()} eSolia Inc. | ${primaryLang === 'ja' ? '機密' : 'Confidential'}</span>
  </div>
</body>
</html>`;

      // PDF header/footer templates
      const footerTemplate = `
        <div style="width: 100%; font-size: 9px; font-family: 'IBM Plex Sans', sans-serif; color: #666; padding: 0 20mm; display: flex; justify-content: space-between; align-items: center;">
          <span>eSolia Inc. — ${primaryLang === 'ja' ? '機密' : 'CONFIDENTIAL'} — ${dateStr}</span>
          <span><span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `;

      // Call PDF Worker via service binding (no WAF, no API key needed)
      // InfoSec: Service binding is internal worker-to-worker, trusted communication
      const pdfResponse = await pdfService.fetch('https://pdf-worker/pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          html,
          options: {
            title: proposal.title,
            author: 'eSolia Inc.',
            subject: `Proposal for ${proposal.client_name || proposal.client_code}`,
            provenance,
            // PDF rendering options
            displayHeaderFooter: true,
            headerTemplate: '<div></div>', // Empty header
            footerTemplate,
            margin: { top: '20mm', right: '20mm', bottom: '25mm', left: '20mm' },
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

      return { success: true, redirect: '/documents' };
    } catch (err) {
      console.error('Delete failed:', err);
      return fail(500, { error: 'Failed to delete proposal' });
    }
  },

  // AI Translate cover letter
  aiTranslate: async ({ request, locals }) => {
    if (!locals.ai) {
      return fail(500, { error: 'AI service not available' });
    }

    const formData = await request.formData();
    const text = formData.get('text')?.toString() || '';
    const sourceLocale = formData.get('source_locale')?.toString() as 'en' | 'ja';

    if (!text || !sourceLocale) {
      return fail(400, { error: 'Text and source locale are required' });
    }

    // InfoSec: Validate locale enum
    if (!['en', 'ja'].includes(sourceLocale)) {
      return fail(400, { error: 'Invalid source locale' });
    }

    const targetLocale = sourceLocale === 'en' ? 'ja' : 'en';
    const userEmail = locals.user?.email || 'anonymous';

    try {
      const translated = await locals.ai.translate(text, sourceLocale, targetLocale, userEmail);
      return { success: true, translated, targetLocale };
    } catch (err) {
      console.error('Translation failed:', err);
      return fail(500, { error: 'Translation failed' });
    }
  },

  // AI Polish/improve cover letter
  aiPolish: async ({ request, locals }) => {
    if (!locals.ai) {
      return fail(500, { error: 'AI service not available' });
    }

    const formData = await request.formData();
    const text = formData.get('text')?.toString() || '';

    if (!text) {
      return fail(400, { error: 'Text is required' });
    }

    const userEmail = locals.user?.email || 'anonymous';

    try {
      const result = await locals.ai.generate(
        {
          action: 'improve',
          selection: text,
          documentType: 'proposal',
        },
        userEmail
      );
      return { success: true, polished: result.content };
    } catch (err) {
      console.error('Polish failed:', err);
      return fail(500, { error: 'Polish failed' });
    }
  },
};

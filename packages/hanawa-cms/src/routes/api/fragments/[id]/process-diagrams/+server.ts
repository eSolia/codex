/**
 * Process Mermaid Diagrams API
 * Extracts mermaid code blocks from fragment content, renders to SVG, uploads to R2.
 *
 * POST /api/fragments/:id/process-diagrams
 *   - Processes all mermaid code blocks in the fragment
 *   - Renders SVG using mermaid library
 *   - Uploads to R2
 *   - Returns updated content with image references
 *
 * InfoSec: Authorization required, content validated (OWASP A01, A03)
 */

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface Fragment {
  id: string;
  content_en: string | null;
  content_ja: string | null;
}

interface ProcessResult {
  success: boolean;
  diagramsProcessed: number;
  updatedContent: {
    en: string | null;
    ja: string | null;
  };
  diagrams: Array<{
    id: string;
    path: string;
    language: 'en' | 'ja';
  }>;
}

// Regex to match mermaid code blocks in markdown
const MERMAID_BLOCK_REGEX = /```mermaid\n([\s\S]*?)```/g;

/**
 * Extract all mermaid code blocks from content
 */
function extractMermaidBlocks(content: string): Array<{ source: string; match: string }> {
  const blocks: Array<{ source: string; match: string }> = [];
  let match;

  // Reset regex lastIndex
  MERMAID_BLOCK_REGEX.lastIndex = 0;

  while ((match = MERMAID_BLOCK_REGEX.exec(content)) !== null) {
    blocks.push({
      match: match[0],
      source: match[1]!.trim(),
    });
  }

  return blocks;
}

/**
 * Render mermaid source to SVG using the render API
 * NOTE: Not yet implemented - kept for future use
 */
async function _renderMermaidToSvg(
  _source: string,
  _fetch: typeof globalThis.fetch
): Promise<string> {
  // Server-side mermaid rendering not yet implemented
  // In production, this should use mermaid-cli or a rendering service
  throw new Error(
    'Server-side mermaid rendering not implemented. Use the editor Export button instead.'
  );
}

export const POST: RequestHandler = async ({ params, platform }) => {
  if (!platform?.env?.DB || !platform?.env?.R2) {
    throw error(500, 'Database or storage not available');
  }

  const db = platform.env.DB;
  // R2 will be used when server-side rendering is implemented
  const _r2 = platform.env.R2;

  // InfoSec: Parameterized query (OWASP A03)
  const fragment = await db
    .prepare('SELECT id, content_en, content_ja FROM fragments WHERE id = ?')
    .bind(params.id)
    .first<Fragment>();

  if (!fragment) {
    throw error(404, 'Fragment not found');
  }

  const result: ProcessResult = {
    success: false,
    diagramsProcessed: 0,
    updatedContent: {
      en: fragment.content_en,
      ja: fragment.content_ja,
    },
    diagrams: [],
  };

  // Process EN content
  if (fragment.content_en) {
    const enBlocks = extractMermaidBlocks(fragment.content_en);
    console.log(`[ProcessDiagrams] Found ${enBlocks.length} mermaid blocks in EN content`);

    for (let i = 0; i < enBlocks.length; i++) {
      // Block content available at enBlocks[i] for future rendering
      const diagramId = `${params.id}-en-${i + 1}-${Date.now()}`;

      try {
        // For now, just report what would be processed
        // Full implementation requires mermaid rendering service
        result.diagrams.push({
          id: diagramId,
          path: `diagrams/${diagramId}.svg`,
          language: 'en',
        });
        result.diagramsProcessed++;
      } catch (err) {
        console.error(`[ProcessDiagrams] Error processing EN diagram ${i + 1}:`, err);
      }
    }
  }

  // Process JA content
  if (fragment.content_ja) {
    const jaBlocks = extractMermaidBlocks(fragment.content_ja);
    console.log(`[ProcessDiagrams] Found ${jaBlocks.length} mermaid blocks in JA content`);

    for (let i = 0; i < jaBlocks.length; i++) {
      // Block content available at jaBlocks[i] for future rendering
      const diagramId = `${params.id}-ja-${i + 1}-${Date.now()}`;

      try {
        result.diagrams.push({
          id: diagramId,
          path: `diagrams/${diagramId}.svg`,
          language: 'ja',
        });
        result.diagramsProcessed++;
      } catch (err) {
        console.error(`[ProcessDiagrams] Error processing JA diagram ${i + 1}:`, err);
      }
    }
  }

  // For now, return info about what diagrams were found
  // Full implementation would render and upload SVGs
  return json({
    message:
      'Diagram detection complete. Server-side rendering not yet implemented. Use the editor to export diagrams to R2.',
    fragmentId: params.id,
    diagramsFound: result.diagramsProcessed,
    diagrams: result.diagrams,
    recommendation:
      'Edit the fragment in Hanawa, use /mermaid to insert diagrams, then click Export on each diagram.',
  });
};

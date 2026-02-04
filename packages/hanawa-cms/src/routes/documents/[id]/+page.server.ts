/**
 * Document Detail/Edit Page Server
 * InfoSec: Input validation, parameterized queries (OWASP A03)
 */

import type { PageServerLoad, Actions } from './$types';
import { error, fail } from '@sveltejs/kit';
import { superValidate } from 'sveltekit-superforms';
import { zod4 } from 'sveltekit-superforms/adapters';
import { saveDocumentSchema, updateDocumentStatusSchema, deleteDocumentSchema } from '$lib/schemas';

/**
 * Process Tiptap callout blocks to PDF-styled HTML
 * Handles nested divs properly by counting open/close tags
 */
function processCallouts(
  html: string,
  styles: Record<string, { bg: string; border: string; icon: string }>
): string {
  // Find callout start tags and process each one
  const calloutStartRegex = /<div[^>]*data-callout-type=["']([^"']+)["'][^>]*>/gi;
  let result = html;
  let match;

  // Collect all callout positions first
  const callouts: Array<{
    start: number;
    end: number;
    type: string;
    title: string | null;
    fullMatch: string;
  }> = [];

  while ((match = calloutStartRegex.exec(html)) !== null) {
    const startTag = match[0];
    const type = match[1];
    const startPos = match.index;

    // Extract title from the start tag
    const titleMatch =
      startTag.match(/data-callout-title="([^"]+)"/i) ||
      startTag.match(/data-callout-title='([^']+)'/i);
    const title = titleMatch ? titleMatch[1] : null;

    // Find the matching closing </div> by counting nested divs
    let depth = 1;
    let pos = startPos + startTag.length;
    while (depth > 0 && pos < html.length) {
      const nextOpen = html.indexOf('<div', pos);
      const nextClose = html.indexOf('</div>', pos);

      if (nextClose === -1) break;

      if (nextOpen !== -1 && nextOpen < nextClose) {
        depth++;
        pos = nextOpen + 4;
      } else {
        depth--;
        if (depth === 0) {
          const endPos = nextClose + 6; // '</div>'.length
          callouts.push({
            start: startPos,
            end: endPos,
            type,
            title,
            fullMatch: html.substring(startPos, endPos),
          });
        }
        pos = nextClose + 6;
      }
    }
  }

  // Process callouts in reverse order to preserve positions
  for (let i = callouts.length - 1; i >= 0; i--) {
    const callout = callouts[i];
    const style = styles[callout.type] || styles.info;

    // Extract the content between the outer div tags
    const innerHtml = callout.fullMatch.replace(/^<div[^>]*>/, '').replace(/<\/div>$/, '');

    // Extract just the callout-content div's contents if present
    const contentMatch = innerHtml.match(
      /<div[^>]*class=["'][^"']*callout-content[^"']*["'][^>]*>([\s\S]*)<\/div>\s*$/i
    );
    const innerContent = contentMatch ? contentMatch[1] : innerHtml;

    const titleHtml = callout.title
      ? `<div style="font-weight: bold; margin-bottom: 8px; color: ${style.border};">${style.icon}${callout.title}</div>`
      : '';

    const replacement = `<div style="margin: 16px 0; padding: 16px; background-color: ${style.bg}; border-left: 4px solid ${style.border}; border-radius: 4px;">
${titleHtml}
<div>${innerContent}</div>
</div>`;

    result = result.substring(0, callout.start) + replacement + result.substring(callout.end);
  }

  return result;
}

/**
 * Extract SVG paths from fragment content
 * Looks for data-svg-path attributes in HTML content (from Tiptap Mermaid blocks)
 *
 * @param fragment - Fragment with content_en and content_ja fields
 * @param lang - Language to prefer ('en' or 'ja')
 * @returns Array of SVG paths found (e.g., "diagrams/mermaid-xxx.svg")
 */
function extractSvgPathsFromFragment(
  fragment: { content_en: string | null; content_ja: string | null },
  lang: 'en' | 'ja'
): string[] {
  // Use language-specific content, fallback to English
  const content = lang === 'ja' && fragment.content_ja ? fragment.content_ja : fragment.content_en;
  if (!content) return [];

  const paths: string[] = [];
  const regex = /data-svg-path=["']([^"']+)["']/gi;
  let match;
  while ((match = regex.exec(content)) !== null) {
    paths.push(match[1]); // e.g., "diagrams/mermaid-xxx.svg"
  }
  return paths;
}

/**
 * Resolve fragment references in HTML content
 * Replaces <div data-fragment-id="xxx" data-fragment-lang="xx">...</div> with actual content
 * InfoSec: Fragment content is trusted (from D1 database, sanitized on save)
 *
 * @param html - HTML content that may contain fragment references
 * @param fragmentContentMap - Map of fragment ID to fragment content
 * @param imageResolver - Map of image URLs to resolved SVG content
 * @param defaultLang - Default language if not specified in fragment reference
 */
function resolveFragmentReferences(
  html: string,
  fragmentContentMap: Map<
    string,
    { id: string; category: string; content_en: string | null; content_ja: string | null }
  >,
  imageResolver: Map<string, string>,
  defaultLang: 'en' | 'ja' = 'en'
): string {
  // Match fragment reference divs: <div data-fragment-id="xxx" data-fragment-lang="xx">...</div>
  const fragmentRefRegex = /<div[^>]*data-fragment-id=["']([^"']+)["'][^>]*>[\s\S]*?<\/div>/gi;

  let result = html.replace(fragmentRefRegex, (match, fragmentId) => {
    // Extract language from the reference attribute
    const langMatch = match.match(/data-fragment-lang=["']([^"']+)["']/i);
    const refLang = (langMatch?.[1] || defaultLang) as 'en' | 'ja';

    const fragment = fragmentContentMap.get(fragmentId);
    if (!fragment) {
      console.warn(`[PDF] Fragment reference not found: ${fragmentId}`);
      return `<div style="margin: 16px 0; padding: 16px; border: 2px dashed #f87171; background: #fef2f2; border-radius: 8px; color: #b91c1c;">
        <strong>Fragment not found:</strong> ${fragmentId}
      </div>`;
    }

    // For diagrams, use the section language (defaultLang) not the reference attribute
    // This ensures JA section gets JA diagrams even if reference was inserted as EN
    // For text fragments, use the reference attribute (user may intentionally set language)
    const lang = fragment.category === 'diagrams' ? defaultLang : refLang;

    // Check if this is a diagram fragment (SVG stored in R2)
    // Single source of truth: data-svg-path attribute in fragment content
    if (fragment.category === 'diagrams') {
      const svgPaths = extractSvgPathsFromFragment(fragment, lang);
      if (svgPaths.length === 0) {
        console.error(`[PDF] No data-svg-path for diagram: ${fragmentId} (lang=${lang})`);
        return `<div style="margin: 16px 0; padding: 16px; border: 2px dashed #fbbf24; background: #fef3c7; border-radius: 8px; color: #92400e;">
          <strong>Diagram not exported:</strong> ${fragmentId}<br>
          <span style="font-size: 0.875em;">Export this diagram to R2 before generating PDF.</span>
        </div>`;
      }

      const svgPath = svgPaths[0];
      const id = svgPath.replace('diagrams/', '').replace('.svg', '');
      const svgContent = imageResolver.get(`/api/diagrams/${id}`);
      if (svgContent) {
        console.log(`[PDF] Resolved diagram ${fragmentId} via data-svg-path: ${svgPath}`);
        return `<div style="text-align: center; margin: 20px 0;">${svgContent}</div>`;
      }

      console.error(`[PDF] SVG not in R2: ${svgPath} (fragment: ${fragmentId})`);
      return `<div style="margin: 16px 0; padding: 16px; border: 2px dashed #f87171; background: #fef2f2; border-radius: 8px; color: #b91c1c;">
        <strong>SVG not found in R2:</strong> ${svgPath}<br>
        <span style="font-size: 0.875em;">Re-export this diagram to R2.</span>
      </div>`;
    }

    // Regular fragment - use content_en or content_ja based on language
    const content =
      lang === 'ja' && fragment.content_ja ? fragment.content_ja : fragment.content_en;
    if (content) {
      console.log(`[PDF] Resolved fragment ${fragmentId} (${lang})`);
      return content;
    }

    console.warn(`[PDF] Fragment has no content: ${fragmentId}`);
    return `<div style="margin: 16px 0; padding: 16px; border: 2px dashed #d1d5db; background: #f9fafb; border-radius: 8px; color: #6b7280;">
      <strong>Fragment empty:</strong> ${fragmentId}
    </div>`;
  });

  // Clean up any remaining "Fragment: xxx" placeholder text that wasn't replaced
  // This handles edge cases where fragment refs weren't fully matched
  result = result.replace(/Fragment:\s*[\w-]+/g, '');

  return result;
}

/**
 * Basic markdown to HTML converter
 * InfoSec: Only used for server-side PDF generation, output not displayed in browser
 *
 * @param markdown - The markdown content to convert
 * @param imageResolver - Optional async function to resolve image URLs to inline content
 */
function markdownToHtml(markdown: string, imageResolver?: Map<string, string>): string {
  let html = markdown;

  // If content already looks like HTML (starts with < tag), process as HTML
  // InfoSec: Fragment HTML is authored in CMS (trusted), sanitized on save
  const trimmed = html.trim();
  if (
    trimmed.startsWith('<') &&
    (trimmed.startsWith('<p') ||
      trimmed.startsWith('<h') ||
      trimmed.startsWith('<div') ||
      trimmed.startsWith('<ul') ||
      trimmed.startsWith('<ol') ||
      trimmed.startsWith('<table'))
  ) {
    let processed = html;

    // Handle Tiptap Mermaid blocks - use R2 SVG, show placeholder if not exported
    // Matches: <div data-type="mermaidBlock" data-source="..." data-svg-path="..." ...>...</div>
    processed = processed.replace(
      /<div[^>]*data-type=["']mermaidBlock["'][^>]*>[\s\S]*?<\/div>/gi,
      (match) => {
        // Extract svgPath attribute if present
        const svgPathMatch = match.match(/data-svg-path=["']([^"']+)["']/i);
        if (svgPathMatch && svgPathMatch[1]) {
          const svgPath = svgPathMatch[1];
          // Use the R2-stored SVG - will be resolved by imageResolver
          const svgUrl = `/api/diagrams/${svgPath.replace('diagrams/', '').replace('.svg', '')}`;
          console.log('[PDF] Using R2 SVG:', svgUrl);
          return `<div style="text-align: center; margin: 20px 0;"><img src="${svgUrl}" alt="Mermaid diagram" style="max-width: 90%; height: auto;"></div>`;
        }

        // No R2 export - show warning placeholder
        // InfoSec: No fallback to external services - all diagrams must be exported to R2
        console.log('[PDF] Mermaid block without R2 export - showing placeholder');
        return `<div class="mermaid-placeholder" style="margin: 20px 0; padding: 20px; border: 2px dashed #f59e0b; border-radius: 8px; text-align: center; color: #92400e; background: #fef3c7;">
          <strong>Diagram not exported</strong><br>
          <span style="font-size: 0.875em;">Export this Mermaid diagram to R2 before generating PDF.</span>
        </div>`;
      }
    );

    // Handle Page Break blocks - convert to CSS page-break for PDF
    processed = processed.replace(
      /<div[^>]*data-type=["']pageBreak["'][^>]*>[\s\S]*?<\/div>/gi,
      () => {
        return `<div style="page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0;"></div>`;
      }
    );

    // Handle Tiptap Callout blocks - convert to styled PDF format
    // Matches: <div data-callout-type="info" data-callout-title="...">...</div>
    const pdfCalloutStyles: Record<string, { bg: string; border: string; icon: string }> = {
      info: {
        bg: '#dbeafe',
        border: '#3b82f6',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 6px;"><path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88Zm16-40a8 8 0 0 1-8 8a16 16 0 0 1-16-16v-40a8 8 0 0 1 0-16a16 16 0 0 1 16 16v40a8 8 0 0 1 8 8Zm-32-92a12 12 0 1 1 12 12a12 12 0 0 1-12-12Z"/></svg>',
      },
      warning: {
        bg: '#fef3c7',
        border: '#f59e0b',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 6px;"><path fill="currentColor" d="M236.8 188.09L149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19a23.51 23.51 0 0 0 .02-23.72ZM120 144v-40a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0Zm20 36a12 12 0 1 1-12-12a12 12 0 0 1 12 12Z"/></svg>',
      },
      danger: {
        bg: '#fee2e2',
        border: '#ef4444',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 6px;"><path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88Zm-8-80V80a8 8 0 0 1 16 0v56a8 8 0 0 1-16 0Zm20 36a12 12 0 1 1-12-12a12 12 0 0 1 12 12Z"/></svg>',
      },
      success: {
        bg: '#d1fae5',
        border: '#10b981',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 6px;"><path fill="currentColor" d="M173.66 98.34a8 8 0 0 1 0 11.32l-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 0ZM232 128A104 104 0 1 1 128 24a104.11 104.11 0 0 1 104 104Zm-16 0a88 88 0 1 0-88 88a88.1 88.1 0 0 0 88-88Z"/></svg>',
      },
      note: {
        bg: '#f3f4f6',
        border: '#6b7280',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 6px;"><path fill="currentColor" d="M208 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h108.69a15.86 15.86 0 0 0 11.31-4.69l49.32-49.32a15.86 15.86 0 0 0 4.68-11.31V48a16 16 0 0 0-16-16Zm0 16v104h-48a8 8 0 0 0-8 8v48H48V48Zm-12.69 120L168 195.31V168Z"/></svg>',
      },
      tip: {
        bg: '#e0e7ff',
        border: '#6366f1',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 6px;"><path fill="currentColor" d="M176 232a8 8 0 0 1-8 8H88a8 8 0 0 1 0-16h80a8 8 0 0 1 8 8Zm40-128a87.55 87.55 0 0 1-33.64 69.21A16.24 16.24 0 0 0 176 186v6a16 16 0 0 1-16 16H96a16 16 0 0 1-16-16v-6a16 16 0 0 0-6.23-12.66A87.59 87.59 0 0 1 40 104.5C39.74 56.83 78.26 17.14 125.88 16A88 88 0 0 1 216 104Z"/></svg>',
      },
    };

    // Handle Tiptap Callout blocks - use a function to properly handle nested divs
    processed = processCallouts(processed, pdfCalloutStyles);

    // Resolve HTML img tags with imageResolver (for Mermaid SVGs from R2)
    // Replace <img src="/api/diagrams/..."> with inline SVG content
    if (imageResolver && imageResolver.size > 0) {
      processed = processed.replace(
        /<img[^>]*src=["'](\/api\/diagrams\/[^"']+)["'][^>]*>/gi,
        (match, url) => {
          if (imageResolver.has(url)) {
            const svgContent = imageResolver.get(url)!;
            console.log('[PDF] Resolved HTML img to inline SVG:', url);
            return svgContent;
          }
          // No resolver match - convert to absolute URL for external fetch
          console.log('[PDF] No inline SVG for:', url);
          return match.replace(url, `https://hanawa.esolia.co.jp${url}`);
        }
      );
    }

    // Tiptap wraps list item content in <p> tags - remove them for cleaner PDF
    // Handle <p> with or without attributes: <li><p class="...">text</p></li> → <li>text</li>
    processed = processed.replace(/<li>\s*<p[^>]*>([\s\S]*?)<\/p>\s*<\/li>/g, '<li>$1</li>');
    // Remove any remaining <p> tags inside <li> (handles multiple <p> in one <li>)
    processed = processed.replace(/<li>([\s\S]*?)<\/li>/g, (match, content) => {
      const stripped = content
        .replace(/<\/?p[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      return `<li>${stripped}</li>`;
    });
    // Remove empty paragraphs
    processed = processed.replace(/<p[^>]*>\s*<\/p>/g, '');
    // Collapse multiple whitespace/newlines between tags
    processed = processed.replace(/>\s+</g, '><');

    // Handle callout blocks in HTML content (:::type{title="..."}<br>...<br>:::</p>)
    // Must decode &quot; first, then match the pattern
    processed = processed.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

    // Callout styles with Phosphor icons
    const htmlCalloutStyles: Record<
      string,
      { bg: string; border: string; label: string; icon: string }
    > = {
      info: {
        bg: '#dbeafe',
        border: '#3b82f6',
        label: 'Info',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88Zm16-40a8 8 0 0 1-8 8a16 16 0 0 1-16-16v-40a8 8 0 0 1 0-16a16 16 0 0 1 16 16v40a8 8 0 0 1 8 8Zm-32-92a12 12 0 1 1 12 12a12 12 0 0 1-12-12Z"/></svg>',
      },
      warning: {
        bg: '#fef3c7',
        border: '#f59e0b',
        label: 'Warning',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M236.8 188.09L149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19a23.51 23.51 0 0 0 .02-23.72Zm-13.87 15.71a8.5 8.5 0 0 1-7.48 4.2H40.55a8.5 8.5 0 0 1-7.48-4.2a7.59 7.59 0 0 1 0-7.72l87.45-151.87a8.75 8.75 0 0 1 15 0l87.45 151.87a7.59 7.59 0 0 1-.04 7.72ZM120 144v-40a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0Zm20 36a12 12 0 1 1-12-12a12 12 0 0 1 12 12Z"/></svg>',
      },
      danger: {
        bg: '#fee2e2',
        border: '#ef4444',
        label: 'Important',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88Zm-8-80V80a8 8 0 0 1 16 0v56a8 8 0 0 1-16 0Zm20 36a12 12 0 1 1-12-12a12 12 0 0 1 12 12Z"/></svg>',
      },
      success: {
        bg: '#d1fae5',
        border: '#10b981',
        label: 'Success',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M173.66 98.34a8 8 0 0 1 0 11.32l-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 0ZM232 128A104 104 0 1 1 128 24a104.11 104.11 0 0 1 104 104Zm-16 0a88 88 0 1 0-88 88a88.1 88.1 0 0 0 88-88Z"/></svg>',
      },
      note: {
        bg: '#f3f4f6',
        border: '#6b7280',
        label: 'Note',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M208 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h108.69a15.86 15.86 0 0 0 11.31-4.69l49.32-49.32a15.86 15.86 0 0 0 4.68-11.31V48a16 16 0 0 0-16-16Zm0 16v104h-48a8 8 0 0 0-8 8v48H48V48Zm-12.69 120L168 195.31V168Z"/></svg>',
      },
      tip: {
        bg: '#e0e7ff',
        border: '#6366f1',
        label: 'Tip',
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M176 232a8 8 0 0 1-8 8H88a8 8 0 0 1 0-16h80a8 8 0 0 1 8 8Zm40-128a87.55 87.55 0 0 1-33.64 69.21A16.24 16.24 0 0 0 176 186v6a16 16 0 0 1-16 16H96a16 16 0 0 1-16-16v-6a16 16 0 0 0-6.23-12.66A87.59 87.59 0 0 1 40 104.5C39.74 56.83 78.26 17.14 125.88 16A88 88 0 0 1 216 104Zm-16 0a72 72 0 0 0-73.74-72c-39 .92-70.47 33.39-70.26 72.39a71.64 71.64 0 0 0 27.64 56.3A32 32 0 0 1 96 186v6h24v-44.69l-29.66-29.65a8 8 0 0 1 11.32-11.32L128 132.69l26.34-26.35a8 8 0 0 1 11.32 11.32L136 147.31V192h24v-6a32.12 32.12 0 0 1 12.47-25.35A71.65 71.65 0 0 0 200 104Z"/></svg>',
      },
    };

    // Match :::type{title="..."}<br>content<br>:::</p>
    processed = processed.replace(
      /:::(info|warning|danger|success|note|tip)(?:\{title="(.+)"\})?<br\s*\/?>([\s\S]*?)<br\s*\/?>:::(?:<\/p>)?/gi,
      (match, type, title, content) => {
        const style = htmlCalloutStyles[type.toLowerCase()] || htmlCalloutStyles.info;
        const cleanTitle = title?.replace(/\\"/g, '"') || style.label;
        const cleanContent = content
          .replace(/^<\/p>\s*/i, '')
          .replace(/\s*<p>$/i, '')
          .trim();
        return `<div class="callout callout-${type}" style="margin: 16px 0; padding: 16px; background-color: ${style.bg}; border-left: 4px solid ${style.border}; border-radius: 4px;">
<div style="font-weight: bold; margin-bottom: 8px; color: ${style.border};">${style.icon}${cleanTitle}</div>
<div>${cleanContent}</div>
</div>`;
      }
    );

    return processed;
  }

  // Handle fenced code blocks FIRST (before any other processing)
  // Preserves content exactly as-is, prevents other rules from mangling code
  html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) => {
    // Mermaid code blocks in markdown - show placeholder (must use Tiptap MermaidBlock + Export)
    // InfoSec: No fallback to external services - all diagrams must be exported to R2
    if (lang === 'mermaid') {
      console.log('[PDF] Markdown mermaid code block - showing placeholder');
      return `<div class="mermaid-placeholder" style="margin: 20px 0; padding: 20px; border: 2px dashed #f59e0b; border-radius: 8px; text-align: center; color: #92400e; background: #fef3c7;">
        <strong>Diagram not exported</strong><br>
        <span style="font-size: 0.875em;">Use the Mermaid block in the editor and export to R2 before generating PDF.</span>
      </div>`;
    }

    // Regular code blocks - escape HTML entities
    const escapedCode = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .trimEnd();
    const langClass = lang ? ` class="language-${lang}"` : '';
    return `<pre><code${langClass}>${escapedCode}</code></pre>`;
  });

  // Handle page break markers
  // Syntax: <!-- pagebreak --> or :::pagebreak
  html = html.replace(/<!--\s*pagebreak\s*-->/gi, '<div class="page-break"></div>');
  html = html.replace(/^:::pagebreak\s*$/gm, '<div class="page-break"></div>');

  // Handle callout/admonition blocks
  // Syntax: :::type{title="Title"} ... ::: or :::type ... :::
  // Types: info, warning, danger, success, note, tip
  // Using Phosphor-style inline SVG icons for reliable PDF rendering
  const calloutStyles: Record<string, { bg: string; border: string; label: string; icon: string }> =
    {
      info: {
        bg: '#dbeafe',
        border: '#3b82f6',
        label: 'Info',
        // Phosphor Info icon
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88Zm16-40a8 8 0 0 1-8 8a16 16 0 0 1-16-16v-40a8 8 0 0 1 0-16a16 16 0 0 1 16 16v40a8 8 0 0 1 8 8Zm-32-92a12 12 0 1 1 12 12a12 12 0 0 1-12-12Z"/></svg>',
      },
      warning: {
        bg: '#fef3c7',
        border: '#f59e0b',
        label: 'Warning',
        // Phosphor Warning icon
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M236.8 188.09L149.35 36.22a24.76 24.76 0 0 0-42.7 0L19.2 188.09a23.51 23.51 0 0 0 0 23.72A24.35 24.35 0 0 0 40.55 224h174.9a24.35 24.35 0 0 0 21.33-12.19a23.51 23.51 0 0 0 .02-23.72Zm-13.87 15.71a8.5 8.5 0 0 1-7.48 4.2H40.55a8.5 8.5 0 0 1-7.48-4.2a7.59 7.59 0 0 1 0-7.72l87.45-151.87a8.75 8.75 0 0 1 15 0l87.45 151.87a7.59 7.59 0 0 1-.04 7.72ZM120 144v-40a8 8 0 0 1 16 0v40a8 8 0 0 1-16 0Zm20 36a12 12 0 1 1-12-12a12 12 0 0 1 12 12Z"/></svg>',
      },
      danger: {
        bg: '#fee2e2',
        border: '#ef4444',
        label: 'Important',
        // Phosphor WarningCircle icon
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M128 24a104 104 0 1 0 104 104A104.11 104.11 0 0 0 128 24Zm0 192a88 88 0 1 1 88-88a88.1 88.1 0 0 1-88 88Zm-8-80V80a8 8 0 0 1 16 0v56a8 8 0 0 1-16 0Zm20 36a12 12 0 1 1-12-12a12 12 0 0 1 12 12Z"/></svg>',
      },
      success: {
        bg: '#d1fae5',
        border: '#10b981',
        label: 'Success',
        // Phosphor CheckCircle icon
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M173.66 98.34a8 8 0 0 1 0 11.32l-56 56a8 8 0 0 1-11.32 0l-24-24a8 8 0 0 1 11.32-11.32L112 148.69l50.34-50.35a8 8 0 0 1 11.32 0ZM232 128A104 104 0 1 1 128 24a104.11 104.11 0 0 1 104 104Zm-16 0a88 88 0 1 0-88 88a88.1 88.1 0 0 0 88-88Z"/></svg>',
      },
      note: {
        bg: '#f3f4f6',
        border: '#6b7280',
        label: 'Note',
        // Phosphor Note icon
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M208 32H48a16 16 0 0 0-16 16v160a16 16 0 0 0 16 16h108.69a15.86 15.86 0 0 0 11.31-4.69l49.32-49.32a15.86 15.86 0 0 0 4.68-11.31V48a16 16 0 0 0-16-16Zm0 16v104h-48a8 8 0 0 0-8 8v48H48V48Zm-12.69 120L168 195.31V168Z"/></svg>',
      },
      tip: {
        bg: '#e0e7ff',
        border: '#6366f1',
        label: 'Tip',
        // Phosphor Lightbulb icon
        icon: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 256 256" style="vertical-align: middle; margin-right: 8px;"><path fill="currentColor" d="M176 232a8 8 0 0 1-8 8H88a8 8 0 0 1 0-16h80a8 8 0 0 1 8 8Zm40-128a87.55 87.55 0 0 1-33.64 69.21A16.24 16.24 0 0 0 176 186v6a16 16 0 0 1-16 16H96a16 16 0 0 1-16-16v-6a16 16 0 0 0-6.23-12.66A87.59 87.59 0 0 1 40 104.5C39.74 56.83 78.26 17.14 125.88 16A88 88 0 0 1 216 104Zm-16 0a72 72 0 0 0-73.74-72c-39 .92-70.47 33.39-70.26 72.39a71.64 71.64 0 0 0 27.64 56.3A32 32 0 0 1 96 186v6h24v-44.69l-29.66-29.65a8 8 0 0 1 11.32-11.32L128 132.69l26.34-26.35a8 8 0 0 1 11.32 11.32L136 147.31V192h24v-6a32.12 32.12 0 0 1 12.47-25.35A71.65 71.65 0 0 0 200 104Z"/></svg>',
      },
    };

  // Match callout blocks - handles HTML-wrapped format from D1
  // Actual format in D1: :::info{title=&quot;...&quot;}<br>content...</p><ul>...</ul><p>...<br>:::</p>
  // Opening has &quot; for quotes, content spans multiple HTML elements, closing is <br>:::</p>

  // First, decode HTML entities for easier matching
  let processedHtml = html.replace(/&quot;/g, '"').replace(/&amp;/g, '&');

  // Helper function to create callout HTML
  const createCallout = (type: string, title: string | undefined, content: string) => {
    const style = calloutStyles[type] || calloutStyles.info;
    const displayTitle = title || style.label;
    // Clean up content - remove leading/trailing p tags, keep internal HTML structure
    const cleanContent = content
      .replace(/^<\/p>\s*/i, '') // Remove closing p tag at start (from split)
      .replace(/\s*<p>$/i, '') // Remove opening p tag at end (before :::)
      .replace(/^<br\s*\/?>/i, '') // Remove leading br
      .replace(/<br\s*\/?>$/i, '') // Remove trailing br
      .trim();
    return `<div class="callout callout-${type}" style="margin: 16px 0; padding: 16px; background-color: ${style.bg}; border-left: 4px solid ${style.border}; border-radius: 4px;">
<div style="font-weight: bold; margin-bottom: 8px; color: ${style.border};">${style.icon}${displayTitle}</div>
<div>${cleanContent}</div>
</div>`;
  };

  // Match pattern: :::type{title="..."}<br> ... <br>:::
  // The content between can include any HTML (p, ul, li, etc.)
  // Title uses GREEDY .+ to handle embedded quotes like "What is "Zero Knowledge"?"
  processedHtml = processedHtml.replace(
    /:::(info|warning|danger|success|note|tip)(?:\{title="(.+)"\})?<br\s*\/?>([\s\S]*?)<br\s*\/?>:::(?:<\/p>)?/gi,
    (match, type, title, content) => {
      // Clean up escaped quotes in title
      const cleanTitle = title?.replace(/\\"/g, '"');
      return createCallout(type.toLowerCase(), cleanTitle, content);
    }
  );

  // Also handle pure markdown format (for content not from D1)
  processedHtml = processedHtml.replace(
    /^:::(info|warning|danger|success|note|tip)(?:\{title="(.+)"\})?\s*\n([\s\S]*?)^:::\s*$/gm,
    (match, type, title, content) => {
      const cleanTitle = title?.replace(/\\"/g, '"');
      return createCallout(type.toLowerCase(), cleanTitle, content);
    }
  );

  html = processedHtml;

  // Handle images BEFORE escaping (images need their URLs intact)
  // Replace markdown images with HTML img tags
  // For /api/diagrams/* URLs, use resolved inline SVG if available
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, url) => {
    // Check if we have an inline SVG for this URL
    if (imageResolver && imageResolver.has(url)) {
      const svgContent = imageResolver.get(url)!;
      return `<div style="margin: 20px 0; text-align: center;"><div class="diagram-container">${svgContent}</div></div>`;
    }
    // For external URLs or when no resolver, use img tag with absolute URL
    const absoluteUrl = url.startsWith('/') ? `https://hanawa.esolia.co.jp${url}` : url;
    return `<img src="${absoluteUrl}" alt="${alt}" style="max-width: 100%; height: auto; margin: 20px 0;">`;
  });

  // Escape HTML entities (prevent XSS in case output is ever displayed)
  // InfoSec: HTML entity encoding (OWASP A03)
  // Note: We must NOT escape the already-converted img/div tags
  // So we only escape content outside of HTML tags
  html = html.replace(/&(?![a-z]+;|#\d+;)/g, '&amp;');
  // Don't escape < and > as we have valid HTML tags now

  // Headers (must be at start of line)
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  // Bold and italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code (single backticks, but not inside <pre> blocks)
  // Match `code` but avoid matching inside already-processed <pre><code> blocks
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // Links (after images, so we don't double-process)
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr>');
  html = html.replace(/^\*\*\*$/gm, '<hr>');

  // Unordered lists
  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');

  // Ordered lists
  html = html.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');

  // Normalize: remove ALL blank lines between <li> tags (even with whitespace)
  // This handles markdown with blank lines between list items
  html = html.replace(/<\/li>\s*\n\s*\n+\s*<li>/g, '</li>\n<li>');

  // Also normalize blank lines BEFORE first <li> (after heading)
  html = html.replace(/(<\/h[1-6]>)\s*\n\s*\n+\s*(<li>)/g, '$1\n$2');

  // Wrap consecutive <li> tags in <ul>
  html = html.replace(/(<li>[\s\S]*?<\/li>\s*)+/g, (match) => {
    // Clean up the match - remove extra whitespace between items
    const cleaned = match.replace(/(<\/li>)\s+(<li>)/g, '$1$2');
    return '<ul>' + cleaned + '</ul>';
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
        trimmed.startsWith('<div') ||
        trimmed.startsWith('<pre')
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
  pageBreakBefore?: boolean;
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

    // Initialize forms - convert null to empty string for optional fields
    const saveForm = await superValidate(
      {
        title: result.title,
        title_ja: result.title_ja || '',
        client_code: result.client_code || '',
        client_name: result.client_name || '',
        client_name_ja: result.client_name_ja || '',
        contact_name: result.contact_name || '',
        contact_name_ja: result.contact_name_ja || '',
        scope: result.scope || '',
        scope_ja: result.scope_ja || '',
        language_mode: result.language_mode as 'en' | 'ja' | 'both_en_first' | 'both_ja_first',
        fragments: result.fragments || '',
        cover_letter_en: result.cover_letter_en || '',
        cover_letter_ja: result.cover_letter_ja || '',
      },
      zod4(saveDocumentSchema)
    );
    const updateStatusForm = await superValidate(zod4(updateDocumentStatusSchema));
    const deleteForm = await superValidate(zod4(deleteDocumentSchema));

    return {
      proposal: result,
      fragments,
      fragmentContents,
      availableFragments,
      boilerplates,
      saveForm,
      updateStatusForm,
      deleteForm,
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
      const saveForm = await superValidate(request, zod4(saveDocumentSchema));
      saveForm.message = 'Database not available';
      return fail(500, { saveForm });
    }

    const db = platform.env.DB;

    // InfoSec: Validate form input (OWASP A03)
    const saveForm = await superValidate(request, zod4(saveDocumentSchema));

    if (!saveForm.valid) {
      return fail(400, { saveForm });
    }

    const {
      title,
      title_ja,
      client_code,
      client_name,
      client_name_ja,
      contact_name,
      contact_name_ja,
      scope,
      scope_ja,
      language_mode,
      fragments,
      cover_letter_en,
      cover_letter_ja,
    } = saveForm.data;

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
          client_code || '',
          client_name || null,
          client_name_ja || null,
          contact_name || null,
          contact_name_ja || null,
          title,
          title_ja || null,
          scope || null,
          scope_ja || null,
          language_mode,
          fragments || '[]',
          cover_letter_en || null,
          cover_letter_ja || null,
          params.id
        )
        .run();

      return { saveForm, success: true };
    } catch (err) {
      console.error('Failed to update proposal:', err);
      saveForm.message = 'Failed to update proposal';
      return fail(500, { saveForm });
    }
  },

  // Update workflow status
  updateStatus: async ({ params, request, platform }) => {
    if (!platform?.env?.DB) {
      const updateStatusForm = await superValidate(request, zod4(updateDocumentStatusSchema));
      updateStatusForm.message = 'Database not available';
      return fail(500, { updateStatusForm });
    }

    const db = platform.env.DB;

    // InfoSec: Validate form input (OWASP A03)
    const updateStatusForm = await superValidate(request, zod4(updateDocumentStatusSchema));

    if (!updateStatusForm.valid) {
      return fail(400, { updateStatusForm });
    }

    const { status, review_notes } = updateStatusForm.data;

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
          .bind(status, review_notes || null, params.id)
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

      return { updateStatusForm, success: true };
    } catch (err) {
      console.error('Failed to update status:', err);
      updateStatusForm.message = 'Failed to update status';
      return fail(500, { updateStatusForm });
    }
  },

  // Generate PDF
  generatePdf: async ({ params, request, platform }) => {
    if (!platform?.env?.DB) {
      return fail(500, { error: 'Database not available' });
    }

    const db = platform.env.DB;
    const pdfService = platform.env.PDF_SERVICE;

    if (!pdfService) {
      return fail(500, { error: 'PDF service not configured' });
    }

    // Helper: Retry D1 operations on timeout
    // InfoSec: Only retries on timeout errors, not on other failures
    async function withRetry<T>(
      operation: () => Promise<T>,
      maxRetries = 2,
      label = 'DB operation'
    ): Promise<T> {
      let lastError: Error | null = null;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          return await operation();
        } catch (err) {
          lastError = err as Error;
          const isTimeout =
            lastError.message?.includes('timeout') || lastError.message?.includes('D1_ERROR');
          if (!isTimeout || attempt === maxRetries) {
            throw lastError;
          }
          console.warn(`${label}: Attempt ${attempt} failed with timeout, retrying...`);
          // Brief delay before retry
          await new Promise((resolve) => setTimeout(resolve, 100 * attempt));
        }
      }
      throw lastError;
    }

    try {
      // Parse enabled fragment IDs from form (passed from client to avoid re-parsing)
      const formData = await request.formData();
      const enabledFragmentIdsJson = formData.get('enabled_fragment_ids') as string;

      let enabledFragments: Array<{ id: string; pageBreakBefore?: boolean }> = [];
      try {
        const parsed = JSON.parse(enabledFragmentIdsJson || '[]');
        if (Array.isArray(parsed) && parsed.length > 0) {
          enabledFragments = parsed;
        }
      } catch {
        // Fall back to loading from database if client data is invalid
        console.warn('generatePdf: Invalid enabled_fragment_ids, will parse from DB');
      }

      // First, always load the proposal (needed for fallback and cover letters)
      const proposal = await withRetry(
        () => db.prepare('SELECT * FROM proposals WHERE id = ?').bind(params.id).first<Proposal>(),
        2,
        'Load proposal'
      );

      if (!proposal) {
        return fail(404, { error: 'Proposal not found' });
      }

      // If no fragment config from client, fall back to parsing from proposal
      if (enabledFragments.length === 0) {
        try {
          const fragments: Fragment[] = JSON.parse(proposal.fragments || '[]');
          enabledFragments = fragments
            .filter((f) => f.enabled)
            .sort((a, b) => a.order - b.order)
            .map((f) => ({ id: f.id, pageBreakBefore: f.pageBreakBefore }));
          console.log('generatePdf: Parsed fragments from proposal:', enabledFragments.length);
        } catch {
          enabledFragments = [];
        }
      }

      // Now fetch fragment contents with the correct IDs
      // InfoSec: Parameterized queries (OWASP A03)
      const enabledFragmentIds = enabledFragments.map((f) => f.id);
      let fragmentContents: FragmentContent[] = [];

      if (enabledFragmentIds.length > 0) {
        fragmentContents = await withRetry(
          async () => {
            const placeholders = enabledFragmentIds.map(() => '?').join(',');
            const result = await db
              .prepare(
                `SELECT id, name, slug, category, content_en, content_ja
                 FROM fragments
                 WHERE id IN (${placeholders})`
              )
              .bind(...enabledFragmentIds)
              .all<FragmentContent>();
            return result.results ?? [];
          },
          2,
          'Load fragments'
        );
        console.log('generatePdf: Loaded fragment contents:', fragmentContents.length);
      }

      // Build content map for ordering
      const contentMap = new Map(fragmentContents.map((f) => [f.id, f]));

      // Fetch diagram SVGs from R2 for inline embedding in PDF
      // This resolves /api/diagrams/* URLs to actual SVG content
      const imageResolver = new Map<string, string>();
      if (platform.env.R2) {
        // Step 1: Discover nested fragment references and fetch from D1
        // Scan cover letters and fragment content for fragment references
        const coverLettersToScan = [proposal.cover_letter_en, proposal.cover_letter_ja]
          .filter(Boolean)
          .join('\n');
        const fragmentContentToScan = fragmentContents
          .map((f) => [f.content_en, f.content_ja].filter(Boolean).join('\n'))
          .join('\n');

        const fragmentRefRegex = /data-fragment-id=["']([^"']+)["']/gi;
        let fragmentRefMatch;
        const referencedFragmentIds = new Set<string>();

        while ((fragmentRefMatch = fragmentRefRegex.exec(coverLettersToScan)) !== null) {
          referencedFragmentIds.add(fragmentRefMatch[1]);
        }
        fragmentRefRegex.lastIndex = 0;
        while ((fragmentRefMatch = fragmentRefRegex.exec(fragmentContentToScan)) !== null) {
          referencedFragmentIds.add(fragmentRefMatch[1]);
        }

        // InfoSec: Parameterized query for D1 fragment fetch (OWASP A03)
        if (referencedFragmentIds.size > 0) {
          const existingIds = new Set(fragmentContents.map((f) => f.id));
          const missingIds = Array.from(referencedFragmentIds).filter((id) => !existingIds.has(id));
          if (missingIds.length > 0) {
            const placeholders = missingIds.map(() => '?').join(',');
            const additionalFragments = await db
              .prepare(
                `SELECT id, name, slug, category, content_en, content_ja
                 FROM fragments
                 WHERE id IN (${placeholders})`
              )
              .bind(...missingIds)
              .all<FragmentContent>();
            if (additionalFragments.results) {
              fragmentContents.push(...additionalFragments.results);
              for (const f of additionalFragments.results) {
                contentMap.set(f.id, f);
              }
              console.log(
                `PDF: Loaded ${additionalFragments.results.length} additional fragments from references`
              );
            }
          }
        }

        // Step 2: Collect all SVG paths from data-svg-path attributes
        // Single source of truth: scan ALL content (fragments + cover letters)
        const svgPathRegex = /data-svg-path=["']([^"']+)["']/gi;
        const diagramEntries = new Map<string, string>(); // url → r2Key

        const allContentToScan = [
          ...fragmentContents.flatMap((f) => [f.content_en, f.content_ja]),
          proposal.cover_letter_en,
          proposal.cover_letter_ja,
        ]
          .filter(Boolean)
          .join('\n');

        let match;
        while ((match = svgPathRegex.exec(allContentToScan)) !== null) {
          const svgPath = match[1]; // "diagrams/mermaid-xxx.svg"
          const id = svgPath.replace('diagrams/', '').replace('.svg', '');
          const url = `/api/diagrams/${id}`;
          diagramEntries.set(url, svgPath);
        }

        // Also scan for <img src="/api/diagrams/xxx"> or markdown ![](/api/diagrams/xxx)
        // (These come from inline content, not mermaid blocks)
        const imgRegex = /(?:src=["']|!\[[^\]]*\]\()(\/api\/diagrams\/([^"')]+))/gi;
        while ((match = imgRegex.exec(allContentToScan)) !== null) {
          const url = match[1];
          const id = match[2];
          const r2Key = `diagrams/${id.endsWith('.svg') ? id : id + '.svg'}`;
          diagramEntries.set(url, r2Key);
        }

        console.log(`PDF: Diagram SVGs to fetch: ${diagramEntries.size}`);

        // Step 3: Fetch all SVGs from R2 in parallel
        const fetches = [...diagramEntries.entries()].map(async ([url, r2Key]) => {
          const cleanKey = r2Key.endsWith('.svg') ? r2Key : `${r2Key}.svg`;
          try {
            const object = await platform.env.R2.get(cleanKey);
            if (object) {
              let svg = await object.text();
              // Strip font-family so the SVG inherits IBM Plex Sans JP from page CSS
              svg = svg.replace(/font-family\s*:\s*[^;}\n]+[;]?/gi, '');
              svg = svg.replace(/\s*font-family="[^"]*"/gi, '');
              svg = svg.replace(/\s*font-family='[^']*'/gi, '');
              // Fix: Convert foreignObject cluster labels to SVG <text> elements.
              // Cloudflare Browser Rendering doesn't render foreignObject in cluster-label
              // groups when printing to PDF, so we replace them with native SVG text.
              svg = svg.replace(
                /<g class="cluster-label" transform="translate\(([^,]+),\s*(\d+)\)">\s*<foreignObject[^>]*>[\s\S]*?<span class="nodeLabel">(?:<p>)?([\s\S]*?)(?:<\/p>)?<\/span>[\s\S]*?<\/foreignObject>\s*<\/g>/gi,
                (_, x, y, text) => {
                  const cleanText = text.replace(/<[^>]+>/g, '').trim();
                  if (!cleanText) return '';
                  const textY = parseFloat(y) + 16;
                  return `<g class="cluster-label" transform="translate(${x}, ${y})"><text x="0" y="${textY}" fill="#333" font-size="13px" font-weight="600">${cleanText}</text></g>`;
                }
              );
              // Clean SVG root: remove width and Mermaid inline style
              // viewBox provides intrinsic dimensions for <img> data URI
              svg = svg.replace(/(<svg\b[^>]*?)\s+width=["'][^"']*["']/, '$1');
              svg = svg.replace(/(<svg\b[^>]*?)\s+style=["'][^"']*["']/, '$1');
              console.log(`PDF: Loaded ${r2Key}`);
              return { url, svg };
            }
          } catch (err) {
            console.warn(`PDF: Failed to fetch ${r2Key}:`, err);
          }
          return null;
        });

        for (const result of await Promise.all(fetches)) {
          if (result) imageResolver.set(result.url, result.svg);
        }

        // Convert diagram SVGs to data URI <img> tags for centering.
        // Only <img> tags center correctly in CF Browser Rendering print mode.
        // Inline SVGs ignore all CSS centering (margin:auto, flexbox, text-align, etc.)
        // Font: sans-serif only (data URI <img> sandboxes SVG from page fonts)
        if (imageResolver.size > 0) {
          const CHUNK_SIZE = 8192;
          for (const [url, svg] of imageResolver) {
            // Set explicit sans-serif font stack with Japanese-capable fonts.
            // CF Browser Rendering = headless Chromium on Linux, likely has Noto fonts.
            // Data URI <img> is sandboxed from page fonts, so we must name fonts explicitly.
            // overflow:visible on foreignObject prevents text clipping when Noto is
            // slightly wider than the font Mermaid used to calculate box widths.
            const svgWithFont = svg.replace(
              /(<svg\b[^>]*>)/,
              `$1<defs><style>*{font-family:'Noto Sans CJK JP','Noto Sans JP','Hiragino Kaku Gothic ProN',Meiryo,sans-serif!important;}foreignObject{overflow:visible!important;}foreignObject div,foreignObject span,foreignObject body{overflow:visible!important;}</style></defs>`
            );
            // Encode Unicode SVG to base64 data URI
            const encoder = new TextEncoder();
            const svgBytes = encoder.encode(svgWithFont);
            const chunks: string[] = [];
            for (let i = 0; i < svgBytes.length; i += CHUNK_SIZE) {
              const chunk = svgBytes.subarray(i, Math.min(i + CHUNK_SIZE, svgBytes.length));
              chunks.push(String.fromCharCode(...chunk));
            }
            const svgBase64 = btoa(chunks.join(''));
            const imgTag = `<img src="data:image/svg+xml;base64,${svgBase64}" style="max-width: 90%; height: auto;" alt="Diagram">`;
            imageResolver.set(url, imgTag);
          }
          console.log(`PDF: Converted ${imageResolver.size} diagrams to data URI <img> tags`);
        }
      }

      // Determine language mode and primary language
      const langMode = proposal.language_mode || 'en';
      const isBilingual = langMode.startsWith('both_');
      const firstLang = langMode === 'both_ja_first' ? 'ja' : 'en';
      const _secondLang = firstLang === 'en' ? 'ja' : 'en'; // Reserved for future bilingual enhancements
      void _secondLang; // Suppress unused warning
      const primaryLang = isBilingual ? firstLang : langMode === 'ja' ? 'ja' : 'en';

      console.log(`PDF: langMode="${langMode}", isBilingual=${isBilingual}`);

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
          // Resolve fragment references (e.g., <div data-fragment-id="xxx">) to actual content
          const resolvedCoverLetter = resolveFragmentReferences(
            coverLetter,
            contentMap,
            imageResolver,
            lang
          );
          // page-break-after: always ensures cover letter gets its own page
          section += `<div class="cover-letter">${resolvedCoverLetter}</div>\n`;
        } else if (!isBilingual && proposalData.custom_sections) {
          // Fall back to custom_sections for single-language proposals
          section += `<div class="cover-letter">${markdownToHtml(proposalData.custom_sections, imageResolver)}</div>\n`;
        }

        // Scope (use language-specific scope)
        // Wrapped in scope-section class to ensure it starts on a new page
        const scopeContent =
          lang === 'ja' ? proposalData.scope_ja || proposalData.scope : proposalData.scope;
        if (scopeContent) {
          section += `<div class="scope-section">\n<h2>${lang === 'ja' ? 'スコープ' : 'Scope'}</h2>\n<p>${scopeContent}</p>\n</div>\n`;
        }

        // Fragments in order (with page break support)
        for (const frag of enabledFragments) {
          const content = contentMap.get(frag.id);
          if (content) {
            // Add page break before this fragment if flagged
            if (frag.pageBreakBefore) {
              section += '<div class="page-break"></div>\n';
            }

            // Check if this is a diagram fragment (SVG stored in R2)
            // Single source of truth: data-svg-path attribute in fragment content
            if (content.category === 'diagrams') {
              const svgPaths = extractSvgPathsFromFragment(content, lang);
              if (svgPaths.length === 0) {
                console.error(`PDF buildSection: No data-svg-path for ${frag.id} (lang=${lang})`);
                section += `<div class="diagram-placeholder" style="margin: 20px 0; padding: 20px; border: 2px dashed #fbbf24; text-align: center; color: #92400e; background: #fef3c7;">
                  <p><strong>${content.name}</strong></p>
                  <p style="font-size: 0.875em;">Diagram not exported to R2</p>
                </div>\n`;
                continue;
              }

              const svgPath = svgPaths[0];
              const id = svgPath.replace('diagrams/', '').replace('.svg', '');
              const svgContent = imageResolver.get(`/api/diagrams/${id}`);
              if (svgContent) {
                console.log(`PDF buildSection: Resolved ${frag.id} via data-svg-path: ${svgPath}`);
                section += `<div style="text-align: center; margin: 20px 0;">${svgContent}</div>\n`;
              } else {
                console.error(`PDF buildSection: SVG not in R2: ${svgPath}`);
                section += `<div class="diagram-placeholder" style="margin: 20px 0; padding: 20px; border: 2px dashed #f87171; text-align: center; color: #b91c1c; background: #fef2f2;">
                  <p><strong>${content.name}</strong></p>
                  <p style="font-size: 0.875em;">SVG not found in R2: ${svgPath}</p>
                </div>\n`;
              }
            } else {
              // Regular fragment with text/HTML content
              const fragContent =
                lang === 'ja' && content.content_ja ? content.content_ja : content.content_en;
              if (fragContent) {
                // Resolve nested fragment references before converting to HTML
                const resolvedContent = resolveFragmentReferences(
                  fragContent,
                  contentMap,
                  imageResolver,
                  lang
                );
                section += markdownToHtml(resolvedContent, imageResolver) + '\n';
              }
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

      // Self-hosted fonts from R2 - MUST match bilingual.ts TOC exactly (which works!)
      const fontBaseUrl = 'https://pub-f1629ddc1be440d2ab0eb2fa9b5c84ef.r2.dev/fonts';
      const fontLinks = `
  <style>
    @font-face {
      font-family: 'IBM Plex Sans JP';
      font-style: normal;
      font-weight: 400;
      font-display: block;
      src: url('${fontBaseUrl}/IBMPlexSansJP-Regular.woff2') format('woff2');
    }
    @font-face {
      font-family: 'IBM Plex Sans JP';
      font-style: normal;
      font-weight: 500;
      font-display: block;
      src: url('${fontBaseUrl}/IBMPlexSansJP-Medium.woff2') format('woff2');
    }
    @font-face {
      font-family: 'IBM Plex Sans JP';
      font-style: normal;
      font-weight: 600;
      font-display: block;
      src: url('${fontBaseUrl}/IBMPlexSansJP-SemiBold.woff2') format('woff2');
    }
    @font-face {
      font-family: 'IBM Plex Sans JP';
      font-style: normal;
      font-weight: 700;
      font-display: block;
      src: url('${fontBaseUrl}/IBMPlexSansJP-Bold.woff2') format('woff2');
    }
  </style>`;

      // Shared CSS styles for all PDFs
      // A4 is 210mm x 297mm, with 12mm margins = 186mm content width
      const pdfStyles = `
    body {
      font-family: 'IBM Plex Sans JP', sans-serif;
      line-height: 1.5;
      color: #2D2F63;
      max-width: 100%;
      margin: 0;
      padding: 20px;
      font-size: 10.5pt;
    }
    p { margin: 0.5em 0; }
    p:empty { display: none; }
    h1 { color: #2D2F63; border-bottom: 2px solid #FFBC68; padding-bottom: 10px; margin-top: 0; }
    h2 { color: #2D2F63; margin-top: 1.3em; margin-bottom: 0.4em; }
    h3 { color: #4a4c7a; margin-top: 0.9em; margin-bottom: 0.3em; }
    /* Reduce gap when heading immediately precedes list */
    h2 + ul, h2 + ol, h3 + ul, h3 + ol { margin-top: 0.25em; }
    table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
    th, td { border: 1px solid #ddd; padding: 5px 8px; text-align: left; }
    th { background-color: #f5f5f5; }
    /* Compact list styling - balanced */
    ul, ol { margin: 0.4em 0; padding-left: 1.5em; }
    li { margin: 0.15em 0; padding: 0; line-height: 1.4; }
    li p { margin: 0; padding: 0; display: inline; }
    ul ul, ol ol, ul ol, ol ul { margin: 0.2em 0; }
    ul li, ol li { margin-bottom: 0.15em; }
    strong { color: #2D2F63; }
    hr { border: none; border-top: 1px solid #ddd; margin: 1em 0; }
    a { color: #2D2F63; }
    /* Code styling - override the wildcard rule */
    code, pre, pre code { font-family: 'IBM Plex Mono', monospace !important; font-size: 0.9em; background-color: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
    pre { background-color: #f5f5f5; border: 1px solid #ddd; border-radius: 4px; padding: 12px; overflow-x: auto; margin: 0.8em 0; page-break-inside: avoid; }
    pre code { background-color: transparent; padding: 0; border-radius: 0; font-size: 9pt; line-height: 1.4; display: block; white-space: pre-wrap; word-wrap: break-word; }
    /* Page break support */
    .page-break { page-break-before: always; break-before: page; height: 0; margin: 0; padding: 0; }
    .logo { margin-bottom: 20px; }
    .header { margin-bottom: 25px; }
    .client-name { font-size: 1.05em; color: #666; margin-top: 8px; }
    .cover-letter { margin-bottom: 15px; page-break-after: always; }
    .cover-letter p { margin: 0.4em 0; }
    .scope-section { margin-top: 0; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #ddd; font-size: 0.9em; color: #666; display: flex; justify-content: space-between; align-items: center; }
    h2 { page-break-before: auto; page-break-after: avoid; }
    h3 { page-break-after: avoid; }
    ul, ol, table { page-break-inside: avoid; }
    /* Diagram SVGs fill their wrapper div, which is centered via margin: auto */
    @media print { body { padding: 0; } .logo { margin-bottom: 15px; } }
      `.trim();

      // Helper: Build complete single-language HTML document
      function buildSingleLanguageHtml(lang: 'en' | 'ja'): string {
        const contactName =
          lang === 'ja'
            ? proposalData.contact_name_ja || proposalData.contact_name
            : proposalData.contact_name;
        const clientName =
          lang === 'ja'
            ? proposalData.client_name_ja || proposalData.client_name
            : proposalData.client_name;
        const title =
          lang === 'ja' && proposalData.title_ja ? proposalData.title_ja : proposalData.title;
        const dateFormatted = lang === 'ja' ? dateFormattedJa : dateFormattedEn;
        const confidential = lang === 'ja' ? '機密' : 'Confidential';

        return `<!DOCTYPE html>
<html lang="${lang}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  ${fontLinks}
  <style>
    /* Hide body until fonts are loaded */
    body { opacity: 0; }
    body.fonts-loaded { opacity: 1; }
    ${pdfStyles}
  </style>
</head>
<body>
  <!-- Hidden element to force font loading with Japanese characters -->
  <div style="position:absolute;left:-9999px;font-family:'IBM Plex Sans JP'">
    日本語フォント読み込みテスト用テキスト。これはPDF生成時にフォントを正しく読み込むためのダミーテキストです。
  </div>
  <script>
    // Wait for fonts then show content
    document.fonts.ready.then(function() {
      document.body.classList.add('fonts-loaded');
    });
  </script>
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
              clientNameEn:
                [proposal.contact_name, proposal.client_name].filter(Boolean).join(', ') ||
                undefined,
              clientNameJa:
                [
                  proposal.contact_name_ja || proposal.contact_name,
                  proposal.client_name_ja || proposal.client_name,
                ]
                  .filter(Boolean)
                  .join(', ') || undefined,
              dateEn: dateFormattedEn,
              dateJa: dateFormattedJa,
            },
            options: {
              displayHeaderFooter: true,
              headerTemplate: '<div></div>',
              footerTemplate,
              margin: { top: '15mm', right: '12mm', bottom: '20mm', left: '12mm' },
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
        const bilingualResult = (await bilingualResponse.json()) as {
          combined: string;
          english: string;
          japanese: string;
          pageInfo: {
            tocPages: number;
            englishPages: number;
            japanesePages: number;
            totalPages: number;
          };
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
          // Use "general" folder for non-personalized documents (empty client_code)
          const clientFolder = proposal.client_code || 'general';
          const basePath = `proposals/${clientFolder}/${proposal.id}`;
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
        const contactName =
          primaryLang === 'ja'
            ? proposal.contact_name_ja || proposal.contact_name
            : proposal.contact_name;
        const clientName =
          primaryLang === 'ja'
            ? proposal.client_name_ja || proposal.client_name
            : proposal.client_name;

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
  ${fontLinks}
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
            subject:
              proposal.client_name || proposal.client_code
                ? `Proposal for ${proposal.client_name || proposal.client_code}`
                : proposal.title,
            provenance,
            // PDF rendering options
            displayHeaderFooter: true,
            headerTemplate: '<div></div>', // Empty header
            footerTemplate,
            margin: { top: '15mm', right: '12mm', bottom: '20mm', left: '12mm' },
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
        // Use "general" folder for non-personalized documents (empty client_code)
        const clientFolder = proposal.client_code || 'general';
        r2Key = `proposals/${clientFolder}/${proposal.id}.pdf`;
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

    // Get selected PDFs (checkboxes with name="share_pdfs")
    const sharePdfs = formData.getAll('share_pdfs').map((v) => v.toString());
    if (sharePdfs.length === 0) {
      return fail(400, { error: 'Select at least one PDF to share' });
    }

    // Get recipient emails (textarea, one per line or comma-separated)
    const recipientEmailsRaw = formData.get('recipient_emails')?.toString().trim() || '';
    const expiresInDays = parseInt(formData.get('expires_in_days')?.toString() || '7', 10);

    // Parse emails: split by newlines and commas, trim whitespace, filter empty
    const recipientEmails = recipientEmailsRaw
      .split(/[\n,]+/)
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (recipientEmails.length === 0) {
      return fail(400, { error: 'At least one recipient email is required' });
    }

    // InfoSec: Validate all email addresses (OWASP A03)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = recipientEmails.filter((e) => !emailRegex.test(e));
    if (invalidEmails.length > 0) {
      return fail(400, { error: `Invalid email address(es): ${invalidEmails.join(', ')}` });
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

      // Build list of R2 keys for selected PDFs
      const pdfKeys: { type: string; key: string }[] = [];
      if (sharePdfs.includes('combined') && proposal.pdf_r2_key) {
        pdfKeys.push({ type: 'combined', key: proposal.pdf_r2_key });
      }
      if (sharePdfs.includes('english') && proposal.pdf_r2_key_en) {
        pdfKeys.push({ type: 'english', key: proposal.pdf_r2_key_en });
      }
      if (sharePdfs.includes('japanese') && proposal.pdf_r2_key_ja) {
        pdfKeys.push({ type: 'japanese', key: proposal.pdf_r2_key_ja });
      }

      if (pdfKeys.length === 0) {
        return fail(400, { error: 'Selected PDFs are not available' });
      }

      // InfoSec: Generate secure PIN using crypto.getRandomValues (OWASP A02)
      const array = new Uint32Array(1);
      crypto.getRandomValues(array);
      const pin = String(100000 + (array[0] % 900000));

      // Calculate expiry
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expiresInDays);

      // Generate share ID using crypto
      const idArray = new Uint8Array(8);
      crypto.getRandomValues(idArray);
      const shareId = `share_${Date.now()}_${Array.from(idArray)
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('')
        .substring(0, 8)}`;

      // Build share URL (Courier format)
      const shareUrl = `https://courier.esolia.co.jp/s/${shareId}`;

      // TODO: Call Courier API to create share with multiple recipients and PDFs
      // For now, store the share info locally
      // In production, this would call the Nexus/Courier API

      // Update proposal with share info
      // Store recipients as JSON array for multiple recipients
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
          JSON.stringify(recipientEmails), // Store as JSON array
          JSON.stringify(pdfKeys.map((p) => p.type)), // Store selected PDF types
          expiresAt.toISOString(),
          params.id
        )
        .run();

      return {
        success: true,
        message: `Share link created for ${recipientEmails.length} recipient(s)`,
        shareUrl,
        pin,
        recipients: recipientEmails,
        pdfs: pdfKeys.map((p) => p.type),
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

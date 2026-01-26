#!/usr/bin/env npx tsx
/**
 * Import a single YAML fragment into D1 database
 * Usage: npx tsx scripts/import-single-fragment.ts <fragment-path>
 *
 * This generates SQL for a single fragment that can be applied to D1.
 *
 * Converts markdown to Tiptap-compatible HTML:
 * - Blockquote callouts (> **ℹ️ Title**) → <div data-callout-type="...">
 * - Mermaid code blocks → <div data-type="mermaidBlock" data-source="...">
 * - Standard markdown → HTML via marked
 */

import { readFileSync, writeFileSync } from 'fs';
import { basename } from 'path';
import { parse } from 'yaml';
import { marked, type Tokens } from 'marked';

interface YamlFragment {
  id: string;
  category?: string;
  version?: string;
  title: { en?: string; ja?: string };
  type?: string;
  tags?: string[];
  status?: string;
  content: { en?: string; ja?: string };
}

interface DbFragment {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  content_en: string | null;
  content_ja: string | null;
  is_bilingual: number;
  tags: string;
  version: string;
  status: string;
}

function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

function escapeHtmlAttr(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Emoji to callout type mapping
const emojiToType: Record<string, string> = {
  ℹ️: 'info',
  '⚠️': 'warning',
  '🚨': 'danger',
  '✅': 'success',
  '📝': 'note',
  '💡': 'tip',
};

/**
 * Pre-process markdown to convert blockquote callouts BEFORE marked processing.
 * This replaces blockquote callouts with a placeholder that won't be touched by marked.
 */
function preprocessBlockquoteCallouts(markdown: string): {
  content: string;
  callouts: Map<string, string>;
} {
  const callouts = new Map<string, string>();
  let calloutIndex = 0;

  // Match blockquote callouts: > **ℹ️ Title**\n> content
  // Capture any emoji at the start, then validate against known emojis
  const blockquoteCalloutRegex = /^> \*\*(.+?)\s+(.+?)\*\*\n((?:> ?.*\n?)*)/gm;

  const processed = markdown.replace(
    blockquoteCalloutRegex,
    (match, possibleEmoji: string, title: string, content: string) => {
      // Check if first part is a known emoji
      const emoji = possibleEmoji.trim();
      const type = emojiToType[emoji];
      if (!type) {
        // Not a callout emoji, return original
        return match;
      }

      // Remove leading "> " from each content line
      const cleanContent = content
        .split('\n')
        .map((line: string) => line.replace(/^> ?/, ''))
        .join('\n')
        .trim();

      // Create Tiptap callout HTML
      // Convert the inner content to HTML (simple conversion for callout content)
      const innerHtml = convertSimpleMarkdownToHtml(cleanContent);

      const calloutHtml = `<div data-callout-type="${type}" data-callout-title="${escapeHtmlAttr(title.trim())}" class="callout callout-${type} border-l-4 p-4 my-4 rounded-r"><div class="callout-title font-semibold mb-2">${title.trim()}</div><div class="callout-content">${innerHtml}</div></div>`;

      // Use a placeholder to protect from marked processing
      const placeholder = `<!--CALLOUT_PLACEHOLDER_${calloutIndex}-->`;
      callouts.set(placeholder, calloutHtml);
      calloutIndex++;

      return placeholder + '\n';
    }
  );

  return { content: processed, callouts };
}

/**
 * Convert simple markdown to HTML (for callout content)
 */
function convertSimpleMarkdownToHtml(md: string): string {
  let html = md;

  // Convert bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Convert italic (single asterisk, but not inside bold)
  html = html.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');

  // Convert inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Convert unordered lists
  const lines = html.split('\n');
  const result: string[] = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      continue;
    }

    const listMatch = trimmed.match(/^[-*] (.+)$/);
    if (listMatch) {
      if (!inList) {
        result.push('<ul>');
        inList = true;
      }
      result.push(`<li>${listMatch[1]}</li>`);
    } else {
      if (inList) {
        result.push('</ul>');
        inList = false;
      }
      // Wrap in <p> if it's plain text
      if (!trimmed.startsWith('<')) {
        result.push(`<p>${trimmed}</p>`);
      } else {
        result.push(trimmed);
      }
    }
  }

  if (inList) {
    result.push('</ul>');
  }

  return result.join('\n');
}

/**
 * Custom marked renderer for Tiptap-compatible HTML
 */
function createTiptapRenderer(): marked.Renderer {
  const renderer = new marked.Renderer();

  // Handle code blocks - convert mermaid to Tiptap mermaid block
  renderer.code = function ({ text, lang }: Tokens.Code): string {
    if (lang === 'mermaid') {
      // Create Tiptap mermaid block HTML
      const escapedSource = escapeHtmlAttr(text);
      return `<div data-type="mermaidBlock" data-source="${escapedSource}" class="mermaid-block"><div class="mermaid-diagram"></div></div>\n`;
    }

    // Regular code block
    const langClass = lang ? ` class="language-${lang}"` : '';
    const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<pre><code${langClass}>${escaped}</code></pre>\n`;
  };

  // Tables - ensure proper Tiptap-compatible structure with inline formatting
  renderer.table = function ({ header, rows }: Tokens.Table): string {
    const headerCells = header
      .map((cell) => {
        // Parse inline markdown in header cells
        const cellHtml = marked.parseInline(cell.text) as string;
        return `<th>${cellHtml}</th>`;
      })
      .join('');
    const headerRow = `<tr>${headerCells}</tr>`;

    const bodyRows = rows
      .map((row) => {
        const cells = row
          .map((cell) => {
            // Parse inline markdown in body cells (bold, italic, code, etc.)
            const cellHtml = marked.parseInline(cell.text) as string;
            return `<td>${cellHtml}</td>`;
          })
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('\n');

    return `<table><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table>\n`;
  };

  return renderer;
}

/**
 * Convert markdown to Tiptap-compatible HTML
 */
function markdownToTiptapHtml(markdown: string): string {
  // Step 1: Pre-process blockquote callouts
  const { content: preprocessed, callouts } = preprocessBlockquoteCallouts(markdown);

  // Step 2: Configure marked with custom renderer
  const renderer = createTiptapRenderer();

  marked.setOptions({
    renderer,
    gfm: true,
    breaks: false,
  });

  // Step 3: Convert with marked
  let html = marked.parse(preprocessed) as string;

  // Step 4: Restore callout placeholders
  for (const [placeholder, calloutHtml] of callouts) {
    html = html.replace(`<p>${placeholder}</p>`, calloutHtml);
    html = html.replace(placeholder, calloutHtml);
  }

  // Step 5: Also handle directive-style callouts (:::info{title="..."} ... :::)
  const directiveRegex =
    /:::(info|warning|danger|success|note|tip)(?:\{title="(.+?)"\})?\n([\s\S]*?)\n:::/g;

  html = html.replace(directiveRegex, (match, type, title, content) => {
    const cleanTitle = title?.replace(/\\"/g, '"') || '';
    const innerHtml = convertSimpleMarkdownToHtml(content.trim());

    const titleAttr = cleanTitle ? ` data-callout-title="${escapeHtmlAttr(cleanTitle)}"` : '';
    const titleHtml = cleanTitle
      ? `<div class="callout-title font-semibold mb-2">${cleanTitle}</div>`
      : '';

    return `<div data-callout-type="${type}"${titleAttr} class="callout callout-${type} border-l-4 p-4 my-4 rounded-r">${titleHtml}<div class="callout-content">${innerHtml}</div></div>`;
  });

  // Step 6: Clean up any remaining paragraph-wrapped directive syntax
  html = html.replace(/<p>:::[\s\S]*?:::<\/p>/g, '');

  return html.trim();
}

function parseFragment(filePath: string): DbFragment | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const yaml = parse(content) as YamlFragment;

    // Extract category from path if not in YAML
    const pathParts = filePath.split('/');
    const fragmentsIndex = pathParts.indexOf('fragments');
    const category =
      yaml.category || (fragmentsIndex >= 0 ? pathParts[fragmentsIndex + 1] : 'general');

    const slug = basename(filePath, '.yaml').replace('.yml', '');
    const name = yaml.title?.en || yaml.title?.ja || slug;

    // Convert markdown to Tiptap HTML
    const contentEn = yaml.content?.en ? markdownToTiptapHtml(yaml.content.en) : null;
    const contentJa = yaml.content?.ja ? markdownToTiptapHtml(yaml.content.ja) : null;

    return {
      id: yaml.id || `${category}/${slug}`,
      name,
      slug,
      category,
      description: yaml.type || null,
      content_en: contentEn,
      content_ja: contentJa,
      is_bilingual: contentEn && contentJa ? 1 : 0,
      tags: JSON.stringify(yaml.tags || []),
      version: yaml.version || '1.0',
      status: yaml.status || 'active',
    };
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/import-single-fragment.ts <fragment-path>');
    process.exit(1);
  }

  const fragmentPath = args[0];
  console.log(`Parsing fragment: ${fragmentPath}`);

  const fragment = parseFragment(fragmentPath);
  if (!fragment) {
    console.error('Failed to parse fragment');
    process.exit(1);
  }

  console.log(`✓ Parsed: ${fragment.category}/${fragment.slug}`);
  console.log(`  - Name: ${fragment.name}`);
  console.log(`  - Bilingual: ${fragment.is_bilingual ? 'Yes' : 'No'}`);
  console.log(`  - EN content: ${fragment.content_en?.length || 0} chars`);
  console.log(`  - JA content: ${fragment.content_ja?.length || 0} chars`);

  // Show sample of converted HTML
  if (fragment.content_en) {
    console.log(`\n  Sample EN HTML (first 500 chars):`);
    console.log(`  ${fragment.content_en.substring(0, 500)}...`);
  }

  // Generate SQL
  const sql = `INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  '${escapeSQL(fragment.id)}',
  '${escapeSQL(fragment.name)}',
  '${escapeSQL(fragment.slug)}',
  '${escapeSQL(fragment.category)}',
  ${fragment.description ? `'${escapeSQL(fragment.description)}'` : 'NULL'},
  '${escapeSQL(fragment.content_en || '')}',
  '${escapeSQL(fragment.content_ja || '')}',
  ${fragment.is_bilingual},
  '${escapeSQL(fragment.tags)}',
  '${escapeSQL(fragment.version)}',
  '${escapeSQL(fragment.status)}',
  datetime('now'),
  datetime('now')
);`;

  // Write SQL to file
  const outputPath = `scripts/single-fragment-import.sql`;
  writeFileSync(outputPath, sql, 'utf-8');
  console.log(`\nSQL written to: ${outputPath}`);

  console.log(`\nTo import to local D1:`);
  console.log(
    `  npx wrangler d1 execute hanawa-db --local --file=scripts/single-fragment-import.sql`
  );
  console.log(`\nTo import to production D1:`);
  console.log(
    `  npx wrangler d1 execute hanawa-db --remote --file=scripts/single-fragment-import.sql`
  );
}

main().catch(console.error);

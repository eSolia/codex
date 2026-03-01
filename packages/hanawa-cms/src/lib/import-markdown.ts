/**
 * Client-side Markdown Import
 *
 * Parses dropped .md files, extracts frontmatter, detects language,
 * and returns structured data for pre-filling the new-fragment form.
 *
 * InfoSec: File content is parsed client-side only, no eval (OWASP A03)
 */

import { parseFrontmatter } from '$lib/frontmatter';

export interface ImportResult {
  /** Fragment ID derived from filename */
  id: string;
  /** Detected language: 'en' or 'ja' */
  language: 'en' | 'ja';
  /** Title from frontmatter or filename */
  title: string;
  /** Category from frontmatter */
  category: string;
  /** Type from frontmatter */
  type: string;
  /** Tags from frontmatter */
  tags: string[];
  /** Markdown body (without frontmatter) */
  body: string;
  /** Original filename */
  filename: string;
}

/**
 * Detect language by CJK character ratio.
 * If > 30% of non-whitespace characters are CJK, treat as Japanese.
 */
function detectLanguage(text: string): 'en' | 'ja' {
  const stripped = text.replace(/\s/g, '');
  if (stripped.length === 0) return 'en';

  // CJK Unified Ideographs + Hiragana + Katakana
  const cjkChars = stripped.match(/[\u3000-\u9fff\uf900-\ufaff]/g);
  const ratio = (cjkChars?.length ?? 0) / stripped.length;
  return ratio > 0.3 ? 'ja' : 'en';
}

/**
 * Derive a fragment ID from a filename.
 * e.g., "my-document.en.md" → "my-document"
 *       "My Document.md" → "my-document"
 */
function deriveId(filename: string): string {
  return (
    filename
      // Strip extension(s): .en.md, .ja.md, .md
      .replace(/\.(en|ja)?\.?md$/i, '')
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80) || 'imported-fragment'
  );
}

/**
 * Parse a markdown file and extract structured data for the fragment form.
 */
export function parseImportedMarkdown(text: string, filename: string): ImportResult {
  const { frontmatter, body } = parseFrontmatter(text);

  const language =
    (frontmatter.language as string) === 'ja' || (frontmatter.language as string) === 'en'
      ? (frontmatter.language as 'en' | 'ja')
      : detectLanguage(body);

  const title = (frontmatter.title as string) || deriveId(filename).replace(/-/g, ' ');

  // Extract tags — handle both array and comma-separated string
  let tags: string[] = [];
  if (Array.isArray(frontmatter.tags)) {
    tags = frontmatter.tags.map(String);
  } else if (typeof frontmatter.tags === 'string') {
    tags = frontmatter.tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
  }

  return {
    id: (frontmatter.id as string) || deriveId(filename),
    language,
    title,
    category: (frontmatter.category as string) || '',
    type: (frontmatter.type as string) || '',
    tags,
    body: body.trim(),
    filename,
  };
}

/**
 * Read a File object as text and parse it.
 */
export async function importMarkdownFile(file: File): Promise<ImportResult> {
  const text = await file.text();
  return parseImportedMarkdown(text, file.name);
}

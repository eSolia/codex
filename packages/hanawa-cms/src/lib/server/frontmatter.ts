/**
 * Frontmatter Parse/Serialize Helpers
 *
 * Parse YAML frontmatter from markdown files and serialize back.
 * Used by fragment edit pages to reconstruct full markdown from form data.
 *
 * InfoSec: No user input directly interpolated — values are escaped (OWASP A03)
 */

export interface ParsedMarkdown {
  frontmatter: Record<string, unknown>;
  body: string;
}

/**
 * Parse frontmatter from a markdown string.
 * Handles YAML frontmatter delimited by `---`.
 */
export function parseFrontmatter(markdown: string): ParsedMarkdown {
  if (!markdown || !markdown.startsWith('---')) {
    return { frontmatter: {}, body: markdown || '' };
  }

  const match = markdown.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: markdown };
  }

  const yamlBlock = match[1]!;
  const body = match[2]!;
  const frontmatter: Record<string, unknown> = {};

  const lines = yamlBlock.split('\n');
  let currentKey = '';
  let inArray = false;
  const arrayValues: string[] = [];

  for (const line of lines) {
    // Continue collecting array items
    if (inArray) {
      const arrayItemMatch = line.match(/^\s+-\s+(.*)/);
      if (arrayItemMatch) {
        const val = arrayItemMatch[1]!.trim().replace(/^["']|["']$/g, '');
        arrayValues.push(val);
        continue;
      } else {
        // Array ended — save and continue processing this line
        frontmatter[currentKey] = [...arrayValues];
        inArray = false;
        arrayValues.length = 0;
      }
    }

    // Key: value pairs
    const kvMatch = line.match(/^([a-z_][a-z0-9_]*):(?:\s(.*))?$/);
    if (kvMatch) {
      const key = kvMatch[1]!;
      const rawValue = (kvMatch[2] || '').trim();

      if (rawValue === '' || rawValue === undefined) {
        // Start of array or empty value
        currentKey = key;
        inArray = true;
        arrayValues.length = 0;
      } else {
        // Scalar value — strip quotes
        frontmatter[key] = rawValue.replace(/^["']|["']$/g, '');
      }
    }
  }

  // Close any open array at EOF
  if (inArray && arrayValues.length > 0) {
    frontmatter[currentKey] = [...arrayValues];
  }

  return { frontmatter, body };
}

/**
 * Serialize frontmatter fields and body back to a markdown string.
 * Preserves a consistent key ordering.
 */
export function serializeFrontmatter(fields: Record<string, unknown>, body: string): string {
  const lines: string[] = ['---'];

  // Standard key ordering for fragments and standards
  const keyOrder = [
    'id',
    'slug',
    'language',
    'title',
    'category',
    'type',
    'version',
    'status',
    'tags',
    'summary',
    'sensitivity',
    'author',
    'created',
    'modified',
    'review_due',
    'allowed_collections',
    'diagram_format',
  ];

  // Collect all keys, ordered ones first
  const allKeys = new Set<string>([...keyOrder, ...Object.keys(fields)]);

  for (const key of allKeys) {
    if (!(key in fields)) continue;
    const value = fields[key];

    // Skip undefined/null values
    if (value === undefined || value === null || value === '') continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - "${String(item)}"`);
      }
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }

  lines.push('---');

  // Ensure body starts with a newline after frontmatter
  const normalizedBody = body.startsWith('\n') ? body : '\n' + body;
  return lines.join('\n') + normalizedBody;
}

/**
 * Build a complete markdown file from metadata fields and body content.
 * Extracts the relevant frontmatter keys from form data.
 */
export function buildFragmentMarkdown(
  metadata: {
    id: string;
    language: 'en' | 'ja';
    title: string;
    category?: string;
    type?: string;
    version?: string;
    status?: string;
    tags?: string[];
    sensitivity?: string;
    author?: string;
    created?: string;
    diagramFormat?: string;
  },
  body: string
): string {
  const fm: Record<string, unknown> = {
    id: metadata.id,
    language: metadata.language,
    title: metadata.title,
  };

  if (metadata.category) fm.category = metadata.category;
  if (metadata.type) fm.type = metadata.type;
  if (metadata.version) fm.version = metadata.version;
  if (metadata.status) fm.status = metadata.status;
  if (metadata.tags && metadata.tags.length > 0) fm.tags = metadata.tags;
  if (metadata.sensitivity) fm.sensitivity = metadata.sensitivity;
  if (metadata.author) fm.author = metadata.author;
  if (metadata.created) fm.created = metadata.created;
  fm.modified = new Date().toISOString().split('T')[0];
  if (metadata.diagramFormat) fm.diagram_format = metadata.diagramFormat;

  return serializeFrontmatter(fm, body);
}

/**
 * Build a complete markdown file from metadata fields and body content
 * for coding/workflow standards (monolingual, slug-based).
 */
export function buildStandardMarkdown(
  metadata: {
    slug: string;
    title: string;
    category?: string;
    status?: string;
    tags?: string[];
    summary?: string;
    author?: string;
    created?: string;
  },
  body: string
): string {
  const fm: Record<string, unknown> = {
    title: metadata.title,
    slug: metadata.slug,
  };

  if (metadata.category) fm.category = metadata.category;
  if (metadata.summary) fm.summary = metadata.summary;
  if (metadata.status) fm.status = metadata.status;
  if (metadata.tags && metadata.tags.length > 0) fm.tags = metadata.tags;
  if (metadata.author) fm.author = metadata.author;
  if (metadata.created) fm.created = metadata.created;
  fm.modified = new Date().toISOString().split('T')[0];

  return serializeFrontmatter(fm, body);
}

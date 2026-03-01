/**
 * Frontmatter Parse Helper (shared — safe for client + server)
 *
 * Pure function that parses YAML frontmatter from markdown strings.
 * No server dependencies — can be imported from client-side code.
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

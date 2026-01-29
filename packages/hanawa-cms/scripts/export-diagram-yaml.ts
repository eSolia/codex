#!/usr/bin/env npx tsx
/**
 * Export diagram fragments from D1 to YAML backup files
 *
 * Usage:
 *   npx tsx scripts/export-diagram-yaml.ts              # Export all diagrams
 *   npx tsx scripts/export-diagram-yaml.ts <id>         # Export single diagram
 *
 * Output: content/fragments/diagrams/{id}.yaml
 *
 * InfoSec: Read-only operation, no external data sources
 */

import { execSync } from 'child_process';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { stringify } from 'yaml';

const OUTPUT_DIR = join(dirname(process.argv[1]), '../../../content/fragments/diagrams');

interface DiagramFragment {
  id: string;
  name: string;
  category: string;
  description: string;
  content_en: string;
  content_ja: string;
  tags: string;
  updated_at: string;
}

/**
 * Extract Mermaid source from HTML content
 */
function extractMermaidSource(html: string): string | null {
  // Match data-source="..." attribute
  const match = html.match(/data-source="([^"]+)"/);
  if (!match) return null;

  // Unescape HTML entities
  return match[1]
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'");
}

/**
 * Extract caption from HTML content
 */
function extractCaption(html: string): string | null {
  const match = html.match(/<div class="mermaid-caption-display">([^<]+)<\/div>/);
  return match ? match[1] : null;
}

/**
 * Query D1 for diagram fragments
 */
function queryDiagrams(fragmentId?: string): DiagramFragment[] {
  const whereClause = fragmentId
    ? `WHERE id = '${fragmentId}'`
    : `WHERE category = 'diagrams' OR description = 'mermaid'`;

  const command = `npx wrangler d1 execute hanawa-db --remote --command "SELECT id, name, category, description, content_en, content_ja, tags, updated_at FROM fragments ${whereClause}" --json 2>/dev/null`;

  try {
    const output = execSync(command, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    const parsed = JSON.parse(output);
    return parsed[0]?.results || [];
  } catch (err) {
    console.error('Error querying D1:', err);
    return [];
  }
}

/**
 * Convert fragment to YAML structure
 */
function fragmentToYaml(fragment: DiagramFragment): object {
  const mermaidEn = extractMermaidSource(fragment.content_en);
  const mermaidJa = extractMermaidSource(fragment.content_ja);
  const captionEn = extractCaption(fragment.content_en);
  const captionJa = extractCaption(fragment.content_ja);

  let tags: string[] = [];
  try {
    tags = JSON.parse(fragment.tags || '[]');
  } catch {
    tags = [];
  }

  return {
    id: fragment.id,
    title: {
      en: fragment.name,
      ja: fragment.name, // Could be enhanced to store separate JA title
    },
    category: fragment.category,
    type: fragment.description || 'mermaid',
    content: {
      mermaid_en: mermaidEn || '',
      mermaid_ja: mermaidJa || '',
      ...(captionEn && { caption_en: captionEn }),
      ...(captionJa && { caption_ja: captionJa }),
    },
    metadata: {
      exported_at: new Date().toISOString(),
      updated_at: fragment.updated_at,
      tags,
    },
  };
}

async function main() {
  const args = process.argv.slice(2);
  const fragmentId = args[0];

  console.log('Exporting diagram fragments from D1...\n');

  // Ensure output directory exists
  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Query fragments
  const fragments = queryDiagrams(fragmentId);

  if (fragments.length === 0) {
    console.log(
      fragmentId ? `No diagram found with id: ${fragmentId}` : 'No diagram fragments found in D1'
    );
    return;
  }

  console.log(`Found ${fragments.length} diagram(s)\n`);

  // Export each fragment
  for (const fragment of fragments) {
    const yaml = fragmentToYaml(fragment);
    const yamlContent = `# ${fragment.name}
# Exported from D1: ${new Date().toISOString()}
# Source of truth: D1 database (this file is a backup)

${stringify(yaml, { lineWidth: 0 })}`;

    const outputPath = join(OUTPUT_DIR, `${fragment.id}.yaml`);
    writeFileSync(outputPath, yamlContent);
    console.log(`✓ Exported: ${fragment.id}.yaml`);
  }

  console.log(`\nExported to: ${OUTPUT_DIR}`);
}

main().catch(console.error);

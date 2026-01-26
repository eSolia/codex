#!/usr/bin/env npx tsx
/**
 * Import a diagram fragment (YAML with mermaid) into D1 database
 * Usage: npx tsx scripts/import-diagram-fragment.ts <fragment-path>
 *
 * This script:
 * 1. Parses the YAML diagram fragment
 * 2. Renders mermaid to SVG using mmdc
 * 3. Outputs SQL for D1 import (SVG upload to R2 is manual or via wrangler)
 *
 * InfoSec: No external data sources, all content from local files
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { basename, dirname, join } from 'path';
import { parse } from 'yaml';
import { execSync } from 'child_process';

interface DiagramYaml {
  id: string;
  title: { en?: string; ja?: string };
  category: string;
  type: string;
  language?: string;
  tags?: string[];
  // New format (password-vault diagrams)
  content?: {
    mermaid?: string;
    caption_en?: string;
    caption_ja?: string;
    en?: string;
    ja?: string;
  };
  // Old format (cloudflare diagrams)
  diagram?: {
    format: string;
    source: string;
  };
  metadata?: {
    author?: string;
    created?: string;
    tags?: string[];
  };
}

interface DbFragment {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  content_en: string;
  content_ja: string;
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

/**
 * Render mermaid diagram to SVG using mmdc
 */
function renderMermaidToSvg(mermaidSource: string, outputPath: string, diagramId: string): boolean {
  // Create temp input file
  const tempDir = join(dirname(outputPath), 'temp');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const tempInput = join(tempDir, `${diagramId}.mmd`);
  writeFileSync(tempInput, mermaidSource, 'utf-8');

  // Config and CSS paths (at repo root /Users/rcogley/dev/codex/scripts/)
  const repoRoot = '/Users/rcogley/dev/codex';
  const configPath = join(repoRoot, 'scripts/mermaid-config.json');
  const cssPath = join(repoRoot, 'scripts/mermaid-styles.css');

  try {
    // Run mmdc
    const cmd = `npx mmdc -i "${tempInput}" -o "${outputPath}" -c "${configPath}" -C "${cssPath}" -b transparent`;
    console.log(`  Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });

    // Clean up temp file
    execSync(`rm -f "${tempInput}"`);

    return existsSync(outputPath);
  } catch (err) {
    console.error(`  Error rendering mermaid:`, err);
    return false;
  }
}

/**
 * Create Tiptap mermaidBlock HTML for the fragment content
 */
function createMermaidBlockHtml(mermaidSource: string, svgPath: string, caption?: string): string {
  const escapedSource = escapeHtmlAttr(mermaidSource);
  const captionHtml = caption ? `<div class="mermaid-caption-display">${caption}</div>` : '';

  return `<div data-type="mermaidBlock" data-source="${escapedSource}" data-svg-path="${svgPath}" class="mermaid-block">
<div class="mermaid-header">
<span class="mermaid-type-label">Mermaid Diagram</span>
</div>
<div class="mermaid-diagram">
<img src="${svgPath}" alt="Mermaid diagram" />
</div>
${captionHtml}
</div>`;
}

function parseFragment(
  filePath: string
): { fragment: DbFragment; yaml: DiagramYaml; mermaidSource: string } | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const yaml = parse(content) as DiagramYaml;

    const slug = basename(filePath, '.yaml').replace('.yml', '');
    const name = yaml.title?.en || yaml.title?.ja || slug;
    const category = yaml.category || 'diagrams';

    // Extract mermaid source from either format
    // New format: content.mermaid
    // Old format: diagram.source
    const mermaidSource = yaml.content?.mermaid || yaml.diagram?.source;
    if (!mermaidSource) {
      console.error(`  No mermaid source found in ${filePath}`);
      return null;
    }

    // Extract captions
    // New format: content.caption_en / content.caption_ja
    // Old format: content.en / content.ja (these are descriptions/captions)
    const captionEn = yaml.content?.caption_en || yaml.content?.en || '';
    const captionJa = yaml.content?.caption_ja || yaml.content?.ja || '';

    // SVG will be stored at diagrams/{id}.svg in R2
    const svgPath = `diagrams/${yaml.id}.svg`;

    // Create content for both languages (same diagram, different caption)
    const contentEn = createMermaidBlockHtml(mermaidSource, svgPath, captionEn);
    const contentJa = createMermaidBlockHtml(mermaidSource, svgPath, captionJa);

    // Get tags from either location
    const tags = yaml.tags || yaml.metadata?.tags || [];

    return {
      fragment: {
        id: yaml.id,
        name,
        slug,
        category,
        description: yaml.type || 'mermaid',
        content_en: contentEn,
        content_ja: contentJa,
        is_bilingual: 1,
        tags: JSON.stringify(tags),
        version: '1.0',
        status: 'active',
      },
      yaml,
      mermaidSource,
    };
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err);
    return null;
  }
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/import-diagram-fragment.ts <fragment-path>');
    console.error('       npx tsx scripts/import-diagram-fragment.ts --all');
    process.exit(1);
  }

  const isAll = args[0] === '--all';
  let fragmentPaths: string[] = [];

  if (isAll) {
    // Find all diagram fragments
    const diagramsDir = join(dirname(process.argv[1]), '../../../content/fragments/diagrams');
    const { readdirSync } = await import('fs');
    fragmentPaths = readdirSync(diagramsDir)
      .filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
      .map((f) => join(diagramsDir, f));
  } else {
    fragmentPaths = [args[0]];
  }

  const outputDir = join(dirname(process.argv[1]), '../static/diagrams');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const sqlStatements: string[] = [];

  for (const fragmentPath of fragmentPaths) {
    console.log(`\nProcessing: ${fragmentPath}`);

    const result = parseFragment(fragmentPath);
    if (!result) {
      console.error(`  Failed to parse`);
      continue;
    }

    const { fragment, yaml, mermaidSource } = result;
    console.log(`  ✓ Parsed: ${fragment.category}/${fragment.slug}`);

    // Render SVG
    const svgOutputPath = join(outputDir, `${yaml.id}.svg`);
    console.log(`  Rendering SVG to: ${svgOutputPath}`);

    const rendered = renderMermaidToSvg(mermaidSource, svgOutputPath, yaml.id);

    if (rendered) {
      console.log(`  ✓ SVG rendered successfully`);
    } else {
      console.error(`  ✗ SVG rendering failed`);
    }

    // Generate SQL
    const sql = `INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  '${escapeSQL(fragment.id)}',
  '${escapeSQL(fragment.name)}',
  '${escapeSQL(fragment.slug)}',
  '${escapeSQL(fragment.category)}',
  ${fragment.description ? `'${escapeSQL(fragment.description)}'` : 'NULL'},
  '${escapeSQL(fragment.content_en)}',
  '${escapeSQL(fragment.content_ja)}',
  ${fragment.is_bilingual},
  '${escapeSQL(fragment.tags)}',
  '${escapeSQL(fragment.version)}',
  '${escapeSQL(fragment.status)}',
  datetime('now'),
  datetime('now')
);`;

    sqlStatements.push(sql);
  }

  // Write combined SQL
  const outputPath = `scripts/diagram-fragments-import.sql`;
  writeFileSync(outputPath, sqlStatements.join('\n\n'), 'utf-8');
  console.log(`\n✓ SQL written to: ${outputPath}`);

  console.log(`\nTo import to local D1:`);
  console.log(
    `  npx wrangler d1 execute hanawa-db --local --file=scripts/diagram-fragments-import.sql`
  );
  console.log(`\nTo import to production D1:`);
  console.log(
    `  npx wrangler d1 execute hanawa-db --remote --file=scripts/diagram-fragments-import.sql`
  );

  console.log(`\nTo upload SVGs to R2:`);
  console.log(
    `  for svg in static/diagrams/*.svg; do npx wrangler r2 object put codex/diagrams/$(basename $svg) --file=$svg; done`
  );
}

main().catch(console.error);

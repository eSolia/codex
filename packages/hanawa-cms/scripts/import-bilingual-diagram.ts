#!/usr/bin/env npx tsx
/**
 * Import a bilingual diagram fragment (YAML with mermaid_en + mermaid_ja)
 * Usage: npx tsx scripts/import-bilingual-diagram.ts <fragment-path>
 *
 * This script:
 * 1. Parses the YAML with separate EN and JA Mermaid sources
 * 2. Renders TWO SVGs: {id}-en.svg and {id}-ja.svg
 * 3. Creates content_en referencing -en.svg, content_ja referencing -ja.svg
 * 4. Outputs SQL for D1 import
 *
 * InfoSec: No external data sources, all content from local files
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { parse } from 'yaml';
import { execSync } from 'child_process';

interface BilingualDiagramYaml {
  id: string;
  title: { en?: string; ja?: string };
  category: string;
  type: string;
  content: {
    mermaid_en: string;
    mermaid_ja: string;
    caption_en?: string;
    caption_ja?: string;
  };
  metadata?: {
    author?: string;
    created?: string;
    tags?: string[];
  };
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
function renderMermaidToSvg(mermaidSource: string, outputPath: string, tempId: string): boolean {
  const tempDir = join(dirname(outputPath), 'temp');
  if (!existsSync(tempDir)) {
    mkdirSync(tempDir, { recursive: true });
  }

  const tempInput = join(tempDir, `${tempId}.mmd`);
  writeFileSync(tempInput, mermaidSource, 'utf-8');

  const repoRoot = '/Users/rcogley/dev/codex';
  const configPath = join(repoRoot, 'scripts/mermaid-config.json');
  const cssPath = join(repoRoot, 'scripts/mermaid-styles.css');

  try {
    const cmd = `npx mmdc -i "${tempInput}" -o "${outputPath}" -c "${configPath}" -C "${cssPath}" -b transparent`;
    console.log(`  Running: ${cmd}`);
    execSync(cmd, { stdio: 'inherit' });
    execSync(`rm -f "${tempInput}"`);
    return existsSync(outputPath);
  } catch (err) {
    console.error(`  Error rendering mermaid:`, err);
    return false;
  }
}

/**
 * Create Tiptap mermaidBlock HTML
 */
function createMermaidBlockHtml(mermaidSource: string, svgPath: string, caption?: string): string {
  const escapedSource = escapeHtmlAttr(mermaidSource.trim());
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

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('Usage: npx tsx scripts/import-bilingual-diagram.ts <fragment-path>');
    process.exit(1);
  }

  const fragmentPath = args[0];
  console.log(`\nProcessing bilingual diagram: ${fragmentPath}`);

  // Parse YAML
  const content = readFileSync(fragmentPath, 'utf-8');
  const yaml = parse(content) as BilingualDiagramYaml;

  if (!yaml.content?.mermaid_en || !yaml.content?.mermaid_ja) {
    console.error('Error: YAML must have content.mermaid_en and content.mermaid_ja');
    process.exit(1);
  }

  const outputDir = join(dirname(process.argv[1]), '../static/diagrams');
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  // Render English SVG
  const svgPathEn = `diagrams/${yaml.id}-en.svg`;
  const svgOutputPathEn = join(outputDir, `${yaml.id}-en.svg`);
  console.log(`\nRendering English SVG: ${svgOutputPathEn}`);
  const renderedEn = renderMermaidToSvg(yaml.content.mermaid_en, svgOutputPathEn, `${yaml.id}-en`);
  console.log(renderedEn ? '  ✓ English SVG rendered' : '  ✗ English SVG failed');

  // Render Japanese SVG
  const svgPathJa = `diagrams/${yaml.id}-ja.svg`;
  const svgOutputPathJa = join(outputDir, `${yaml.id}-ja.svg`);
  console.log(`\nRendering Japanese SVG: ${svgOutputPathJa}`);
  const renderedJa = renderMermaidToSvg(yaml.content.mermaid_ja, svgOutputPathJa, `${yaml.id}-ja`);
  console.log(renderedJa ? '  ✓ Japanese SVG rendered' : '  ✗ Japanese SVG failed');

  // Create HTML content for each language (each references its own SVG)
  const contentEn = createMermaidBlockHtml(
    yaml.content.mermaid_en,
    svgPathEn,
    yaml.content.caption_en
  );
  const contentJa = createMermaidBlockHtml(
    yaml.content.mermaid_ja,
    svgPathJa,
    yaml.content.caption_ja
  );

  const tags = yaml.metadata?.tags || [];
  const name = yaml.title?.en || yaml.title?.ja || yaml.id;

  // Generate SQL (UPDATE existing fragment, not INSERT)
  const sql = `-- Update bilingual diagram fragment: ${yaml.id}
-- Generated: ${new Date().toISOString()}

UPDATE fragments SET
  name = '${escapeSQL(name)}',
  content_en = '${escapeSQL(contentEn)}',
  content_ja = '${escapeSQL(contentJa)}',
  is_bilingual = 1,
  tags = '${escapeSQL(JSON.stringify(tags))}',
  updated_at = datetime('now')
WHERE id = '${escapeSQL(yaml.id)}';

-- If no rows updated, insert new fragment
INSERT OR IGNORE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at)
VALUES (
  '${escapeSQL(yaml.id)}',
  '${escapeSQL(name)}',
  '${escapeSQL(yaml.id)}',
  '${escapeSQL(yaml.category || 'diagrams')}',
  '${escapeSQL(yaml.type || 'mermaid')}',
  '${escapeSQL(contentEn)}',
  '${escapeSQL(contentJa)}',
  1,
  '${escapeSQL(JSON.stringify(tags))}',
  '1.0',
  'active',
  datetime('now'),
  datetime('now')
);`;

  const outputPath = `scripts/bilingual-diagram-import.sql`;
  writeFileSync(outputPath, sql, 'utf-8');
  console.log(`\n✓ SQL written to: ${outputPath}`);

  console.log(`\nTo import to production D1:`);
  console.log(
    `  npx wrangler d1 execute hanawa-db --remote --file=scripts/bilingual-diagram-import.sql`
  );

  console.log(`\nTo upload SVGs to R2:`);
  console.log(
    `  npx wrangler r2 object put codex/${svgPathEn} --file=static/diagrams/${yaml.id}-en.svg --remote`
  );
  console.log(
    `  npx wrangler r2 object put codex/${svgPathJa} --file=static/diagrams/${yaml.id}-ja.svg --remote`
  );
}

main().catch(console.error);

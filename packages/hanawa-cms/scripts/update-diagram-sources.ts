#!/usr/bin/env npx tsx
/**
 * Update diagram fragment records with mermaid source in data-source attribute
 * Usage: npx tsx scripts/update-diagram-sources.ts
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { parse } from 'yaml';

interface DiagramYaml {
  id: string;
  content?: {
    mermaid?: string;
  };
  diagram?: {
    source?: string;
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

async function main() {
  const diagramsDir = '/Users/rcogley/dev/codex/content/fragments/diagrams';
  const files = readdirSync(diagramsDir).filter(
    (f) => f.startsWith('password-vault-') && f.endsWith('.yaml')
  );

  const sqlStatements: string[] = [
    '-- Update Password Vault Diagram Fragments with Mermaid Source',
    '-- Generated: ' + new Date().toISOString(),
    '',
  ];

  for (const file of files) {
    const filePath = join(diagramsDir, file);
    const content = readFileSync(filePath, 'utf-8');
    const yaml = parse(content) as DiagramYaml;

    const id = yaml.id;
    const mermaidSource = yaml.content?.mermaid || yaml.diagram?.source;

    if (!mermaidSource) {
      console.log(`Skipping ${id} - no mermaid source found`);
      continue;
    }

    console.log(`Processing ${id}...`);
    console.log(`  Mermaid source length: ${mermaidSource.length} chars`);

    const escapedSource = escapeHtmlAttr(mermaidSource.trim());
    const svgPath = `diagrams/${id}.svg`;

    const htmlContent = `<div data-type="mermaidBlock" data-source="${escapedSource}" data-svg-path="${svgPath}" class="mermaid-block"><div class="mermaid-header"><span class="mermaid-type-label">Mermaid Diagram</span></div><div class="mermaid-diagram"><img src="${svgPath}" alt="Mermaid diagram" /></div></div>`;

    const sql = `UPDATE fragments SET
  content_en = '${escapeSQL(htmlContent)}',
  content_ja = '${escapeSQL(htmlContent)}',
  updated_at = datetime('now')
WHERE id = '${escapeSQL(id)}';`;

    sqlStatements.push(sql);
    sqlStatements.push('');
  }

  const outputPath = 'scripts/update-diagram-sources.sql';
  writeFileSync(outputPath, sqlStatements.join('\n'), 'utf-8');
  console.log(`\nSQL written to: ${outputPath}`);

  console.log(`\nTo apply to local D1:`);
  console.log(
    `  npx wrangler d1 execute hanawa-db --local --file=scripts/update-diagram-sources.sql`
  );
  console.log(`\nTo apply to production D1:`);
  console.log(
    `  npx wrangler d1 execute hanawa-db --remote --file=scripts/update-diagram-sources.sql`
  );
}

main().catch(console.error);

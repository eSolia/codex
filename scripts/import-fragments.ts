/**
 * Import YAML fragments into D1 database
 * Run with: npx tsx scripts/import-fragments.ts
 *
 * Generates SQL that can be executed with wrangler d1 execute
 */

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const FRAGMENTS_DIR = join(__dirname, '..', 'content', 'fragments');
const OUTPUT_FILE = join(__dirname, 'import-fragments.sql');

interface YamlFragment {
  id: string;
  title: { en: string; ja: string };
  type?: string;
  category?: string;
  tags?: string[];
  versions?: { current: string };
  content: { en: string; ja: string };
  metadata?: {
    last_updated?: string;
    author?: string;
    usage_notes?: string;
  };
}

function escapeSQL(str: string): string {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

function findYamlFiles(dir: string): string[] {
  const files: string[] = [];

  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findYamlFiles(fullPath));
    } else if (entry.name.endsWith('.yaml') || entry.name.endsWith('.yml')) {
      files.push(fullPath);
    }
  }

  return files;
}

function yamlToSQL(filePath: string): string | null {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const data = parse(content) as YamlFragment;

    if (!data.id || !data.content) {
      console.warn(`Skipping ${filePath}: missing id or content`);
      return null;
    }

    // Determine category from path if not specified
    const pathParts = filePath.split('/');
    const categoryFromPath = pathParts[pathParts.length - 2] || 'general';
    const category = data.category || categoryFromPath;

    // Build name from title or id
    const name = data.title?.en || data.id.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

    const slug = data.id;
    const contentEn = escapeSQL(data.content.en || '');
    const contentJa = escapeSQL(data.content.ja || '');
    const description = escapeSQL(data.metadata?.usage_notes || '');
    const tags = JSON.stringify(data.tags || []);
    const version = data.versions?.current || '1.0';

    return `INSERT INTO fragments (id, site_id, name, slug, category, content_en, content_ja, description, tags, version, status, is_bilingual, default_locale, available_locales)
VALUES (
  '${escapeSQL(data.id)}',
  NULL,
  '${escapeSQL(name)}',
  '${escapeSQL(slug)}',
  '${escapeSQL(category)}',
  '${contentEn}',
  '${contentJa}',
  '${description}',
  '${escapeSQL(tags)}',
  '${escapeSQL(version)}',
  'active',
  1,
  'en',
  '["en", "ja"]'
);`;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return null;
  }
}

// Main
console.log(`Scanning ${FRAGMENTS_DIR} for YAML files...`);
const yamlFiles = findYamlFiles(FRAGMENTS_DIR);
console.log(`Found ${yamlFiles.length} YAML files`);

const sqlStatements: string[] = [
  '-- Auto-generated fragment import',
  `-- Generated: ${new Date().toISOString()}`,
  '',
  '-- Clear existing fragments (optional - comment out to preserve)',
  '-- DELETE FROM fragments;',
  '',
];

for (const file of yamlFiles) {
  console.log(`Processing: ${basename(file)}`);
  const sql = yamlToSQL(file);
  if (sql) {
    sqlStatements.push(sql);
    sqlStatements.push('');
  }
}

const output = sqlStatements.join('\n');
writeFileSync(OUTPUT_FILE, output);

console.log(`\nGenerated ${OUTPUT_FILE}`);
console.log(`Total fragments: ${yamlFiles.length}`);
console.log('\nTo import, run:');
console.log(`cd packages/hanawa-cms && npx wrangler d1 execute hanawa-db --remote --file=../../scripts/import-fragments.sql`);

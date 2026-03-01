/**
 * Seed Fragment Index Script
 *
 * Reads all *.en.md and *.ja.md files from content/fragments/,
 * parses frontmatter, and generates SQL to populate the D1 fragment_index table.
 *
 * Usage:
 *   npx tsx scripts/seed-fragment-index.ts                  # output SQL to stdout
 *   npx tsx scripts/seed-fragment-index.ts --output seed.sql # write to file
 *   npx tsx scripts/seed-fragment-index.ts --local           # execute against local D1
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FRAGMENTS_DIR = join(ROOT, 'content', 'fragments');
const HANAWA_DIR = join(ROOT, 'packages', 'hanawa-cms');

const args = process.argv.slice(2);
const OUTPUT_FILE = args.includes('--output') ? args[args.indexOf('--output') + 1] : null;
const LOCAL_EXEC = args.includes('--local');

// ─── Frontmatter Parser ─────────────────────────────────────────────────────

interface ParsedFrontmatter {
  id?: string;
  language?: string;
  title?: string;
  category?: string;
  type?: string;
  version?: string;
  status?: string;
  tags?: string[];
  sensitivity?: string;
  author?: string;
  created?: string;
  modified?: string;
  diagram_format?: string;
}

function parseFrontmatter(content: string): { fm: ParsedFrontmatter; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { fm: {}, body: content };

  const lines = match[1]!.split('\n');
  const fm: Record<string, unknown> = {};
  let currentKey = '';
  let inArray = false;
  const arrayValues: string[] = [];

  for (const line of lines) {
    if (inArray) {
      if (line.match(/^\s+-\s/)) {
        const val = line.replace(/^\s+-\s*/, '').replace(/^["']|["']$/g, '');
        arrayValues.push(val);
        continue;
      } else {
        fm[currentKey] = [...arrayValues];
        inArray = false;
        arrayValues.length = 0;
      }
    }

    const kvMatch = line.match(/^([a-z_]+):\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1]!;
      const value = kvMatch[2]!.trim();

      if (value === '') {
        currentKey = key;
        inArray = true;
        arrayValues.length = 0;
      } else {
        fm[key] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  if (inArray && arrayValues.length > 0) {
    fm[currentKey] = [...arrayValues];
  }

  return { fm: fm as ParsedFrontmatter, body: match[2]! };
}

// ─── Discover Fragments ─────────────────────────────────────────────────────

interface FragmentIndex {
  id: string;
  category: string;
  title_en: string | null;
  title_ja: string | null;
  type: string | null;
  version: string | null;
  status: string;
  tags: string;
  has_en: number;
  has_ja: number;
  r2_key_en: string | null;
  r2_key_ja: string | null;
  sensitivity: string;
  author: string;
  created_at: string | null;
  updated_at: string;
}

function discoverFragments(): Map<string, FragmentIndex> {
  const index = new Map<string, FragmentIndex>();

  const categories = readdirSync(FRAGMENTS_DIR).filter(d => {
    const stat = statSync(join(FRAGMENTS_DIR, d));
    return stat.isDirectory();
  });

  for (const category of categories) {
    const catDir = join(FRAGMENTS_DIR, category);
    const files = readdirSync(catDir).filter(f => f.endsWith('.en.md') || f.endsWith('.ja.md'));

    for (const file of files) {
      const langMatch = file.match(/\.(en|ja)\.md$/);
      if (!langMatch) continue;

      const lang = langMatch[1] as 'en' | 'ja';
      const id = file.replace(/\.(en|ja)\.md$/, '');
      const filePath = join(catDir, file);
      const content = readFileSync(filePath, 'utf-8');
      const { fm } = parseFrontmatter(content);

      // Get or create entry
      let entry = index.get(id);
      if (!entry) {
        entry = {
          id,
          category,
          title_en: null,
          title_ja: null,
          type: null,
          version: null,
          status: 'production',
          tags: '[]',
          has_en: 0,
          has_ja: 0,
          r2_key_en: null,
          r2_key_ja: null,
          sensitivity: 'normal',
          author: 'eSolia Technical Team',
          created_at: null,
          updated_at: new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ''),
        };
        index.set(id, entry);
      }

      // Update with data from this file
      if (lang === 'en') {
        entry.has_en = 1;
        entry.r2_key_en = `fragments/${category}/${id}.en.md`;
        entry.title_en = (fm.title as string) || null;
      } else {
        entry.has_ja = 1;
        entry.r2_key_ja = `fragments/${category}/${id}.ja.md`;
        entry.title_ja = (fm.title as string) || null;
      }

      // Use metadata from either file (prefer EN values for shared fields)
      if (fm.type && (lang === 'en' || !entry.type)) entry.type = fm.type;
      if (fm.version && (lang === 'en' || !entry.version)) entry.version = fm.version;
      if (fm.status && (lang === 'en' || entry.status === 'production')) entry.status = fm.status;
      if (fm.sensitivity && (lang === 'en' || entry.sensitivity === 'normal')) entry.sensitivity = fm.sensitivity;
      if (fm.author && (lang === 'en' || entry.author === 'eSolia Technical Team')) entry.author = fm.author;
      if (fm.created && (lang === 'en' || !entry.created_at)) entry.created_at = fm.created;
      if (fm.category) entry.category = fm.category;

      // Merge tags
      if (fm.tags && Array.isArray(fm.tags)) {
        const existingTags: string[] = JSON.parse(entry.tags);
        const merged = new Set([...existingTags, ...fm.tags]);
        entry.tags = JSON.stringify(Array.from(merged));
      }
    }
  }

  return index;
}

// ─── SQL Generation ─────────────────────────────────────────────────────────

function escapeSQL(val: string | null): string {
  if (val === null) return 'NULL';
  return `'${val.replace(/'/g, "''")}'`;
}

function generateSQL(index: Map<string, FragmentIndex>): string {
  const lines: string[] = [
    '-- Auto-generated by seed-fragment-index.ts',
    `-- Generated: ${new Date().toISOString()}`,
    `-- Fragment count: ${index.size}`,
    '',
    '-- Clear existing data',
    'DELETE FROM fragment_index;',
    '',
  ];

  for (const entry of index.values()) {
    lines.push(`INSERT INTO fragment_index (id, category, title_en, title_ja, type, version, status, tags, has_en, has_ja, r2_key_en, r2_key_ja, sensitivity, author, created_at, updated_at) VALUES (`);
    lines.push(`  ${escapeSQL(entry.id)},`);
    lines.push(`  ${escapeSQL(entry.category)},`);
    lines.push(`  ${escapeSQL(entry.title_en)},`);
    lines.push(`  ${escapeSQL(entry.title_ja)},`);
    lines.push(`  ${escapeSQL(entry.type)},`);
    lines.push(`  ${escapeSQL(entry.version)},`);
    lines.push(`  ${escapeSQL(entry.status)},`);
    lines.push(`  ${escapeSQL(entry.tags)},`);
    lines.push(`  ${entry.has_en},`);
    lines.push(`  ${entry.has_ja},`);
    lines.push(`  ${escapeSQL(entry.r2_key_en)},`);
    lines.push(`  ${escapeSQL(entry.r2_key_ja)},`);
    lines.push(`  ${escapeSQL(entry.sensitivity)},`);
    lines.push(`  ${escapeSQL(entry.author)},`);
    lines.push(`  ${escapeSQL(entry.created_at)},`);
    lines.push(`  ${escapeSQL(entry.updated_at)}`);
    lines.push(`);`);
    lines.push('');
  }

  return lines.join('\n');
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log('Seed Fragment Index\n');

const index = discoverFragments();
console.log(`Discovered ${index.size} unique fragments\n`);

// Show summary by category
const byCat = new Map<string, number>();
for (const entry of index.values()) {
  byCat.set(entry.category, (byCat.get(entry.category) || 0) + 1);
}
console.log('By category:');
for (const [cat, count] of Array.from(byCat.entries()).sort()) {
  console.log(`  ${cat}: ${count}`);
}

const bilingual = Array.from(index.values()).filter(e => e.has_en && e.has_ja).length;
console.log(`\nBilingual: ${bilingual} / ${index.size}`);

const sql = generateSQL(index);

if (OUTPUT_FILE) {
  writeFileSync(OUTPUT_FILE, sql, 'utf-8');
  console.log(`\nSQL written to: ${OUTPUT_FILE}`);
} else if (LOCAL_EXEC) {
  // Write to temp file and execute against local D1
  const tmpFile = join(HANAWA_DIR, 'seed-fragment-index.sql');
  writeFileSync(tmpFile, sql, 'utf-8');
  console.log(`\nExecuting against local D1...`);
  try {
    execSync(`npx wrangler d1 execute hanawa-db --local --file=${tmpFile}`, {
      cwd: HANAWA_DIR,
      stdio: 'inherit',
    });
    console.log('Done!');
  } finally {
    // Clean up temp file
    try {
      const { unlinkSync: unlink } = require('node:fs');
      unlink(tmpFile);
    } catch {
      // ignore
    }
  }
} else {
  // Output SQL to stdout
  console.log('\n--- SQL OUTPUT ---\n');
  console.log(sql);
}

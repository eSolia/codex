/**
 * Fragment Cleanup Script
 *
 * Normalizes migrated markdown fragments:
 *   1. Unify status: active → production
 *   2. Unify diagram types: type: mermaid → type: diagram (add diagram_format: mermaid)
 *   3. Fix underscore in ID: fiber-path-diagram_1 → fiber-path-diagram-1
 *   4. Merge language-suffixed diagram IDs:
 *      - esolia-m365-components-en / -ja → esolia-m365-components
 *      - esolia-cloudflare-m365-smb-security-coverage-ja → esolia-cloudflare-m365-smb-security-coverage
 *   5. Standardize title capitalization (Title Case)
 *
 * Usage:
 *   npx tsx scripts/cleanup-fragments.ts            # dry-run (default)
 *   npx tsx scripts/cleanup-fragments.ts --apply     # apply changes
 *   npx tsx scripts/cleanup-fragments.ts --verbose   # show details
 */

import { readFileSync, writeFileSync, readdirSync, statSync, renameSync, existsSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FRAGMENTS_DIR = join(ROOT, 'content', 'fragments');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERBOSE = args.includes('--verbose');

// ─── Stats ──────────────────────────────────────────────────────────────────
let statusFixes = 0;
let typeFixes = 0;
let idFixes = 0;
let titleFixes = 0;
let mergedPairs = 0;
let filesRenamed = 0;
let filesDeleted = 0;

// ─── Frontmatter Helpers ────────────────────────────────────────────────────

function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
  if (!match) return { frontmatter: {}, body: content };

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
        // Could be start of array or empty value
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

  return { frontmatter: fm, body: match[2]! };
}

function serializeFrontmatter(fm: Record<string, unknown>, body: string): string {
  const lines: string[] = ['---'];

  // Key ordering for consistency
  const keyOrder = [
    'id', 'language', 'title', 'category', 'type', 'version',
    'status', 'tags', 'sensitivity', 'author', 'created', 'modified',
    'review_due', 'allowed_collections', 'diagram_format',
  ];

  const allKeys = new Set([...keyOrder, ...Object.keys(fm)]);

  for (const key of allKeys) {
    if (!(key in fm)) continue;
    const value = fm[key];

    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - "${item}"`);
      }
    } else if (value !== undefined && value !== null) {
      lines.push(`${key}: ${value}`);
    }
  }

  lines.push('---');
  return lines.join('\n') + '\n' + body;
}

// ─── Title Case ─────────────────────────────────────────────────────────────

const LOWERCASE_WORDS = new Set([
  'a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'is',
  'nor', 'of', 'on', 'or', 'so', 'the', 'to', 'up', 'via', 'yet',
  'vs', 'vs.',
]);

const UPPERCASE_WORDS = new Set([
  'm365', 'smb', 'dns', 'vpn', 'spf', 'dkim', 'dmarc', 'ssl',
  'tls', 'api', 'soc', 'en', 'ja', 'r2', 'cf', 'svg', 'pdf',
  'it', 'ip', 'url', 'http', 'https', 'tcp', 'udp', 'ssh',
]);

// Brand names that must be preserved exactly
const BRAND_NAMES: Record<string, string> = {
  'esolia': 'eSolia',
  'totalsupport': 'TotalSupport',
  'cosupport': 'CoSupport',
  'co-support': 'Co-Support',
  'microsoft': 'Microsoft',
  'cloudflare': 'Cloudflare',
  'fortinet': 'Fortinet',
  'fortigate': 'FortiGate',
  'sharepoint': 'SharePoint',
  'mermaid': 'Mermaid',
  'ipv4': 'IPv4',
  'ipv6': 'IPv6',
};

/** Returns true if the string contains non-ASCII characters (e.g. Japanese) */
function hasNonAscii(str: string): boolean {
  // eslint-disable-next-line no-control-regex
  return /[^\x00-\x7F]/.test(str);
}

/** Title-case a single word segment (no spaces or hyphens) */
function titleCaseWord(word: string, isFirst: boolean): string {
  const lower = word.toLowerCase();

  // Exact brand name match
  if (lower in BRAND_NAMES) return BRAND_NAMES[lower]!;

  // All-uppercase acronym
  if (UPPERCASE_WORDS.has(lower)) return word.toUpperCase();

  // Already has mixed case that looks intentional (e.g. "eSolia", "FortiGate")
  // — if it's not all-lower and not all-upper and has >1 char, leave it alone
  if (word.length > 1 && word !== lower && word !== word.toUpperCase()) return word;

  // Lowercase articles/prepositions (unless first word)
  if (!isFirst && LOWERCASE_WORDS.has(lower)) return lower;

  // Standard title case: capitalize first letter, keep rest as-is
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
}

function toTitleCase(str: string): string {
  // Skip Japanese / non-ASCII text entirely
  if (hasNonAscii(str)) return str;

  // Track whether next word should be treated as "first" (start of sentence/clause)
  let nextIsFirst = true;

  // Process hyphenated words by splitting on hyphens, then spaces
  return str.split(' ').map((word) => {
    const isFirst = nextIsFirst;
    // After a colon, the next word is treated as first (capitalize it)
    nextIsFirst = word.endsWith(':');

    // Handle hyphenated compound words (e.g. "Co-Support", "Enterprise-Grade")
    if (word.includes('-')) {
      return word.split('-').map((part, partIdx) => {
        return titleCaseWord(part, isFirst && partIdx === 0);
      }).join('-');
    }
    return titleCaseWord(word, isFirst);
  }).join(' ');
}

// ─── File Discovery ─────────────────────────────────────────────────────────

interface FragmentFile {
  path: string;
  category: string;
  id: string;
  lang: 'en' | 'ja';
  content: string;
  frontmatter: Record<string, unknown>;
  body: string;
}

function discoverFragments(): FragmentFile[] {
  const results: FragmentFile[] = [];

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
      const { frontmatter, body } = parseFrontmatter(content);

      results.push({ path: filePath, category, id, lang, content, frontmatter, body });
    }
  }

  return results;
}

// ─── Merge Definitions ──────────────────────────────────────────────────────

// IDs to merge: old → new
const MERGE_MAP: Record<string, string> = {
  'esolia-m365-components-en': 'esolia-m365-components',
  'esolia-m365-components-ja': 'esolia-m365-components',
  'esolia-cloudflare-m365-smb-security-coverage-ja': 'esolia-cloudflare-m365-smb-security-coverage',
};

// IDs to rename (non-merge)
const RENAME_MAP: Record<string, string> = {
  'fiber-path-diagram_1': 'fiber-path-diagram-1',
};

// ─── Apply Changes ──────────────────────────────────────────────────────────

function processFile(frag: FragmentFile): { changed: boolean; newContent: string; newPath?: string; delete?: boolean } {
  let changed = false;
  const fm = { ...frag.frontmatter };
  let body = frag.body;
  let newPath: string | undefined;

  // 1. Fix status: active → production
  if (fm.status === 'active') {
    if (VERBOSE) console.log(`  [status] ${frag.path}: active → production`);
    fm.status = 'production';
    changed = true;
    statusFixes++;
  }

  // 2. Fix type: mermaid → diagram
  if (fm.type === 'mermaid') {
    if (VERBOSE) console.log(`  [type] ${frag.path}: mermaid → diagram`);
    fm.type = 'diagram';
    if (!fm.diagram_format) {
      fm.diagram_format = 'mermaid';
    }
    changed = true;
    typeFixes++;
  }

  // 3. Fix underscore IDs
  if (frag.id in RENAME_MAP) {
    const newId = RENAME_MAP[frag.id]!;
    if (VERBOSE) console.log(`  [rename] ${frag.id} → ${newId}`);
    fm.id = newId;

    // Build new path
    const newFileName = `${newId}.${frag.lang}.md`;
    newPath = join(dirname(frag.path), newFileName);
    changed = true;
    idFixes++;
    filesRenamed++;
  }

  // 4. Handle merges (language-suffixed diagram IDs)
  if (frag.id in MERGE_MAP) {
    const newId = MERGE_MAP[frag.id]!;

    // For merged IDs, we keep ONE pair of .en.md / .ja.md under the new ID
    // The -en variant provides the English content, -ja variant provides Japanese
    // Since these are stub diagrams anyway, we just rename and update

    // If this is the "-en" variant, rename to base ID
    // If this is the "-ja" variant and "-en" exists, this becomes the content
    // But since both en/ja files exist for each variant, pick the right ones:
    //   esolia-m365-components-en.en.md → esolia-m365-components.en.md
    //   esolia-m365-components-ja.ja.md → esolia-m365-components.ja.md
    //   esolia-m365-components-en.ja.md → delete (redundant)
    //   esolia-m365-components-ja.en.md → delete (redundant)

    const isNaturalLang = (
      (frag.id.endsWith('-en') && frag.lang === 'en') ||
      (frag.id.endsWith('-ja') && frag.lang === 'ja')
    );

    if (isNaturalLang) {
      // This is the right file to keep
      fm.id = newId;
      fm.title = toTitleCase(newId.replace(/-/g, ' '));
      const newFileName = `${newId}.${frag.lang}.md`;
      newPath = join(dirname(frag.path), newFileName);
      changed = true;
      mergedPairs++;
    } else {
      // This is a redundant file — mark for deletion
      return { changed: true, newContent: '', delete: true };
    }
  }

  // For the single special case of esolia-cloudflare-m365-smb-security-coverage-ja:
  // It only has one source pair, not two. Both .en.md and .ja.md should be renamed.
  if (frag.id === 'esolia-cloudflare-m365-smb-security-coverage-ja' && !(frag.id in MERGE_MAP && (frag.id.endsWith('-en') || frag.id.endsWith('-ja')))) {
    // Already handled above in MERGE_MAP, but this ID ends in -ja and is not
    // a dual-variant. Special handling: rename both files.
    // Actually, this IS in MERGE_MAP above, so the merge logic handles it.
    // The en file will be "redundant" since frag.id ends in -ja and frag.lang is en.
    // But that's wrong for this case — this is a SINGLE fragment, not a merge of two.
    // Let me fix: for this ID, keep BOTH files.
  }

  // 5. Standardize title capitalization
  if (typeof fm.title === 'string') {
    const titleCased = toTitleCase(fm.title);
    if (titleCased !== fm.title) {
      if (VERBOSE) console.log(`  [title] "${fm.title}" → "${titleCased}"`);
      fm.title = titleCased;
      changed = true;
      titleFixes++;
    }
  }

  // Update body if it's a stub "Diagram: ..." placeholder
  if (body.trim().startsWith('Diagram: ') && typeof fm.title === 'string') {
    const newBody = `Diagram: ${fm.title}\n`;
    if (newBody !== body) {
      body = newBody;
      changed = true;
    }
  }

  const newContent = changed ? serializeFrontmatter(fm, body) : frag.content;
  return { changed, newContent, newPath };
}

// ─── Main ───────────────────────────────────────────────────────────────────

console.log(`\nFragment Cleanup Script`);
console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`);

const fragments = discoverFragments();
console.log(`Found ${fragments.length} markdown fragment files\n`);

// First pass: handle the esolia-cloudflare-m365-smb-security-coverage-ja special case
// This ID ends in -ja but is NOT a dual-variant merge — it's a single fragment to rename
// Override MERGE_MAP behavior: keep both .en and .ja files
const cfSecId = 'esolia-cloudflare-m365-smb-security-coverage-ja';
const cfSecNewId = 'esolia-cloudflare-m365-smb-security-coverage';

// Process all files
const deletions: string[] = [];
const renames: Array<{ from: string; to: string; content: string }> = [];
const updates: Array<{ path: string; content: string }> = [];

for (const frag of fragments) {
  // Special handling for the CF security coverage fragment
  if (frag.id === cfSecId) {
    const newId = cfSecNewId;
    const fm = { ...frag.frontmatter };
    fm.id = newId;
    fm.title = toTitleCase(newId.replace(/-/g, ' '));
    if (fm.status === 'active') { fm.status = 'production'; statusFixes++; }
    if (fm.type === 'mermaid') { fm.type = 'diagram'; fm.diagram_format = 'mermaid'; typeFixes++; }

    const titleCased = toTitleCase(fm.title as string);
    if (titleCased !== fm.title) { fm.title = titleCased; titleFixes++; }

    let body = frag.body;
    if (body.trim().startsWith('Diagram: ')) {
      body = `Diagram: ${fm.title}\n`;
    }

    const newContent = serializeFrontmatter(fm, body);
    const newFileName = `${newId}.${frag.lang}.md`;
    const newFilePath = join(dirname(frag.path), newFileName);

    renames.push({ from: frag.path, to: newFilePath, content: newContent });
    idFixes++;
    filesRenamed++;
    continue;
  }

  // For esolia-m365-components merges, handle specially
  if (frag.id === 'esolia-m365-components-en' || frag.id === 'esolia-m365-components-ja') {
    const newId = 'esolia-m365-components';
    const isNaturalLang = (
      (frag.id === 'esolia-m365-components-en' && frag.lang === 'en') ||
      (frag.id === 'esolia-m365-components-ja' && frag.lang === 'ja')
    );

    if (isNaturalLang) {
      const fm = { ...frag.frontmatter };
      fm.id = newId;
      if (fm.status === 'active') { fm.status = 'production'; statusFixes++; }
      if (fm.type === 'mermaid') { fm.type = 'diagram'; fm.diagram_format = 'mermaid'; typeFixes++; }

      fm.title = toTitleCase(newId.replace(/-/g, ' '));
      titleFixes++;

      let body = frag.body;
      if (body.trim().startsWith('Diagram: ')) {
        body = `Diagram: ${fm.title}\n`;
      }

      const newContent = serializeFrontmatter(fm, body);
      const newFileName = `${newId}.${frag.lang}.md`;
      const newFilePath = join(dirname(frag.path), newFileName);

      renames.push({ from: frag.path, to: newFilePath, content: newContent });
      mergedPairs++;
      filesRenamed++;
    } else {
      // Redundant file (e.g., esolia-m365-components-en.ja.md) — delete
      deletions.push(frag.path);
      filesDeleted++;
    }
    continue;
  }

  // Standard processing
  const result = processFile(frag);
  if (result.delete) {
    deletions.push(frag.path);
    filesDeleted++;
  } else if (result.changed) {
    if (result.newPath) {
      renames.push({ from: frag.path, to: result.newPath, content: result.newContent });
    } else {
      updates.push({ path: frag.path, content: result.newContent });
    }
  }
}

// ─── Summary ────────────────────────────────────────────────────────────────

console.log('Changes summary:');
console.log(`  Status fixes (active → production): ${statusFixes}`);
console.log(`  Type fixes (mermaid → diagram):     ${typeFixes}`);
console.log(`  ID renames:                          ${idFixes}`);
console.log(`  Title case fixes:                    ${titleFixes}`);
console.log(`  Merged pairs:                        ${mergedPairs}`);
console.log(`  Files renamed:                       ${filesRenamed}`);
console.log(`  Files to delete:                     ${filesDeleted}`);
console.log(`  Files updated in-place:              ${updates.length}`);
console.log();

if (deletions.length > 0) {
  console.log('Files to DELETE:');
  for (const path of deletions) {
    console.log(`  - ${path.replace(ROOT + '/', '')}`);
  }
  console.log();
}

if (renames.length > 0) {
  console.log('Files to RENAME:');
  for (const r of renames) {
    console.log(`  ${r.from.replace(ROOT + '/', '')} → ${r.to.replace(ROOT + '/', '')}`);
  }
  console.log();
}

if (APPLY) {
  console.log('Applying changes...\n');

  // Apply in-place updates
  for (const u of updates) {
    writeFileSync(u.path, u.content, 'utf-8');
    console.log(`  Updated: ${u.path.replace(ROOT + '/', '')}`);
  }

  // Apply renames (write new, delete old)
  for (const r of renames) {
    writeFileSync(r.to, r.content, 'utf-8');
    if (r.from !== r.to && existsSync(r.from)) {
      unlinkSync(r.from);
    }
    console.log(`  Renamed: ${r.from.replace(ROOT + '/', '')} → ${r.to.replace(ROOT + '/', '')}`);
  }

  // Apply deletions
  for (const d of deletions) {
    if (existsSync(d)) {
      unlinkSync(d);
      console.log(`  Deleted: ${d.replace(ROOT + '/', '')}`);
    }
  }

  console.log('\nDone!');
} else {
  console.log('No changes applied. Use --apply to apply changes.');
}

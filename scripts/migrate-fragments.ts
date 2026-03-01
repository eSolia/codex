/**
 * Fragment Migration Script: YAML → Markdown
 *
 * Converts all fragment YAML files in content/fragments/ to bilingual
 * markdown files with frontmatter:
 *   {id}.en.md — English content
 *   {id}.ja.md — Japanese content
 *
 * Three fragment types handled:
 *   1. Content fragments: content.en / content.ja → text body
 *   2. Single-language diagrams: diagram.source + content.en/ja (caption)
 *   3. Bilingual diagrams: content.mermaid_en / content.mermaid_ja
 *
 * Usage:
 *   npx tsx scripts/migrate-fragments.ts [--dry-run] [--verbose]
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, basename } from 'node:path';
import { parse as parseYaml } from 'yaml';

// ─── CLI flags ───────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const VERBOSE = args.includes('--verbose');

// ─── Paths ───────────────────────────────────────────────────────────────────
import { fileURLToPath } from 'node:url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const FRAGMENTS_DIR = join(ROOT, 'content', 'fragments');

// ─── Types ───────────────────────────────────────────────────────────────────
interface FragmentYaml {
  id: string;
  title?: { en?: string; ja?: string };
  category?: string;
  type?: string;
  version?: string;
  versions?: { current?: string; history?: Array<{ version: string; changes: string }> };
  status?: string;
  tags?: string[];
  language?: string;
  created?: string;
  modified?: string;
  author?: string;
  reviewer?: string;
  review_due?: string;
  sensitivity?: string;
  allowed_collections?: string[];
  content?: {
    en?: string;
    ja?: string;
    mermaid_en?: string;
    mermaid_ja?: string;
    mermaid?: string;
    caption_en?: string;
    caption_ja?: string;
  };
  diagram?: {
    format?: string;
    source?: string;
  };
  metadata?: {
    last_updated?: string;
    author?: string;
    usage_notes?: string;
    tags?: string[];
    exported_at?: string;
    updated_at?: string;
    created?: string;
  };
}

interface MigrationResult {
  yamlPath: string;
  id: string;
  enPath: string | null;
  jaPath: string | null;
  type: 'content' | 'diagram-single' | 'diagram-bilingual' | 'diagram-mono';
  skipped: boolean;
  reason?: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Recursively find all .yaml files under a directory */
function findYamlFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findYamlFiles(full));
    } else if (entry.endsWith('.yaml') || entry.endsWith('.yml')) {
      results.push(full);
    }
  }
  return results.sort();
}

/** Build YAML frontmatter string from a key/value map */
function buildFrontmatter(fields: Record<string, unknown>): string {
  const lines: string[] = ['---'];
  for (const [key, value] of Object.entries(fields)) {
    if (value === null || value === undefined) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const item of value) {
        if (typeof item === 'object') {
          // version history entries
          const obj = item as Record<string, string>;
          lines.push(`  - version: "${obj.version}"`);
          if (obj.changes) lines.push(`    changes: "${obj.changes}"`);
        } else {
          lines.push(`  - "${item}"`);
        }
      }
    } else if (typeof value === 'string') {
      // Quote strings that contain special YAML characters
      if (value.includes(':') || value.includes('#') || value.includes('"') || value.startsWith('{') || value.startsWith('[')) {
        lines.push(`${key}: "${value.replace(/"/g, '\\"')}"`);
      } else {
        lines.push(`${key}: ${value}`);
      }
    } else if (typeof value === 'boolean') {
      lines.push(`${key}: ${value}`);
    } else {
      lines.push(`${key}: ${String(value)}`);
    }
  }
  lines.push('---');
  return lines.join('\n');
}

/** Determine the fragment type based on available fields */
function classifyFragment(frag: FragmentYaml): 'content' | 'diagram-single' | 'diagram-bilingual' | 'diagram-mono' {
  if (frag.content?.mermaid_en || frag.content?.mermaid_ja) {
    return 'diagram-bilingual';
  }
  if (frag.content?.mermaid) {
    return 'diagram-mono';
  }
  if (frag.diagram?.source) {
    return 'diagram-single';
  }
  return 'content';
}

/** Build common frontmatter fields from a fragment */
function commonFrontmatter(frag: FragmentYaml, lang: 'en' | 'ja'): Record<string, unknown> {
  const title = lang === 'en' ? frag.title?.en : frag.title?.ja;
  const version = frag.versions?.current ?? frag.version ?? null;

  const fm: Record<string, unknown> = {
    id: frag.id,
    language: lang,
    title: title ?? frag.title?.en ?? frag.id,
    category: frag.category ?? null,
    type: frag.type ?? null,
    version,
    status: frag.status ?? 'production',
    tags: mergedTags(frag),
    sensitivity: frag.sensitivity ?? 'normal',
    author: frag.author ?? frag.metadata?.author ?? 'eSolia Technical Team',
    created: frag.created ?? frag.metadata?.created ?? frag.metadata?.last_updated ?? null,
    modified: frag.modified ?? frag.metadata?.updated_at ?? frag.metadata?.last_updated ?? null,
  };

  // Optional fields
  if (frag.reviewer) fm.reviewer = frag.reviewer;
  if (frag.review_due) fm.review_due = frag.review_due;
  if (frag.allowed_collections) fm.allowed_collections = frag.allowed_collections;
  if (frag.versions?.history) fm.version_history = frag.versions.history;
  if (frag.metadata?.usage_notes) fm.usage_notes = frag.metadata.usage_notes.trim();

  // Diagram metadata
  if (frag.diagram?.format) fm.diagram_format = frag.diagram.format;

  return fm;
}

/** Merge tags from root level and metadata */
function mergedTags(frag: FragmentYaml): string[] {
  const rootTags = frag.tags ?? [];
  const metaTags = frag.metadata?.tags ?? [];
  const all = new Set([...rootTags, ...metaTags]);
  return [...all];
}

/** Trim trailing whitespace from content but ensure it ends with a newline */
function normalizeContent(text: string): string {
  return text.replace(/\s+$/, '') + '\n';
}

// ─── Migration logic ─────────────────────────────────────────────────────────

function migrateFragment(yamlPath: string): MigrationResult {
  const raw = readFileSync(yamlPath, 'utf-8');
  const frag = parseYaml(raw) as FragmentYaml;

  if (!frag.id) {
    return {
      yamlPath,
      id: '(unknown)',
      enPath: null,
      jaPath: null,
      type: 'content',
      skipped: true,
      reason: 'Missing id field',
    };
  }

  const fragType = classifyFragment(frag);
  const dir = dirname(yamlPath);
  const enPath = join(dir, `${frag.id}.en.md`);
  const jaPath = join(dir, `${frag.id}.ja.md`);
  let wroteEn = false;
  let wroteJa = false;

  if (fragType === 'content') {
    // Standard content fragment: content.en / content.ja
    const enContent = frag.content?.en;
    const jaContent = frag.content?.ja;

    if (enContent) {
      const fm = buildFrontmatter(commonFrontmatter(frag, 'en'));
      const md = `${fm}\n\n${normalizeContent(enContent)}`;
      if (!DRY_RUN) writeFileSync(enPath, md, 'utf-8');
      wroteEn = true;
    }

    if (jaContent) {
      const fm = buildFrontmatter(commonFrontmatter(frag, 'ja'));
      const md = `${fm}\n\n${normalizeContent(jaContent)}`;
      if (!DRY_RUN) writeFileSync(jaPath, md, 'utf-8');
      wroteJa = true;
    }
  } else if (fragType === 'diagram-single') {
    // Single-language diagram: diagram.source is the same in both languages
    // content.en / content.ja are captions
    const diagramSource = frag.diagram?.source ?? '';
    const enCaption = frag.content?.en ?? '';
    const jaCaption = frag.content?.ja ?? '';

    // English version
    {
      const fm = buildFrontmatter(commonFrontmatter(frag, 'en'));
      let body = `\`\`\`mermaid\n${diagramSource.replace(/\s+$/, '')}\n\`\`\`\n`;
      if (enCaption.trim()) {
        body += `\n${normalizeContent(enCaption)}`;
      }
      const md = `${fm}\n\n${body}`;
      if (!DRY_RUN) writeFileSync(enPath, md, 'utf-8');
      wroteEn = true;
    }

    // Japanese version (same diagram, different caption)
    {
      const fm = buildFrontmatter(commonFrontmatter(frag, 'ja'));
      let body = `\`\`\`mermaid\n${diagramSource.replace(/\s+$/, '')}\n\`\`\`\n`;
      if (jaCaption.trim()) {
        body += `\n${normalizeContent(jaCaption)}`;
      }
      const md = `${fm}\n\n${body}`;
      if (!DRY_RUN) writeFileSync(jaPath, md, 'utf-8');
      wroteJa = true;
    }
  } else if (fragType === 'diagram-mono') {
    // Single diagram with bilingual captions: content.mermaid + content.caption_en/caption_ja
    // The diagram source is the same in both languages; captions differ.
    const diagramSource = frag.content?.mermaid ?? '';
    const captionEn = frag.content?.caption_en ?? '';
    const captionJa = frag.content?.caption_ja ?? '';

    if (diagramSource) {
      // English version
      {
        const fm = buildFrontmatter(commonFrontmatter(frag, 'en'));
        let body = `\`\`\`mermaid\n${diagramSource.replace(/\s+$/, '')}\n\`\`\`\n`;
        if (captionEn.trim()) {
          body += `\n${normalizeContent(captionEn)}`;
        }
        const md = `${fm}\n\n${body}`;
        if (!DRY_RUN) writeFileSync(enPath, md, 'utf-8');
        wroteEn = true;
      }

      // Japanese version (same diagram, different caption)
      {
        const fm = buildFrontmatter(commonFrontmatter(frag, 'ja'));
        let body = `\`\`\`mermaid\n${diagramSource.replace(/\s+$/, '')}\n\`\`\`\n`;
        if (captionJa.trim()) {
          body += `\n${normalizeContent(captionJa)}`;
        }
        const md = `${fm}\n\n${body}`;
        if (!DRY_RUN) writeFileSync(jaPath, md, 'utf-8');
        wroteJa = true;
      }
    }
  } else if (fragType === 'diagram-bilingual') {
    // Bilingual diagram: content.mermaid_en / content.mermaid_ja
    const mermaidEn = frag.content?.mermaid_en ?? '';
    const mermaidJa = frag.content?.mermaid_ja ?? '';

    if (mermaidEn) {
      const fm = buildFrontmatter(commonFrontmatter(frag, 'en'));
      const body = `\`\`\`mermaid\n${mermaidEn.replace(/\s+$/, '')}\n\`\`\`\n`;
      const md = `${fm}\n\n${body}`;
      if (!DRY_RUN) writeFileSync(enPath, md, 'utf-8');
      wroteEn = true;
    }

    if (mermaidJa) {
      const fm = buildFrontmatter(commonFrontmatter(frag, 'ja'));
      const body = `\`\`\`mermaid\n${mermaidJa.replace(/\s+$/, '')}\n\`\`\`\n`;
      const md = `${fm}\n\n${body}`;
      if (!DRY_RUN) writeFileSync(jaPath, md, 'utf-8');
      wroteJa = true;
    }
  }

  return {
    yamlPath,
    id: frag.id,
    enPath: wroteEn ? enPath : null,
    jaPath: wroteJa ? jaPath : null,
    type: fragType,
    skipped: !wroteEn && !wroteJa,
    reason: !wroteEn && !wroteJa ? 'No content found' : undefined,
  };
}

// ─── Main ────────────────────────────────────────────────────────────────────

function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log('  Fragment Migration: YAML → Markdown');
  console.log(`  ${DRY_RUN ? '(DRY RUN — no files will be written)' : '(LIVE — writing files)'}`);
  console.log(`${'='.repeat(60)}\n`);

  if (!existsSync(FRAGMENTS_DIR)) {
    console.error(`Error: Fragments directory not found: ${FRAGMENTS_DIR}`);
    process.exit(1);
  }

  const yamlFiles = findYamlFiles(FRAGMENTS_DIR);
  console.log(`Found ${yamlFiles.length} YAML files\n`);

  const results: MigrationResult[] = [];
  const stats = {
    total: 0,
    content: 0,
    diagramSingle: 0,
    diagramBilingual: 0,
    diagramMono: 0,
    skipped: 0,
    enFiles: 0,
    jaFiles: 0,
  };

  for (const yamlPath of yamlFiles) {
    const relPath = relative(ROOT, yamlPath);
    stats.total++;

    try {
      const result = migrateFragment(yamlPath);
      results.push(result);

      if (result.skipped) {
        stats.skipped++;
        console.log(`  SKIP  ${relPath} — ${result.reason}`);
      } else {
        if (result.type === 'content') stats.content++;
        else if (result.type === 'diagram-single') stats.diagramSingle++;
        else if (result.type === 'diagram-bilingual') stats.diagramBilingual++;
        else if (result.type === 'diagram-mono') stats.diagramMono++;

        if (result.enPath) stats.enFiles++;
        if (result.jaPath) stats.jaFiles++;

        const langs = [result.enPath ? 'EN' : '', result.jaPath ? 'JA' : '']
          .filter(Boolean)
          .join('+');
        const iconMap: Record<string, string> = {
          'content': 'DOC',
          'diagram-single': 'DIA',
          'diagram-bilingual': 'D2L',
          'diagram-mono': 'DMO',
        };
        const icon = iconMap[result.type] ?? 'DOC';

        if (VERBOSE) {
          console.log(`  ${icon}  ${relPath} → ${result.id} [${langs}]`);
        } else {
          console.log(`  OK  ${result.id} [${langs}] (${result.type})`);
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ERR  ${relPath} — ${message}`);
      results.push({
        yamlPath,
        id: basename(yamlPath, '.yaml'),
        enPath: null,
        jaPath: null,
        type: 'content',
        skipped: true,
        reason: message,
      });
      stats.skipped++;
    }
  }

  // Summary
  console.log(`\n${'─'.repeat(60)}`);
  console.log('  Summary');
  console.log(`${'─'.repeat(60)}`);
  console.log(`  YAML files processed:   ${stats.total}`);
  console.log(`  Content fragments:      ${stats.content}`);
  console.log(`  Diagrams (single):      ${stats.diagramSingle}`);
  console.log(`  Diagrams (bilingual):   ${stats.diagramBilingual}`);
  console.log(`  Diagrams (mono):        ${stats.diagramMono}`);
  console.log(`  Skipped:                ${stats.skipped}`);
  console.log(`  .en.md files created:   ${stats.enFiles}`);
  console.log(`  .ja.md files created:   ${stats.jaFiles}`);
  console.log(`  Total markdown files:   ${stats.enFiles + stats.jaFiles}`);
  console.log(`${'─'.repeat(60)}\n`);

  if (DRY_RUN) {
    console.log('  Dry run complete. Re-run without --dry-run to write files.\n');
  } else {
    console.log('  Migration complete. Verify output with:\n');
    console.log('    find content/fragments -name "*.en.md" | wc -l');
    console.log('    find content/fragments -name "*.ja.md" | wc -l\n');
  }
}

main();

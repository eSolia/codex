/**
 * Export fragments from D1 database to YAML files
 * Run with: npx tsx scripts/export-fragments.ts
 *
 * This creates a backup of the canonical D1 data as version-controlled YAML.
 * The exported YAML files can be committed to git for backup/history.
 *
 * Requires wrangler to be configured with D1 access.
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { stringify } from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const EXPORT_DIR = join(__dirname, '..', 'content', 'fragments', 'exported');
const HANAWA_DIR = join(__dirname, '..', 'packages', 'hanawa-cms');

interface D1Fragment {
  id: string;
  site_id: string | null;
  name: string;
  slug: string;
  category: string;
  content_en: string | null;
  content_ja: string | null;
  description: string | null;
  tags: string | null;
  version: string;
  status: string;
  is_bilingual: number;
  default_locale: string;
  available_locales: string;
  created_at: string;
  updated_at: string;
}

function ensureDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function fragmentToYaml(fragment: D1Fragment): string {
  // Parse tags from JSON string
  let tags: string[] = [];
  try {
    tags = fragment.tags ? JSON.parse(fragment.tags) : [];
  } catch {
    tags = [];
  }

  // Parse available locales
  let availableLocales: string[] = ['en', 'ja'];
  try {
    availableLocales = fragment.available_locales
      ? JSON.parse(fragment.available_locales)
      : ['en', 'ja'];
  } catch {
    availableLocales = ['en', 'ja'];
  }

  // Build the YAML structure
  const yamlObj: Record<string, unknown> = {
    id: fragment.id,
    category: fragment.category,
    version: fragment.version,
    title: {
      en: fragment.name,
      ja: fragment.name, // Could be different if stored separately
    },
    tags,
    status: fragment.status,
    content: {
      en: fragment.content_en || '',
      ja: fragment.content_ja || '',
    },
  };

  if (fragment.description) {
    yamlObj.metadata = {
      usage_notes: fragment.description,
    };
  }

  // Add export metadata
  yamlObj._exported = {
    from: 'd1',
    at: new Date().toISOString(),
    is_bilingual: fragment.is_bilingual === 1,
    default_locale: fragment.default_locale,
    available_locales: availableLocales,
  };

  const header = [
    `# ${fragment.name}`,
    `# ${'='.repeat(75)}`,
    `# Exported from D1 database`,
    `# Category: ${fragment.category}`,
    `# Last updated: ${fragment.updated_at}`,
    `# ${'='.repeat(75)}`,
    '',
  ].join('\n');

  return header + stringify(yamlObj, { lineWidth: 0 });
}

async function main() {
  console.log('Exporting fragments from D1...\n');

  // Query D1 for all fragments
  const query = 'SELECT * FROM fragments ORDER BY category, id';

  try {
    const result = execSync(
      `npx wrangler d1 execute hanawa-db --remote --command="${query}" --json`,
      {
        cwd: HANAWA_DIR,
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large result sets
      }
    );

    const parsed = JSON.parse(result);
    const fragments: D1Fragment[] = parsed[0]?.results || [];

    console.log(`Found ${fragments.length} fragments in D1\n`);

    if (fragments.length === 0) {
      console.log('No fragments to export.');
      return;
    }

    // Ensure export directory exists
    ensureDir(EXPORT_DIR);

    // Group by category
    const byCategory = new Map<string, D1Fragment[]>();
    for (const fragment of fragments) {
      const cat = fragment.category || 'uncategorized';
      if (!byCategory.has(cat)) {
        byCategory.set(cat, []);
      }
      byCategory.get(cat)!.push(fragment);
    }

    let exported = 0;
    for (const [category, frags] of byCategory) {
      const categoryDir = join(EXPORT_DIR, category);
      ensureDir(categoryDir);

      console.log(`\n${category}/`);
      for (const fragment of frags) {
        const yamlContent = fragmentToYaml(fragment);
        const filePath = join(categoryDir, `${fragment.id}.yaml`);
        writeFileSync(filePath, yamlContent);
        console.log(`  ✓ ${fragment.id}.yaml`);
        exported++;
      }
    }

    console.log(`\n✓ Exported ${exported} fragments to ${EXPORT_DIR}`);
    console.log('\nTo commit the backup:');
    console.log('  git add content/fragments/exported/');
    console.log('  git commit -m "chore(fragments): backup D1 fragments to YAML"');
  } catch (error) {
    console.error('Error exporting fragments:', error);
    process.exit(1);
  }
}

main();

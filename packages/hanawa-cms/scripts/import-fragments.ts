/**
 * Import YAML fragments into D1 database
 * Run with: npx tsx scripts/import-fragments.ts
 */

import { readFileSync, readdirSync, statSync } from "fs";
import { join, basename, dirname } from "path";
import { fileURLToPath } from "url";
import { parse } from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const FRAGMENTS_DIR = "../../../content/fragments";

interface YamlFragment {
  id: string;
  title: { en?: string; ja?: string };
  type?: string;
  versions?: { current: string };
  content: { en?: string; ja?: string };
  metadata?: {
    last_updated?: string;
    author?: string;
    tags?: string[];
  };
}

interface DbFragment {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string | null;
  content_en: string | null;
  content_ja: string | null;
  is_bilingual: number;
  tags: string;
  version: string;
  status: string;
}

function walkDir(dir: string, category = ""): { path: string; category: string }[] {
  const results: { path: string; category: string }[] = [];

  try {
    const items = readdirSync(dir);

    for (const item of items) {
      if (item.startsWith(".") || item.startsWith("_")) continue;

      const fullPath = join(dir, item);
      const stat = statSync(fullPath);

      if (stat.isDirectory()) {
        results.push(...walkDir(fullPath, item));
      } else if (item.endsWith(".yaml") || item.endsWith(".yml")) {
        results.push({ path: fullPath, category: category || "general" });
      }
    }
  } catch (err) {
    console.error(`Error reading directory ${dir}:`, err);
  }

  return results;
}

function parseFragment(filePath: string, category: string): DbFragment | null {
  try {
    const content = readFileSync(filePath, "utf-8");
    const yaml = parse(content) as YamlFragment;

    const slug = basename(filePath, ".yaml").replace(".yml", "");
    const name = yaml.title?.en || yaml.title?.ja || slug;

    return {
      id: yaml.id || `${category}/${slug}`,
      name,
      slug,
      category,
      description: yaml.type || null,
      content_en: yaml.content?.en || null,
      content_ja: yaml.content?.ja || null,
      is_bilingual: yaml.content?.en && yaml.content?.ja ? 1 : 0,
      tags: JSON.stringify(yaml.metadata?.tags || []),
      version: yaml.versions?.current || "1.0",
      status: "active",
    };
  } catch (err) {
    console.error(`Error parsing ${filePath}:`, err);
    return null;
  }
}

async function main() {
  const fragmentsPath = join(__dirname, FRAGMENTS_DIR);
  console.log(`Scanning: ${fragmentsPath}`);

  const files = walkDir(fragmentsPath);
  console.log(`Found ${files.length} fragment files\n`);

  const fragments: DbFragment[] = [];

  for (const { path, category } of files) {
    const fragment = parseFragment(path, category);
    if (fragment) {
      fragments.push(fragment);
      console.log(`✓ ${fragment.category}/${fragment.slug} (${fragment.is_bilingual ? "EN/JA" : "single lang"})`);
    }
  }

  console.log(`\n--- SQL INSERT statements ---\n`);

  const sqlStatements: string[] = [];
  for (const f of fragments) {
    const sql = `INSERT OR REPLACE INTO fragments (id, name, slug, category, description, content_en, content_ja, is_bilingual, tags, version, status, created_at, updated_at) VALUES ('${f.id}', '${f.name.replace(/'/g, "''")}', '${f.slug}', '${f.category}', ${f.description ? `'${f.description}'` : "NULL"}, '${(f.content_en || "").replace(/'/g, "''").replace(/\n/g, "\\n")}', '${(f.content_ja || "").replace(/'/g, "''").replace(/\n/g, "\\n")}', ${f.is_bilingual}, '${f.tags}', '${f.version}', '${f.status}', datetime('now'), datetime('now'));`;

    sqlStatements.push(sql);
    console.log(sql);
    console.log();
  }

  // Write to file for D1 import
  const { writeFileSync } = await import("fs");
  const outputPath = join(__dirname, "../fragments-import.sql");
  writeFileSync(outputPath, sqlStatements.join("\n\n"));
  console.log(`\nSQL written to: ${outputPath}`);

  console.log(`\n--- Summary ---`);
  console.log(`Total fragments: ${fragments.length}`);
  console.log(`Bilingual: ${fragments.filter(f => f.is_bilingual).length}`);
  console.log(`Categories: ${[...new Set(fragments.map(f => f.category))].join(", ")}`);
}

main().catch(console.error);

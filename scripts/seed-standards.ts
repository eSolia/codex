#!/usr/bin/env -S npx tsx

/**
 * seed-standards.ts
 *
 * Reads all markdown files from content/standards/ and uploads them
 * to the R2 codex bucket at standards/{slug}.md for the MCP server.
 *
 * Usage:
 *   npx tsx scripts/seed-standards.ts
 *   npx tsx scripts/seed-standards.ts --remote
 *   npx tsx scripts/seed-standards.ts --dry-run
 */

import { readdir, readFile } from "node:fs/promises";
import { join, basename, extname } from "node:path";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    dir: { type: "string", default: "content/standards" },
    bucket: { type: "string", default: "codex" },
    remote: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

interface Frontmatter {
  title?: string;
  slug?: string;
  category?: string;
  tags?: string[];
  summary?: string;
  [key: string]: unknown;
}

function parseFrontmatter(content: string): {
  metadata: Frontmatter;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, body: content };
  }

  const frontmatter = match[1];
  const body = match[2].trim();
  const metadata: Frontmatter = {};

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value: string | string[] = line.slice(colonIdx + 1).trim();

    // Strip surrounding quotes
    if (
      typeof value === "string" &&
      value.startsWith('"') &&
      value.endsWith('"')
    ) {
      value = value.slice(1, -1);
    }

    // Handle YAML arrays like [tag1, tag2, tag3]
    if (
      typeof value === "string" &&
      value.startsWith("[") &&
      value.endsWith("]")
    ) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim());
    }

    metadata[key] = value;
  }

  return { metadata, body };
}

async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      const subFiles = await findMarkdownFiles(fullPath);
      files.push(...subFiles);
    } else if (entry.isFile() && extname(entry.name) === ".md") {
      files.push(fullPath);
    }
  }

  return files;
}

async function main() {
  const dir = values.dir ?? "content/standards";
  const bucket = values.bucket ?? "codex";
  const isDryRun = values["dry-run"] ?? false;
  const isRemote = values.remote ?? false;

  console.log(`📂 Reading standards from: ${dir}`);
  console.log(`📦 Target R2 bucket: ${bucket}${isRemote ? " (remote)" : " (local)"}`);

  const files = await findMarkdownFiles(dir);
  console.log(`📄 Found ${files.length} markdown file(s)\n`);

  if (files.length === 0) {
    console.log("No markdown files found. Run migration first.");
    process.exit(1);
  }

  let seeded = 0;
  let failed = 0;

  for (const filePath of files) {
    const fileSlug = basename(filePath, ".md");
    const raw = await readFile(filePath, "utf-8");
    const { metadata } = parseFrontmatter(raw);

    const effectiveSlug = (metadata.slug as string) ?? fileSlug;
    const title = (metadata.title as string) ?? fileSlug;
    const category = (metadata.category as string) ?? "general";
    const tags = Array.isArray(metadata.tags) ? metadata.tags : [];

    // R2 key: standards/{slug}.md — the full file (with frontmatter) is uploaded
    const r2Key = `standards/${effectiveSlug}.md`;

    if (isDryRun) {
      console.log(`  🔍 ${r2Key} → "${title}" (${category})`);
      console.log(`     Tags: ${tags.join(", ") || "(none)"}`);
      console.log(`     Size: ${raw.length} chars`);
      seeded++;
      continue;
    }

    // Upload to R2 via wrangler CLI
    // InfoSec: file path is from local filesystem, not user input
    const remoteFlag = isRemote ? "--remote" : "--local";
    const cmd = `npx wrangler r2 object put "${bucket}/${r2Key}" --file "${filePath}" --content-type "text/markdown" ${remoteFlag}`;

    try {
      execSync(cmd, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: join(
          import.meta.dirname ?? process.cwd(),
          "..",
          "packages",
          "esolia-standards-mcp"
        ),
      });
      console.log(`  ✅ ${effectiveSlug} → ${r2Key}`);
      seeded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed to upload "${effectiveSlug}": ${message}`);
      failed++;
    }
  }

  console.log(
    `\n🎉 Done! ${seeded} uploaded, ${failed} failed out of ${files.length} total.`
  );
  if (isDryRun) {
    console.log("   (dry run — no R2 writes performed)");
  }
}

main().catch(console.error);

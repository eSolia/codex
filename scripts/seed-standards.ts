#!/usr/bin/env -S npx tsx

/**
 * seed-standards.ts
 *
 * Reads all markdown files from content/standards/ and uploads them
 * to the R2 codex bucket at standards/{slug}.md for the MCP server.
 *
 * Only uploads files whose content has changed since the last run,
 * tracked via a local manifest of content hashes.
 *
 * Usage:
 *   npx tsx scripts/seed-standards.ts              # upload changed files (local R2)
 *   npx tsx scripts/seed-standards.ts --remote      # upload changed files (remote R2)
 *   npx tsx scripts/seed-standards.ts --force        # upload all files regardless
 *   npx tsx scripts/seed-standards.ts --dry-run      # show what would change
 */

import { readdir, readFile, writeFile, mkdir } from "node:fs/promises";
import { join, resolve, basename, extname } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

// ─── Reliable path resolution ───────────────────────────────────────────────
// import.meta.dirname is undefined in some tsx versions, so derive from URL.
const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, "..", "..");
const WRANGLER_CWD = join(REPO_ROOT, "packages", "esolia-standards-mcp");
const MANIFEST_DIR = join(REPO_ROOT, "scripts");
const MANIFEST_PATH = join(MANIFEST_DIR, ".seed-manifest.json");

const { values } = parseArgs({
  options: {
    dir: { type: "string", default: "content/standards" },
    bucket: { type: "string", default: "codex" },
    remote: { type: "boolean", default: false },
    force: { type: "boolean", default: false },
    "dry-run": { type: "boolean", default: false },
  },
});

// ─── Manifest (content hash tracking) ───────────────────────────────────────

type Manifest = Record<string, string>; // slug → content MD5

async function loadManifest(): Promise<Manifest> {
  try {
    const raw = await readFile(MANIFEST_PATH, "utf-8");
    return JSON.parse(raw) as Manifest;
  } catch {
    return {};
  }
}

async function saveManifest(manifest: Manifest): Promise<void> {
  await mkdir(MANIFEST_DIR, { recursive: true });
  await writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");
}

function md5(content: string): string {
  return createHash("md5").update(content).digest("hex");
}

// ─── Frontmatter parsing ────────────────────────────────────────────────────

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

// ─── File discovery ─────────────────────────────────────────────────────────

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

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const dirRel = values.dir ?? "content/standards";
  const dirAbs = resolve(REPO_ROOT, dirRel);
  const bucket = values.bucket ?? "codex";
  const isDryRun = values["dry-run"] ?? false;
  const isRemote = values.remote ?? false;
  const isForce = values.force ?? false;

  console.log(`📂 Reading standards from: ${dirAbs}`);
  console.log(`📦 Target R2 bucket: ${bucket}${isRemote ? " (remote)" : " (local)"}`);

  const files = await findMarkdownFiles(dirAbs);
  console.log(`📄 Found ${files.length} markdown file(s)`);

  if (files.length === 0) {
    console.log("No markdown files found. Check the --dir path.");
    process.exit(1);
  }

  const manifest = await loadManifest();
  const newManifest: Manifest = {};

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (const filePath of files) {
    const fileSlug = basename(filePath, ".md");
    const raw = await readFile(filePath, "utf-8");
    const { metadata } = parseFrontmatter(raw);

    const effectiveSlug = (metadata.slug as string) ?? fileSlug;
    const title = (metadata.title as string) ?? fileSlug;
    const category = (metadata.category as string) ?? "general";
    const tags = Array.isArray(metadata.tags) ? metadata.tags : [];
    const r2Key = `standards/${effectiveSlug}.md`;
    const hash = md5(raw);

    // Track in new manifest regardless of upload
    newManifest[effectiveSlug] = hash;

    // Skip unchanged files unless --force
    if (!isForce && manifest[effectiveSlug] === hash) {
      skipped++;
      continue;
    }

    if (isDryRun) {
      const reason = manifest[effectiveSlug] ? "changed" : "new";
      console.log(`  🔍 ${r2Key} → "${title}" (${category}) [${reason}]`);
      console.log(`     Tags: ${tags.join(", ") || "(none)"}`);
      console.log(`     Size: ${raw.length} chars`);
      uploaded++;
      continue;
    }

    // Upload to R2 via wrangler CLI
    // InfoSec: file path is from local filesystem, not user input
    const args = [
      "wrangler", "r2", "object", "put",
      `${bucket}/${r2Key}`,
      "--file", filePath,
      "--content-type", "text/markdown",
      isRemote ? "--remote" : "--local",
    ];

    try {
      execFileSync("npx", args, {
        stdio: ["pipe", "pipe", "pipe"],
        cwd: WRANGLER_CWD,
      });
      console.log(`  ✅ ${effectiveSlug} → ${r2Key}`);
      uploaded++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ❌ Failed to upload "${effectiveSlug}": ${message}`);
      // Keep old hash so it retries next run
      if (manifest[effectiveSlug]) {
        newManifest[effectiveSlug] = manifest[effectiveSlug];
      } else {
        delete newManifest[effectiveSlug];
      }
      failed++;
    }
  }

  // Save manifest (unless dry run)
  if (!isDryRun) {
    await saveManifest(newManifest);
  }

  console.log(
    `\n🎉 Done! ${uploaded} uploaded, ${skipped} unchanged, ${failed} failed out of ${files.length} total.`
  );
  if (isDryRun) {
    console.log("   (dry run — no R2 writes or manifest updates performed)");
  }
  if (isForce) {
    console.log("   (--force: all files uploaded regardless of changes)");
  }
}

main().catch(console.error);

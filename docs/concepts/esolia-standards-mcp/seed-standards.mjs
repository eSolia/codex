#!/usr/bin/env node

/**
 * seed-standards.mjs
 *
 * Reads markdown files from a local standards directory and uploads them
 * to Cloudflare KV with structured metadata.
 *
 * Usage:
 *   node scripts/seed-standards.mjs --dir ./standards
 *   node scripts/seed-standards.mjs --dir ./standards --env production
 *
 * Each markdown file should have YAML frontmatter:
 *   ---
 *   title: Backpressure Patterns
 *   category: Code Quality
 *   tags: [async, flow-control, resilience]
 *   summary: How to use backpressure to write more resilient async code.
 *   ---
 */

import { readdir, readFile } from "node:fs/promises";
import { join, basename } from "node:path";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: {
    dir: { type: "string", default: "./standards" },
    namespace: { type: "string", default: "esolia-standards-kv" },
    env: { type: "string" },
    preview: { type: "boolean", default: false },
  },
});

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { metadata: {}, body: content };
  }

  const frontmatter = match[1];
  const body = match[2].trim();
  const metadata = {};

  for (const line of frontmatter.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    let value = line.slice(colonIdx + 1).trim();

    // Handle YAML arrays like [tag1, tag2, tag3]
    if (value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim());
    }

    metadata[key] = value;
  }

  return { metadata, body };
}

async function main() {
  const dir = values.dir;
  console.log(`📂 Reading standards from: ${dir}`);

  const files = (await readdir(dir)).filter((f) => f.endsWith(".md"));
  console.log(`📄 Found ${files.length} markdown file(s)\n`);

  for (const file of files) {
    const slug = basename(file, ".md");
    const raw = await readFile(join(dir, file), "utf-8");
    const { metadata, body } = parseFrontmatter(raw);

    const kvMetadata = JSON.stringify({
      slug,
      title: metadata.title || slug,
      category: metadata.category || "General",
      tags: Array.isArray(metadata.tags) ? metadata.tags : [],
      summary: metadata.summary || "",
    });

    const key = `standard:${slug}`;

    // Write to KV via wrangler
    const envFlag = values.env ? `--env ${values.env}` : "";
    const previewFlag = values.preview ? "--preview" : "";
    const bindingFlag = `--binding STANDARDS_KV`;

    // wrangler kv key put requires piping content via stdin for large values
    const cmd = `echo ${JSON.stringify(body)} | npx wrangler kv key put "${key}" --metadata='${kvMetadata}' ${bindingFlag} ${envFlag} ${previewFlag} --stdin`;

    try {
      execSync(cmd, { stdio: "pipe", cwd: process.cwd() });
      console.log(`  ✅ ${slug} → "${metadata.title || slug}" (${metadata.category || "General"})`);
    } catch (err) {
      console.error(`  ❌ Failed to seed "${slug}":`, err.message);
    }
  }

  console.log(`\n🎉 Done! ${files.length} standard(s) seeded to KV.`);
}

main().catch(console.error);

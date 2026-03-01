#!/usr/bin/env -S npx tsx

/**
 * validate-content.ts
 *
 * Validates markdown content files before syncing to R2.
 * Checks frontmatter schema, bilingual pair completeness, and naming conventions.
 *
 * Usage:
 *   npx tsx scripts/validate-content.ts                          # validate all content/fragments/
 *   npx tsx scripts/validate-content.ts --files path1.md path2.md  # validate specific files
 *   npx tsx scripts/validate-content.ts --strict                  # exit 1 on warnings too
 */

import { readdir, readFile } from "node:fs/promises";
import { join, resolve, basename, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const REPO_ROOT = resolve(__filename, "..", "..");

const { values, positionals } = parseArgs({
  options: {
    files: { type: "string", multiple: true },
    strict: { type: "boolean", default: false },
    dir: { type: "string", default: "content/fragments" },
  },
  allowPositionals: true,
});

// ─── Types ───────────────────────────────────────────────────────────────────

interface ValidationIssue {
  file: string;
  level: "error" | "warning";
  message: string;
}

// ─── Required frontmatter fields for fragments ──────────────────────────────

const REQUIRED_FIELDS = ["id", "language", "title", "category", "type"];
const VALID_LANGUAGES = ["en", "ja"];
const VALID_STATUSES = ["production", "draft", "deprecated", "archived"];
const VALID_SENSITIVITIES = ["normal", "confidential", "embargoed"];

// ─── Frontmatter parser (same as seed-standards.ts) ─────────────────────────

function parseFrontmatter(content: string): Record<string, unknown> {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};

  const meta: Record<string, unknown> = {};
  let currentKey = "";
  let inArray = false;
  const arrayItems: string[] = [];

  for (const line of match[1].split("\n")) {
    if (inArray && /^\s+-\s+/.test(line)) {
      const val = line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "");
      arrayItems.push(val);
      continue;
    }

    if (inArray) {
      meta[currentKey] = [...arrayItems];
      arrayItems.length = 0;
      inArray = false;
    }

    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;

    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    if (rawValue === "") {
      currentKey = key;
      inArray = true;
      continue;
    }

    let value: string | string[] = rawValue;
    if (
      typeof value === "string" &&
      value.startsWith('"') &&
      value.endsWith('"')
    ) {
      value = value.slice(1, -1);
    }
    if (
      typeof value === "string" &&
      value.startsWith("[") &&
      value.endsWith("]")
    ) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    }

    meta[key] = value;
    currentKey = key;
  }

  if (inArray && arrayItems.length > 0) {
    meta[currentKey] = [...arrayItems];
  }

  return meta;
}

// ─── Validation logic ────────────────────────────────────────────────────────

function validateFile(filePath: string, content: string): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const fileName = basename(filePath);
  const rel = filePath.replace(REPO_ROOT + "/", "");

  // Check file naming: should be {id}.{en|ja}.md
  const nameMatch = fileName.match(/^(.+)\.(en|ja)\.md$/);
  if (!nameMatch) {
    issues.push({
      file: rel,
      level: "error",
      message: `Filename must match pattern {id}.{en|ja}.md, got "${fileName}"`,
    });
    return issues; // Can't validate further without proper naming
  }

  const fileId = nameMatch[1];
  const fileLang = nameMatch[2];

  // Check frontmatter exists
  if (!content.startsWith("---\n")) {
    issues.push({
      file: rel,
      level: "error",
      message: "Missing YAML frontmatter (file must start with ---)",
    });
    return issues;
  }

  const meta = parseFrontmatter(content);

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!meta[field]) {
      issues.push({
        file: rel,
        level: "error",
        message: `Missing required frontmatter field: ${field}`,
      });
    }
  }

  // Validate id matches filename
  if (meta.id && meta.id !== fileId) {
    issues.push({
      file: rel,
      level: "error",
      message: `Frontmatter id "${meta.id}" does not match filename id "${fileId}"`,
    });
  }

  // Validate language matches filename
  if (meta.language && meta.language !== fileLang) {
    issues.push({
      file: rel,
      level: "error",
      message: `Frontmatter language "${meta.language}" does not match filename language "${fileLang}"`,
    });
  }

  // Validate language value
  if (meta.language && !VALID_LANGUAGES.includes(meta.language as string)) {
    issues.push({
      file: rel,
      level: "error",
      message: `Invalid language "${meta.language}", must be one of: ${VALID_LANGUAGES.join(", ")}`,
    });
  }

  // Validate status if present
  if (meta.status && !VALID_STATUSES.includes(meta.status as string)) {
    issues.push({
      file: rel,
      level: "error",
      message: `Invalid status "${meta.status}", must be one of: ${VALID_STATUSES.join(", ")}`,
    });
  }

  // Validate sensitivity if present
  if (
    meta.sensitivity &&
    !VALID_SENSITIVITIES.includes(meta.sensitivity as string)
  ) {
    issues.push({
      file: rel,
      level: "error",
      message: `Invalid sensitivity "${meta.sensitivity}", must be one of: ${VALID_SENSITIVITIES.join(", ")}`,
    });
  }

  // Validate category matches directory
  const dirCategory = basename(dirname(filePath));
  if (
    meta.category &&
    meta.category !== dirCategory &&
    dirCategory !== "_drafts"
  ) {
    issues.push({
      file: rel,
      level: "warning",
      message: `Frontmatter category "${meta.category}" does not match directory "${dirCategory}"`,
    });
  }

  // Check for body content after frontmatter
  const bodyMatch = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
  const body = bodyMatch ? bodyMatch[1].trim() : "";
  if (body.length === 0) {
    issues.push({
      file: rel,
      level: "warning",
      message: "File has frontmatter but no body content",
    });
  }

  return issues;
}

// ─── Bilingual pair check ────────────────────────────────────────────────────

function checkBilingualPairs(
  files: string[]
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  // Group files by directory + id
  const pairs = new Map<string, { en: boolean; ja: boolean; dir: string }>();

  for (const file of files) {
    const fileName = basename(file);
    const match = fileName.match(/^(.+)\.(en|ja)\.md$/);
    if (!match) continue;

    const id = match[1];
    const lang = match[2];
    const dir = dirname(file);
    const key = `${dir}/${id}`;

    if (!pairs.has(key)) {
      pairs.set(key, { en: false, ja: false, dir });
    }
    const pair = pairs.get(key)!;
    if (lang === "en") pair.en = true;
    if (lang === "ja") pair.ja = true;
  }

  for (const [key, pair] of pairs) {
    const rel = key.replace(REPO_ROOT + "/", "");
    if (pair.en && !pair.ja) {
      issues.push({
        file: `${rel}.en.md`,
        level: "warning",
        message: "Missing Japanese companion file (.ja.md)",
      });
    }
    if (pair.ja && !pair.en) {
      issues.push({
        file: `${rel}.ja.md`,
        level: "warning",
        message: "Missing English companion file (.en.md)",
      });
    }
  }

  return issues;
}

// ─── File discovery ──────────────────────────────────────────────────────────

async function findMarkdownFiles(dir: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findMarkdownFiles(fullPath)));
    } else if (entry.isFile() && /\.(en|ja)\.md$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const isStrict = values.strict ?? false;

  // Determine files to validate
  let files: string[];
  if (values.files && values.files.length > 0) {
    files = values.files.map((f) => resolve(REPO_ROOT, f));
  } else if (positionals.length > 0) {
    files = positionals.map((f) => resolve(REPO_ROOT, f));
  } else {
    const dir = resolve(REPO_ROOT, values.dir ?? "content/fragments");
    console.log(`Scanning: ${dir}`);
    files = await findMarkdownFiles(dir);
  }

  console.log(`Validating ${files.length} file(s)...\n`);

  const allIssues: ValidationIssue[] = [];

  // Validate each file
  for (const file of files) {
    try {
      const content = await readFile(file, "utf-8");
      const issues = validateFile(file, content);
      allIssues.push(...issues);
    } catch (err) {
      allIssues.push({
        file: file.replace(REPO_ROOT + "/", ""),
        level: "error",
        message: `Cannot read file: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  }

  // Check bilingual pairs
  allIssues.push(...checkBilingualPairs(files));

  // Report
  const errors = allIssues.filter((i) => i.level === "error");
  const warnings = allIssues.filter((i) => i.level === "warning");

  if (errors.length > 0) {
    console.log("ERRORS:");
    for (const issue of errors) {
      console.log(`  ${issue.file}: ${issue.message}`);
    }
    console.log();
  }

  if (warnings.length > 0) {
    console.log("WARNINGS:");
    for (const issue of warnings) {
      console.log(`  ${issue.file}: ${issue.message}`);
    }
    console.log();
  }

  console.log(
    `${files.length} file(s) checked: ${errors.length} error(s), ${warnings.length} warning(s)`
  );

  if (errors.length > 0 || (isStrict && warnings.length > 0)) {
    process.exit(1);
  }
}

main().catch(console.error);

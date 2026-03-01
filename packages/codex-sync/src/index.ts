/**
 * codex-sync — Bidirectional content synchronization between Git and R2/D1.
 *
 * Endpoints:
 *   POST /sync    — Git → R2/D1: upsert fragment_index rows for files already uploaded to R2 by CI
 *   POST /export  — R2 → Git: read R2 content, create branch + PR via GitHub API
 *   GET  /health  — Liveness check
 */

import { Hono } from "hono";
import { logger } from "hono/logger";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Env {
  DB: D1Database;
  R2: R2Bucket;
  ENVIRONMENT: string;
  SYNC_SECRET: string;
  GITHUB_TOKEN?: string;
  GITHUB_REPO?: string; // "owner/repo" format
}

/** A single file entry sent by the CI workflow after R2 upload. */
interface SyncEntry {
  /** Relative path from repo root, e.g. "content/fragments/company/esolia-overview.en.md" */
  path: string;
  /** "added" | "modified" | "removed" */
  action: "added" | "modified" | "removed";
}

/** Parsed frontmatter from a fragment markdown file. */
interface FragmentMeta {
  id: string;
  language: string;
  title: string;
  category: string;
  type: string;
  version: string;
  status: string;
  tags: string[];
  sensitivity: string;
  author: string;
  created: string;
  modified: string;
}

// ─── Frontmatter Parsing ─────────────────────────────────────────────────────

function parseFrontmatter(content: string): {
  meta: Record<string, unknown>;
  body: string;
} {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };

  const meta: Record<string, unknown> = {};
  let currentKey = "";
  let inArray = false;
  const arrayItems: string[] = [];

  for (const line of match[1].split("\n")) {
    // YAML array item (indented with "- ")
    if (inArray && /^\s+-\s+/.test(line)) {
      const val = line.replace(/^\s+-\s+/, "").replace(/^["']|["']$/g, "");
      arrayItems.push(val);
      continue;
    }

    // End of array — flush
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
      // Could be start of a YAML array or multi-line value
      currentKey = key;
      inArray = true;
      continue;
    }

    // Strip quotes
    let value: string | string[] = rawValue;
    if (value.startsWith('"') && value.endsWith('"')) {
      value = value.slice(1, -1);
    }

    // Inline array [a, b, c]
    if (typeof value === "string" && value.startsWith("[") && value.endsWith("]")) {
      value = value
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    }

    meta[key] = value;
    currentKey = key;
  }

  // Flush trailing array
  if (inArray && arrayItems.length > 0) {
    meta[currentKey] = [...arrayItems];
  }

  return { meta, body: match[2].trim() };
}

// ─── Path Helpers ────────────────────────────────────────────────────────────

/**
 * Convert a git path like "content/fragments/company/esolia-overview.en.md"
 * to an R2 key like "fragments/company/esolia-overview.en.md"
 */
function gitPathToR2Key(gitPath: string): string {
  // Strip leading "content/" prefix
  return gitPath.replace(/^content\//, "");
}

/**
 * Extract fragment ID and language from a path.
 * "content/fragments/company/esolia-overview.en.md" → { id: "esolia-overview", lang: "en", category: "company" }
 */
function parseFragmentPath(gitPath: string): {
  id: string;
  lang: "en" | "ja";
  category: string;
} | null {
  const match = gitPath.match(
    /^content\/fragments\/([^/]+)\/([^/]+)\.(en|ja)\.md$/
  );
  if (!match) return null;
  return { category: match[1], id: match[2], lang: match[3] as "en" | "ja" };
}

// ─── App ─────────────────────────────────────────────────────────────────────

const app = new Hono<{ Bindings: Env }>();

app.use("*", logger());

// ─── Auth Middleware ─────────────────────────────────────────────────────────

// InfoSec: Bearer token auth for CI webhook — prevents unauthorized D1 writes (OWASP A01)
function requireAuth(secret: string, authHeader: string | undefined): boolean {
  if (!secret) return false;
  if (!authHeader) return false;
  const token = authHeader.replace(/^Bearer\s+/i, "");
  // InfoSec: Constant-time comparison to prevent timing attacks (OWASP A02)
  if (token.length !== secret.length) return false;
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── GET /health ─────────────────────────────────────────────────────────────

app.get("/health", (c) => {
  return c.json({ status: "ok", service: "codex-sync", env: c.env.ENVIRONMENT });
});

// ─── POST /sync — Git → D1 index upsert ─────────────────────────────────────

app.post("/sync", async (c) => {
  // InfoSec: Validate bearer token (OWASP A01)
  if (!requireAuth(c.env.SYNC_SECRET, c.req.header("Authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  let body: { entries: SyncEntry[] };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!Array.isArray(body.entries) || body.entries.length === 0) {
    return c.json({ error: "entries array required" }, 400);
  }

  // InfoSec: Validate entry paths — only allow content/** paths (OWASP A03)
  for (const entry of body.entries) {
    if (!entry.path.startsWith("content/")) {
      return c.json({ error: `Invalid path: ${entry.path}` }, 400);
    }
  }

  const results: Array<{ path: string; action: string; status: string; error?: string }> = [];

  for (const entry of body.entries) {
    try {
      if (entry.action === "removed") {
        await handleRemoval(c.env, entry.path);
        results.push({ path: entry.path, action: "removed", status: "ok" });
        continue;
      }

      // For added/modified: read from R2 (CI already uploaded the file)
      const r2Key = gitPathToR2Key(entry.path);
      const obj = await c.env.R2.get(r2Key);
      if (!obj) {
        results.push({
          path: entry.path,
          action: entry.action,
          status: "skipped",
          error: `R2 object not found: ${r2Key}`,
        });
        continue;
      }

      const content = await obj.text();
      const fragInfo = parseFragmentPath(entry.path);

      if (fragInfo) {
        await upsertFragmentIndex(c.env.DB, entry.path, content, fragInfo);
        results.push({ path: entry.path, action: entry.action, status: "indexed" });
      } else {
        // Non-fragment content (standards, templates, etc.) — R2 upload is sufficient
        results.push({ path: entry.path, action: entry.action, status: "r2-only" });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ path: entry.path, action: entry.action, status: "error", error: msg });
    }
  }

  const indexed = results.filter((r) => r.status === "indexed").length;
  const removed = results.filter((r) => r.status === "ok" && r.action === "removed").length;
  const errors = results.filter((r) => r.status === "error").length;

  return c.json({
    summary: { total: results.length, indexed, removed, errors },
    results,
  });
});

// ─── POST /export — R2 → Git (reverse sync) ────────────────────────────────

app.post("/export", async (c) => {
  // InfoSec: Validate bearer token (OWASP A01)
  if (!requireAuth(c.env.SYNC_SECRET, c.req.header("Authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const githubToken = c.env.GITHUB_TOKEN;
  const githubRepo = c.env.GITHUB_REPO;
  if (!githubToken || !githubRepo) {
    return c.json({ error: "GITHUB_TOKEN and GITHUB_REPO must be configured" }, 500);
  }

  let body: { prefix?: string; collections?: string[] };
  try {
    body = await c.req.json();
  } catch {
    body = {};
  }

  // Default: export all fragments
  const prefix = body.prefix ?? "fragments/";

  try {
    const result = await exportToGit(c.env, prefix, githubToken, githubRepo);
    return c.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return c.json({ error: msg }, 500);
  }
});

// ─── D1 Upsert Logic ────────────────────────────────────────────────────────

async function upsertFragmentIndex(
  db: D1Database,
  gitPath: string,
  content: string,
  fragInfo: { id: string; lang: "en" | "ja"; category: string }
): Promise<void> {
  const { meta } = parseFrontmatter(content);
  const r2Key = gitPathToR2Key(gitPath);

  // Check if row exists
  const existing = await db
    .prepare("SELECT id FROM fragment_index WHERE id = ?")
    .bind(fragInfo.id)
    .first<{ id: string }>();

  const title = (meta.title as string) ?? fragInfo.id;
  const tags = Array.isArray(meta.tags) ? JSON.stringify(meta.tags) : "[]";
  const now = new Date().toISOString();

  if (existing) {
    // Update existing row — set language-specific fields
    if (fragInfo.lang === "en") {
      await db
        .prepare(
          `UPDATE fragment_index
           SET title_en = ?, r2_key_en = ?, has_en = 1,
               category = COALESCE(?, category),
               type = COALESCE(?, type),
               version = COALESCE(?, version),
               status = COALESCE(?, status),
               tags = ?, sensitivity = COALESCE(?, sensitivity),
               author = COALESCE(?, author),
               updated_at = ?
           WHERE id = ?`
        )
        .bind(
          title, r2Key,
          (meta.category as string) ?? null,
          (meta.type as string) ?? null,
          (meta.version as string) ?? null,
          (meta.status as string) ?? null,
          tags,
          (meta.sensitivity as string) ?? null,
          (meta.author as string) ?? null,
          now,
          fragInfo.id
        )
        .run();
    } else {
      await db
        .prepare(
          `UPDATE fragment_index
           SET title_ja = ?, r2_key_ja = ?, has_ja = 1, updated_at = ?
           WHERE id = ?`
        )
        .bind(title, r2Key, now, fragInfo.id)
        .run();
    }
  } else {
    // Insert new row
    await db
      .prepare(
        `INSERT INTO fragment_index
         (id, category, title_en, title_ja, type, version, status, tags,
          has_en, has_ja, r2_key_en, r2_key_ja, sensitivity, author, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .bind(
        fragInfo.id,
        (meta.category as string) ?? fragInfo.category,
        fragInfo.lang === "en" ? title : null,
        fragInfo.lang === "ja" ? title : null,
        (meta.type as string) ?? "content",
        (meta.version as string) ?? now.slice(0, 7),
        (meta.status as string) ?? "production",
        tags,
        fragInfo.lang === "en" ? 1 : 0,
        fragInfo.lang === "ja" ? 1 : 0,
        fragInfo.lang === "en" ? r2Key : null,
        fragInfo.lang === "ja" ? r2Key : null,
        (meta.sensitivity as string) ?? "normal",
        (meta.author as string) ?? "eSolia Technical Team",
        (meta.created as string) ?? now,
        now
      )
      .run();
  }
}

async function handleRemoval(env: Env, gitPath: string): Promise<void> {
  const fragInfo = parseFragmentPath(gitPath);
  if (!fragInfo) return;

  const r2Key = gitPathToR2Key(gitPath);

  // Remove the R2 object
  await env.R2.delete(r2Key);

  // Update D1: clear the language-specific fields
  if (fragInfo.lang === "en") {
    await env.DB
      .prepare(
        `UPDATE fragment_index SET has_en = 0, r2_key_en = NULL, title_en = NULL, updated_at = ? WHERE id = ?`
      )
      .bind(new Date().toISOString(), fragInfo.id)
      .run();
  } else {
    await env.DB
      .prepare(
        `UPDATE fragment_index SET has_ja = 0, r2_key_ja = NULL, title_ja = NULL, updated_at = ? WHERE id = ?`
      )
      .bind(new Date().toISOString(), fragInfo.id)
      .run();
  }

  // If both languages are gone, delete the row
  const row = await env.DB
    .prepare("SELECT has_en, has_ja FROM fragment_index WHERE id = ?")
    .bind(fragInfo.id)
    .first<{ has_en: number; has_ja: number }>();

  if (row && row.has_en === 0 && row.has_ja === 0) {
    await env.DB.prepare("DELETE FROM fragment_index WHERE id = ?").bind(fragInfo.id).run();
  }
}

// ─── Reverse Sync: R2 → Git ─────────────────────────────────────────────────

interface ExportResult {
  branch: string;
  prUrl: string | null;
  filesExported: number;
  filesUnchanged: number;
}

async function exportToGit(
  env: Env,
  prefix: string,
  githubToken: string,
  githubRepo: string
): Promise<ExportResult> {
  const apiBase = `https://api.github.com/repos/${githubRepo}`;
  const headers = {
    Authorization: `Bearer ${githubToken}`,
    Accept: "application/vnd.github.v3+json",
    "User-Agent": "codex-sync/1.0",
    "Content-Type": "application/json",
  };

  // 1. Get default branch SHA
  const repoResp = await fetch(apiBase, { headers });
  if (!repoResp.ok) throw new Error(`GitHub API error: ${repoResp.status}`);
  const repoData = (await repoResp.json()) as { default_branch: string };
  const defaultBranch = repoData.default_branch;

  const refResp = await fetch(`${apiBase}/git/ref/heads/${defaultBranch}`, { headers });
  if (!refResp.ok) throw new Error(`Cannot get ref for ${defaultBranch}`);
  const refData = (await refResp.json()) as { object: { sha: string } };
  const baseSha = refData.object.sha;

  // 2. List R2 objects with prefix
  const listed = await env.R2.list({ prefix });
  if (listed.objects.length === 0) {
    return { branch: "", prUrl: null, filesExported: 0, filesUnchanged: 0 };
  }

  // 3. Read each R2 object and compare with git
  const treeEntries: Array<{ path: string; mode: string; type: string; sha: string }> = [];
  let filesExported = 0;
  let filesUnchanged = 0;

  for (const obj of listed.objects) {
    const r2Content = await env.R2.get(obj.key);
    if (!r2Content) continue;

    const content = await r2Content.text();
    const gitPath = `content/${obj.key}`;

    // Check if file exists in git with same content
    const existingResp = await fetch(
      `${apiBase}/contents/${encodeURIComponent(gitPath)}?ref=${defaultBranch}`,
      { headers }
    );

    if (existingResp.ok) {
      const existingData = (await existingResp.json()) as { content: string };
      const existingContent = atob(existingData.content.replace(/\n/g, ""));
      if (existingContent === content) {
        filesUnchanged++;
        continue;
      }
    }

    // Create blob for changed/new file
    const blobResp = await fetch(`${apiBase}/git/blobs`, {
      method: "POST",
      headers,
      body: JSON.stringify({ content, encoding: "utf-8" }),
    });
    if (!blobResp.ok) throw new Error(`Failed to create blob for ${gitPath}`);
    const blobData = (await blobResp.json()) as { sha: string };

    treeEntries.push({
      path: gitPath,
      mode: "100644",
      type: "blob",
      sha: blobData.sha,
    });
    filesExported++;
  }

  if (filesExported === 0) {
    return { branch: "", prUrl: null, filesExported: 0, filesUnchanged };
  }

  // 4. Create tree
  const treeResp = await fetch(`${apiBase}/git/trees`, {
    method: "POST",
    headers,
    body: JSON.stringify({ base_tree: baseSha, tree: treeEntries }),
  });
  if (!treeResp.ok) throw new Error("Failed to create tree");
  const treeData = (await treeResp.json()) as { sha: string };

  // 5. Create commit
  const timestamp = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, "");
  const branchName = `codex-sync/export-${timestamp}`;

  const commitResp = await fetch(`${apiBase}/git/commits`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      message: `chore(codex-sync): export ${filesExported} file(s) from CMS\n\nR2 prefix: ${prefix}`,
      tree: treeData.sha,
      parents: [baseSha],
    }),
  });
  if (!commitResp.ok) throw new Error("Failed to create commit");
  const commitData = (await commitResp.json()) as { sha: string };

  // 6. Create branch
  const branchResp = await fetch(`${apiBase}/git/refs`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha: commitData.sha }),
  });
  if (!branchResp.ok) throw new Error("Failed to create branch");

  // 7. Open PR
  const prResp = await fetch(`${apiBase}/pulls`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: `chore(codex-sync): export ${filesExported} CMS-authored file(s) to git`,
      body: [
        "## Summary",
        "",
        `Exported ${filesExported} file(s) from R2 (prefix: \`${prefix}\`) that differ from the current git content.`,
        `${filesUnchanged} file(s) were unchanged and skipped.`,
        "",
        "## Files",
        "",
        ...treeEntries.map((e) => `- \`${e.path}\``),
        "",
        "---",
        "*Auto-generated by codex-sync reverse export.*",
      ].join("\n"),
      head: branchName,
      base: defaultBranch,
    }),
  });

  let prUrl: string | null = null;
  if (prResp.ok) {
    const prData = (await prResp.json()) as { html_url: string };
    prUrl = prData.html_url;
  }

  return { branch: branchName, prUrl, filesExported, filesUnchanged };
}

// ─── Export ──────────────────────────────────────────────────────────────────

export default app;

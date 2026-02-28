#!/usr/bin/env node

/**
 * migrate-standards.mjs
 *
 * Migrates docs/shared/ files → content/standards/ with frontmatter.
 * Run: node scripts/migrate-standards.mjs
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname;

// Mapping: source path → { target, title, slug, category, tags, summary }
const FILES = [
  // ── Guides ──────────────────────────────────────────────────────────────────
  {
    src: "docs/shared/guides/SVELTEKIT_GUIDE.md",
    target: "content/standards/guides/sveltekit-guide.md",
    title: "SvelteKit Development Guide",
    slug: "sveltekit-guide",
    category: "guides",
    tags: ["sveltekit", "svelte5", "cloudflare", "runes"],
    summary: "Svelte 5 patterns, SvelteKit conventions, Cloudflare deployment",
  },
  {
    src: "docs/shared/guides/SVELTEKIT_BACKPRESSURE.md",
    target: "content/standards/guides/sveltekit-backpressure.md",
    title: "Engineering Backpressure for SvelteKit Code Quality",
    slug: "sveltekit-backpressure",
    category: "guides",
    tags: ["sveltekit", "code-quality", "backpressure", "linting"],
    summary:
      "Quality enforcement strategy using lint rules, type system, and verification",
  },
  {
    src: "docs/shared/guides/SVELTEKIT_SEO_CHECKLIST.md",
    target: "content/standards/guides/sveltekit-seo-checklist.md",
    title: "SvelteKit SEO Checklist",
    slug: "sveltekit-seo-checklist",
    category: "guides",
    tags: ["sveltekit", "seo", "meta-tags", "structured-data"],
    summary: "SEO best practices and checklist for SvelteKit applications",
  },
  {
    src: "docs/shared/guides/typescript-practices.md",
    target: "content/standards/guides/typescript-practices.md",
    title: "TypeScript and Coding Practices",
    slug: "typescript-practices",
    category: "guides",
    tags: ["typescript", "coding-standards", "type-safety"],
    summary:
      "Canonical coding standards for all eSolia TypeScript applications",
  },
  {
    src: "docs/shared/guides/LINTING_STRATEGY.md",
    target: "content/standards/guides/linting-strategy.md",
    title: "Linting Strategy",
    slug: "linting-strategy",
    category: "guides",
    tags: ["linting", "eslint", "oxlint", "code-quality"],
    summary:
      "Multi-layer linting setup with oxlint, eslint, and custom rules",
  },
  {
    src: "docs/shared/guides/ARTICLE_WRITING_GUIDE.md",
    target: "content/standards/guides/article-writing-guide.md",
    title: "eSolia Article Writing Guide",
    slug: "article-writing-guide",
    category: "guides",
    tags: ["writing", "content", "articles", "style-guide"],
    summary:
      "Guide for creating engaging, narrative-driven articles for the eSolia website",
  },
  {
    src: "docs/shared/guides/WRITING_GUIDE_AI_PROOF_EDITING_EN.md",
    target: "content/standards/guides/writing-guide-ai-proof-editing-en.md",
    title: "AI-Proof Editing Guide (English)",
    slug: "writing-guide-ai-proof-editing-en",
    category: "guides",
    tags: ["writing", "editing", "ai-detection", "english"],
    summary:
      "English AI-pattern detection, vocabulary red flags, and editing checklist",
  },
  {
    src: "docs/shared/guides/WRITING_GUIDE_AI_PROOF_EDITING_JA.md",
    target: "content/standards/guides/writing-guide-ai-proof-editing-ja.md",
    title: "AI-Proof Editing Guide (Japanese)",
    slug: "writing-guide-ai-proof-editing-ja",
    category: "guides",
    tags: ["writing", "editing", "ai-detection", "japanese"],
    summary:
      "Japanese AI-pattern detection, overused phrases, and editing checklist",
  },
  {
    src: "docs/shared/guides/CONTENT_LOCALIZATION_STRATEGY.md",
    target: "content/standards/guides/content-localization-strategy.md",
    title: "Content Localization Strategy",
    slug: "content-localization-strategy",
    category: "guides",
    tags: ["localization", "i18n", "bilingual", "translation"],
    summary: "Not-1:1 localization principle, Ally/Bridge model for EN/JA",
  },
  {
    src: "docs/shared/guides/CLAUDE_PROJECT_TEMPLATE.md",
    target: "content/standards/guides/claude-project-template.md",
    title: "Claude Project Template",
    slug: "claude-project-template",
    category: "guides",
    tags: ["claude-code", "project-setup", "template"],
    summary:
      "Template for CLAUDE.md project configuration in eSolia repositories",
  },
  {
    src: "docs/shared/guides/cloudflare-auth-and-deploy.md",
    target: "content/standards/guides/cloudflare-auth-and-deploy.md",
    title: "Cloudflare Auth and Deploy",
    slug: "cloudflare-auth-and-deploy",
    category: "guides",
    tags: ["cloudflare", "authentication", "deployment", "access"],
    summary:
      "Cloudflare Access authentication and deployment patterns for Workers/Pages",
  },
  {
    src: "docs/shared/guides/Cloudflare-AI-Gateway-Reference.md",
    target: "content/standards/guides/cloudflare-ai-gateway-reference.md",
    title: "Cloudflare AI Gateway Reference",
    slug: "cloudflare-ai-gateway-reference",
    category: "guides",
    tags: ["cloudflare", "ai-gateway", "workers-ai", "llm"],
    summary:
      "Reference guide for Cloudflare AI Gateway configuration and usage",
  },
  {
    src: "docs/shared/guides/Cloudflare-D1-Maintenance.md",
    target: "content/standards/guides/cloudflare-d1-maintenance.md",
    title: "Cloudflare D1 Maintenance",
    slug: "cloudflare-d1-maintenance",
    category: "guides",
    tags: ["cloudflare", "d1", "database", "maintenance"],
    summary: "D1 database maintenance procedures, backups, and monitoring",
  },
  {
    src: "docs/shared/guides/cloudflare-security-hardening.md",
    target: "content/standards/guides/cloudflare-security-hardening.md",
    title: "Cloudflare Security Hardening",
    slug: "cloudflare-security-hardening",
    category: "guides",
    tags: ["cloudflare", "security", "hardening", "waf"],
    summary:
      "Security hardening guide for Cloudflare infrastructure and Workers",
  },
  {
    src: "docs/shared/guides/d1-migrations.md",
    target: "content/standards/guides/d1-migrations.md",
    title: "D1 Migration Patterns",
    slug: "d1-migrations",
    category: "guides",
    tags: ["cloudflare", "d1", "migrations", "database"],
    summary: "Patterns and conventions for Cloudflare D1 database migrations",
  },
  {
    src: "docs/shared/guides/deployment-strategy-guide.md",
    target: "content/standards/guides/deployment-strategy-guide.md",
    title: "Deployment Strategy Guide",
    slug: "deployment-strategy-guide",
    category: "guides",
    tags: ["deployment", "ci-cd", "cloudflare", "release"],
    summary: "Deployment strategies and release workflows for eSolia projects",
  },
  {
    src: "docs/shared/guides/email-deliverability.md",
    target: "content/standards/guides/email-deliverability.md",
    title: "Email Deliverability",
    slug: "email-deliverability",
    category: "guides",
    tags: ["email", "spf", "dkim", "dmarc", "deliverability"],
    summary: "Email authentication and deliverability best practices",
  },
  {
    src: "docs/shared/guides/i18n.md",
    target: "content/standards/guides/i18n.md",
    title: "Internationalization Guide",
    slug: "i18n",
    category: "guides",
    tags: ["i18n", "localization", "paraglide", "sveltekit"],
    summary: "Internationalization patterns for SvelteKit applications",
  },
  {
    src: "docs/shared/guides/mermaid-compact-reference.md",
    target: "content/standards/guides/mermaid-compact-reference.md",
    title: "Mermaid Compact Reference",
    slug: "mermaid-compact-reference",
    category: "guides",
    tags: ["mermaid", "diagrams", "documentation"],
    summary: "Quick reference for Mermaid diagram syntax and patterns",
  },
  {
    src: "docs/shared/guides/security-checklist.md",
    target: "content/standards/guides/security-checklist.md",
    title: "Security Checklist",
    slug: "security-checklist",
    category: "guides",
    tags: ["security", "owasp", "checklist", "audit"],
    summary:
      "Pre-deployment security checklist covering OWASP Top 10 and more",
  },
  {
    src: "docs/shared/guides/sveltekit-pages-to-workers-migration.md",
    target: "content/standards/guides/sveltekit-pages-to-workers-migration.md",
    title: "SvelteKit Pages to Workers Migration",
    slug: "sveltekit-pages-to-workers-migration",
    category: "guides",
    tags: ["sveltekit", "cloudflare", "workers", "migration"],
    summary: "Migration guide from Cloudflare Pages to Workers for SvelteKit",
  },
  {
    src: "docs/shared/guides/tauri-practices.md",
    target: "content/standards/guides/tauri-practices.md",
    title: "Tauri Practices",
    slug: "tauri-practices",
    category: "guides",
    tags: ["tauri", "desktop", "rust", "security"],
    summary: "Development practices for Tauri desktop applications",
  },
  {
    src: "docs/shared/guides/avatar-system.md",
    target: "content/standards/guides/avatar-system.md",
    title: "Avatar System",
    slug: "avatar-system",
    category: "guides",
    tags: ["ui", "avatar", "components", "design"],
    summary:
      "Avatar generation and display system for user profiles and content",
  },
  // ── Reference ───────────────────────────────────────────────────────────────
  {
    src: "docs/shared/reference/esolia-branding.md",
    target: "content/standards/reference/esolia-branding.md",
    title: "eSolia Branding Configuration",
    slug: "esolia-branding",
    category: "reference",
    tags: ["branding", "colors", "typography", "design-system"],
    summary: "eSolia CI colors, typography, and branding configuration",
  },
  {
    src: "docs/shared/reference/esolia-resource-naming.md",
    target: "content/standards/reference/esolia-resource-naming.md",
    title: "eSolia Resource Naming Conventions",
    slug: "esolia-resource-naming",
    category: "reference",
    tags: ["naming", "conventions", "cloudflare", "infrastructure"],
    summary: "Naming conventions for Cloudflare resources and infrastructure",
  },
  {
    src: "docs/shared/reference/maileroo-integration.md",
    target: "content/standards/reference/maileroo-integration.md",
    title: "Maileroo Integration",
    slug: "maileroo-integration",
    category: "reference",
    tags: ["email", "maileroo", "api", "integration"],
    summary: "Integration guide for Maileroo email service",
  },
  // ── Prompts ─────────────────────────────────────────────────────────────────
  {
    src: "docs/shared/prompts/security-and-code-quality-audit.md",
    target: "content/standards/prompts/security-and-code-quality-audit.md",
    title: "Security & Code Quality Audit Prompt",
    slug: "security-and-code-quality-audit",
    category: "prompts",
    tags: ["security", "audit", "code-quality", "claude-code"],
    summary:
      "Prompt for performing comprehensive security and code quality audits",
  },
];

// SEO files are non-markdown, copy as-is (no frontmatter)
const SEO_FILES = [
  {
    src: "docs/shared/guides/seo-check.test.ts",
    target: "content/standards/seo/seo-check.test.ts",
  },
  {
    src: "docs/shared/guides/seo-check.yml",
    target: "content/standards/seo/seo-check.yml",
  },
];

function generateFrontmatter(file) {
  const lines = [
    "---",
    `title: "${file.title}"`,
    `slug: ${file.slug}`,
    `category: ${file.category}`,
    `tags: [${file.tags.join(", ")}]`,
    `summary: "${file.summary}"`,
    `author: "eSolia Technical Team"`,
    `created: "2025-12-29"`,
    `modified: "2026-03-01"`,
    "---",
    "",
  ];
  return lines.join("\n");
}

async function main() {
  let migrated = 0;
  let skipped = 0;

  for (const file of FILES) {
    const srcPath = join(ROOT, file.src);
    const targetPath = join(ROOT, file.target);

    try {
      const content = await readFile(srcPath, "utf-8");

      // Check if content already has frontmatter
      const hasFrontmatter = content.startsWith("---\n");

      let newContent;
      if (hasFrontmatter) {
        // Replace existing frontmatter
        const match = content.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/);
        const body = match ? match[1] : content;
        newContent = generateFrontmatter(file) + body;
      } else {
        newContent = generateFrontmatter(file) + content;
      }

      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, newContent, "utf-8");
      console.log(`  ✅ ${file.slug} → ${file.target}`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ ${file.src}: ${err.message}`);
      skipped++;
    }
  }

  // Copy SEO files as-is
  for (const file of SEO_FILES) {
    try {
      const content = await readFile(join(ROOT, file.src), "utf-8");
      await mkdir(dirname(join(ROOT, file.target)), { recursive: true });
      await writeFile(join(ROOT, file.target), content, "utf-8");
      console.log(`  ✅ ${file.target} (copied)`);
      migrated++;
    } catch (err) {
      console.error(`  ❌ ${file.src}: ${err.message}`);
      skipped++;
    }
  }

  console.log(
    `\n🎉 Migration complete: ${migrated} migrated, ${skipped} skipped`
  );
}

main().catch(console.error);

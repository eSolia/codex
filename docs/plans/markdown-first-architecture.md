# Markdown-First Content Architecture

> Master plan for Hanawa CMS content architecture. Discussed and agreed Feb 2026.
> Extracted from session `8f828301` planning transcript.

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Tiptap 3.x + Markdown | ✅ Complete | Tiptap 3.x, @tiptap/markdown, all custom extensions updated |
| Phase 2: Fragment Migration | ✅ Complete | 54 YAML → 108 markdown files, fragment_index D1 table (migration 0025) |
| Phase 3: Fragment Editing | ✅ Complete | Fragment list/edit/new routes, R2 load/save, AI translate, version auto-bump |
| Phase 4: Assembled Document Builder | ✅ Complete | Multi-editor, RBAC guards, section translate, type filter. #12 for D1 user lookup |
| Phase 5: PDF via Typst | ✅ Complete | Cloudflare Container with pandoc + typst, bilingual scoped TOCs |
| Phase 6: Centralized Standards | ✅ Complete | MCP Worker deployed, 27 standards in R2, D1 migration 0027, CMS routes, GitHub Action, config synced, bootstrap scripts fixed, rsync deprecated |
| Phase 7: Content Quality & Import | ✅ Complete | Fragment import, QC checks (Workers AI), WritingTips panel, migration 0028 |
| Phase 8: Codex Sync | ✅ Complete | codex-sync Worker (Hono), GitHub Actions workflow, validation script, reverse sync via PR |
| Phase 9: Standing Documents | ⏳ Planned | Single-file docs (rate cards, capability statements) |
| Phase 10: Website Content Editing | ⏳ Planned | Site-scoped routes for client content |
| Phase 11: QC & Import Extras | ⏳ Planned | CLI bulk QC, document QC action, document section import |

---

## Context

The current Hanawa CMS stores fragment content inside YAML files (in git) and as HTML in D1. This creates friction: Claude Code can't easily edit content buried in YAML, the editor stores HTML with no markdown round-trip, fragments are edited one-by-one, and the PDF pipeline is split between Typst (CLI) and Browser Rendering API (web). The system works but is unintuitive.

This plan moves to **markdown as the universal content format**: markdown files in git, markdown in Tiptap (via `@tiptap/markdown`), markdown to Typst for PDFs. D1 becomes a metadata index, not a content store.

## Locked-In Design Decisions

1. **Bilingual: Separate files** — `*.en.md` + `*.ja.md`, linked by shared `id` in frontmatter. Enables 4 PDF language modes (EN-only, JA-only, combined EN-first, combined JA-first).
2. **Copy on insert** — When a fragment is added to an assembled document, the markdown is copied into the document's directory. Editable locally without affecting the source. "Refresh from source" pulls updates on demand.
3. **RBAC** — Two permission flags: `can_assemble` (insert/reorder fragments, generate PDF) and `can_edit` (modify markdown in Tiptap). Both granted by default.
4. **"Edit original" button** — Each inserted fragment shows a link to open the source fragment for editing.
5. **AI translation** — Available in both standalone fragment editing and assembled document editing.
6. **Generic terminology** — "Assembled documents" covers proposals, reports, quotes, SOWs, assessments, etc.

## Architecture Overview

```
content/
├── fragments/                    # Reusable building blocks
│   ├── company/
│   │   ├── esolia-introduction.en.md
│   │   └── esolia-introduction.ja.md
│   ├── services/
│   ├── products/
│   ├── terms/
│   └── ...
├── documents/                    # Assembled documents (proposals, reports, etc.)
│   └── ACME-support-202602/
│       ├── manifest.yaml         # Section order, metadata, sources
│       ├── 01-exec-summary.en.md
│       ├── 02-introduction.en.md # Copied from fragment
│       └── 03-pricing.en.md
├── standing/                     # Single-file documents (rate cards, etc.)
│   └── rate-card-2026.en.md
└── sites/                        # Client website content
    └── help-esolia-pro/
        └── getting-started.en.md
```

**D1** indexes metadata (what exists, where, status, tags). Content lives in markdown files in R2 (synced from git).

**Tiptap + @tiptap/markdown** provides WYSIWYG editing with markdown as the storage format.

**Typst** generates PDFs from assembled markdown, reusing the existing `template.typ` and `generate.sh` pipeline.

---

## Phase 1: Tiptap 3.x Upgrade + Markdown Extension ✅

**Goal**: Upgrade Tiptap and add bidirectional markdown support to the editor.

### Why first
Everything else depends on the editor being able to load, edit, and save markdown. This is the riskiest technical change, so validate it early.

### Tasks

1. **Upgrade Tiptap 2.x → 3.x** in `packages/hanawa-cms/package.json`
   - Update `@tiptap/core`, `@tiptap/starter-kit`, all `@tiptap/extension-*` packages
   - Review Tiptap 3.x migration guide for breaking changes
   - Update all custom extensions in `packages/hanawa-cms/src/lib/editor/extensions/` to be 3.x compatible:
     - `callout.ts`
     - `fragment-reference.ts`
     - `mermaid-block.ts`
     - `page-break.ts`
     - `privacy-mask.ts`
     - `status-badge.ts`
     - `slash-commands.ts`

2. **Install `@tiptap/markdown`** and configure it
   - Add markdown parse/serialize handlers for custom extensions (callouts → `:::info`, page breaks → `<!-- pagebreak -->`, etc.)
   - Test round-trip: markdown → Tiptap JSON → markdown
   - Verify GFM tables, task lists, code blocks survive round-trip

3. **Update `HanawaEditor.svelte`** component
   - Accept `contentType: 'markdown'` mode
   - Load markdown string → Tiptap
   - Save → `editor.getMarkdown()` returns markdown string
   - Keep HTML mode as fallback for legacy content

4. **Run preflight**: `pnpm run verify` in `packages/hanawa-cms/`

### Files modified
- `packages/hanawa-cms/package.json` (dependency versions)
- `packages/hanawa-cms/src/lib/editor/editor.ts` (add Markdown extension)
- `packages/hanawa-cms/src/lib/editor/extensions/*.ts` (3.x compat + markdown handlers)
- `packages/hanawa-cms/src/lib/components/editor/HanawaEditor.svelte` (markdown mode)

---

## Phase 2: Fragment Migration (YAML → Markdown) ✅

**Goal**: Convert all 48+ fragment YAML files to markdown with frontmatter. Update D1 to be an index.

### Tasks

1. **Write migration script** (`scripts/migrate-fragments.ts`)
   - Read each YAML in `content/fragments/**/*.yaml`
   - Extract `content.en` → `{id}.en.md` with frontmatter
   - Extract `content.ja` → `{id}.ja.md` with frontmatter
   - Frontmatter includes: id, category, title, version, status, language, tags, sensitivity, created, modified, author
   - Place in same category directory

2. **Update fragment JSON schema** (`schemas/fragment.json`)

3. **D1 migration: fragment_index** (`packages/hanawa-cms/migrations/0025_fragment_index.sql`)
   - Create `fragment_index` table with: id, category, title_en, title_ja, type, version, status, tags, has_en, has_ja, r2_key_en, r2_key_ja, sensitivity, author, created_at, updated_at
   - Keep old `fragments` table for backward compat

4. **Seed script** (`scripts/seed-fragment-index.ts`)
   - Parse all markdown frontmatter, generate SQL, populate D1

5. **Cleanup script** (`scripts/cleanup-fragments.ts`)
   - Normalize IDs, types, tags, status, title case across all markdown files

### Files created
- `scripts/migrate-fragments.ts`
- `scripts/seed-fragment-index.ts`
- `scripts/cleanup-fragments.ts`
- `packages/hanawa-cms/migrations/0025_fragment_index.sql`
- `content/fragments/**/*.en.md` and `*.ja.md` (107 files, 53 bilingual pairs + 1 mono)

---

## Phase 3: Fragment Editing via Markdown ✅

**Goal**: Fragment routes load/save markdown from R2 instead of HTML from D1.

### Tasks

1. **Update fragment list route** (`/fragments`)
   - Query `fragment_index` table instead of `fragments`
   - Display fragment metadata (title, category, status, version, type)

2. **Update fragment edit route** (`/fragments/[id]`)
   - Load markdown from R2 (using `r2_key_en`/`r2_key_ja` from index)
   - Display in Tiptap with `contentType: 'markdown'`
   - Bilingual: two Tiptap editors (EN / JA / Side-by-side tabs)
   - Save: write markdown to R2, update `fragment_index` in D1
   - Full metadata editing (title, category, type, status, sensitivity, tags, author, version)
   - Rename and delete actions

3. **Add AI translation buttons**
   - Title translate: EN → JA and JA → EN
   - Content translate: between EN/JA tabs
   - Uses existing `locals.ai.translate()` (Anthropic primary, Workers AI fallback)

4. **Version auto-bump**
   - Format: `YYYYMMDDA` with letter incrementing on same-day saves (A → B → C)

5. **Create fragment page** (`/fragments/new`)
   - Same metadata panel as edit
   - Auto-generate ID from title

6. **API + FragmentPicker updates**
   - `/api/fragments/` queries `fragment_index`
   - `FragmentPicker.svelte` uses new field names

### Files modified
- `packages/hanawa-cms/src/routes/fragments/+page.server.ts`
- `packages/hanawa-cms/src/routes/fragments/+page.svelte`
- `packages/hanawa-cms/src/routes/fragments/[id]/+page.server.ts`
- `packages/hanawa-cms/src/routes/fragments/[id]/+page.svelte`
- `packages/hanawa-cms/src/routes/fragments/new/+page.server.ts`
- `packages/hanawa-cms/src/routes/fragments/new/+page.svelte`
- `packages/hanawa-cms/src/routes/api/fragments/+server.ts`
- `packages/hanawa-cms/src/lib/components/FragmentPicker.svelte`
- `packages/hanawa-cms/src/lib/schemas.ts`
- `packages/hanawa-cms/src/lib/server/frontmatter.ts` (created)

---

## Phase 4: Assembled Document Builder ⏳

**Goal**: Multi-editor page for assembling documents from fragments + custom sections.

### Document Manifest Format

```yaml
# documents/ACME-support-202602/manifest.yaml
id: ACME-support-202602
type: proposal                    # proposal, report, quote, sow, assessment
client_code: ACME
client_name: Acme Corporation
client_name_ja: アクメ株式会社
title: Japan IT Support Proposal
title_ja: 日本ITサポートの提案
language_mode: both_en_first      # en, ja, both_en_first, both_ja_first
template_id: tpl_comprehensive
status: draft
created_by: rick.cogley@esolia.co.jp
created_at: "2026-02-28"
updated_at: "2026-02-28"

sections:
  - file: 01-exec-summary.en.md
    label: Executive Summary
    source: null                  # custom section
    locked: false

  - file: 02-introduction.en.md
    label: eSolia Introduction
    source: fragments/company/esolia-introduction
    source_version: "2026-02"
    locked: true                  # boilerplate, read-only in this document

  - file: 03-services.en.md
    label: Services Overview
    source: fragments/services/monitoring-overview
    source_version: "2026-01"
    locked: false                 # editable copy

  - file: 04-pricing.en.md
    label: Pricing
    source: null
    locked: false
```

### Tasks

1. **New route: `/documents`** (list view)
   - Show all assembled documents from D1 (reuse existing `proposals` table, renamed/aliased)
   - Filter by type, status, client
   - "New Document" button

2. **New route: `/documents/new`**
   - Select document type (proposal, report, quote, etc.)
   - Select template (loads default fragment set)
   - Enter client details
   - Creates manifest + copies fragment markdowns into document directory in R2

3. **New route: `/documents/[id]`** — the multi-editor page
   - Load manifest from R2
   - For each section: load its markdown, create a Tiptap editor instance
   - **Section controls per editor**:
     - Drag handle for reordering
     - Lock/unlock toggle
     - "Edit original" link (opens `/fragments/[source-id]` in new tab) — only shown for fragment-sourced sections
     - "Refresh from source" button (copies latest fragment markdown, with confirmation)
     - "Translate" button (AI translation)
     - Remove section (with confirmation)
   - **Locked sections**: collapsed, read-only, expandable for review
   - **Unlocked sections**: full Tiptap editor
   - **Bottom bar**:
     - "+ Add custom section" (creates empty editor)
     - "+ Insert fragment" (opens fragment picker, copies markdown)
   - **Action bar**:
     - Save Draft (writes all markdown files + manifest to R2)
     - Language mode selector (EN / JA / Both EN-first / Both JA-first)
     - Preview PDF
     - Generate PDF

4. **RBAC enforcement**:
   - `can_assemble`: can create documents, insert/reorder/remove sections, generate PDF
   - `can_edit`: can modify content in Tiptap editors
   - Both: full access (default)
   - Assemble-only: editors are read-only, but can add/reorder/remove sections

5. **D1 table updates**:
   - Reuse `proposals` table or create `documents` table (superset of proposals)
   - Add `r2_manifest_key` column pointing to the manifest YAML in R2
   - Add `document_type` to filter between proposals, reports, etc.
   - Keep existing proposal fields (client_code, share_id, pdf_r2_key, etc.)

### Files to create
- `packages/hanawa-cms/src/routes/documents/+page.svelte` (list — rewrite)
- `packages/hanawa-cms/src/routes/documents/+page.server.ts` (rewrite)
- `packages/hanawa-cms/src/routes/documents/new/+page.svelte` (rewrite)
- `packages/hanawa-cms/src/routes/documents/new/+page.server.ts` (rewrite)
- `packages/hanawa-cms/src/routes/documents/[id]/+page.svelte` (multi-editor — rewrite)
- `packages/hanawa-cms/src/routes/documents/[id]/+page.server.ts` (rewrite)
- `packages/hanawa-cms/src/lib/components/editor/SectionEditor.svelte` (single section wrapper)
- `packages/hanawa-cms/src/lib/components/editor/DocumentActionBar.svelte`
- `packages/hanawa-cms/migrations/0029_documents.sql` (if new table needed)

### Files to modify
- `packages/hanawa-cms/src/routes/+layout.svelte` (navigation links)
- `packages/hanawa-cms/src/lib/components/FragmentPicker.svelte` (standalone mode for document context)

---

## Phase 5: PDF Generation via Typst ⏳

**Goal**: Generate branded PDFs from assembled markdown, matching the quality of `tools/md-to-pdf/generate.sh`.

### Approach

Deploy a **Cloudflare Container** running pandoc + typst with the existing `template.typ`. The container exposes an HTTP endpoint that accepts markdown + options, returns PDF binary.

### Bilingual TOC — Lessons Learned & Typst Solution

The previous `tools/md-to-pdf/` iteration spent a full day on bilingual TOC generation. Key findings:

- **Generating per-language TOCs from headings was unreliable** — pandoc couldn't reliably produce TOCs from headings across concatenated bilingual content.
- **Working solution: 3-PDF assembly** — a TOC PDF with pointers, plus separate EN and JA PDFs. The TOC links to the tops of each language section.
- **Original goal was more ambitious**: detailed per-language TOC + "日本語は次のページ" / "English follows" interstitials. Abandoned due to unreliable heading-based TOC generation.

**Typst solves this natively.** Research (Feb 2026) confirms Typst's `#outline()` supports scoped TOCs via `selector().after().before()`:

```typst
// Place boundary markers in the assembled content
#metadata(none) <en-start>
// ... English sections ...
#pagebreak()
#metadata(none) <ja-start>
#set text(lang: "ja")
// ... Japanese sections ...

// Then at the front of the document, two scoped outlines:
#outline(
  title: "Contents",
  target: selector(heading)
    .after(<en-start>, inclusive: false)
    .before(<ja-start>, inclusive: false),
  depth: 3,
)
#pagebreak()
#outline(
  title: [目次],
  target: selector(heading)
    .after(<ja-start>, inclusive: false),
  depth: 3,
)
```

Multiple `#outline()` calls are fully supported. Page numbers are correct across the combined document. This eliminates the 3-PDF assembly workaround entirely — a single `typst compile` produces one PDF with per-language TOCs.

**Fallback**: If pandoc's Typst output interferes with label resolution, use `query()` to build a fully programmatic TOC with complete control over filtering and formatting.

### Tasks

1. **Create container image** (`packages/typst-pdf/`)
   - Dockerfile: Alpine + pandoc + typst + IBM Plex Sans JP fonts + logo
   - Include `template.typ` (copy from `tools/md-to-pdf/`)
   - HTTP endpoint (lightweight: could be a small Go/Node server or even a shell-based CGI)
   - Input: POST with JSON `{ markdown, watermark, showWatermark, languageMode }`
   - Output: PDF binary
   - For bilingual modes: use Typst `#outline()` with scoped selectors for per-language TOCs (see research above); inject `<en-start>` / `<ja-start>` boundary labels between language sections

2. **Wire "Generate PDF" button** in document builder
   - Concatenate section markdowns in manifest order
   - Apply language mode (pick `.en.md` files, `.ja.md` files, or both in order)
   - POST to Typst container endpoint
   - Receive PDF, offer download or store in R2

3. **Wire "Preview PDF"**
   - Same as Generate but opens in browser PDF viewer

4. **Standing documents** — same flow but simpler (single markdown file → PDF)

### Reused assets
- `tools/md-to-pdf/template.typ` → copied into container
- eSolia logo SVG, IBM Plex Sans JP fonts → bundled in container image

### Files to create
- `packages/typst-pdf/Dockerfile`
- `packages/typst-pdf/server.ts` (or `server.go` — lightweight HTTP wrapper)
- `packages/typst-pdf/template.typ` (symlink or copy from tools/)
- `packages/typst-pdf/wrangler.jsonc` (container config)

### Files to modify
- `packages/hanawa-cms/wrangler.jsonc` (add service binding to typst-pdf container)
- `packages/hanawa-cms/src/routes/documents/[id]/+page.server.ts` (PDF generation action)

### Note on existing pdf-worker
The current `packages/pdf-worker/` (Browser Rendering API) stays as-is for now — it handles screenshot generation and may still be useful for HTML-based PDFs. The Typst container handles markdown-to-PDF.

---

## Phase 6: Centralized Standards (MCP + Hanawa) ✅

**Goal**: Make codex the single hub for all eSolia standards documents. Replace the rsync-based distribution (`nexus/scripts/sync-shared-docs.sh`) with: (1) a remote MCP server for Claude Code access from any repo, (2) Hanawa CMS editing, and (3) cross-platform bootstrap scripts for distributing Claude rules/commands.

### Why now

With markdown-first architecture in place (Phases 1-5), standards docs are natural markdown content that can be authored, edited, and served through the same infrastructure. Moving them to codex unifies the content hub, eliminates rsync drift, and enables CMS editing.

### Current state

- 28 standards docs in `docs/shared/` (guides, reference, prompts) — copied from `nexus/docs/shared/` via rsync
- Claude rules in `.claude/rules/` and commands in `.claude/commands/` — also rsync'd from nexus
- 8 consuming repos must be manually synced
- Concept design exists at `docs/concepts/esolia-standards-mcp/`

### Architecture

```
codex repo (source of truth)
  │
  ├── content/standards/**/*.md     ← markdown with frontmatter
  │       │
  │       ├──→ Hanawa CMS (edit via browser)
  │       │      reads/writes R2 + D1 metadata
  │       │
  │       └──→ GitHub Action → seed R2
  │                  │
  │                  ▼
  │  packages/esolia-standards-mcp/
  │    Cloudflare Worker (McpAgent + Durable Object)
  │    R2: standards/{slug}.md (same codex bucket)
  │    Tools: list_standards, get_standard, search_standards
  │                  │
  │                  ▼  HTTP/MCP (streamable)
  │         Any repo's Claude Code session
  │
  ├── config/claude/rules/*.md      ← distributable rules
  ├── config/claude/commands/*.md   ← distributable commands
  └── scripts/setup-claude-env.*    ← bootstrap (sh + ps1)
```

### Tasks

#### Task 1: Migrate `docs/shared/` → `content/standards/`

Move all 28 files from `docs/shared/` into `content/standards/` with frontmatter for R2 storage and Hanawa compatibility.

```
content/standards/
├── guides/          # 24 files (sveltekit-guide.md, typescript-practices.md, etc.)
├── reference/       # 3 files (esolia-branding.md, resource-naming.md, maileroo.md)
├── prompts/         # 1 file (security-code-quality-audit.md)
└── seo/             # Test configs (seo-check.test.ts, seo-check.yml)
```

Frontmatter format:
```yaml
---
title: "SvelteKit Development Guide"
slug: sveltekit-guide
category: guides
tags: [sveltekit, svelte5, cloudflare]
summary: "Svelte 5 patterns, SvelteKit conventions, Cloudflare deployment"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
```

Rename from UPPER_CASE.md to kebab-case.md. Body content unchanged.

#### Task 2: Create `packages/esolia-standards-mcp/` Worker

Adapt from `docs/concepts/esolia-standards-mcp/index.ts`:
- `McpAgent` from `agents/mcp` (Cloudflare Agents SDK)
- Three tools: `list_standards`, `get_standard`, `search_standards`
- R2 bucket binding `STANDARDS_R2` (same codex bucket, `standards/{slug}.md` prefix)
- Optional `SHARED_SECRET` Bearer auth
- CORS support

```
packages/esolia-standards-mcp/
├── wrangler.jsonc
├── package.json
├── tsconfig.json
└── src/
    └── index.ts
```

#### Task 3: Create `scripts/seed-standards.ts`

Reads all `content/standards/**/*.md`, uploads to R2 at `standards/{slug}.md` via wrangler CLI. Keeps frontmatter intact so the MCP Worker can parse it at read time.

#### Task 4: Create `config/claude/` for distributable rules & commands ✅

```
config/claude/
├── rules/
│   ├── backpressure-verify.md
│   └── security-standards.md
├── commands/
│   ├── backpressure-review.md
│   ├── seo-setup.md
│   └── update-diagram.md
└── mcp.json.example          # .mcp.json template for repos (type: http, /mcp endpoint)
```

Commands synced from `.claude/commands/` (authoritative). `mcp.json.example` updated to `type: http` transport with correct Worker URL, no auth headers.

#### Task 5: Cross-platform bootstrap scripts ✅

- `scripts/setup-claude-env.sh` (macOS/Linux) — creates symlinks from `config/claude/` into target repo's `.claude/`, copies `.mcp.json` template
- `scripts/setup-claude-env.ps1` (Windows) — same, using PowerShell symlinks (requires Developer Mode or admin)

Both scripts:
1. Create `.claude/{rules,commands}` dirs in target repo
2. Symlink rules and commands from codex
3. Copy `.mcp.json` template if not present
4. Print instructions for `claude mcp add --transport http -s user` (user-scoped, correct URL)

#### Task 6: Hanawa CMS standards collection (separate PR)

- New routes: `/standards` (list), `/standards/[slug]` (edit)
- D1 `standards` table for metadata
- R2 read/write at `standards/{slug}.md`
- MCP Worker reads from the same R2 bucket — no separate sync needed

#### Task 7: GitHub Action for git-originated updates

On push to `main` when `content/standards/**` changes → run `seed-standards.ts --remote` to upload to R2.

#### Task 8: Retire rsync distribution ✅ (deprecation notice added)

Deprecation path started:
1. Created `docs/shared/DEPRECATED.md` — notes MCP is authoritative, local copies are reference only
2. Updated codex `CLAUDE.md` Required Reading to point to MCP first, local fallback second
3. Consuming repos still need individual updates (tracked in `docs/shared/DEPRECATED.md` checklist)
4. `nexus/scripts/sync-shared-docs.sh` can be archived once all repos switch

### Implementation order

1. **First PR**: Tasks 1-5 (content migration, MCP Worker, seeder, bootstrap, config/claude) ✅
2. **Second PR**: Tasks 6-7 (Hanawa CMS standards routes, GitHub Action) ✅
3. **Third PR**: Task 8 (retire rsync, update consuming repos) ✅ deprecation notice added; full retirement pending per-repo updates

### Files to create

| File | Purpose |
|------|---------|
| `content/standards/**/*.md` | Migrated standards with frontmatter |
| `packages/esolia-standards-mcp/src/index.ts` | MCP Worker (from concept doc) |
| `packages/esolia-standards-mcp/wrangler.jsonc` | Worker config |
| `packages/esolia-standards-mcp/package.json` | Dependencies |
| `scripts/seed-standards.ts` | R2 uploader |
| `scripts/setup-claude-env.sh` | macOS/Linux bootstrap |
| `scripts/setup-claude-env.ps1` | Windows bootstrap |
| `config/claude/rules/*.md` | Distributable rules |
| `config/claude/commands/*.md` | Distributable commands |
| `config/claude/mcp.json.example` | MCP config template |

### Reuse from codebase

- `docs/concepts/esolia-standards-mcp/index.ts` — MCP Worker source
- `docs/concepts/esolia-standards-mcp/seed-standards.mjs` — KV seeder logic
- `docs/concepts/esolia-standards-mcp/wrangler.jsonc` — Worker config
- `packages/hanawa-cms/src/routes/fragments/` — reference for standards CRUD routes
- `packages/hanawa-cms/src/lib/server/frontmatter.ts` — frontmatter parsing

---

## Phase 7: Content Quality & Import ⏳

**Goal**: Three authoring-quality features: (1) markdown import from external tools, (2) QC checks against writing guides, (3) in-editor author guidance.

### Context — Three Authoring Paths

Content enters the system through three paths, each needing quality assurance:

| Path | Tool | Flow |
|------|------|------|
| **Git + Claude Code** | Terminal / IDE | Author markdown → commit → codex-sync pushes to R2 |
| **Hanawa CMS** | Tiptap editor | Author in browser → save to R2/D1 |
| **External import** | Claude Desktop, ChatGPT, etc. | Draft externally → export markdown → import into Hanawa |

Path 3 has no import mechanism yet. All three paths lack systematic QC against the writing guides.

### Writing Guides (existing assets)

Four guides form the quality framework:

| Guide | File | Purpose |
|-------|------|---------|
| Article Writing Guide | `docs/shared/guides/ARTICLE_WRITING_GUIDE.md` | Structure frameworks, voice/tone, anti-patterns |
| AI-Proof Editing (EN) | `docs/shared/guides/WRITING_GUIDE_AI_PROOF_EDITING_EN.md` | English AI-pattern detection, vocabulary red flags |
| AI-Proof Editing (JA) | `docs/shared/guides/WRITING_GUIDE_AI_PROOF_EDITING_JA.md` | Japanese AI-pattern detection, overused phrases |
| Localization Strategy | `docs/shared/guides/CONTENT_LOCALIZATION_STRATEGY.md` | "Not 1:1" principle, Ally/Bridge model |

These are currently prose documents read by humans. This phase makes them machine-actionable.

### Task 1: Markdown Import (External → Hanawa)

**Problem**: Authors draft in Claude Desktop or ChatGPT, export markdown, then need to get it into Hanawa with proper metadata. Currently no import path exists.

**Solution**: Drag-and-drop import on the fragment and document pages.

#### Import flow

```
Author exports .md from Claude Desktop / ChatGPT
    ↓
Drag onto Hanawa import zone (or click "Import Markdown")
    ↓
Sanitization pipeline:
  1. Filename normalization (slugify, strip dates, lowercase)
  2. Frontmatter validation (parse existing or generate skeleton)
  3. Content cleanup (normalize line endings, fix heading levels, strip tool artifacts)
  4. Language detection (heuristic: CJK character ratio → en/ja)
  5. Bilingual pair check (if importing .en.md, prompt for .ja.md companion)
    ↓
Preview: show cleaned content + generated frontmatter
    ↓
Author confirms → save to R2 + index in D1
```

#### Files to create
- `packages/hanawa-cms/src/lib/server/import.ts` — sanitization pipeline (filename, frontmatter, content cleanup)
- `packages/hanawa-cms/src/lib/components/ImportDropzone.svelte` — drag-and-drop UI component

#### Files to modify
- `packages/hanawa-cms/src/routes/fragments/+page.svelte` — add import dropzone
- `packages/hanawa-cms/src/routes/fragments/+page.server.ts` — add `importMarkdown` form action
- `packages/hanawa-cms/src/routes/documents/[id]/+page.svelte` — add import for custom sections
- `packages/hanawa-cms/src/routes/documents/[id]/+page.server.ts` — add `importSection` form action

### Task 2: QC Checks Against Writing Guides

**Problem**: Content quality is inconsistent. The writing guides exist but are only applied manually. Authors forget to check, and reviewers don't have time.

**Solution**: Automated QC checks powered by Workers AI, run against the writing guide rules.

#### Two modes

| Mode | Where | Trigger | Scope |
|------|-------|---------|-------|
| **Bulk CLI** | Terminal / CI | `scripts/qc-content.ts` | All fragments, all documents, or specific paths |
| **In-app button** | Hanawa CMS | "Check Quality" button per section/fragment | Single content piece |

#### QC check implementation

The QC check sends content + the relevant writing guide(s) to Workers AI with a structured prompt:

```typescript
// Pseudocode for QC check
async function checkContentQuality(content: string, lang: 'en' | 'ja'): Promise<QCResult> {
  const guide = lang === 'en'
    ? WRITING_GUIDE_AI_PROOF_EDITING_EN
    : WRITING_GUIDE_AI_PROOF_EDITING_JA;

  const result = await ai.run('@cf/meta/llama-3.1-70b-instruct', {
    messages: [
      { role: 'system', content: `You are a writing quality reviewer. Apply the following guide:\n\n${guide}` },
      { role: 'user', content: `Review this content and return a JSON report with: flagged_phrases (array of {phrase, reason, suggestion}), structural_issues (array of {issue, location}), overall_score (1-10), summary (one paragraph).\n\nContent:\n${content}` }
    ]
  });

  return parseQCResult(result);
}
```

#### QC result display

```
┌─────────────────────────────────────────────────┐
│ Quality Check Results          Score: 7/10       │
├─────────────────────────────────────────────────┤
│ ⚠ Vocabulary flags (3)                          │
│   • "robust solution" → be specific about what  │
│   • "leverage" → use "use" or name the action   │
│   • "it's worth noting" → delete the preamble   │
│                                                  │
│ ⚠ Structural issues (1)                         │
│   • Uniform paragraph lengths (5 paragraphs,    │
│     all ~60 words) → vary sentence rhythm        │
│                                                  │
│ ✓ No localization issues detected                │
└─────────────────────────────────────────────────┘
```

#### Files to create
- `packages/hanawa-cms/src/lib/server/qc.ts` — QC check logic (Workers AI calls, guide loading, result parsing)
- `packages/hanawa-cms/src/lib/components/QCResultPanel.svelte` — result display component
- `scripts/qc-content.ts` — CLI bulk QC checker (reads from R2 or local filesystem)

#### Files to modify
- `packages/hanawa-cms/src/routes/fragments/[id]/+page.server.ts` — add `qcCheck` form action
- `packages/hanawa-cms/src/routes/fragments/[id]/+page.svelte` — add "Check Quality" button
- `packages/hanawa-cms/src/routes/documents/[id]/+page.server.ts` — add `qcCheckSection` form action
- `packages/hanawa-cms/src/lib/components/editor/SectionEditor.svelte` — add "Check Quality" button

### Task 3: In-Editor Author Guidance

**Problem**: Authors shouldn't need to read the writing guides before every editing session. Key guidance should be surfaced inside the editor itself.

**Solution**: Contextual guidance delivered through three mechanisms — none intrusive.

#### Mechanism A: Collapsible guidance panel

A slim panel above the editor (fragment edit page, document section editors) with key reminders from the guides. Collapsed by default, remembers toggle state via `localStorage`.

```
┌─ Writing Tips ──────────────────────── [▼ collapse] ─┐
│ • Be specific: replace "robust" with what makes it   │
│   strong. Replace "leverage" with the actual action.  │
│ • Vary rhythm: mix short sentences with longer ones.  │
│ • EN ≠ JA: each language serves a different audience. │
│   JA readers bridge to HQ; EN readers learn Japan.    │
│ • Delete preambles: "It's worth noting" → just note.  │
└──────────────────────────────────────────────────────┘
```

Content varies by language (EN tips for EN editor, JA tips for JA editor). Tips are distilled from the four guides — not the full guides, just the most actionable rules.

#### Mechanism B: Placeholder text with guidance

When the editor is empty, the placeholder text includes a brief writing reminder instead of generic "Start writing...":

- EN: `"Write with specifics. Avoid AI-sounding phrases like 'robust' or 'it's worth noting'. Vary sentence length."`
- JA: `"具体的に書きましょう。「様々な」「包括的」「～と言えるでしょう」などAI的な表現を避け、文の長さに変化をつけてください。"`

#### Mechanism C: Post-edit QC nudge

After saving content, if the content hasn't been QC-checked recently (tracked via a `last_qc_check` timestamp in D1), show a subtle reminder:

```
┌────────────────────────────────────────────┐
│ 💡 Saved. Run a quality check? [Check now] │
└────────────────────────────────────────────┘
```

Dismissible, non-blocking. Only shown if `last_qc_check` is null or older than the last edit.

#### Files to create
- `packages/hanawa-cms/src/lib/components/editor/WritingTips.svelte` — collapsible guidance panel

#### Files to modify
- `packages/hanawa-cms/src/routes/fragments/[id]/+page.svelte` — add WritingTips above editor
- `packages/hanawa-cms/src/routes/documents/[id]/+page.svelte` — add WritingTips (global, not per-section)
- `packages/hanawa-cms/src/lib/components/editor/SectionEditor.svelte` — update placeholder text
- `packages/hanawa-cms/src/lib/components/editor/HanawaEditor.svelte` — language-aware placeholder defaults

---

## Phase 8: Codex Sync (Git ↔ R2) ✅

**Goal**: Bidirectional content synchronization between the git repo (`content/`) and R2 (codex bucket), so that git-authored content is available in R2 and CMS-authored content can be exported to git.

### Why needed

Currently, two authoring paths exist but don't sync:
- **Git + Claude Code** writes markdown to `content/fragments/`, `content/concepts/`, etc. — but R2 doesn't know about it
- **Hanawa CMS** writes to R2 + D1 — but git doesn't know about it

Without codex-sync, fragments authored via Claude Code must be manually imported to D1/R2, and CMS-authored content can't be version-controlled in git.

### Existing pattern

The `.github/workflows/sync-diagrams.yml` workflow already syncs draw.io → SVG → R2 for diagrams, demonstrating the GitHub Actions + `wrangler r2 object put` approach.

### Architecture

```
Git push to main
    ↓ GitHub Actions
Validate content (frontmatter, schema, bilingual pairs)
    ↓
Upload changed files to R2 (codex bucket)
    ↓
Upsert metadata in D1 (fragment_index, content tables)
    ↓
Trigger embedding generation (Workers AI) for AI Search
```

### Tasks

1. **Create `packages/codex-sync/`** — Cloudflare Worker (Hono)
   - HTTP endpoint triggered by GitHub Actions webhook
   - Accepts a list of changed file paths (from `git diff`)
   - Reads files from the repo (via GitHub API or R2 upload from CI)
   - Writes to R2 with correct key paths
   - Upserts D1 index rows (fragment_index, content tables)

2. **GitHub Actions workflow** (`.github/workflows/codex-sync.yml`)
   - Trigger: push to `main` when `content/**` changes
   - Compute changed file list via `git diff`
   - Upload changed markdown files to R2 via `wrangler r2 object put`
   - Call codex-sync worker to update D1 indexes
   - Optionally trigger AI Search re-indexing

3. **Validation step in CI**
   - Validate frontmatter against schema
   - Check bilingual pair completeness (`.en.md` has matching `.ja.md`)
   - Validate fragment IDs match directory/filename conventions

4. **Reverse sync (CMS → git)** ✅
   - POST /export endpoint on codex-sync Worker
   - Reads R2 content, diffs against git, creates branch + PR via GitHub API
   - Requires GITHUB_TOKEN and GITHUB_REPO secrets on the Worker

### Files to create
- `packages/codex-sync/src/index.ts` (Hono worker)
- `packages/codex-sync/wrangler.jsonc`
- `packages/codex-sync/package.json`
- `.github/workflows/codex-sync.yml`
- `scripts/validate-content.ts` (frontmatter + schema validation)

### Files to modify
- `packages/hanawa-cms/wrangler.jsonc` (service binding to codex-sync, if needed)

---

## Phase 9: Standing Documents ⏳

**Goal**: Single-file documents (rate cards, capability statements) with the same editing and PDF generation.

### Tasks

1. **New route: `/standing`** (list view)
   - Shows markdown files from `content/standing/` in R2
   - Each file is a standalone document

2. **New route: `/standing/[slug]`** (editor)
   - Single Tiptap editor for the full document
   - Frontmatter form fields (title, language, date, version)
   - Same action bar: Save, Language mode, Preview PDF, Generate PDF

3. **D1 index** (optional — or just read from R2 directly since the count is small)

### Files to create
- `packages/hanawa-cms/src/routes/standing/+page.svelte`
- `packages/hanawa-cms/src/routes/standing/+page.server.ts`
- `packages/hanawa-cms/src/routes/standing/[slug]/+page.svelte`
- `packages/hanawa-cms/src/routes/standing/[slug]/+page.server.ts`

---

## Phase 10: Website Content Editing ⏳

**Goal**: Clients authenticate and edit markdown-with-frontmatter for their websites.

### Tasks

1. **Site-scoped routes** in Hanawa CMS
   - `/sites/[site]/[collection]` — list articles
   - `/sites/[site]/[collection]/[slug]` — edit article
   - `/sites/[site]/[collection]/new` — create article

2. **Frontmatter form + Tiptap body**
   - Structured form for frontmatter fields (title, title_ja, tags, status, dates)
   - Tiptap editor for the markdown body
   - Save combines frontmatter + body into a single `.md` file
   - Write to R2 at the path the client's site expects

3. **Cloudflare Access per site**
   - Different Access policies for different client sites
   - `sites` table in D1 already exists with domain, slug, settings
   - `locals.user` plus site membership check

4. **Content discovery**
   - Read R2 prefix listing for the site's content directory
   - Or: maintain an index in D1 (the existing `content` table can serve this purpose)

### Files to create
- `packages/hanawa-cms/src/routes/sites/[site]/[collection]/+page.svelte`
- `packages/hanawa-cms/src/routes/sites/[site]/[collection]/+page.server.ts`
- `packages/hanawa-cms/src/routes/sites/[site]/[collection]/[slug]/+page.svelte`
- `packages/hanawa-cms/src/routes/sites/[site]/[collection]/[slug]/+page.server.ts`
- `packages/hanawa-cms/src/routes/sites/[site]/[collection]/new/+page.svelte`
- `packages/hanawa-cms/src/routes/sites/[site]/[collection]/new/+page.server.ts`

---

## Phase 11: QC & Import Extras ⏳

**Goal**: Extend Phase 7's fragment-level features to documents and CLI tooling.

### Task 1: CLI bulk QC script

Create `scripts/qc-content.ts` — batch QC checker that reads fragments from R2 (or local filesystem) and runs QC checks against writing guides. Outputs a report with scores and flagged issues.

#### Files to create
- `scripts/qc-content.ts`

### Task 2: Document QC action

Add `qcCheckSection` form action to document editor so individual sections can be quality-checked (same as fragments).

#### Files to modify
- `packages/hanawa-cms/src/routes/documents/[id]/+page.server.ts` — add `qcCheckSection` action
- `packages/hanawa-cms/src/lib/components/editor/SectionEditor.svelte` — add "Check Quality" button

### Task 3: Document section import

Allow importing `.md` files directly into document sections (not just fragment creation).

#### Files to modify
- `packages/hanawa-cms/src/routes/documents/[id]/+page.svelte` — add import dropzone for custom sections
- `packages/hanawa-cms/src/routes/documents/[id]/+page.server.ts` — add `importSection` form action

---

## Key Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Tiptap 2→3 upgrade** | All 7 custom extensions may need rework | ✅ Resolved — upgraded successfully |
| **`@tiptap/markdown` is beta** | Edge cases with complex content | ✅ Resolved — custom handlers for callouts, page breaks, etc. |
| **Mermaid in markdown** | Mermaid code blocks need special handling in Typst pipeline | Already solved in `generate.sh`; replicate in container |
| **Cloudflare Container for Typst** | Containers are relatively new CF feature | ✅ Resolved — Container class works; `declare class` workaround for missing types |
| **Windows symlinks for bootstrap** | Symlinks need Developer Mode or admin on Windows | Detect and warn; fall back to file copy with drift warning |
| **RBAC not yet enforced** | Currently all users are admin | ✅ Resolved — Phase 4 added guards; #12 tracks D1 user lookup |
| **Git ↔ R2 desync** | Content authored in git not available in CMS/AI Search | Phase 7 codex-sync worker |
| **QC check cost** | Workers AI calls for every QC check add token cost | Use smaller model (Llama 3.1 8B) for quick checks; 70B only for deep review |
| **Import sanitization edge cases** | External tools export wildly different markdown flavors | Strict normalization pipeline; preview before save |

## Verification Strategy

### Per-phase verification

- **Phase 1**: ✅ Create a test markdown file, load in Tiptap, edit, save, verify round-trip fidelity.
- **Phase 2**: ✅ Run migration script, verify all YAML files produce valid markdown. Diff content.
- **Phase 3**: ✅ Edit a fragment in Hanawa, verify R2 file updates, verify D1 index updates.
- **Phase 4**: Create an assembled document with 3+ sections, reorder, edit, generate PDF.
- **Phase 5**: ✅ Generate a PDF from Typst container, compare with `tools/md-to-pdf/generate.sh` output. Verify bilingual per-language TOCs.
- **Phase 6**: Run `seed-standards.ts` → verify KV populated. `claude mcp add` → test `list_standards`, `get_standard`, `search_standards`. Run bootstrap scripts on macOS and Windows → verify symlinks. Edit a standard in Hanawa CMS → verify KV updates.
- **Phase 7**: Import a markdown file exported from Claude Desktop → verify sanitization (filename, frontmatter, content). Run QC check on a fragment → verify flagged phrases match guide rules. Confirm writing tips panel renders in EN and JA editors.
- **Phase 8**: Push a markdown change to `content/`, verify it appears in R2 and D1 index.
- **Phase 9**: Edit a standing document, generate PDF.
- **Phase 10**: Authenticate as a client user, edit a page, verify R2 file updates.
- **Phase 11**: Run `qc-content.ts` on all fragments → verify report. Run QC on a document section → verify result panel. Import `.md` into a document section → verify content loads.

### Preflight checks

After every code change: `npm run verify` (lint + typecheck + test)

### End-to-end test

Full flow: Create fragment (markdown) → Insert into assembled document → Edit section → Generate bilingual PDF → Verify output

---

*Plan created: 2026-02-27*
*Last updated: 2026-03-01 — Phases 1-8 complete, Phase 9 (Standing Documents) next*

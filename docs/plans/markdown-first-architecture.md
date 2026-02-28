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
| Phase 5: PDF via Typst | ⏳ Next | Cloudflare Container with pandoc + typst |
| Phase 6: Codex Sync | ⏳ Planned | Git ↔ R2 content synchronization worker |
| Phase 7: Standing Documents | ⏳ Planned | Single-file docs (rate cards, capability statements) |
| Phase 8: Website Content Editing | ⏳ Planned | Site-scoped routes for client content |

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

## Phase 6: Codex Sync (Git ↔ R2) ⏳

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

4. **Reverse sync (CMS → git)** — stretch goal
   - Export button in Hanawa: writes R2 content back to a git branch
   - Or: scheduled worker that diffs R2 vs git and opens PRs
   - Lower priority — CMS content can stay in R2 for now

### Files to create
- `packages/codex-sync/src/index.ts` (Hono worker)
- `packages/codex-sync/wrangler.jsonc`
- `packages/codex-sync/package.json`
- `.github/workflows/codex-sync.yml`
- `scripts/validate-content.ts` (frontmatter + schema validation)

### Files to modify
- `packages/hanawa-cms/wrangler.jsonc` (service binding to codex-sync, if needed)

---

## Phase 7: Standing Documents ⏳

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

## Phase 8: Website Content Editing ⏳

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

## Key Technical Risks

| Risk | Impact | Mitigation |
|------|--------|------------|
| **Tiptap 2→3 upgrade** | All 7 custom extensions may need rework | ✅ Resolved — upgraded successfully |
| **`@tiptap/markdown` is beta** | Edge cases with complex content | ✅ Resolved — custom handlers for callouts, page breaks, etc. |
| **Mermaid in markdown** | Mermaid code blocks need special handling in Typst pipeline | Already solved in `generate.sh`; replicate in container |
| **Cloudflare Container for Typst** | Containers are relatively new CF feature | Validate container deploys early; fallback: run Typst as a GitHub Action |
| **RBAC not yet enforced** | Currently all users are admin | ✅ Resolved — Phase 4 added guards; #12 tracks D1 user lookup |
| **Git ↔ R2 desync** | Content authored in git not available in CMS/AI Search | Phase 6 codex-sync worker |

## Verification Strategy

### Per-phase verification

- **Phase 1**: ✅ Create a test markdown file, load in Tiptap, edit, save, verify round-trip fidelity.
- **Phase 2**: ✅ Run migration script, verify all YAML files produce valid markdown. Diff content.
- **Phase 3**: ✅ Edit a fragment in Hanawa, verify R2 file updates, verify D1 index updates.
- **Phase 4**: Create an assembled document with 3+ sections, reorder, edit, generate PDF.
- **Phase 5**: Generate a PDF from Typst container, compare with `tools/md-to-pdf/generate.sh` output. Verify bilingual per-language TOCs.
- **Phase 6**: Push a markdown change to `content/`, verify it appears in R2 and D1 index.
- **Phase 7**: Edit a standing document, generate PDF.
- **Phase 8**: Authenticate as a client user, edit a page, verify R2 file updates.

### Preflight checks

After every code change: `npm run verify` (lint + typecheck + test)

### End-to-end test

Full flow: Create fragment (markdown) → Insert into assembled document → Edit section → Generate bilingual PDF → Verify output

---

*Plan created: 2026-02-27*
*Last updated: 2026-02-28 — Phases 1-4 complete*

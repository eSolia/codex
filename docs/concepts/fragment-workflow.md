# Fragment Lifecycle & Quality Control

How fragments move from draft to production, with ingestion standards and QC checkpoints.

## Fragment Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRAGMENT LIFECYCLE                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AUTHORING                    QC GATES                    PRODUCTION        │
│  ─────────                    ────────                    ──────────        │
│                                                                              │
│  content/fragments/           Validation                  R2 (codex bucket) │
│  └── _drafts/                 ├── Schema validation       ├── Indexed in D1 │
│      ├── product-xyz.yaml     ├── Bilingual check         ├── Versioned     │
│      └── ...                  ├── Markdown lint           └── Immutable     │
│                               ├── Link verification                          │
│  Claude Code / Hanawa         └── Human review            Hanawa resolves   │
│  authors here                                              at view/export    │
│                                                                              │
│  content/fragments/           Git push triggers           Sites consume     │
│  └── products/                CI validation               from R2           │
│      ├── m365-bp.yaml                                                       │
│      └── ...                  Hanawa syncs on publish                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Directory Structure

```
content/
├── fragments/
│   ├── _drafts/                    # Work in progress (not synced to R2)
│   │   └── *.yaml                  # Prefixed with underscore = draft
│   │
│   ├── products/                   # Product overviews
│   │   ├── m365-business-premium.yaml
│   │   ├── m365-e3.yaml
│   │   ├── m365-e5.yaml
│   │   ├── cloudflare-zero-trust.yaml
│   │   ├── cloudflare-pages.yaml
│   │   └── ...
│   │
│   ├── services/                   # eSolia service descriptions
│   │   ├── implementation-methodology.yaml
│   │   ├── managed-services.yaml
│   │   ├── security-assessment.yaml
│   │   └── ...
│   │
│   ├── comparisons/                # Side-by-side comparisons
│   │   ├── m365-licenses.yaml      # BP vs E3 vs E5
│   │   ├── hosting-options.yaml
│   │   └── ...
│   │
│   ├── diagrams/                   # Reusable Mermaid diagrams
│   │   ├── cloudflare-security-layers.yaml
│   │   ├── m365-integration-flow.yaml
│   │   └── ...
│   │
│   ├── boilerplate/                # Standard paragraphs
│   │   ├── esolia-contact.yaml
│   │   ├── confidentiality-notice.yaml
│   │   ├── payment-terms.yaml
│   │   └── ...
│   │
│   └── pricing/                    # Price tables (internal only)
│       ├── m365-pricing-2025.yaml
│       └── ...
│
├── concepts/                       # Explanation articles
├── how-to/                         # Task guides
└── templates/                      # Document templates
```

## Fragment Schema

Every fragment follows this YAML structure:

```yaml
# content/fragments/products/m365-business-premium.yaml
# ──────────────────────────────────────────────────────

# IDENTITY
id: m365-business-premium              # Unique, URL-safe slug
category: products                      # Must match parent directory
version: "2025-01"                      # CalVer: YYYY-MM or YYYY-MM-vN

# METADATA
title:
  en: "Microsoft 365 Business Premium"
  ja: "Microsoft 365 Business Premium"

type: product-overview                  # Enum: product-overview, comparison,
                                        # service-description, diagram, boilerplate

tags:
  - m365
  - licensing
  - productivity
  - security

# LIFECYCLE
status: production                      # draft | review | production | deprecated
created: "2025-01-15"
modified: "2025-01-20"
author: "rick.cogley@esolia.co.jp"
reviewer: null                          # Set during review phase
review_due: "2025-04-15"                # Quarterly review cycle

# ACCESS CONTROL (optional)
sensitivity: normal                     # normal | internal | confidential
allowed_collections:                    # Which document types can use this
  - proposals
  - help
  - concepts

# CONTENT
content:
  en: |
    **Full Office Applications:** The license includes perpetual desktop
    versions of Word, Excel, PowerPoint, and Outlook—replacing whatever
    came with your laptops with properly licensed, always-updated software.

    **Business Email:** Professional email hosting with your company domain,
    plus calendars, contacts, and Microsoft Teams for collaboration.

    [Additional content...]

  ja: |
    **フルOfficeアプリケーション:** このライセンスには、Word、Excel、
    PowerPoint、Outlookの永続デスクトップ版が含まれています。

    **ビジネスメール:** 貴社ドメインでのプロフェッショナルなメール
    ホスティング、カレンダー、連絡先、Microsoft Teamsによるコラボ
    レーション機能を提供します。

    [追加コンテンツ...]

# DIAGRAM (for type: diagram only)
diagram:
  format: mermaid                       # mermaid | svg | png
  source: |
    flowchart TB
        A[Team] --> B[Cloudflare]
        B --> C[Services]
```

## Lifecycle States

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  FRAGMENT STATES                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  draft ──────► review ──────► production ──────► deprecated                 │
│    │             │               │                    │                      │
│    │             │               │                    ▼                      │
│    │             │               │               archived                    │
│    │             ▼               │               (removed)                   │
│    │          rejected           │                                           │
│    │             │               │                                           │
│    └─────────────┘               │                                           │
│         (back to draft)          ▼                                           │
│                            in use by N docs                                  │
│                            (tracked in D1)                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

| State | Location | Synced to R2 | Can Reference |
|-------|----------|--------------|---------------|
| `draft` | `_drafts/` or `status: draft` | No | No |
| `review` | Main folder, `status: review` | No | No (preview only) |
| `production` | Main folder, `status: production` | Yes | Yes |
| `deprecated` | Main folder, `status: deprecated` | Yes (cached) | Yes (with warning) |

## Quality Control Gates

### Gate 1: Schema Validation (Automated)

On every Git push, CI validates:

```yaml
# .github/workflows/fragments.yaml
- name: Validate Fragments
  run: |
    npx ajv validate -s schemas/fragment.json -d "content/fragments/**/*.yaml"
```

Checks:
- Required fields present (`id`, `title.en`, `title.ja`, `content.en`, `content.ja`)
- Valid enum values (`type`, `status`, `sensitivity`)
- Version format matches CalVer
- Category matches directory
- No duplicate IDs

### Gate 2: Content Quality (Automated + Manual)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONTENT QC CHECKLIST                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  AUTOMATED                                                                   │
│  ☐ Markdown syntax valid (markdownlint)                                     │
│  ☐ No broken internal links                                                 │
│  ☐ Japanese text length ≈ English (within 30% variance)                     │
│  ☐ No hardcoded prices (use placeholders or pricing fragments)              │
│  ☐ Mermaid diagrams render without errors                                   │
│  ☐ No TODO/FIXME markers in production status                               │
│                                                                              │
│  MANUAL (during review)                                                      │
│  ☐ Technical accuracy verified                                              │
│  ☐ Japanese translation natural (not machine-like)                          │
│  ☐ Consistent with eSolia terminology                                       │
│  ☐ No confidential client info in public fragments                          │
│  ☐ Diagrams match current product capabilities                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Gate 3: Human Review

For `status: review` → `status: production`:

1. **Author** sets `status: review` and `reviewer: <email>`
2. **Reviewer** receives notification (via GitHub PR or Hanawa)
3. **Reviewer** checks manual QC items
4. **Reviewer** either:
   - Approves → sets `status: production`, clears `reviewer`
   - Rejects → adds comment, sets `status: draft`

### Gate 4: Periodic Review

Fragments with `review_due` in the past trigger:
- Dashboard warning in Hanawa
- Email to last `author`
- Quarterly review cycle by default

## Ingestion Workflows

### Path A: Claude Code (Technical Staff)

```bash
# 1. Create draft in codex repo
cd /Users/rcogley/dev/codex
claude

> Create a bilingual fragment for Cloudflare Zero Trust Gateway.
> Include key features, WARP client, and DNS filtering.
> Save to content/fragments/_drafts/cloudflare-zero-trust.yaml
```

```bash
# 2. Validate locally
npm run validate:fragments

# 3. Move to production folder when ready
mv content/fragments/_drafts/cloudflare-zero-trust.yaml \
   content/fragments/products/cloudflare-zero-trust.yaml

# 4. Update status in file
# status: draft → status: review

# 5. Commit and push
git add content/fragments/products/cloudflare-zero-trust.yaml
git commit -m "feat(fragments): add Cloudflare Zero Trust overview"
git push
```

```bash
# 6. CI runs validation
# 7. PR review (if required) or direct merge
# 8. Post-merge: codex-sync worker uploads to R2
```

### Path B: Hanawa CMS (Non-Technical Staff)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  HANAWA FRAGMENT EDITOR                                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. Navigate to hanawa.esolia.co.jp/fragments                               │
│  2. Click "New Fragment" or duplicate existing                              │
│  3. Fill in form:                                                           │
│     ┌──────────────────────────────────────────────┐                        │
│     │ ID: [auto-generated or custom slug]          │                        │
│     │ Category: [dropdown]                         │                        │
│     │ Type: [dropdown]                             │                        │
│     │ Title (EN): [_______________]                │                        │
│     │ Title (JA): [_______________]                │                        │
│     │                                              │                        │
│     │ Content (EN):                                │                        │
│     │ ┌──────────────────────────────────────────┐ │                        │
│     │ │ [Tiptap editor with markdown preview]    │ │                        │
│     │ └──────────────────────────────────────────┘ │                        │
│     │                                              │                        │
│     │ Content (JA):                                │                        │
│     │ ┌──────────────────────────────────────────┐ │                        │
│     │ │ [Tiptap editor with markdown preview]    │ │                        │
│     │ └──────────────────────────────────────────┘ │                        │
│     │                                              │                        │
│     │ Tags: [m365] [security] [+]                 │                        │
│     │                                              │                        │
│     │ [Save Draft] [Submit for Review] [Preview]  │                        │
│     └──────────────────────────────────────────────┘                        │
│                                                                              │
│  4. "Submit for Review" triggers:                                           │
│     - Automated validation                                                  │
│     - Notification to reviewer                                              │
│     - Fragment locked for editing                                           │
│                                                                              │
│  5. Reviewer approves/rejects in Hanawa UI                                  │
│                                                                              │
│  6. On approval: fragment synced to Git and R2                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Path C: Bulk Import (Migration)

For importing existing content:

```bash
# content/fragments/_import/README.md
# Place markdown files here with naming convention:
# {category}--{id}--{lang}.md
#
# Example:
# products--m365-business-premium--en.md
# products--m365-business-premium--ja.md

npm run import:fragments
# Combines paired files into YAML, validates, outputs to _drafts/
```

## Naming Conventions

### Fragment IDs

| Pattern | Example | Notes |
|---------|---------|-------|
| `{product-name}` | `m365-business-premium` | Products |
| `{comparison-type}` | `m365-licenses` | Comparisons |
| `{service-name}` | `security-assessment` | Services |
| `{diagram-name}` | `cloudflare-security-layers` | Diagrams |
| `{purpose}` | `payment-terms` | Boilerplate |

Rules:
- Lowercase, hyphen-separated
- No version numbers in ID (version is a field)
- Descriptive but concise (max 50 chars)
- English-only (Japanese in `title.ja`)

### Version Numbers

Use CalVer: `YYYY-MM` or `YYYY-MM-vN` for multiple updates per month.

```yaml
version: "2025-01"        # First version January 2025
version: "2025-01-v2"     # Second update January 2025
version: "2025-03"        # March 2025 quarterly update
```

### File Names

```
{id}.yaml
```

Examples:
- `m365-business-premium.yaml`
- `cloudflare-security-layers.yaml`
- `esolia-contact.yaml`

## Reference Syntax

In proposals and documents:

```markdown
## Microsoft 365 Overview

{{fragment:products/m365-business-premium lang="ja"}}

## License Comparison

{{fragment:comparisons/m365-licenses lang="ja" version="2025-01"}}

## Architecture

{{fragment:diagrams/cloudflare-security-layers}}
```

### Syntax Options

| Syntax | Behavior |
|--------|----------|
| `{{fragment:id}}` | Latest version, default language |
| `{{fragment:id lang="ja"}}` | Specific language |
| `{{fragment:id version="2025-01"}}` | Specific version |
| `{{fragment:category/id}}` | With category prefix |

### Resolution

At view/export time in Hanawa:
1. Parse fragment reference
2. Look up in R2 (or D1 cache)
3. Select language/version
4. Inject content inline
5. Record in provenance metadata

## Provenance Tracking

Every assembled document includes fragment provenance:

```yaml
# Embedded in PDF metadata and Hanawa database
provenance:
  document_id: "proposal-acme-2025-01"
  assembled_at: "2025-01-20T14:00:00Z"
  assembled_by: "rick.cogley@esolia.co.jp"

  fragments_used:
    - id: "products/m365-business-premium"
      version: "2025-01"
      lang: "ja"
      resolved_at: "2025-01-20T14:00:01Z"
      content_hash: "sha256:abc123..."

    - id: "comparisons/m365-licenses"
      version: "2025-01"
      lang: "ja"
      resolved_at: "2025-01-20T14:00:02Z"
      content_hash: "sha256:def456..."

    - id: "diagrams/cloudflare-security-layers"
      version: "2025-01"
      resolved_at: "2025-01-20T14:00:03Z"
      rendered_as: "svg"
      content_hash: "sha256:ghi789..."
```

### Version Drift Alerts

When a fragment updates, Hanawa notifies:
- Documents using older versions
- Option to "Update all references" or "Keep pinned"

## PDF Generation

Follows the Periodic/Pulse pattern:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PDF GENERATION FLOW (via Nexus)                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Hanawa                        Nexus                       Client            │
│  ──────                        ─────                       ──────            │
│                                                                              │
│  1. Assemble document                                                        │
│     ├── Resolve fragments                                                    │
│     ├── Render Mermaid → SVG                                                │
│     └── Generate self-contained HTML                                         │
│                                                                              │
│  2. POST /api/v1/integration/pdf                                            │
│     ├── htmlContent (base64)                                                 │
│     ├── provenance (full metadata)                                          │
│     ├── filename                                                             │
│     └── language                                                             │
│                                                                              │
│                               3. Nexus uses @cloudflare/puppeteer           │
│                                  ├── Renders HTML                            │
│                                  ├── Embeds provenance                       │
│                                  ├── Generates PDF                           │
│                                  └── Caches by content hash                  │
│                                                                              │
│                               4. Returns PDF bytes                           │
│                                  ├── X-Nexus-PDF-Cached                      │
│                                  ├── X-Nexus-Content-Hash                    │
│                                  └── Content-Disposition                     │
│                                                                              │
│  5. Stream to user or                                                        │
│     create Courier share                                                     │
│                                                             6. PIN-protected │
│                                                                access        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### PDF Provenance Embedding

Provenance appears in PDF as:
1. **Visible footer** - Export ID, generation date, classification
2. **Hidden JSON** - Full provenance in document metadata
3. **Schema.org JSON-LD** - Machine-readable structured data

---

## Quick Reference

### Creating a Fragment

1. **Draft**: Create in `_drafts/` or set `status: draft`
2. **Validate**: Run `npm run validate:fragments`
3. **Review**: Move to category folder, set `status: review`
4. **Approve**: Reviewer sets `status: production`
5. **Sync**: CI pushes to R2, available in Hanawa

### Fragment QC Checklist

- [ ] Schema valid (all required fields)
- [ ] Both EN and JA content present
- [ ] Length parity (JA ≈ EN)
- [ ] No broken links
- [ ] No hardcoded prices
- [ ] Technical accuracy verified
- [ ] Translation quality checked
- [ ] Diagrams render correctly
- [ ] Tags assigned
- [ ] Review date set

### Commands

```bash
# Validate all fragments
npm run validate:fragments

# Validate single fragment
npm run validate:fragment -- content/fragments/products/m365-bp.yaml

# Import from markdown
npm run import:fragments

# Check for stale fragments (past review_due)
npm run check:fragment-reviews
```

---

*Document version: 1.0*
*Last updated: 2025-12-27*

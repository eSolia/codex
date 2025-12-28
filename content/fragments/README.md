# Codex Fragments

Reusable bilingual content blocks for proposals, documentation, and help articles.

## Directory Structure

```
fragments/
├── _drafts/          # Work in progress (not synced to R2)
├── products/         # Product overviews (M365, Cloudflare, etc.)
├── services/         # eSolia service descriptions
├── comparisons/      # Side-by-side comparisons
├── diagrams/         # Reusable Mermaid diagrams
├── boilerplate/      # Standard paragraphs (contact, disclaimers)
└── pricing/          # Price tables (internal only)
```

## Creating a Fragment

1. Create YAML file in appropriate category folder
2. Follow schema in `/schemas/fragment.json`
3. Include both EN and JA content
4. Set `status: draft` initially
5. Run validation: `npm run validate:fragments`
6. Change to `status: review` when ready
7. After review, set `status: production`

## Fragment Schema

```yaml
id: unique-slug                    # Required: URL-safe identifier
category: products                 # Required: must match directory
version: "2025-01"                 # Required: CalVer format
title:
  en: "English Title"              # Required
  ja: "日本語タイトル"              # Required
type: product-overview             # Required: enum
tags: [tag1, tag2]                 # Recommended
status: production                 # Required: draft|review|production|deprecated
created: "2025-01-15"              # Required: ISO date
modified: "2025-01-20"             # Required: ISO date
author: "email@esolia.co.jp"       # Required
content:
  en: |                            # Required
    English markdown content...
  ja: |                            # Required
    日本語マークダウンコンテンツ...
```

## Using Fragments

In Hanawa CMS or markdown documents:

```markdown
{{fragment:products/m365-business-premium lang="ja"}}
{{fragment:diagrams/cloudflare-security-layers}}
{{fragment:boilerplate/esolia-contact lang="en"}}
```

## Validation

```bash
# Validate all fragments
npm run validate:fragments

# Check for stale reviews
npm run check:fragment-reviews
```

## See Also

- [Fragment Workflow](../../docs/concepts/fragment-workflow.md) - Full lifecycle documentation
- [Proposal Workflow](../../docs/concepts/proposal-workflow.md) - Using fragments in proposals

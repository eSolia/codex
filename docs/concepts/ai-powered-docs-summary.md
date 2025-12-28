# AI-Powered Documentation Architecture

## Summary

This document outlines an approach to building a **content-as-code** knowledge base that powers multiple products through Cloudflare's AI Search (formerly AutoRAG). The key insight is treating educational content like source code: versioned, validated, and deployed to multiple targets.

---

## The Core Concept

```
┌─────────────────────────────────────────────────────────────────┐
│                 CONTENT REPO (Source of Truth)                   │
│                                                                  │
│   Markdown + YAML + Diagrams                                     │
│   Validated by schemas                                           │
│   Reviewed via PR                                                │
│   Authored with Claude Code                                      │
│                                                                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            │  CI/CD Pipeline
                            │
         ┌──────────────────┼──────────────────┐
         │                  │                  │
         ▼                  ▼                  ▼
  ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
  │  AI Search  │   │ Static Docs │   │  Quiz DB    │
  │  (RAG)      │   │ (Browsable) │   │  (D1)       │
  │             │   │             │   │             │
  │ In-app help │   │ SEO, public │   │ Structured  │
  │ Q&A         │   │ reference   │   │ questions   │
  └─────────────┘   └─────────────┘   └─────────────┘
         │                  │                  │
         └──────────────────┼──────────────────┘
                            │
                            ▼
              ┌───────────────────────────┐
              │   Multiple Products       │
              │   (Periodic, Pulse,       │
              │    Quiz, Nexus)           │
              └───────────────────────────┘
```

---

## Retrieval-First Architecture (Cost Efficiency)

The key insight for cost control: **pay once to create great content, retrieve cheaply forever**.

### Two Modes of AI Search

| Mode | What It Does | Cost | When to Use |
|------|--------------|------|-------------|
| `.search()` | Retrieves pre-written content | ~1-2 Neurons | Default for most queries |
| `.aiSearch()` | Retrieves + generates new answer | ~100-200 Neurons | Novel questions only |

### Cost Comparison

| Approach | Per-Query Cost | 1,000 Queries/Day |
|----------|---------------|-------------------|
| Always generate | ~100-200 Neurons | ~$1.10-2.20/day |
| Always retrieve | ~1-2 Neurons | ~$0.01-0.02/day |
| Hybrid (90/10) | ~12-22 Neurons avg | ~$0.13-0.24/day |

### Hybrid Pattern (Recommended)

```javascript
// Try retrieval first, fall back to generation
const searchResults = await env.AI.autorag("security-education").search({
  query: question,
});

const HIGH_CONFIDENCE = 0.85;

if (topResult?.score >= HIGH_CONFIDENCE) {
  // Return pre-written content directly (cheap)
  return topResult.text;
} else {
  // Generate answer (expensive, but rare)
  const generated = await env.AI.autorag("security-education").aiSearch({
    query: question,
  });
  
  // Log this gap for future content creation
  await logContentGap(question);
  
  return generated.response;
}
```

---

## Content Structure

```
security-content/
├── content/
│   ├── periodic/                    # DNS monitoring product
│   │   ├── issues/                  # Detected problems
│   │   │   └── dns/
│   │   │       ├── spf-missing.md
│   │   │       ├── spf-too-permissive.md
│   │   │       └── dmarc-missing.md
│   │   ├── concepts/                # Educational fundamentals
│   │   │   ├── what-is-spf.md
│   │   │   ├── what-is-dmarc.md
│   │   │   └── what-is-dkim.md
│   │   └── remediation/             # Fix guidance
│   │       └── by-provider/
│   │
│   ├── pulse/                       # Compliance tracking product
│   │   └── frameworks/
│   │       ├── iso27001/
│   │       │   └── controls/
│   │       └── m365-baseline/
│   │           └── controls/
│   │               └── mfa-admins.md
│   │
│   ├── quiz/                        # Quiz/training product
│   │   └── banks/
│   │       └── email-security.yaml
│   │
│   └── shared/                      # Cross-product content
│       ├── diagrams/
│       └── glossary/
│
├── schemas/                         # JSON Schema validation
│   ├── issue.schema.json
│   ├── control.schema.json
│   └── quiz-bank.schema.json
│
├── templates/                       # Authoring templates
└── scripts/                         # Build & validation
```

---

## Content Document Anatomy

### Frontmatter (Machine-Readable Metadata)

```yaml
---
id: spf-missing
category: issue
subcategory: dns/email-authentication
severity: high
keywords:
  - spf
  - email authentication
  - phishing
related_issues:
  - spf-too-permissive
  - dmarc-missing
related_concepts:
  - what-is-spf
products:
  - periodic
  - quiz
last_updated: 2025-01-15
---
```

### Body (Human-Readable Content)

Structured sections optimized for retrieval:

1. **Summary** — Front-loaded with searchable terms (first 200 chars are critical)
2. **Why This Matters** — Business impact, statistics, analogies
3. **What We Found** — Specific details (for issues)
4. **How to Fix This** — Actionable remediation
5. **Common Questions** — Anticipate user queries
6. **Learn More** — Related content links

---

## Multi-Tenancy & Privacy

AI Search supports tenant isolation via folder-based filtering:

```
R2 Bucket Structure:
├── tenant-a/
│   ├── docs/
│   └── custom-content/
├── tenant-b/
│   └── docs/
└── shared/                    # Your base content
    ├── periodic/
    ├── pulse/
    └── quiz/
```

```javascript
// Query scoped to tenant
const result = await env.AI.autorag("security-education").search({
  query: question,
  filters: {
    type: "or",
    filters: [
      { type: "eq", key: "folder", value: `${tenantId}/` },
      { type: "eq", key: "folder", value: "shared/" },
    ],
  },
});
```

### Privacy Guarantees

- Data never leaves Cloudflare's infrastructure (if using Workers AI models)
- Data never used for training
- Data never shared with other customers
- Tenant isolation enforced at query time

---

## Quiz Integration

Quiz questions live as YAML in the content repo but transform to D1 for the app:

```yaml
# content/quiz/banks/email-security.yaml
id: email-security-fundamentals
title: Email Security Fundamentals

questions:
  - id: spf-001
    type: multiple-choice
    question: |
      What does `-all` at the end of an SPF record mean?
    options:
      - id: a
        text: Accept all email regardless of sender
      - id: b
        text: Reject email from unauthorized senders
    correct: b
    explanation: |
      The `-all` mechanism is a "hard fail"...
    reference: periodic/concepts/what-is-spf.md
    difficulty: beginner
```

CI transforms this to SQL and syncs to D1 for fast quiz operations.

---

## Deployment Model

The content repo is **completely independent** from app repos:

```
┌─────────────────┐
│ security-content│ ──── CI ────▶ R2 ──▶ AI Search
│ (standalone)    │
└─────────────────┘
                                         │ API
        ┌────────────────────────────────┼────────────────┐
        │                                │                │
        ▼                                ▼                ▼
┌─────────────┐                  ┌─────────────┐  ┌─────────────┐
│  periodic/  │                  │   pulse/    │  │   quiz/     │
│  (app repo) │                  │  (app repo) │  │  (app repo) │
└─────────────┘                  └─────────────┘  └─────────────┘

Apps query AI Search at runtime via API.
No build-time dependencies between repos.
```

---

## Authoring Workflow

### With Claude Code

```bash
# Generate new content from template
claude "Create an issue document for DKIM key rotation"

# Generate quiz questions from existing content
claude "Generate 5 quiz questions from what-is-spf.md"

# Update content based on feedback
claude "Add a section about SPF flattening to the lookup limit issue"
```

### Manual Workflow

1. Copy template from `templates/`
2. Fill in frontmatter and sections
3. Run `npm run validate` locally
4. Submit PR
5. CI validates schema, links, sections
6. Merge deploys to AI Search

---

## Content Refresh Cadence

| Content Type | Refresh Frequency | Examples |
|--------------|-------------------|----------|
| Static | Yearly | ISO 27001 explanations, DNS fundamentals |
| Semi-static | Quarterly | M365 baseline changes, threat landscape |
| Dynamic | Generate on-demand | Client-specific analysis, novel questions |

---

## Integration with Illustrations

Illustrations enhance retrieval and comprehension:

```markdown
## How SPF Works

![SPF Authentication Flow](/diagrams/spf-flow.svg)

When someone receives an email claiming to be from your domain...
```

Potential integration patterns:

1. **Inline with content** — Diagram lives with the concept it explains
2. **Shared library** — Reusable diagrams referenced by path
3. **Generated** — Mermaid/text-based diagrams rendered at build time

---

## Key Cloudflare Services Used

| Service | Purpose | Pricing |
|---------|---------|---------|
| **R2** | Content storage | Free up to 10GB |
| **AI Search** | RAG retrieval + optional generation | Free to enable (beta) |
| **Workers AI** | Embedding + LLM inference | 10k Neurons/day free |
| **Vectorize** | Vector embeddings | Free up to 5M vectors |
| **D1** | Quiz progress, structured data | Free tier generous |
| **Pages** | Static docs site (optional) | Free |

---

## Next Steps

1. **Flesh out illustration library** — Define formats, organization, workflow
2. **Combine content + illustrations** — Single source of truth
3. **Build initial content set** — Start with high-value Periodic concepts
4. **Deploy to AI Search** — Test retrieval quality
5. **Integrate into apps** — Add search UI to products

---

## Reference

Sample code package available with:
- Content schemas (JSON Schema)
- Example documents (issues, concepts, controls, quiz)
- Validation scripts
- Deployment scripts (R2 sync, AI Search reindex)
- CI/CD workflows (GitHub Actions)
- Scaffolding tools for new content

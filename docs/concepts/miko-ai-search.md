# Miko: AI-Powered Knowledge Interface

How Miko uses Cloudflare AI Search to provide conversational access to Codex content.

## Overview

Miko (巫女) serves as the intermediary between users and Codex knowledge—like a shrine maiden who channels information. Built on Cloudflare AI Search (formerly AutoRAG), Miko provides semantic search and AI-generated answers grounded in eSolia's curated content.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  MIKO ARCHITECTURE                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  USER INTERFACES                 AI SEARCH                CONTENT           │
│  ───────────────                 ─────────                ───────           │
│                                                                              │
│  codex.esolia.pro ────┐                               ┌── Hanawa CMS        │
│  (Ask Miko widget)    │     ┌─────────────────┐       │   (proposals,       │
│                       │     │   Cloudflare    │       │    help, blog)      │
│  help.esolia.pro ─────┼────►│   AI Search     │◄──────┤                     │
│  (Contextual help)    │     │                 │       │                     │
│                       │     │  • Vectorize    │       ├── Git content       │
│  Periodic/Pulse ──────┤     │  • Workers AI   │       │   (concepts,        │
│  (In-app guidance)    │     │  • R2 index     │       │    how-to, ref)     │
│                       │     └─────────────────┘       │                     │
│  Nexus portal ────────┘                               └── Fragments         │
│  (Client Q&A)                                             (products,        │
│                                                            services)        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Cost-Efficient Design

**Key Insight:** Pay once to create great content, retrieve cheaply forever.

### Two Modes of AI Search

| Mode | Method | Cost | Use Case |
|------|--------|------|----------|
| **Retrieval** | `.search()` | ~1-2 Neurons | Return pre-written answers |
| **Generation** | `.aiSearch()` | ~100-200 Neurons | Novel questions, synthesis |

### Hybrid Pattern (Recommended)

```typescript
// src/lib/server/miko.ts

export async function askMiko(
  env: Env,
  question: string,
  context?: { collection?: string; language?: 'en' | 'ja' }
): Promise<MikoResponse> {
  const HIGH_CONFIDENCE = 0.85;

  // Step 1: Try retrieval first (cheap)
  const searchResults = await env.AI.autorag('codex').search({
    query: question,
    filters: context?.collection
      ? { type: 'eq', key: 'collection', value: context.collection }
      : undefined,
  });

  const topResult = searchResults.results[0];

  // Step 2: If confident match, return directly
  if (topResult?.score >= HIGH_CONFIDENCE) {
    return {
      answer: topResult.text,
      source: topResult.metadata.source,
      confidence: topResult.score,
      mode: 'retrieval',
      cost: 2, // Neurons
    };
  }

  // Step 3: Otherwise, generate (expensive but necessary)
  const generated = await env.AI.autorag('codex').aiSearch({
    query: question,
  });

  // Step 4: Log content gap for future authoring
  await logContentGap(env, question, searchResults);

  return {
    answer: generated.response,
    sources: generated.sources,
    confidence: null,
    mode: 'generation',
    cost: 150, // Neurons (approximate)
  };
}

// Track questions that required generation
async function logContentGap(
  env: Env,
  question: string,
  searchResults: SearchResults
): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO content_gaps (question, top_score, searched_at)
     VALUES (?, ?, ?)`
  ).bind(
    question,
    searchResults.results[0]?.score ?? 0,
    new Date().toISOString()
  ).run();
}
```

### Cost Comparison

| Approach | Per Query | 1,000 Queries/Day | Monthly |
|----------|-----------|-------------------|---------|
| Always generate | ~150 Neurons | ~$1.65/day | ~$50 |
| Always retrieve | ~2 Neurons | ~$0.02/day | ~$0.60 |
| Hybrid (90/10) | ~17 Neurons | ~$0.19/day | ~$5.70 |

**Strategy:** Invest in content authoring (via Claude Max subscription), minimize generation API costs.

## Content Optimization for Retrieval

### Document Structure

Front-load searchable content in the first 200 characters:

```markdown
---
id: what-is-spf
title: "What is SPF (Sender Policy Framework)?"
title_ja: "SPF（Sender Policy Framework）とは？"
collection: concepts
keywords: [spf, email-authentication, dns, phishing, spoofing]
---

## Summary

SPF (Sender Policy Framework) is a DNS-based email authentication method that
specifies which mail servers are authorized to send email for your domain.
It helps prevent email spoofing and phishing attacks by allowing recipients
to verify sender legitimacy.

[Rest of content...]
```

### Keyword Strategy

Include terms users actually search for:

```yaml
# Good keywords
keywords:
  - spf                    # Acronym
  - sender policy framework # Full name
  - email authentication   # Category
  - spoofing              # Problem it solves
  - dns txt record        # Technical detail

# Also include Japanese equivalents in title_ja and content
```

### Section Patterns

Each document should have:

1. **Summary** — First 2-3 sentences answer "what is this?"
2. **Why This Matters** — Business impact, not just technical
3. **The Simple Explanation** — Analogy for accessibility
4. **How It Works** — Technical details for those who need them
5. **Common Questions** — Anticipate follow-up queries

## Multi-Tenancy

AI Search supports folder-based isolation for client-specific content:

```
R2 Bucket (codex):
├── shared/                    # Public knowledge base
│   ├── concepts/
│   ├── how-to/
│   ├── products/
│   └── services/
│
├── clients/                   # Client-specific content
│   ├── acme-corp/
│   │   ├── procedures/
│   │   └── configurations/
│   └── globex-inc/
│       └── custom-docs/
│
└── internal/                  # Staff-only content
    ├── sop/
    └── pricing/
```

### Scoped Queries

```typescript
// Public query (any visitor)
const publicResults = await env.AI.autorag('codex').search({
  query: question,
  filters: { type: 'eq', key: 'folder', value: 'shared/' },
});

// Client-specific query (authenticated client user)
const clientResults = await env.AI.autorag('codex').search({
  query: question,
  filters: {
    type: 'or',
    filters: [
      { type: 'eq', key: 'folder', value: 'shared/' },
      { type: 'eq', key: 'folder', value: `clients/${clientId}/` },
    ],
  },
});

// Internal query (eSolia staff)
const internalResults = await env.AI.autorag('codex').search({
  query: question,
  // No folder filter = search everything
});
```

## Miko Widget

Embeddable component for "Ask Miko" functionality:

```svelte
<!-- packages/miko-widget/src/MikoWidget.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let endpoint = 'https://codex.esolia.pro/api/ask';
  export let collection: string | undefined = undefined;
  export let language: 'en' | 'ja' = 'en';
  export let placeholder = 'Ask Miko...';

  let query = '';
  let response: MikoResponse | null = null;
  let loading = false;

  const dispatch = createEventDispatcher();

  async function askMiko() {
    if (!query.trim()) return;

    loading = true;
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: query, collection, language }),
      });
      response = await res.json();
      dispatch('response', response);
    } finally {
      loading = false;
    }
  }
</script>

<div class="miko-widget">
  <form on:submit|preventDefault={askMiko}>
    <input
      type="text"
      bind:value={query}
      {placeholder}
      disabled={loading}
    />
    <button type="submit" disabled={loading || !query.trim()}>
      {loading ? '...' : '⛩️'}
    </button>
  </form>

  {#if response}
    <div class="miko-response">
      <p>{response.answer}</p>
      {#if response.source}
        <a href={response.source}>Learn more →</a>
      {/if}
    </div>
  {/if}
</div>
```

### Usage in Sites

```html
<!-- help.esolia.pro -->
<script src="https://codex.esolia.pro/miko-widget.js"></script>
<miko-widget collection="help" language="ja"></miko-widget>

<!-- periodic.esolia.pro -->
<script src="https://codex.esolia.pro/miko-widget.js"></script>
<miko-widget collection="periodic" language="en"></miko-widget>
```

## Content Gap Analysis

Track questions that require generation to identify authoring priorities:

```sql
-- D1: content_gaps table
CREATE TABLE content_gaps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  question TEXT NOT NULL,
  top_score REAL,              -- Confidence of best match
  collection TEXT,             -- Where the query came from
  searched_at TEXT NOT NULL,
  addressed_at TEXT,           -- When content was created
  fragment_id TEXT             -- Link to created content
);

-- Query for authoring priorities
SELECT
  question,
  COUNT(*) as frequency,
  AVG(top_score) as avg_confidence,
  MAX(searched_at) as last_asked
FROM content_gaps
WHERE addressed_at IS NULL
GROUP BY question
ORDER BY frequency DESC, avg_confidence ASC
LIMIT 20;
```

### Content Gap Dashboard (Hanawa)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CONTENT GAPS - Authoring Priorities                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Frequently Asked (No Good Answer)                                          │
│  ─────────────────────────────────                                          │
│                                                                              │
│  ▸ "How do I set up DKIM for Microsoft 365?"      42 asks, 0.45 confidence  │
│    [Create Fragment]                                                        │
│                                                                              │
│  ▸ "What's the difference between E3 and E5?"    38 asks, 0.52 confidence  │
│    [Create Fragment]  (Related: m365-licenses exists but needs update)      │
│                                                                              │
│  ▸ "How long does DNS propagation take?"          31 asks, 0.38 confidence  │
│    [Create Fragment]                                                        │
│                                                                              │
│  Recently Addressed                                                          │
│  ──────────────────                                                          │
│                                                                              │
│  ✓ "What is SPF?" → concepts/what-is-spf.md       (addressed 2025-01-15)   │
│  ✓ "M365 Business Premium features" → m365-bp    (addressed 2025-01-20)    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Integration with Proposal Assembly

Miko can assist during proposal creation:

```typescript
// In Hanawa proposal editor
async function suggestFragment(context: string): Promise<FragmentSuggestion[]> {
  const results = await fetch('/api/miko/suggest', {
    method: 'POST',
    body: JSON.stringify({
      context,
      type: 'fragment',
      limit: 5,
    }),
  });

  return results.json();
}

// Example: User types "Microsoft 365" in proposal
// Miko suggests: products/m365-business-premium, comparisons/m365-licenses
```

## Privacy & Data Handling

### Cloudflare AI Search Guarantees

- Data never leaves Cloudflare's infrastructure
- Data never used for training
- Data never shared with other customers
- Queries logged for gap analysis (no PII)

### Query Logging Policy

```typescript
// What we log (for content improvement)
interface QueryLog {
  question: string;        // The query text
  collection: string;      // Source context
  topScore: number;        // Match confidence
  mode: 'retrieval' | 'generation';
  timestamp: string;
}

// What we DON'T log
// - User identity
// - IP addresses
// - Session information
// - Any client-specific context
```

## Deployment

### AI Search Configuration

```toml
# wrangler.toml
[[ai]]
binding = "AI"

[[ai.autorag]]
name = "codex"
bucket = "codex-content"
index_name = "codex-index"
```

### R2 Content Structure for Indexing

```
codex-content/
├── shared/
│   ├── concepts/
│   │   ├── what-is-spf.md
│   │   └── what-is-dmarc.md
│   ├── how-to/
│   │   └── configure-spf-record.md
│   └── products/
│       └── m365-business-premium.md    # Rendered from fragment
│
└── _metadata/
    └── index-config.json               # AI Search configuration
```

### Indexing Trigger

```typescript
// scripts/trigger-reindex.ts
export async function triggerReindex(env: Env): Promise<void> {
  // AI Search auto-indexes on R2 changes
  // For manual reindex:
  await fetch(`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/ai/autorag/${INDEX_NAME}/reindex`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });
}
```

## Metrics & Monitoring

### Key Metrics

| Metric | Target | Action if Below |
|--------|--------|-----------------|
| Retrieval hit rate | >80% | Identify content gaps |
| Avg confidence score | >0.75 | Improve keyword coverage |
| Generation fallback rate | <20% | Author more content |
| Query latency (p95) | <500ms | Check index size |

### Dashboard Query

```sql
SELECT
  DATE(searched_at) as date,
  COUNT(*) as total_queries,
  SUM(CASE WHEN top_score >= 0.85 THEN 1 ELSE 0 END) as retrievals,
  SUM(CASE WHEN top_score < 0.85 THEN 1 ELSE 0 END) as generations,
  AVG(top_score) as avg_confidence
FROM query_logs
WHERE searched_at >= DATE('now', '-30 days')
GROUP BY DATE(searched_at)
ORDER BY date DESC;
```

---

## Quick Reference

### Asking Miko (API)

```bash
curl -X POST https://codex.esolia.pro/api/ask \
  -H "Content-Type: application/json" \
  -d '{"question": "What is SPF?", "language": "en"}'
```

### Response Format

```json
{
  "answer": "SPF (Sender Policy Framework) is...",
  "source": "/concepts/what-is-spf",
  "confidence": 0.92,
  "mode": "retrieval",
  "relatedTopics": ["dkim", "dmarc", "email-authentication"]
}
```

### Cost Optimization

1. **Author comprehensive content** (via Claude Max subscription)
2. **Optimize for retrieval** (keywords, summaries, structure)
3. **Track content gaps** (log low-confidence queries)
4. **Fill gaps proactively** (scheduled authoring from gap analysis)

---

*Document version: 1.0*
*Last updated: 2025-12-27*

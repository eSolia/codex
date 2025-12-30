# Codex Architecture

This document describes the **current implementation** of the Codex platform. For the full vision including planned features, see [concepts/esolia-codex-architecture-v3.md](./concepts/esolia-codex-architecture-v3.md).

## System Overview

Codex is eSolia's unified knowledge infrastructure providing:
- **Centralized authoring** via Hanawa CMS
- **Semantic search** via Miko (Cloudflare AI Search)
- **Multi-channel publishing** to websites, SharePoint, and secure delivery

```mermaid
flowchart TB
    subgraph Authors["AUTHORING"]
        direction LR
        H["🚀 Hanawa CMS<br/>hanawa.esolia.co.jp"]
        GIT["📁 Git + Claude Code<br/>Technical docs"]
    end

    subgraph Storage["CLOUDFLARE STORAGE"]
        direction TB
        D1[("D1<br/>SQLite")]
        R2[("R2<br/>codex bucket")]
        VEC[("Vectorize<br/>Embeddings")]
        KV[("KV<br/>Cache")]
    end

    subgraph AI["AI LAYER"]
        WAI["Workers AI<br/>Embeddings, Analysis"]
        MIKO["🏮 Miko<br/>AI Search"]
    end

    subgraph Consumers["DISTRIBUTION"]
        HELP["help.esolia.pro"]
        CODEX["codex.esolia.co.jp"]
        SP["SharePoint"]
        PDF["PDF Export"]
        API["Delivery API"]
    end

    H -->|drafts, metadata| D1
    H -->|published content| R2
    GIT -->|sync| R2

    R2 --> VEC
    WAI --> VEC
    VEC --> MIKO

    R2 --> HELP
    R2 --> CODEX
    R2 --> SP
    R2 --> PDF
    D1 --> API
    KV --> API

    style H fill:#e11d48,color:#fff
    style MIKO fill:#2d2f63,color:#fff
```

## Packages

### hanawa-cms (v0.1.0)

The centralized headless CMS deployed at `hanawa.esolia.co.jp`.

```mermaid
flowchart LR
    subgraph HanawaCMS["Hanawa CMS"]
        UI["SvelteKit UI<br/>Svelte 5 + Tailwind"]
        EDITOR["Tiptap Editor<br/>Custom Extensions"]
        ROUTES["API Routes<br/>Content, Webhooks, Delivery"]
    end

    subgraph Bindings["Cloudflare Bindings"]
        D1[("D1")]
        R2[("R2")]
        AI["Workers AI"]
        VEC[("Vectorize")]
    end

    UI --> EDITOR
    EDITOR --> ROUTES
    ROUTES --> D1
    ROUTES --> R2
    ROUTES --> AI
    ROUTES --> VEC

    style UI fill:#e11d48,color:#fff
```

**Tech Stack:**
- SvelteKit 2 + Svelte 5 (runes)
- Tailwind CSS v4 + bits-ui
- Tiptap 2.x with custom extensions
- Cloudflare Pages + D1 + R2

**Key Features (Implemented):**
| Feature | Description |
|---------|-------------|
| Rich Text Editor | Tiptap with tables, task lists, code blocks, Mermaid |
| Fragment Library | Reusable content blocks with versioning |
| Version Control | Document history with restore |
| Workflow Engine | Draft → Review → Published states |
| Scheduled Publishing | Time-based publish/unpublish |
| Localization | Field-level EN/JA translations |
| Media Library | R2-backed assets with metadata |
| Webhooks | HMAC-signed event notifications |
| Delivery API | Public content API with caching |
| Preview Links | Shareable token-based previews |
| AI Assistant | Writing suggestions, translation |
| Content Intelligence | Quality scoring, readability |

### hanawa-scheduler (v0.1.0)

Cloudflare Worker handling scheduled publishing jobs.

```mermaid
sequenceDiagram
    participant CRON as Cron Trigger
    participant SCHED as Scheduler Worker
    participant D1 as D1 Database
    participant R2 as R2 Storage
    participant WH as Webhooks

    CRON->>SCHED: Every minute
    SCHED->>D1: Query due jobs
    D1-->>SCHED: Jobs to process

    loop Each job
        SCHED->>D1: Update document status
        SCHED->>R2: Publish/unpublish content
        SCHED->>WH: Fire webhook events
        SCHED->>D1: Mark job complete
    end
```

### pdf-worker (v1.0.0)

Shared PDF generation service for proposals and reports.

```mermaid
flowchart LR
    REQ["Request<br/>HTML + CSS + Assets"] --> WORKER["PDF Worker"]
    WORKER --> PUPPETEER["Puppeteer<br/>Headless Chrome"]
    PUPPETEER --> PDF["PDF Output"]
    WORKER --> R2[("R2<br/>Store result")]
```

## Data Model

### D1 Schema (Core Tables)

```mermaid
erDiagram
    documents ||--o{ document_versions : "has versions"
    documents ||--o{ comments : "has comments"
    documents ||--o{ scheduled_jobs : "has schedules"
    documents }o--|| workflow_stages : "at stage"

    documents {
        text id PK
        text title
        text slug
        text collection
        text content_json
        text status
        text locale
        json localized_fields
        text sensitivity
        timestamp created_at
        timestamp updated_at
        timestamp published_at
    }

    document_versions {
        integer id PK
        text document_id FK
        integer version
        text content_json
        text changed_by
        timestamp created_at
    }

    fragments {
        text id PK
        text title
        text content_en
        text content_ja
        text category
        integer version
        timestamp updated_at
    }

    audit_log {
        integer id PK
        text action
        text entity_type
        text entity_id
        text user_id
        json details
        timestamp created_at
    }
```

### R2 Structure

```
codex/                          # R2 bucket
├── content/                    # Published content
│   ├── concepts/
│   ├── how-to/
│   ├── help/
│   └── blog/
├── fragments/                  # Rendered fragments
├── assets/                     # Media files
│   ├── images/
│   └── documents/
└── exports/                    # Generated PDFs
```

## Security Architecture

```mermaid
flowchart TB
    subgraph External["External Access"]
        USER["User Browser"]
        API_CLIENT["API Client"]
    end

    subgraph Edge["Cloudflare Edge"]
        ACCESS["CF Access<br/>Zero Trust"]
        WAF["WAF Rules"]
        RATE["Rate Limiting"]
    end

    subgraph App["Application"]
        AUTH["Session Auth"]
        CSRF["CSRF Protection"]
        SANITIZE["HTML Sanitization"]
        AUDIT["Audit Logging"]
    end

    subgraph Data["Data Layer"]
        D1_ENC["D1<br/>Encrypted at rest"]
        R2_ENC["R2<br/>Encrypted at rest"]
    end

    USER --> ACCESS
    API_CLIENT --> WAF
    WAF --> RATE
    ACCESS --> AUTH
    RATE --> AUTH
    AUTH --> CSRF
    CSRF --> SANITIZE
    SANITIZE --> AUDIT
    AUDIT --> D1_ENC
    AUDIT --> R2_ENC

    style ACCESS fill:#10b981,color:#fff
    style SANITIZE fill:#e11d48,color:#fff
```

**Key Security Controls:**
- Cloudflare Access (Zero Trust authentication)
- XSS prevention via `$lib/sanitize.ts`
- CSRF protection (SvelteKit built-in)
- Content classification (Normal, Confidential, Embargoed)
- Full audit trail logging
- HMAC-signed webhooks

## Content Flow

```mermaid
flowchart LR
    subgraph Author["Authoring"]
        DRAFT["Draft"]
        REVIEW["In Review"]
    end

    subgraph Publish["Publishing"]
        SCHEDULED["Scheduled"]
        PUBLISHED["Published"]
    end

    subgraph Consume["Consumption"]
        SITE["Websites"]
        SEARCH["AI Search"]
        EXPORT["PDF/Share"]
    end

    DRAFT -->|submit| REVIEW
    REVIEW -->|approve| SCHEDULED
    REVIEW -->|approve| PUBLISHED
    SCHEDULED -->|cron| PUBLISHED
    PUBLISHED --> SITE
    PUBLISHED --> SEARCH
    PUBLISHED --> EXPORT

    REVIEW -->|reject| DRAFT
```

## API Endpoints

### Content Delivery API

```
GET  /api/v1/content/:collection           # List content
GET  /api/v1/content/:collection/:slug     # Get document
GET  /api/v1/fragments/:id                 # Get fragment
GET  /api/v1/search?q=...                  # Search content
```

### Webhook Events

```
document.created     # New document
document.updated     # Content changed
document.published   # Published to R2
document.unpublished # Removed from R2
fragment.updated     # Fragment changed
```

## Deployment

```mermaid
flowchart LR
    DEV["Local Dev<br/>vite dev"] --> PREVIEW["Preview<br/>PR deploys"]
    PREVIEW --> PROD["Production<br/>hanawa.esolia.co.jp"]

    GH["GitHub Push"] --> CF["Cloudflare Pages"]
    CF --> PREVIEW
    CF --> PROD
```

**URLs:**
| Environment | URL |
|-------------|-----|
| Production | hanawa.esolia.co.jp |
| Preview | {branch}.hanawa-cms.pages.dev |

## Planned Components

| Component | Purpose | Status |
|-----------|---------|--------|
| **Miko Widget** | Embeddable AI search | 🔮 Design complete |
| **codex-sync** | Git → R2 synchronization | 🔮 Planned |
| **Real-time Collab** | Durable Objects + Yjs | ⏳ Specification ready |

---

*Document version: 1.0*
*Last updated: 2025-12-29*

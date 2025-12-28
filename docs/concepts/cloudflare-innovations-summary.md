# Cloudflare Platform Overview & 2025 Innovations

A comprehensive summary of Cloudflare's developer platform capabilities, including major 2025 announcements from Developer Week, AI Week, Security Week, and Birthday Week.

---

## Table of Contents

1. [Compute](#compute)
2. [Storage & Data](#storage--data)
3. [AI & Machine Learning](#ai--machine-learning)
4. [Real-Time & Media](#real-time--media)
5. [Security & Zero Trust](#security--zero-trust)
6. [Developer Experience](#developer-experience)
7. [Networking](#networking)
8. [Pricing Overview](#pricing-overview)

---

## Compute

### Workers

Cloudflare's serverless JavaScript/TypeScript runtime, running on their global edge network.

| Feature | Description |
|---------|-------------|
| **V8 Isolates** | Lightweight isolation (not containers), fast cold starts |
| **Global deployment** | Runs in 300+ locations worldwide |
| **Node.js compatibility** | Expanding support including `node:fs`, `node:https` |
| **Smart Placement** | Automatically places Workers closer to data sources |

**2025 Updates:**
- 10x reduction in cold starts via optimistic routing
- Full-stack support (frontend + backend in single Worker)
- Framework support: React Router, Astro, Hono, Vue, Nuxt, Svelte
- Deeper Vite integration
- OpenNext adapter for Next.js

### Cloudflare Containers (Open Beta June 2025)

Run Docker containers alongside Workers—for workloads that need full Linux, multiple cores, or large memory.

```javascript
// Orchestrate containers from Workers
const container = await env.CONTAINER.start({
  image: "your-image:latest",
});
```

| Feature | Description |
|---------|-------------|
| **Full Linux support** | Any language, any runtime |
| **Scaling** | Up to 1000 dev instances or 400 basic instances concurrently |
| **Resources** | Up to 400 GiB memory, 100 vCPUs, 2 TB disk |
| **Integration** | Native bindings with Workers, Durable Objects, Queues |

**Use cases:** FFmpeg processing, ML inference, code sandboxes, legacy app migration.

### Durable Objects

Strongly consistent, single-threaded compute with persistent storage—ideal for coordination and real-time state.

| Feature | Description |
|---------|-------------|
| **Single-threaded** | No race conditions by design |
| **WebSocket support** | Built-in hibernation for cost efficiency |
| **SQLite storage** | Embedded database per object |
| **Global uniqueness** | Each object ID maps to exactly one instance |

**Use cases:** Real-time collaboration, game state, rate limiting, leader election.

### Workflows (GA 2025)

Durable, long-running multi-step execution with automatic retries and state persistence.

```javascript
export class MyWorkflow extends Workflow {
  async run(event, step) {
    const data = await step.do("fetch-data", async () => {
      return fetchExternalAPI();
    });
    
    await step.sleep("wait", "1 hour");
    
    await step.do("process", async () => {
      return processData(data);
    });
  }
}
```

**Use cases:** Onboarding flows, data pipelines, scheduled jobs, saga patterns.

---

## Storage & Data

### R2 (Object Storage)

S3-compatible object storage with **zero egress fees**.

| Feature | Description |
|---------|-------------|
| **S3 API compatible** | Drop-in replacement for many S3 use cases |
| **Zero egress** | No charges for data transfer out |
| **Free tier** | 10 GB storage, 10M Class A ops, 1M Class B ops/month |

**2025 Updates:**
- **R2 Data Catalog** — Managed Apache Iceberg catalog for analytics
- Integration with Spark, Snowflake, PyIceberg
- Super Slurper upgrade for faster migrations

### D1 (SQLite Database)

Serverless SQLite database with automatic replication.

| Feature | Description |
|---------|-------------|
| **SQLite compatible** | Familiar SQL, portable queries |
| **Read replication** | Automatic global read replicas |
| **Free tier** | 5 GB storage, 5M rows read, 100K rows written/day |

**2025 Updates:**
- Read replication GA
- Outerbase acquisition for improved database tooling

### KV (Key-Value Store)

Eventually consistent, globally distributed key-value storage.

| Feature | Description |
|---------|-------------|
| **Global** | Cached at edge locations worldwide |
| **Simple API** | `get`, `put`, `delete`, `list` |
| **Free tier** | 1 GB storage, 100K reads, 1K writes/day |

### Vectorize

Vector database for AI embeddings and semantic search.

| Feature | Description |
|---------|-------------|
| **Purpose-built** | Optimized for embedding vectors |
| **Integration** | Native binding with Workers AI |
| **Free tier** | 5M vector dimensions, 30M queried dimensions/month |

### Queues

Message queues for asynchronous processing.

| Feature | Description |
|---------|-------------|
| **Guaranteed delivery** | At-least-once semantics |
| **Batching** | Process multiple messages together |
| **Dead letter queues** | Handle failed messages |

### Hyperdrive

Connection pooler and caching layer for external PostgreSQL databases.

| Feature | Description |
|---------|-------------|
| **Connection pooling** | Reduce connection overhead |
| **Query caching** | Cache frequent queries at edge |
| **Regional hints** | Place pooler near your database |

---

## AI & Machine Learning

### Workers AI

Run AI models on Cloudflare's GPU infrastructure.

| Feature | Description |
|---------|-------------|
| **Model catalog** | LLMs, embeddings, image generation, speech |
| **Serverless** | Pay per inference, no GPU management |
| **Free tier** | 10,000 Neurons/day |

**2025 Updates:**
- Speculative decoding (2-4x faster inference)
- Prefix caching
- Batch API for large workloads
- New partner models: Leonardo.Ai, Deepgram
- LoRA fine-tuning support
- OpenAI-compatible API endpoints

**Pricing:** $0.011 per 1,000 Neurons (after free tier)

### AI Search (formerly AutoRAG)

Managed Retrieval-Augmented Generation (RAG) infrastructure.

```javascript
// Retrieval only (cheap)
const results = await env.AI.autorag("my-index").search({
  query: "What is SPF?",
});

// Retrieval + generation (more expensive)
const answer = await env.AI.autorag("my-index").aiSearch({
  query: "Explain SPF in simple terms",
});
```

| Feature | Description |
|---------|-------------|
| **Automatic indexing** | Point at R2 bucket, auto-indexes |
| **Multi-tenancy** | Folder-based filtering for tenant isolation |
| **External models** | Use OpenAI/Anthropic via AI Gateway |
| **NLWeb support** | Microsoft's conversational search protocol |

**2025 Updates:**
- Renamed from AutoRAG to AI Search
- External model provider support (OpenAI, Anthropic)
- Metadata filtering for multi-tenancy
- Similarity caching

### AI Gateway

Observe, control, and optimize AI API calls.

| Feature | Description |
|---------|-------------|
| **Unified interface** | Single API for multiple providers |
| **Caching** | Cache responses to reduce costs |
| **Rate limiting** | Control spend and usage |
| **Logging** | Full request/response logging |

**2025 Updates:**
- Provider key management (BYO keys)
- Integration with AI Search

### Agents SDK & MCP Support

Build AI agents with the Model Context Protocol.

**2025 Updates:**
- MCP client support in Agents SDK
- Authentication/authorization for MCP servers
- Hibernation support for MCP
- Durable Objects free tier for agent state
- **MCP Server Portals** (Open Beta) — Centralize, secure, and observe MCP connections

**13 Official MCP Servers:**
- Workers Logs
- Container execution
- Browser Rendering
- AutoRAG/AI Search
- Audit Logs
- DNS Analytics
- And more...

---

## Real-Time & Media

### Browser Rendering (Puppeteer/Playwright)

Headless browser automation on Cloudflare's infrastructure.

```javascript
// Using Puppeteer
import puppeteer from "@cloudflare/puppeteer";

const browser = await puppeteer.launch(env.BROWSER);
const page = await browser.newPage();
await page.goto("https://example.com");
const pdf = await page.pdf({ format: "A4" });
```

| Endpoint | Description |
|----------|-------------|
| `/screenshot` | Capture webpage screenshots |
| `/pdf` | Generate PDFs from HTML/URLs |
| `/content` | Fetch rendered HTML |
| `/scrape` | Extract specific elements |
| `/json` | AI-powered structured data extraction |
| `/markdown` | Convert pages to Markdown |
| `/links` | Extract all links |
| `/snapshot` | HTML + screenshot in one call |

**Use cases:** PDF generation, screenshots, web scraping, testing, social previews.

### Cloudflare Realtime (RealtimeKit)

Real-time audio/video infrastructure (from Dyte acquisition).

| Feature | Description |
|---------|-------------|
| **WebRTC abstraction** | SFU, STUN/TURN included |
| **SDKs** | iOS, Android, Web, React Native |
| **Server-side features** | Transcription, recording |

**Use cases:** Video calls, live streaming, AI-powered voice apps.

### Stream

Video hosting, encoding, and delivery.

| Feature | Description |
|---------|-------------|
| **Adaptive streaming** | HLS/DASH delivery |
| **Storage included** | Upload and store videos |
| **Live streaming** | RTMPS ingest |

### Images

Image optimization, transformation, and delivery.

| Feature | Description |
|---------|-------------|
| **On-the-fly transforms** | Resize, crop, format conversion |
| **Polish** | Automatic optimization |
| **WebP/AVIF** | Modern format delivery |

---

## Security & Zero Trust

### Cloudflare One (Zero Trust Platform)

Complete SASE (Secure Access Service Edge) platform.

| Component | Description |
|-----------|-------------|
| **Access** | Identity-aware application access |
| **Gateway** | Secure web gateway, DNS filtering |
| **Tunnel** | Secure connections to internal resources |
| **WARP** | Device client for Zero Trust |
| **Browser Isolation** | Remote browser for risky content |

### AI Security (2025)

**AI Security Posture Management (AI-SPM):**
- Shadow AI Report — Discover employee AI usage
- Policy enforcement at edge via Gateway
- Confidence scores for GenAI applications

**Firewall for AI:**
- Unsafe content moderation (built with Llama)
- Detect/block harmful prompts before reaching AI apps

### AI Crawl Control (formerly AI Audit)

Control how AI crawlers access your content.

| Feature | Description |
|---------|-------------|
| **402 responses** | "Payment Required" with custom messages |
| **Content Signals Policy** | Express data usage preferences |
| **robots.txt management** | Easy updates for AI crawler rules |

### Web Bot Auth

Verify and segment AI agents from verified bots.

### WAF & DDoS Protection

| Feature | Description |
|---------|-------------|
| **Managed rules** | OWASP, Cloudflare managed rulesets |
| **Custom rules** | Build your own WAF rules |
| **Rate limiting** | Protect against abuse |
| **DDoS mitigation** | Automatic L3/L4/L7 protection |

**2025 Updates:**
- Request payload inspection up to 1 MB (all plans)
- Enhanced React RCE detection (CVE-2025-55182)
- Per-customer anomaly detection models for bot management

---

## Developer Experience

### Wrangler CLI

Command-line tool for developing and deploying Workers.

```bash
wrangler dev          # Local development
wrangler deploy       # Deploy to production
wrangler d1 execute   # Run D1 queries
wrangler r2 object    # Manage R2 objects
```

### Workers Builds (GA 2025)

CI/CD for Workers, built into Cloudflare.

### Secrets Store (Public Beta 2025)

Centralized secrets management for Workers.

| Feature | Description |
|---------|-------------|
| **Encrypted storage** | Dual-layer key hierarchy |
| **RBAC** | Role-based access controls |
| **Audit logs** | Track secret usage |
| **Native bindings** | Direct integration with Workers |

### Pages

Static site hosting with Git integration.

| Feature | Description |
|---------|-------------|
| **Git integration** | Auto-deploy from GitHub/GitLab |
| **Preview deployments** | Per-branch previews |
| **Functions** | Server-side logic via Workers |
| **Free tier** | Generous—500 builds/month, unlimited sites |

### Terraform Provider v5

Infrastructure as code for Cloudflare resources.

**2025 Updates:**
- Major v5 release with improved stability
- Resource-by-resource stabilization approach
- 2-3 week improvement cadence

---

## Networking

### Workers VPC (Open Beta 2025)

Connect Workers to private resources in external clouds (AWS, GCP, Azure).

```
┌─────────────────┐         ┌─────────────────┐
│   Your Worker   │ ──────▶ │   Workers VPC   │
│  (Cloudflare)   │         │                 │
└─────────────────┘         └────────┬────────┘
                                     │
                            Private connection
                                     │
                                     ▼
                            ┌─────────────────┐
                            │   Your AWS VPC  │
                            │  (Database,API) │
                            └─────────────────┘
```

**Use cases:** Access private databases, internal APIs, hybrid cloud architectures.

### Workers VPC Private Link

Direct, private routing from external VPCs to Cloudflare resources.

### Pipelines (from Arroyo acquisition)

Real-time stream ingestion to R2.

| Feature | Description |
|---------|-------------|
| **Streaming engine** | Distributed, Arroyo-based |
| **R2 destination** | Direct ingestion to object storage |

---

## Emerging & Experimental

### NET Dollar (Announced 2025)

US dollar-backed stablecoin for the "agentic web"—enabling AI agents to transact.

### Replicate Acquisition (2025)

Replicate's AI model hosting tools being integrated into Workers platform.

---

## Pricing Overview

### Free Tiers

| Service | Free Allocation |
|---------|-----------------|
| **Workers** | 100K requests/day |
| **Workers AI** | 10K Neurons/day |
| **R2** | 10 GB storage |
| **D1** | 5 GB storage, 5M reads/day |
| **KV** | 1 GB storage |
| **Vectorize** | 5M vector dimensions |
| **Pages** | Unlimited sites, 500 builds/month |
| **AI Search** | Free to enable (beta) |

### Workers Paid Plan ($5/month)

Unlocks:
- Higher limits on all services
- Pay-as-you-go for overages
- Durable Objects
- Queues
- Analytics Engine

### Containers Pricing (Preview)

| Resource | Included | Overage |
|----------|----------|---------|
| Memory | 25 GiB-hours/month | $0.0000025/GiB-second |
| CPU | 375 vCPU-minutes/month | $0.000020/vCPU-second |
| Egress | 1 TB/month | TBD |

---

## Key 2025 Themes

1. **Full-stack on Workers** — Frontend + backend + containers in unified platform
2. **AI-native infrastructure** — AI Search, MCP, Agents SDK, AI security
3. **Enterprise connectivity** — Workers VPC, Private Link, hybrid cloud
4. **Developer experience** — Secrets Store, Workflows GA, improved cold starts
5. **Real-time capabilities** — RealtimeKit, Pipelines, Browser Rendering
6. **Agentic web** — MCP support, NET Dollar, authenticated AI agents

---

## Quick Reference: When to Use What

| Need | Service |
|------|---------|
| Serverless compute | Workers |
| Heavy compute, full Linux | Containers |
| Coordination, real-time state | Durable Objects |
| Multi-step workflows | Workflows |
| Object storage | R2 |
| SQL database | D1 |
| Key-value cache | KV |
| Vector search | Vectorize |
| AI inference | Workers AI |
| RAG/semantic search | AI Search |
| PDF generation | Browser Rendering |
| Screenshots | Browser Rendering |
| Video hosting | Stream |
| Image optimization | Images |
| External database access | Hyperdrive |
| Private cloud connectivity | Workers VPC |
| Message queues | Queues |
| Secrets management | Secrets Store |

---

## Resources

- [Cloudflare Docs](https://developers.cloudflare.com/)
- [Developer Week 2025 Recap](https://blog.cloudflare.com/)
- [AI Week 2025 Updates](https://www.cloudflare.com/innovation-week/ai-week-2025/updates/)
- [Birthday Week 2025](https://www.cloudflare.com/innovation-week/birthday-week-2025/updates/)
- [Workers AI Pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)
- [AI Search Docs](https://developers.cloudflare.com/ai-search/)

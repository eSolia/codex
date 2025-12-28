# Hanawa CMS Feature Roadmap

Implementation specifications for Hanawa CMS enterprise features. These documents provide detailed technical guidance for building out Hanawa's core capabilities.

## Overview

Hanawa needs to evolve from a rich-text editor into a full-featured headless CMS. This roadmap prioritizes features based on compliance requirements and competitive positioning.

```
┌─────────────────────────────────────────────────────────────────┐
│  HANAWA EVOLUTION                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  TODAY                         TOMORROW                        │
│  ─────                         ────────                        │
│  Tiptap editor                 Full CMS platform               │
│  Custom extensions             + Real-time collaboration       │
│  Manual saves                  + Audit trails                  │
│  Single user                   + Approval workflows            │
│                                + Version control               │
│                                + Scheduled publishing          │
│                                + Localization (EN/JA)          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
Core infrastructure that everything else depends on.

| Feature | Document | Effort | Dependencies |
|---------|----------|--------|--------------|
| Audit Logging | [01-audit-system.md](./01-audit-system.md) | 3-4 days | None |
| Version History | [02-version-control.md](./02-version-control.md) | 3-4 days | Audit system |

### Phase 2: Collaboration (Weeks 3-4)
Multi-user editing and communication.

| Feature | Document | Effort | Dependencies |
|---------|----------|--------|--------------|
| Real-time Presence | [03-realtime-collaboration.md](./03-realtime-collaboration.md) | 4-5 days | Durable Objects |
| Comments & Threads | [04-comments-system.md](./04-comments-system.md) | 3-4 days | Audit system |

### Phase 3: Workflow (Weeks 5-6)
Content governance and publishing controls.

| Feature | Document | Effort | Dependencies |
|---------|----------|--------|--------------|
| Workflow Engine | [05-workflow-engine.md](./05-workflow-engine.md) | 4-5 days | Audit, Versions |
| Scheduled Publishing | [06-scheduled-publishing.md](./06-scheduled-publishing.md) | 2-3 days | Workflow engine |

### Phase 4: Localization (Weeks 7-8)
Bilingual content management.

| Feature | Document | Effort | Dependencies |
|---------|----------|--------|--------------|
| Field-level i18n | [07-localization.md](./07-localization.md) | 4-5 days | Schema updates |

### Phase 5: Intelligence (Weeks 9-10)
AI-powered features and Codex integration.

| Feature | Document | Effort | Dependencies |
|---------|----------|--------|--------------|
| AI Writing Assistant | [08-ai-assistant.md](./08-ai-assistant.md) | 3-4 days | Claude API |
| Codex Sync | [09-codex-integration.md](./09-codex-integration.md) | 4-5 days | Vectorize |

### Phase 6: Polish (Weeks 11-14)
Features that elevate user experience and developer integration.

| Feature | Document | Effort | Dependencies |
|---------|----------|--------|--------------|
| Media Library | [10-media-library.md](./10-media-library.md) | 4-5 days | R2, CF Images |
| Webhooks & Integrations | [11-webhooks-integrations.md](./11-webhooks-integrations.md) | 2-3 days | Queues |
| Editor Productivity | [12-editor-productivity.md](./12-editor-productivity.md) | 2-3 days | None |
| Content Intelligence | [13-content-intelligence.md](./13-content-intelligence.md) | 3-4 days | Workers AI |
| Preview Deployments | [14-preview-deployments.md](./14-preview-deployments.md) | 2-3 days | Pages |
| Delivery API | [15-delivery-api.md](./15-delivery-api.md) | 3-4 days | KV Cache |

---

## Technology Decisions

### Real-time Infrastructure

For collaboration features, we need a real-time layer. Options considered:

| Option | Pros | Cons | Verdict |
|--------|------|------|---------|
| **Cloudflare Durable Objects** | Native to platform, WebSocket support, consistent state | Learning curve, DO-specific patterns | ✅ **Selected** |
| PartyKit | Great DX, Cloudflare-hosted | Additional service, cost | Considered for future |
| Liveblocks | Feature-rich, easy integration | External dependency, recurring cost | Too heavy |
| Supabase Realtime | PostgreSQL sync, auth integration | Different stack, latency | Wrong platform |

**Decision:** Durable Objects for presence and collaboration state. Each document gets a DO instance that coordinates connected editors.

### Conflict Resolution

For concurrent editing:

| Approach | Description | Best For |
|----------|-------------|----------|
| **Last-write-wins** | Simple timestamp comparison | Field-level edits |
| **Operational Transform (OT)** | Transform operations for consistency | Real-time character-by-character |
| **CRDT** | Conflict-free data types | Offline-first, complex merging |

**Decision:** Tiptap already uses ProseMirror's OT-like collaboration protocol via `@tiptap/extension-collaboration`. We'll leverage that with a Durable Object as the authority.

### Database Schema Evolution

All new features extend the existing D1 schema. Key additions:

```sql
-- Core tables (new)
audit_log           -- All actions logged
document_versions   -- Full snapshots
workflow_stages     -- Stage definitions
workflow_state      -- Current state per document
comments            -- Inline and document comments
scheduled_jobs      -- Publish queue

-- Extended columns (existing tables)
documents.locale              -- Language code
documents.localized_fields    -- JSON of field→content per locale
documents.workflow_stage_id   -- Current workflow position
```

---

## Competitive Positioning

```
┌─────────────────────────────────────────────────────────────────┐
│  HANAWA vs. MARKET LEADERS                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  UNIQUE TO HANAWA (Differentiators)                            │
│  ├── Built for compliance documentation                        │
│  ├── Privacy masking for PII/financial data                   │
│  ├── Evidence linking with R2 document storage                 │
│  ├── Status badges for control tracking                        │
│  ├── Shareable preview with watermarking                       │
│  ├── Direct pipeline to Codex/Miko knowledge base             │
│  └── Bilingual-first (EN/JA) architecture                     │
│                                                                 │
│  MATCH THE MARKET (Core features)                              │
│  ├── Real-time collaboration (à la Sanity)                    │
│  ├── Comprehensive audit trails (à la Contentstack)           │
│  ├── Multi-step workflows (à la dotCMS)                       │
│  ├── Version control with diff (à la Kontent.ai)              │
│  └── Scheduled publishing (à la Storyblok)                    │
│                                                                 │
│  POLISH FEATURES (Knockout details)                            │
│  ├── Media library with focal points (à la Cloudinary)        │
│  ├── Command palette & keyboard shortcuts (à la Linear)       │
│  ├── SEO & readability scoring (à la Yoast)                   │
│  ├── Webhooks & Slack integration (à la Contentful)           │
│  ├── Preview deployments (à la Vercel)                        │
│  └── REST + GraphQL API with SDK (à la Prismic)               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Document Index

Each specification follows a consistent structure:

1. **Overview** — What and why
2. **Data Model** — D1 schema additions
3. **API Design** — Endpoints and contracts
4. **UI Components** — Svelte component specifications
5. **Implementation Notes** — Cloudflare-specific considerations
6. **Testing Strategy** — How to verify correctness
7. **Migration Path** — Upgrading existing content

### Specification Documents

| # | Document | Status | Category |
|---|----------|--------|----------|
| 01 | [Audit System](./01-audit-system.md) | ✅ Implemented | Foundation |
| 02 | [Version Control](./02-version-control.md) | ✅ Implemented | Foundation |
| 03 | [Real-time Collaboration](./03-realtime-collaboration.md) | ⏳ Planned | Collaboration |
| 04 | [Comments System](./04-comments-system.md) | ✅ Implemented | Collaboration |
| 05 | [Workflow Engine](./05-workflow-engine.md) | ✅ Implemented | Workflow |
| 06 | [Scheduled Publishing](./06-scheduled-publishing.md) | ✅ Implemented | Workflow |
| 07 | [Localization](./07-localization.md) | ✅ Implemented | Localization |
| 08 | [AI Assistant](./08-ai-assistant.md) | ✅ Implemented | Intelligence |
| 09 | [Codex Integration](./09-codex-integration.md) | ✅ Implemented | Intelligence |
| 10 | [Media Library](./10-media-library.md) | ✅ Implemented | Polish |
| 11 | [Webhooks & Integrations](./11-webhooks-integrations.md) | ✅ Implemented | Polish |
| 12 | [Editor Productivity](./12-editor-productivity.md) | ✅ Implemented | Polish |
| 13 | [Content Intelligence](./13-content-intelligence.md) | ✅ Implemented | Polish |
| 14 | [Preview Deployments](./14-preview-deployments.md) | ✅ Implemented | Polish |
| 15 | [Delivery API](./15-delivery-api.md) | ✅ Implemented | Polish |
| 16 | [Block Editor](./16-block-editor.md) | ✅ Implemented | Core |

---

## Usage with Claude Code

These specifications are designed to be shared with Claude Code for implementation. Recommended workflow:

```bash
# Share a spec for implementation
claude "Read /docs/hanawa-specs/01-audit-system.md and implement the audit logging system"

# Implement a specific component
claude "Based on 03-realtime-collaboration.md, create the PresenceIndicator component"

# Generate migrations
claude "Create D1 migrations for the schema in 05-workflow-engine.md"
```

Each document is self-contained with enough context for focused implementation.

---

*Document version: 1.2*
*Last updated: December 2025*

### Recent Updates
- **Dec 2025**: Implemented Webhooks & Integrations (spec 11) with HMAC signing, retry logic, and delivery tracking
- **Dec 2025**: Implemented Delivery API (spec 15) with API keys, rate limiting, and content caching

### Implementation Progress Legend
- ✅ Implemented — Feature is complete and in production
- 🔶 Partial — Some components implemented, others planned
- ⏳ Planned — Specification ready, awaiting implementation

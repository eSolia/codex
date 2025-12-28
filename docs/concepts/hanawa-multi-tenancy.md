# Hanawa Multi-Tenancy Architecture

How to enable external clients to use Hanawa CMS for their websites while maintaining complete data isolation.

## Context

eSolia uses a consistent resource naming convention across all applications:

```
esolia-{app}-{client-slug}-{hash}
```

Examples:
- `esolia-periodic-jac-3119` - JAC's Periodic instance
- `esolia-pulse-esolia-7q6g` - eSolia's Pulse instance

The question: How should Hanawa support multiple clients editing their own website content?

---

## Multi-Tenancy Options

### Option A: Single Instance, Per-Tenant Resources

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  hanawa.esolia.co.jp                                                         │
│       │                                                                      │
│       ├── /tenant/esolia  →  esolia-hanawa-esolia-7q6g (D1 + R2)           │
│       ├── /tenant/jac     →  esolia-hanawa-jac-3119 (D1 + R2)              │
│       └── /tenant/acme    →  esolia-hanawa-acme-xxxx (D1 + R2)             │
│                                                                              │
│  Pros: Single deployment, shared updates, central management                │
│  Cons: Complex routing, risk of tenant leakage bugs, shared compute         │
└─────────────────────────────────────────────────────────────────────────────┘
```

**How it works:**
- Single Hanawa deployment handles all tenants
- Tenant determined by URL path, subdomain, or CF Access email domain
- Dynamic D1/R2 binding based on tenant context
- Requires tenant-aware middleware in every request

**Challenges:**
- Complex multi-tenant middleware required
- Schema needs `tenant_id` on every table
- Risk of cross-tenant data leakage if bugs exist
- Harder to reason about security

---

### Option B: Separate Instances Per Client (Recommended)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  hanawa.esolia.co.jp      →  esolia-hanawa-esolia-7q6g (eSolia internal)   │
│  cms.jac-web.jp           →  esolia-hanawa-jac-3119 (JAC's CMS)            │
│  cms.acme.co.jp           →  esolia-hanawa-acme-xxxx (Acme's CMS)          │
│                                                                              │
│  Each is a separate CF Pages project, same codebase, different bindings     │
│                                                                              │
│  Pros: Complete isolation, client-branded URLs, independent scaling         │
│  Cons: Multiple deployments to update, more infrastructure to manage        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**How it works:**
- Same Hanawa codebase deployed multiple times
- Each deployment has its own `wrangler.{client}.toml`
- Each deployment bound to client-specific D1 + R2
- CF Access configured per-deployment for client's users

**Advantages:**
- Complete data isolation by design (different databases)
- Client-branded URLs possible
- Independent scaling and performance
- Easy to answer "can client A see client B's data?" (No, different DB)
- Simpler auth model (CF Access per instance)

---

### Option C: Hybrid - Internal vs. Client CMS

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  INTERNAL (eSolia use only)                                                  │
│  hanawa.esolia.co.jp  →  Codex, Help, Proposals, Fragments                  │
│                          esolia-hanawa-internal-xxxx                         │
│                                                                              │
│  CLIENT CMS (per-client instances)                                           │
│  cms.client.co.jp     →  Client website content only                        │
│                          esolia-hanawa-{client}-{hash}                       │
└─────────────────────────────────────────────────────────────────────────────┘
```

**How it works:**
- eSolia's internal Hanawa remains separate (Codex, proposals, fragments)
- Client instances are lightweight (just pages/content editing)
- Clients only see what they need

---

## Recommendation: Option B (Separate Instances)

For a CMS handling sensitive content, separate instances provide:

| Concern | Multi-Tenant Risk | Separate Instance |
|---------|-------------------|-------------------|
| **Data isolation** | One bug could leak data | Impossible by design |
| **Auth complexity** | Tenant-aware access control | CF Access per instance |
| **Performance** | Shared D1 contention | Independent resources |
| **Customization** | Hard to customize per-client | Easy per-deployment |
| **Billing** | Complex allocation | Clear per-client usage |
| **Compliance** | Hard to prove isolation | Different databases |

---

## Implementation Plan

### Phase 1: Keep Current Hanawa for eSolia Internal

No changes needed:
- `hanawa.esolia.co.jp` stays internal-only
- Codex, Help, Proposals continue here
- Current D1/R2 bindings remain

### Phase 2: Create Client CMS Template

```
codex/packages/hanawa-cms/
├── wrangler.toml              # eSolia internal (current)
├── wrangler.client.template   # Template for new clients
└── scripts/
    └── create-client-instance.sh
```

**Template wrangler config:**
```toml
# wrangler.{client}.toml
name = "hanawa-{client}"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]

[[d1_databases]]
binding = "DB"
database_name = "esolia-hanawa-{client}-{hash}"
database_id = "{to-be-filled}"

[[r2_buckets]]
binding = "MEDIA"
bucket_name = "esolia-hanawa-{client}-{hash}"
```

**Provisioning script:**
```bash
#!/bin/bash
# scripts/create-client-instance.sh

CLIENT=$1
HASH=$2

# Create D1 database
wrangler d1 create esolia-hanawa-$CLIENT-$HASH

# Create R2 bucket
wrangler r2 bucket create esolia-hanawa-$CLIENT-$HASH

# Generate wrangler config
sed "s/{client}/$CLIENT/g; s/{hash}/$HASH/g" \
  wrangler.client.template > wrangler.$CLIENT.toml

echo "Created resources for $CLIENT"
echo "Next: Fill in database_id in wrangler.$CLIENT.toml"
```

### Phase 3: Simplified Client Schema

Client CMS needs fewer features than internal Hanawa:

```sql
-- Client-focused schema (simpler than internal)
CREATE TABLE pages (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  title_ja TEXT,
  content TEXT,
  content_ja TEXT,
  status TEXT DEFAULT 'draft',
  published_at INTEGER,
  updated_at INTEGER,
  updated_by TEXT
);

CREATE TABLE media (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER,
  r2_key TEXT NOT NULL,
  alt TEXT,
  alt_ja TEXT,
  uploaded_at INTEGER,
  uploaded_by TEXT
);

-- Audit log (simplified)
CREATE TABLE audit_log (
  id TEXT PRIMARY KEY,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  actor_email TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
```

**Not needed for clients:**
- Fragments (internal reusable content)
- Proposals (internal sales documents)
- Workflow stages (too complex for simple edits)
- AI features (cost allocation unclear)

### Phase 4: Delivery API for Websites

The client's SvelteKit website fetches content via API:

```typescript
// In client's website codebase
import { createHanawaClient } from '@hanawa/client';

const cms = createHanawaClient({
  baseUrl: 'https://cms.client.co.jp',
  apiKey: process.env.HANAWA_API_KEY,
});

// Fetch page
const aboutPage = await cms.pages.get('about-us', { locale: 'ja' });

// Fetch all news
const news = await cms.pages.list({
  type: 'news',
  status: 'published',
  sort: 'publishedAt:desc',
});
```

### Phase 5: Deploy First Client

```bash
# Example: JAC deployment

# 1. Create resources
./scripts/create-client-instance.sh jac 3119

# 2. Run migrations
wrangler d1 execute esolia-hanawa-jac-3119 \
  --file=migrations/client-schema.sql

# 3. Build and deploy
npm run build
wrangler pages deploy .svelte-kit/cloudflare \
  --project-name=hanawa-jac \
  --config=wrangler.jac.toml

# 4. Configure CF Access
# - Create Access application for cms.jac-web.jp
# - Add JAC team emails to allowed list

# 5. Set up custom domain
# - Add CNAME: cms.jac-web.jp → hanawa-jac.pages.dev
```

---

## Client Onboarding Checklist

When adding a new client:

- [ ] Get client slug and hash from Nexus (or generate)
- [ ] Add to `esolia-resource-naming.md`
- [ ] Create D1 database: `esolia-hanawa-{client}-{hash}`
- [ ] Create R2 bucket: `esolia-hanawa-{client}-{hash}`
- [ ] Generate `wrangler.{client}.toml`
- [ ] Run client schema migrations
- [ ] Deploy to CF Pages
- [ ] Configure CF Access application
- [ ] Set up custom domain (optional)
- [ ] Create API key for client website
- [ ] Document in client's Nexus profile

---

## Risks of Using Current Instance for Clients

If we tried to make `hanawa.esolia.co.jp` multi-tenant:

1. **Current D1 contains eSolia internal data**
   - Fragments, proposals, Codex content
   - Would need complex migration

2. **No tenant isolation in schema**
   - Tables don't have `tenant_id` columns
   - Queries don't filter by tenant

3. **CF Access configured for eSolia**
   - Would need complex access rules
   - Risk of misconfiguration

4. **Codex integration assumes single tenant**
   - R2 paths, Vectorize index
   - Would need per-tenant separation

5. **Feature parity concerns**
   - Clients don't need all features
   - Simpler CMS is actually better for them

---

## Cost Considerations

### Per-Client Resources

| Resource | Free Tier | Paid Estimate |
|----------|-----------|---------------|
| D1 Database | 5GB storage, 5M reads/day | $0.75/GB/month |
| R2 Bucket | 10GB storage | $0.015/GB/month |
| Pages | Unlimited | Free |
| CF Access | 50 users | $3/user/month |

For a typical client with light CMS usage, expect ~$5-10/month in Cloudflare costs.

### Update Overhead

With N client instances:
- Each deployment is independent
- Updates require deploying to each
- Consider GitHub Actions matrix for automated rollouts

```yaml
# .github/workflows/deploy-all.yml
jobs:
  deploy:
    strategy:
      matrix:
        client: [esolia, jac, acme]
    steps:
      - run: npm run build
      - run: wrangler pages deploy ... --config=wrangler.${{ matrix.client }}.toml
```

---

## Future Considerations

### Centralized Client Management

If client count grows, consider a management layer:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Nexus (Central Platform)                                                    │
│       │                                                                      │
│       ├── Organization management                                            │
│       ├── Resource provisioning (D1, R2, Pages)                             │
│       ├── User access management                                             │
│       └── Billing/usage tracking                                             │
│                                                                              │
│  hanawa-jac  ←──────────────────────────────────────────────────────────────│
│  hanawa-acme ←──────────────────────────────────────────────────────────────│
└─────────────────────────────────────────────────────────────────────────────┘
```

### White-Label Option

For clients wanting fully branded CMS:
- Custom domain (already supported)
- Custom logo/branding (add config)
- Custom color scheme (CSS variables)

---

## Summary

**Decision:** Use separate Hanawa instances per client (Option B)

**Rationale:**
- Complete data isolation by design
- Simpler security model
- Client-specific customization possible
- Clear resource allocation and billing
- Matches existing eSolia resource naming pattern

**Next Steps:**
1. Document this decision
2. Create client instance template
3. Define simplified client schema
4. Implement Delivery API (spec 15)
5. Pilot with first client

---

*Document version: 1.0*
*Created: December 2025*

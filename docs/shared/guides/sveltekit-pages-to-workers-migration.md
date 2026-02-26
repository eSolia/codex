# SvelteKit: Migrating from Cloudflare Pages to Workers

A practical guide for migrating SvelteKit applications from Cloudflare Pages to Cloudflare Workers with Static Assets.

---

## Why Migrate?

Cloudflare is consolidating Pages into Workers. All new development focuses on Workers, and Pages projects will eventually be auto-migrated. Moving now gives you:

- Access to Workers-only features (Durable Objects, Cron Triggers, Queues, Analytics Engine)
- Per-branch preview URLs with PR comments (now available in Workers)
- Centralized Secrets Store for shared credentials across Workers
- Smart Placement for automatic latency optimization
- Enhanced observability with Workers Logs and Query Builder
- A unified platform for all your Cloudflare services
- Future-proofing against the eventual Pages sunset

---

## Prerequisites

Before starting:

1. **Wrangler 4+** — Required for modern Workers deployment

   ```bash
   npm install --save-dev wrangler@^4.0.0
   npx wrangler --version  # Verify 4.x
   ```

2. **@sveltejs/adapter-cloudflare** — The unified adapter (not `adapter-cloudflare-workers`)

   ```bash
   npm install --save-dev @sveltejs/adapter-cloudflare
   ```

3. **Cloudflare DNS** — Workers custom domains require Cloudflare-managed nameservers (unlike Pages, which supported external DNS)

---

## Pre-Migration Checks

Run these checks while still on Pages to identify potential blockers.

### 1. Check Bundle Size

Workers have a 10MB compressed limit for the Worker script (your SSR code). Pages is more generous, so large bundles that work on Pages may fail on Workers.

```bash
# Build your project
npm run build

# Check the worker bundle size
ls -lh .svelte-kit/cloudflare/_worker.js

# For detailed analysis, use wrangler
npx wrangler deploy --dry-run --outdir ./worker-output
ls -lh ./worker-output
```

**If your bundle exceeds ~3-4MB uncompressed, investigate:**

```bash
# Analyze what's in the bundle
npx vite-bundle-visualizer

# Or use source-map-explorer if you have source maps
npx source-map-explorer .svelte-kit/cloudflare/_worker.js
```

**Common culprits and fixes:**

| Issue                                        | Fix                                                              |
| -------------------------------------------- | ---------------------------------------------------------------- |
| Large libraries (moment, lodash full)        | Use lighter alternatives (date-fns, lodash-es with tree-shaking) |
| Server-side only imports in shared code      | Move to `+page.server.ts` or use dynamic imports                 |
| Bundled dependencies that should be external | Check `vite.config.ts` externals                                 |
| Images/fonts in server bundle                | Move to `/static` folder (served as assets)                      |

**Move heavy imports to client-side:**

```typescript
// Before — included in server bundle
import { Chart } from 'chart.js';

// After — only loaded in browser
import { browser } from '$app/environment';

let Chart;
if (browser) {
  const module = await import('chart.js');
  Chart = module.Chart;
}
```

### 2. Check for Unsupported Node APIs

Workers have limited Node.js compatibility. Some APIs that work in Pages' Node environment may not work in Workers.

```bash
# Build and test locally with wrangler (simulates Workers runtime)
npm run build
npx wrangler dev .svelte-kit/cloudflare
```

**Watch for errors mentioning:**

- `fs` (use `$app/server`'s `read()` function instead)
- `path` operations on server paths
- Native Node modules (crypto operations should use Web Crypto API)
- `process.env` (use `$env/dynamic/private` instead)

### 3. Verify Custom Domain DNS

Workers requires Cloudflare-managed nameservers for custom domains.

```bash
# Check current nameservers
dig NS yourdomain.com +short
```

If the nameservers aren't Cloudflare's (`*.ns.cloudflare.com`), you'll need to either:

- Migrate DNS to Cloudflare before the Workers migration
- Use a subdomain on a Cloudflare-managed zone
- Keep the site on Pages (which supports external DNS)

### 4. Audit Environment Variables

List all env vars and secrets currently configured in Pages:

1. Dashboard → Workers & Pages → Your Pages Project → Settings → Environment Variables
2. Note which are "encrypted" (secrets) vs plain variables
3. Check if any use `$env/static/private` — these need to change to `$env/dynamic/private`

```typescript
// Search your codebase for static private imports
grep -r "from '\$env/static/private'" src/
```

---

## Migration Steps

### 1. Update the SvelteKit Adapter

In `svelte.config.js`, ensure you're using `adapter-cloudflare`:

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter({
      // Optional: specify config path if non-standard
      // config: 'wrangler.jsonc',
      // Optional: configure platform proxy for local dev
      // platformProxy: {
      //   configPath: 'wrangler.jsonc',
      //   persist: { path: '.wrangler/state/v3' }
      // }
    })
  }
};

export default config;
```

### 2. Update Wrangler Configuration

Convert your Pages configuration to Workers format.

**Before (Pages):**

```jsonc
{
  "name": "my-sveltekit-app",
  "pages_build_output_dir": ".svelte-kit/cloudflare",
  "compatibility_date": "2024-12-01",
  "compatibility_flags": ["nodejs_compat"],
  "d1_databases": [...],
  "kv_namespaces": [...]
}
```

**After (Workers):**

```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "my-sveltekit-app",

  // Point to the generated worker entry
  "main": ".svelte-kit/cloudflare/_worker.js",

  // Static assets configuration
  "assets": {
    "directory": ".svelte-kit/cloudflare",
    "binding": "ASSETS"
  },

  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],

  // Preview URLs (opt-in for security)
  "preview_urls": true,

  // Enable observability
  "observability": {
    "logs": {
      "enabled": true,
      "invocation_logs": true
    }
  },

  // Bindings remain the same
  "d1_databases": [...],
  "kv_namespaces": [...],
  "r2_buckets": [...]
}
```

**Key changes:**
| Pages Config | Workers Config |
|--------------|----------------|
| `pages_build_output_dir` | `main` + `assets.directory` |
| (implicit) | `assets.binding` (for SSR access) |
| (automatic) | `preview_urls: true` (explicit opt-in) |

### 3. Update Package Scripts

Replace Pages commands with Workers equivalents:

```json
{
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "deploy": "npm run build && wrangler deploy",
    "deploy:dry-run": "npm run build && wrangler deploy --dry-run"
  }
}
```

**Command mapping:**
| Before | After |
|--------|-------|
| `wrangler pages deploy .svelte-kit/cloudflare` | `wrangler deploy` |
| `wrangler pages dev .svelte-kit/cloudflare` | `wrangler dev` |

### 4. Handle Environment Variables

Workers handle environment variables slightly differently than Pages.

**Static imports (build-time):**

```typescript
// Works the same in both
import { PUBLIC_API_URL } from '$env/static/public';
```

**Dynamic imports (runtime):**

```typescript
// Preferred for secrets and runtime config
import { env } from '$env/dynamic/private';

export async function load({ platform }) {
  // Access via SvelteKit's env module
  const apiKey = env.API_KEY;

  // Or via platform.env for Cloudflare-specific bindings
  const db = platform?.env?.DB;
}
```

**Important:** If you were using `$env/static/private` for secrets, switch to `$env/dynamic/private`. Static imports are resolved at build time, and Workers secrets aren't available then.

### 5. Configure Custom Domain

In your `wrangler.jsonc`, add the routes configuration:

```jsonc
{
  "routes": [{ "pattern": "myapp.example.com", "custom_domain": true }]
}
```

Or configure via the Cloudflare dashboard under **Workers & Pages → Your Worker → Settings → Domains & Routes**.

### 6. Set Up Preview URLs

Workers now supports Pages-style preview deployments:

```jsonc
{
  "preview_urls": true
}
```

When connected to Git (GitHub/GitLab):

- Each PR gets a stable branch preview URL: `feature-branch-my-app.account.workers.dev`
- Preview links are posted as PR comments
- URLs stay stable across commits to the same branch

To protect previews with Cloudflare Access:

1. Dashboard → Workers & Pages → Your Worker → Settings → Domains & Routes
2. Under Preview URLs, click "Enable Cloudflare Access"

### 7. Migrate Secrets

Secrets don't automatically transfer. Re-add them via Wrangler:

```bash
# List what you need to migrate (check Pages dashboard or .dev.vars)
wrangler secret put DATABASE_URL
wrangler secret put API_KEY
wrangler secret put OAUTH_CLIENT_SECRET
```

Or use `.dev.vars` for local development (never commit this file):

```bash
# .dev.vars
DATABASE_URL=postgres://...
API_KEY=sk_test_...
```

### 8. Consider Centralized Secrets Store (Beta)

For secrets shared across multiple Workers (e.g., `MAILEROO_API_KEY` used by Nexus, Pulse, and Periodic), use the Cloudflare Secrets Store instead of per-Worker secrets.

**Benefits:**

- Single source of truth for shared credentials
- RBAC-controlled access (separate from Worker permissions)
- Audit logging for all secret access
- Update once, all Workers get the new value

**Create a store and secret:**

```bash
# Create the store (first time only)
wrangler secrets-store store create esolia-shared --remote

# Add a secret
wrangler secrets-store secret create \
  --store-id <STORE_ID> \
  --name maileroo-api-key \
  --scope workers
```

**Bind to your Worker:**

```jsonc
// wrangler.jsonc
{
  "secrets_store_secrets": [
    {
      "binding": "MAILEROO_API_KEY",
      "store_id": "<STORE_ID>",
      "secret_name": "maileroo-api-key"
    }
  ]
}
```

**Access in code:**

```typescript
// Same as regular secrets — no code changes needed
export async function load({ platform }) {
  const apiKey = platform?.env?.MAILEROO_API_KEY;
}
```

**Good candidates for centralized secrets:**

- Email service API keys (Maileroo, SendGrid)
- Shared OAuth client secrets
- Third-party API keys used across apps
- Encryption keys for cross-app data

**Keep as per-Worker secrets:**

- Worker-specific configuration
- Database connection strings (if different per app)
- Secrets only one Worker needs

---

## Workers-Only Features

Now that you're on Workers, you can use features that weren't available on Pages:

### Cron Triggers

```jsonc
// wrangler.jsonc
{
  "triggers": {
    "crons": [
      "0 * * * *", // Hourly
      "0 0 * * *" // Daily at midnight
    ]
  }
}
```

```typescript
// src/hooks.server.ts or a dedicated worker entry
export default {
  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    switch (event.cron) {
      case '0 * * * *':
        await runHourlyJob(env);
        break;
      case '0 0 * * *':
        await runDailyCleanup(env);
        break;
    }
  }
};
```

### Queues

```jsonc
{
  "queues": {
    "producers": [{ "binding": "MY_QUEUE", "queue": "my-queue" }],
    "consumers": [{ "queue": "my-queue", "max_batch_size": 10 }]
  }
}
```

### Durable Objects

```jsonc
{
  "durable_objects": {
    "bindings": [{ "name": "COUNTER", "class_name": "Counter" }]
  },
  "migrations": [{ "tag": "v1", "new_classes": ["Counter"] }]
}
```

### Analytics Engine

```jsonc
{
  "analytics_engine_datasets": [{ "binding": "ANALYTICS", "dataset": "my_app_events" }]
}
```

### Service Bindings (Worker-to-Worker)

Service Bindings allow one Worker to call another Worker directly without going through the public internet. This is ideal for microservice architectures where a SvelteKit frontend needs to call a backend API Worker.

**Benefits:**

- **More secure**: Traffic never leaves Cloudflare's network
- **Faster**: No DNS lookup, no TLS handshake (~10-50ms saved per request)
- **Cheaper**: Service binding calls cost less than external HTTP requests
- **No CORS**: Internal calls bypass CORS entirely

**Configure in wrangler.jsonc:**

```jsonc
{
  "services": [
    {
      "binding": "API",
      "service": "my-api-worker" // Name of the target Worker
    }
  ]
}
```

**Type definitions (src/app.d.ts):**

```typescript
/// <reference types="@cloudflare/workers-types" />

declare global {
  namespace App {
    interface Platform {
      env?: {
        API: Fetcher; // Service Binding to API Worker
        ASSETS: Fetcher;
      };
      cf?: CfProperties;
      ctx?: ExecutionContext;
    }
  }
}

export {};
```

**Dual-mode API client pattern:**

Create a utility that uses Service Binding when available (server-side in production) and falls back to HTTP (client-side or local dev):

```typescript
// src/lib/api.ts
import { browser } from '$app/environment';

const API_URL = 'https://api.example.com';

export function createApiClient(
  platform: App.Platform | undefined,
  fetch: typeof globalThis.fetch
) {
  return async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    // Use Service Binding if available (server-side in production)
    if (!browser && platform?.env?.API) {
      return platform.env.API.fetch(new Request(`https://api.internal${normalizedPath}`, init));
    }

    // Fallback to HTTP (client-side or local dev)
    return fetch(`${API_URL}${normalizedPath}`, init);
  };
}
```

**Usage in load functions:**

```typescript
// +page.ts or +page.server.ts
import { createApiClient } from '$lib/api';

export async function load({ fetch, platform }) {
  const api = createApiClient(platform, fetch);

  const response = await api('/api/posts?status=published');
  const data = await response.json();

  return { posts: data.posts };
}
```

**Deployment order matters:** The target Worker (API) must exist before deploying Workers that bind to it. In CI/CD, use job dependencies:

```yaml
deploy-web:
  needs: deploy-api # API must deploy first
```

---

## Performance Settings

### Smart Placement (Beta)

Smart Placement automatically moves your Worker closer to backend services (databases, APIs) rather than always running at the edge nearest the user. This can dramatically improve latency for apps that make multiple round-trips to centralized resources.

**When to enable:**

- Your app connects to external databases (Neon, Supabase, PlanetScale)
- You make multiple API calls to centralized services
- You use Hyperdrive for PostgreSQL/MySQL connections

**When it doesn't help:**

- Pure D1/KV/R2 usage (Cloudflare optimizes these automatically)
- Static asset serving
- Apps with minimal backend calls

**Enable in wrangler.jsonc:**

```jsonc
{
  "placement": {
    "mode": "smart"
  }
}
```

**Verify it's working:**

Check the `cf-placement` response header:

- `remote-LHR` — Request was routed to London data center (Smart Placement active)
- `local-EWR` — Request ran at nearest edge (Smart Placement not applied)

**Note:** Smart Placement requires consistent traffic from multiple locations to make optimization decisions. Low-traffic Workers may not see benefits immediately.

### D1 Read Replication (Beta)

If your app is read-heavy and users are distributed globally, D1 read replication can significantly reduce latency by routing read queries to nearby replicas instead of the primary database.

**Enable in the dashboard:**

1. D1 → Select database → Settings → Enable Read Replication

**Or via API:**

```bash
curl -X PUT "https://api.cloudflare.com/client/v4/accounts/{account_id}/d1/database/{database_id}" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"read_replication": {"mode": "auto"}}'
```

**Important:** You must use the Sessions API to benefit from read replicas. Without it, all queries still go to the primary.

**Basic Sessions API usage:**

```typescript
// In your server load function or API route
export async function load({ platform, cookies }) {
  const db = platform?.env?.DB;
  if (!db) throw error(500, 'Database not available');

  // Get bookmark from previous request (stored in cookie or header)
  const bookmark = cookies.get('d1-bookmark') ?? 'first-unconstrained';

  // Create session — queries will use appropriate replica
  const session = db.withSession(bookmark);

  // Read queries go to nearest replica
  const { results } = await session
    .prepare('SELECT * FROM shares WHERE org_id = ?')
    .bind(orgId)
    .all();

  // Store bookmark for next request to maintain consistency
  const newBookmark = session.getBookmark();
  if (newBookmark) {
    cookies.set('d1-bookmark', newBookmark, { path: '/', httpOnly: true });
  }

  return { shares: results };
}
```

**Session strategies:**

| Strategy              | Use Case                                                                 |
| --------------------- | ------------------------------------------------------------------------ |
| `first-unconstrained` | Default. First query goes to any replica. Best latency.                  |
| `first-primary`       | First query goes to primary. Use after writes for immediate consistency. |
| Stored bookmark       | Continue from previous session. Best for multi-request flows.            |

**When to use read replication:**

- Dashboard views showing lists of data
- Search and filtering operations
- Public-facing read-heavy pages
- Reporting and analytics queries

**When NOT to use (or use `first-primary`):**

- Immediately after a write (user expects to see their change)
- Admin operations requiring latest data
- Financial or audit-critical reads

### CPU Time Limits

Workers now support up to 5 minutes of CPU time per request (up from 30 seconds). Useful for:

- Large file processing
- Complex cryptographic operations
- Data transformation pipelines

```jsonc
{
  "limits": {
    "cpu_ms": 300000 // 5 minutes (default is 30000)
  }
}
```

**Important:** CPU time is active processing only — time waiting on network/storage doesn't count. Most requests use <2ms of CPU time.

### Hyperdrive (External Database Optimization)

If you're connecting to PostgreSQL or MySQL outside Cloudflare, Hyperdrive provides connection pooling and query caching:

```jsonc
{
  "hyperdrive": [
    {
      "binding": "DB",
      "id": "<HYPERDRIVE_CONFIG_ID>"
    }
  ]
}
```

Hyperdrive works well with Smart Placement — the Worker runs near the database, and Hyperdrive handles connection pooling.

---

## Observability

### Workers Logs (Recommended)

Enable automatic log collection, storage, and querying:

```jsonc
{
  "observability": {
    "enabled": true,
    "logs": {
      "enabled": true,
      "invocation_logs": true,
      "head_sampling_rate": 1 // 1 = 100%, 0.1 = 10%
    }
  }
}
```

**Features:**

- Automatic log ingestion and storage (7 days)
- Query Builder for cross-Worker analysis
- Invocation grouping (see all logs from one request)
- JSON field extraction and indexing

**Best practice — log in JSON format:**

```typescript
console.log(
  JSON.stringify({
    event: 'share_created',
    shareId: share.id,
    userId: user.id,
    fileCount: files.length
  })
);
```

### Tail Workers (Advanced)

For custom log processing or sending to external services (Datadog, Sentry):

```jsonc
{
  "tail_consumers": [{ "service": "my-log-processor" }]
}
```

### Logpush (Enterprise)

Send Workers trace events to external destinations (R2, S3, Datadog, etc.) for long-term storage or compliance.

---

## Type Definitions

Update `src/app.d.ts` to include your bindings:

```typescript
/// <reference types="@cloudflare/workers-types" />

declare global {
  namespace App {
    interface Locals {
      user: { id: string; email: string } | null;
    }

    interface Platform {
      env?: {
        // Databases
        DB: D1Database;

        // Storage
        FILES: R2Bucket;
        CACHE: KVNamespace;

        // Assets (auto-provided by adapter)
        ASSETS: Fetcher;

        // Workers-only features
        ANALYTICS: AnalyticsEngineDataset;
        MY_QUEUE: Queue<QueueMessage>;
        COUNTER: DurableObjectNamespace;

        // Secrets (accessed via $env/dynamic/private preferred)
        API_KEY?: string;
      };

      // Cloudflare-specific request context
      cf?: CfProperties;
      ctx?: ExecutionContext;
      caches?: CacheStorage & { default: Cache };
    }
  }
}

export {};
```

---

## CI/CD with GitHub Actions

Update your deployment workflow:

```yaml
# .github/workflows/deploy.yml
name: Deploy to Cloudflare Workers

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - run: npm ci

      - run: npm run build

      # Preview deployment for PRs
      - name: Deploy Preview
        if: github.event_name == 'pull_request'
        run: npx wrangler deploy --env preview
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      # Production deployment for main
      - name: Deploy Production
        if: github.ref == 'refs/heads/main'
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

For automatic Git integration (PR comments with preview URLs), connect your repo via the Cloudflare dashboard instead:

1. Dashboard → Workers & Pages → Your Worker
2. Settings → Builds → Connect to Git
3. Select repository and configure build settings

---

## Rollback Strategy

### Option 1: Keep Pages Project Temporarily

Don't delete your Pages project immediately. Run both in parallel:

- Workers on primary domain
- Pages on `*.pages.dev` as backup

### Option 2: Use Workers Versions

Workers supports gradual rollouts and instant rollback:

```bash
# View recent versions
wrangler versions list

# Rollback to previous version
wrangler rollback
```

---

## Troubleshooting

### "Domain not available" Error

Workers requires Cloudflare-managed DNS. If your domain's nameservers are external:

1. Migrate DNS to Cloudflare, or
2. Use a subdomain on a Cloudflare-managed zone

### Build Size Exceeds Limits

Workers have a 10MB compressed limit (vs. Pages' more generous limits):

```typescript
// Move large imports to client-side only
import { browser } from '$app/environment';

let heavyLibrary;
if (browser) {
  heavyLibrary = await import('heavy-library');
}
```

### Environment Variables Not Available

Remember:

- `$env/static/*` — resolved at build time
- `$env/dynamic/*` — resolved at runtime (use for secrets)
- `platform.env.*` — Cloudflare bindings (D1, KV, R2, etc.)

### Preview URLs Not Working

Ensure in `wrangler.jsonc`:

```jsonc
{
  "preview_urls": true,
  "workers_dev": true // Required for *.workers.dev URLs
}
```

### "wrangler: command not found" in CI

If GitHub Actions fails with `wrangler: command not found`, wrangler is installed as a dev dependency but not in the system PATH.

**Fix:** Use your package manager's exec command:

```bash
# npm
npx wrangler deploy

# pnpm
pnpm exec wrangler deploy

# yarn
yarn wrangler deploy
```

This is common in monorepos where wrangler is installed at the root or in a specific package rather than globally.

**Monorepo note:** Each app that runs `wrangler deploy` needs wrangler as a devDependency in its own `package.json`, not just at the root:

```bash
pnpm --filter @myorg/web add -D wrangler
pnpm --filter @myorg/pub add -D wrangler
```

### Secrets Store Authorization Error (10021)

If deployment fails with:

```
failed to fetch secrets store binding due to authorization error [code: 10021]
```

**Cause:** Your API token has `Secrets Store: Read` but needs `Secrets Store: Edit`.

**Fix:** Update your Cloudflare API token:

1. Dashboard → Manage Account → API Tokens
2. Edit your deployment token
3. Change `Secrets Store: Read` → `Secrets Store: Edit`

This is a known issue - see [GitHub Issue #8964](https://github.com/cloudflare/workers-sdk/issues/8964).

### Workers Routes Authentication Error (10000)

If the Worker uploads but fails on routes:

```
A request to the Cloudflare API (/zones/.../workers/routes) failed.
Authentication error [code: 10000]
```

**Cause:** Missing zone-level permission for Workers Routes.

**Fix:** Add to your API token:

- `Zone → Workers Routes → Edit`

### Zone Restrictions Blocking Account Permissions

If you have zone-restricted API tokens (e.g., "Specific zone → example.com"), account-level resources like Secrets Store may fail even with correct permissions.

**Fix:** Either:

1. Use "All zones" for Zone Resources, or
2. Create a separate token for account-level operations

### Static Redirects Exceed 2000 Rule Limit

Workers limit `_redirects` files to 2000 rules. If you have more:

```
Maximum number of static _redirects rules limit of 2000 exceeded
```

**Options:**

1. **Pattern-based handler** (recommended for large sets):

   ```typescript
   // src/hooks.server.ts
   import redirectMap from '$lib/legacy-redirects.json';

   export const handle: Handle = async ({ event, resolve }) => {
     const match = event.url.pathname.match(/^\/\d{4}\/\d{2}\/\d{2}\/(.+)\.html\/?$/);
     if (match) {
       const slug = match[1];
       const targetId = redirectMap[slug];
       if (targetId) {
         throw redirect(301, `/posts/${targetId}`);
       }
     }
     return resolve(event);
   };
   ```

2. **Cloudflare Bulk Redirects** (account-level, up to 25,000 on free tier):
   - Dashboard → Rules → Redirect Rules → Bulk Redirects
   - Import CSV with source,target,status columns

3. **Trim unused redirects** if many are obsolete

---

## Migration Checklist

### Pre-Migration (While Still on Pages)

- [ ] Check bundle size (`ls -lh .svelte-kit/cloudflare/_worker.js`)
- [ ] Test with `wrangler dev` to catch Node API issues
- [ ] Verify domain nameservers are Cloudflare-managed
- [ ] Audit environment variables and secrets
- [ ] Search for `$env/static/private` imports

### Core Migration

- [ ] Update Wrangler to v4+
- [ ] Install/verify `@sveltejs/adapter-cloudflare`
- [ ] Convert `wrangler.jsonc` from Pages to Workers format
- [ ] Update `package.json` scripts (`wrangler deploy` not `wrangler pages deploy`)
- [ ] Switch `$env/static/private` to `$env/dynamic/private` for secrets
- [ ] Re-add secrets via `wrangler secret put`
- [ ] Update `src/app.d.ts` with Platform types
- [ ] Configure custom domain via routes or dashboard
- [ ] Enable preview URLs
- [ ] Update CI/CD workflow

### Secrets Consolidation (Optional)

- [ ] Identify secrets shared across multiple Workers
- [ ] Create Secrets Store and add shared secrets
- [ ] Update `wrangler.jsonc` with `secrets_store_secrets` bindings
- [ ] Remove duplicated per-Worker secrets

### Performance Optimization (Optional)

- [ ] Enable Smart Placement if using external databases/APIs
- [ ] Enable D1 read replication for read-heavy global apps
- [ ] Implement Sessions API for D1 if using read replication
- [ ] Configure Hyperdrive for PostgreSQL/MySQL connections
- [ ] Adjust `limits.cpu_ms` if doing heavy computation

### Observability

- [ ] Enable `observability.logs` in wrangler config
- [ ] Configure `head_sampling_rate` for high-traffic Workers
- [ ] Set up Logpush or Tail Workers if needed

### Service Bindings (Optional)

- [ ] Identify Workers that need to communicate
- [ ] Add `services` binding in wrangler.jsonc
- [ ] Create API client utility with dual-mode (Service Binding / HTTP fallback)
- [ ] Update load functions to use API client
- [ ] Configure CI/CD job dependencies (API deploys before consumers)

### Deployment

- [ ] Test locally with `wrangler dev`
- [ ] Deploy with `wrangler deploy --dry-run` first
- [ ] Deploy to production
- [ ] Verify custom domain works
- [ ] Check Smart Placement via `cf-placement` header
- [ ] (Optional) Delete old Pages project after verification period

---

## Monorepo Considerations

When migrating multiple SvelteKit apps in a monorepo (e.g., Turborepo, Nx, pnpm workspaces):

### Shared Configuration

Create a base wrangler config that can be extended:

```jsonc
// packages/wrangler-config/base.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "compatibility_date": "2025-01-01",
  "compatibility_flags": ["nodejs_compat"],
  "preview_urls": true,
  "observability": {
    "logs": { "enabled": true, "invocation_logs": true }
  }
}
```

### GitHub Actions with Dependencies

When using Service Bindings, deploy the API Worker first:

**Important:** When wrangler is installed as a dev dependency (not globally), use `pnpm exec wrangler` or `npx wrangler` to ensure the command is found in CI environments.

```yaml
jobs:
  deploy-api:
    name: Deploy API
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      # Use 'pnpm exec' since wrangler is a dev dependency, not global
      - run: pnpm exec wrangler deploy
        working-directory: apps/api
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

  deploy-web:
    name: Deploy Web
    needs: deploy-api # Wait for API
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm turbo build --filter=@myorg/web
      # Use 'pnpm exec' since wrangler is a dev dependency, not global
      - run: pnpm exec wrangler deploy
        working-directory: apps/web
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Client-Side Apps (SSR Disabled)

If your app has `ssr = false` in `+layout.ts`, Service Bindings won't be used (they're server-side only). The API client will automatically fall back to HTTP fetch. You can still migrate to Workers for:

- Unified deployment pipeline
- Workers-only features (Cron Triggers, etc.)
- Future SSR enablement

### Turborepo Integration

Add Workers deployment to your `turbo.json`:

```json
{
  "tasks": {
    "deploy": {
      "dependsOn": ["build"],
      "cache": false
    }
  }
}
```

---

## Reference

- [SvelteKit Cloudflare Adapter Docs](https://svelte.dev/docs/kit/adapter-cloudflare)
- [Cloudflare Workers Migration Guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [Service Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Workers Preview URLs](https://developers.cloudflare.com/workers/configuration/previews/)
- [Wrangler Configuration](https://developers.cloudflare.com/workers/wrangler/configuration/)
- [Secrets Store](https://developers.cloudflare.com/secrets-store/)
- [Smart Placement](https://developers.cloudflare.com/workers/configuration/smart-placement/)
- [D1 Read Replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Workers Logs](https://developers.cloudflare.com/workers/observability/logs/workers-logs/)
- [Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)

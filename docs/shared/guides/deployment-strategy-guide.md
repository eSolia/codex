# Deployment Strategy: Conserving GitHub Actions Minutes

## Context

GitHub Pro includes 3,000 Actions minutes per month. With multiple Cloudflare Workers apps deploying on every push, these minutes deplete quickly. This guide outlines strategies to reduce or eliminate GitHub Actions usage for deployments while maintaining automation.

---

## Recommended Approach: Cloudflare Git Integration

Cloudflare Workers now supports native Git integration, running builds on Cloudflare's infrastructure instead of GitHub's. This is the primary recommended approach for most apps.

### Benefits

- Zero GitHub Actions minutes consumed
- PR preview URLs with automatic comments
- Branch-based deployments
- Build logs in Cloudflare dashboard
- Same functionality as the old Pages Git integration

### Setup Steps

1. Go to **Cloudflare Dashboard → Workers & Pages → [Your Worker]**
2. Navigate to **Settings → Builds → Connect to Git**
3. Authorize GitHub access and select the repository
4. Configure build settings:
   - **Build command**: `npm run build`
   - **Deploy command**: `npx wrangler deploy` (usually auto-detected)
   - **Root directory**: `/` (or subfolder if monorepo)
5. Set environment variables in the Cloudflare dashboard under **Settings → Variables and Secrets**

### Migration Checklist

When migrating a repo from GitHub Actions to Cloudflare Git integration:

- [ ] Verify `wrangler.jsonc` has `preview_urls: true` for PR previews
- [ ] Move secrets from GitHub Actions to Cloudflare dashboard
- [ ] Delete or disable the GitHub Actions workflow file
- [ ] Test a PR to confirm preview deployment works
- [ ] Test a merge to main to confirm production deployment works

### Limitations

- Less flexibility than custom GitHub Actions workflows
- Build environment is Cloudflare-managed (specific Node versions, etc.)
- Complex multi-step builds may not fit well

---

## Alternative: Optimized GitHub Actions

For repos that need GitHub Actions (tests, linting, multi-repo coordination), optimize the workflow to minimize minute usage.

### Optimized Workflow Template

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
    paths:
      # Only trigger when app code changes
      - 'src/**'
      - 'static/**'
      - 'package.json'
      - 'package-lock.json'
      - 'svelte.config.js'
      - 'vite.config.ts'
      - 'wrangler.jsonc'
      - 'tsconfig.json'

# Cancel in-progress runs when new commits arrive
concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: true

jobs:
  deploy:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      - name: Deploy
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

### Key Optimizations Explained

| Optimization                     | What It Does                                       | Estimated Savings        |
| -------------------------------- | -------------------------------------------------- | ------------------------ |
| `paths` filter                   | Skips builds for README, docs, config-only changes | 20-50% of runs           |
| `concurrency.cancel-in-progress` | Cancels outdated runs when new commits push        | Prevents wasted minutes  |
| `cache: 'npm'`                   | Caches node_modules between runs                   | 30-60 seconds per run    |
| `timeout-minutes`                | Fails fast if something hangs                      | Prevents runaway billing |
| No PR builds                     | Only deploy on main branch                         | 50%+ reduction           |

### Adding PR Previews (If Needed)

If you need PR preview deployments via GitHub Actions:

```yaml
on:
  push:
    branches: [main]
    paths: [...]
  pull_request:
    branches: [main]
    paths: [...]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      # ... setup steps ...

      - name: Deploy Preview
        if: github.event_name == 'pull_request'
        run: npx wrangler deploy --env preview
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}

      - name: Deploy Production
        if: github.ref == 'refs/heads/main'
        run: npx wrangler deploy
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
```

---

## Alternative: Manual Local Deploys

For rapid iteration or when automation isn't critical, deploy directly from the terminal.

### Local Deploy Script

Create a `deploy.sh` in the project root:

```bash
#!/bin/bash
# deploy.sh - Manual deployment script

set -e

echo "🔨 Building..."
npm run build

echo "🚀 Deploying to Cloudflare..."
npx wrangler deploy

echo "✅ Deployed successfully"
```

Make it executable:

```bash
chmod +x deploy.sh
```

### NPM Script Alternative

Add to `package.json`:

```json
{
  "scripts": {
    "deploy": "npm run build && wrangler deploy",
    "deploy:preview": "npm run build && wrangler deploy --env preview"
  }
}
```

Then deploy with:

```bash
npm run deploy
```

---

## Decision Matrix

Use this to decide which approach fits each repository:

| Repository Type             | Recommended Approach                | Reasoning                     |
| --------------------------- | ----------------------------------- | ----------------------------- |
| Simple SvelteKit app        | Cloudflare Git integration          | Zero minutes, full automation |
| App with test suite         | Optimized GitHub Actions            | Need CI for tests             |
| Rapid development phase     | Local deploys                       | Faster feedback loop          |
| Monorepo with multiple apps | Optimized GitHub Actions with paths | Fine-grained control          |
| Library/package (no deploy) | GitHub Actions for tests only       | No deployment needed          |

---

## Migration Plan

### Phase 1: Audit Current Repos

List all repos currently using GitHub Actions for deployment:

```bash
# In each repo, check for workflow files
ls -la .github/workflows/
```

### Phase 2: Categorize

For each repo, decide:

1. **Cloudflare Git** — Simple builds, no tests required
2. **Optimized Actions** — Needs tests or complex builds
3. **Manual** — Infrequent deploys, development-heavy

### Phase 3: Implement

For Cloudflare Git integration:

1. Set up in Cloudflare dashboard
2. Add secrets to Cloudflare
3. Delete GitHub workflow file
4. Test deployment

For optimized GitHub Actions:

1. Update workflow with optimizations above
2. Add `paths` filter appropriate to the project
3. Add `concurrency` settings
4. Test deployment

---

## Secrets Management

When moving from GitHub Actions to Cloudflare Git integration, migrate secrets:

### GitHub Actions Secrets Location

**Repository → Settings → Secrets and variables → Actions**

### Cloudflare Secrets Location

**Workers & Pages → [Worker] → Settings → Variables and Secrets**

### Common Secrets to Migrate

| Secret                 | Purpose                         | Notes                                     |
| ---------------------- | ------------------------------- | ----------------------------------------- |
| `CLOUDFLARE_API_TOKEN` | Not needed in Cloudflare builds | Cloudflare has implicit access            |
| `DATABASE_URL`         | D1/external DB connection       | Add as encrypted variable                 |
| `MAILEROO_API_KEY`     | Email service                   | Consider Secrets Store for shared secrets |
| `SENTRY_DSN`           | Error tracking                  | Add as plain variable (not sensitive)     |

---

## Monitoring Usage

Track GitHub Actions usage:
**GitHub → Settings → Billing and plans → Plans and usage**

Track Cloudflare build usage:
**Cloudflare Dashboard → Workers & Pages → [Worker] → Deployments**

---

## Troubleshooting

### Cloudflare Git build fails but local build works

- Check Node.js version compatibility
- Verify all environment variables are set in Cloudflare dashboard
- Check build logs in Cloudflare for specific errors

### Preview URLs not appearing on PRs

Ensure `wrangler.jsonc` includes:

```jsonc
{
  "preview_urls": true,
  "workers_dev": true,
}
```

### GitHub Actions still running after migration

- Delete or rename the workflow file in `.github/workflows/`
- Or disable the workflow: **Actions → [Workflow] → ... → Disable workflow**

---

## eSolia Projects Migration Status

**Last updated:** 2026-01-16

This section tracks the migration status of eSolia projects from GitHub Actions deployments to Cloudflare Git Integration.

### Target Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    GitHub Actions (CI Only)                      │
│   • Format check (prettier --check)                              │
│   • Lint (eslint)                                                │
│   • Type check (tsc / svelte-check)                              │
│   • Security audit (pnpm audit)                                  │
│   • NO deployment - uses minimal minutes                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Cloudflare Git Integration (Builds/Deploy)          │
│   • Triggered by GitHub push/PR                                  │
│   • Builds on Cloudflare infrastructure (FREE)                   │
│   • PR preview URLs automatically                                │
│   • Production deploy on main branch                             │
└─────────────────────────────────────────────────────────────────┘
```

### Project Status

| Project      | Type    | CI Workflow | wrangler.jsonc          | CF Git Integration | Deploy Hooks     | Status       |
| ------------ | ------- | ----------- | ----------------------- | ------------------ | ---------------- | ------------ |
| **Nexus**    | Workers | ✅ Created  | ✅ Updated              | ✅ Enabled         | ⏳ Waiting on CF | **Complete** |
| **Periodic** | Workers | ✅ Created  | ✅ Has preview_urls     | ✅ Enabled         | ⏳ Waiting on CF | **Complete** |
| **Pulse**    | Workers | ✅ Created  | ✅ Has preview_urls     | ✅ Enabled         | ⏳ Waiting on CF | **Complete** |
| **Courier**  | Workers | ✅ Created  | ✅ Has preview_urls     | ✅ Enabled         | N/A              | **Complete** |
| **Hanawa**   | Workers | ✅ Created  | ✅ Converted to Workers | ✅ Enabled         | ⏳ Waiting on CF | **Complete** |
| **Chocho**   | Workers | ✅ Created  | ✅ Converted to Workers | ⏳ Pending         | N/A              | **Complete** |

### Completed Tasks

1. **CI Workflows Created** - All 6 projects have `ci.yml` workflows with:
   - pnpm package manager
   - Format check, lint, type check
   - Security audit (non-blocking)

2. **ESLint Standardization** - Added eslint.config.js to:
   - Nexus (Hono template)
   - Courier (SvelteKit template)
   - Hanawa (SvelteKit template)
   - Chocho (SvelteKit template)

3. **Husky Pre-commit Hooks** - Configured for subdirectory projects:
   - Hanawa (codex/packages/hanawa-cms)
   - Chocho (chocho/app)

4. **Deploy Hook Webhook** - Created `/webhook/deploy-hook` endpoint in Nexus:
   - Receives POST from Cloudflare deploy hooks
   - Validates webhook secret
   - Triggers GitHub repository_dispatch for API sync

5. **Hanawa Pages→Workers Migration** - Converted wrangler.jsonc:
   - Changed from `pages_build_output_dir` to `main` + `assets`
   - Added `preview_urls: true` and `workers_dev: true`
   - Added observability config
   - Updated deploy script

6. **Old deploy.yml Workflows Deleted** - Removed from all projects

### Remaining Tasks

#### Completed

1. ~~**Enable Cloudflare Git Integration**~~ ✅ Done for all Workers projects
2. ~~**Set Nexus Secrets**~~ ✅ `DEPLOY_HOOK_SECRET` and `GITHUB_DISPATCH_TOKEN` configured
3. ~~**Migrate Secrets to Cloudflare**~~ ✅ Secrets configured in CF Dashboard

#### Waiting on Cloudflare

**Deploy Hooks** - Workers Git Integration doesn't yet support outbound deploy hooks (webhooks on deploy complete). Per the [compatibility matrix](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/#compatibility-matrix), this is "Coming soon."

- Tracked in: https://github.com/eSolia/nexus/issues/16
- Workaround: Scheduled sync every 6 hours via `cf-api-sync.yml`
- Nexus webhook endpoint ready at `/webhook/deploy-hook`

#### Chocho Conversion (Completed)

Chocho was converted from Cloudflare Pages to Workers (Jan 2026):

- Updated `wrangler.jsonc` to Workers format (`main` + `assets`)
- Added `preview_urls: true` and `workers_dev: true`
- Updated `platform.context` → `platform.ctx` in code
- CI workflow handles linting/checks, Cloudflare Git Integration handles deploys

### Estimated Savings

| Project  | Before (min/deploy) | After (min/run) | Reduction |
| -------- | ------------------: | --------------: | --------: |
| Nexus    |                  ~3 |              ~1 |       67% |
| Periodic |                  ~4 |            ~1.5 |       63% |
| Pulse    |                  ~4 |            ~1.5 |       63% |
| Courier  |                  ~4 |            ~1.5 |       63% |
| Hanawa   |                  ~3 |              ~1 |       67% |
| Chocho   |                  ~3 |            ~0.5 |       83% |

**Total estimated savings:** ~70% reduction in GitHub Actions minutes

---

## References

- [Cloudflare Workers Git Integration](https://developers.cloudflare.com/workers/ci-cd/builds/)
- [GitHub Actions Billing](https://docs.github.com/en/billing/managing-billing-for-github-actions)
- [Wrangler Deploy Command](https://developers.cloudflare.com/workers/wrangler/commands/#deploy)
- [SvelteKit Pages to Workers Migration](./sveltekit-pages-to-workers-migration.md)

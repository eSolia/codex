---
title: "Cloudflare Auth and Deploy"
slug: cloudflare-auth-and-deploy
category: guides
tags: [cloudflare, authentication, deployment, access]
summary: "Cloudflare Access authentication and deployment patterns for Workers/Pages"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
# Cloudflare Authentication & Worker Deployment

## Single-Token Architecture

All Cloudflare tooling (wrangler CLI, Cloudflare MCP, GitHub Actions) uses a single manually-created API token. No per-repo OAuth logins required.

### Token Setup

1. **Create** an API token in [Cloudflare Dashboard → API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. **Template**: Use "Edit Cloudflare Workers" as a starting point, then add any additional permissions needed
3. **Required permissions** (cumulative — covers wrangler, MCP, and CI):
   - `Account — Workers Scripts:Edit` (deploy workers)
   - `Account — Workers KV Storage:Edit` (KV operations)
   - `Account — Workers R2 Storage:Edit` (R2 operations)
   - `Account — D1:Edit` (D1 database operations)
   - `Account — Workers Tail:Read` (log tailing)
   - `Zone — Zone:Read` (list zones)
   - `Zone — Firewall Services:Edit` (WAF rules via MCP)
4. **Store** the token:

   ```bash
   echo "YOUR_TOKEN" > ~/.ssh/tokens/CLOUDFLARE_API_TOKEN
   chmod 600 ~/.ssh/tokens/CLOUDFLARE_API_TOKEN
   ```

5. **Load** in `.zshrc`:

   ```bash
   if [[ -e ~/.ssh/tokens/CLOUDFLARE_API_TOKEN ]]; then
       export CLOUDFLARE_API_TOKEN="$(cat ~/.ssh/tokens/CLOUDFLARE_API_TOKEN)"
   fi
   ```

### How Each Tool Picks Up the Token

| Tool               | Mechanism                                                  | Notes                                                               |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------- |
| **wrangler CLI**   | Reads `CLOUDFLARE_API_TOKEN` env var                       | Env var takes priority over `~/.wrangler/config/default.toml` OAuth |
| **Cloudflare MCP** | `Authorization: Bearer` header set during `claude mcp add` | Configured once at user scope — available in all repos              |
| **GitHub Actions** | `secrets.CLOUDFLARE_API_TOKEN` in workflow env             | Set per-repo or per-org in GitHub Settings                          |

### Important: No Wrangler OAuth

Do **not** run `wrangler login` — it creates `~/.wrangler/config/default.toml` with an OAuth token that can conflict with the env var. If one exists, remove it:

```bash
npx wrangler logout   # (unset CLOUDFLARE_API_TOKEN first if needed)
rm -f ~/.wrangler/config/default.toml
```

Wrangler should only authenticate via the `CLOUDFLARE_API_TOKEN` env var.

---

## Claude Code MCP Configuration

The Cloudflare MCP is configured at **user scope** (available in all repos):

```bash
claude mcp add \
  --transport http \
  --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
  -s user \
  cloudflare \
  https://mcp.cloudflare.com/mcp
```

**Note:** The `${CLOUDFLARE_API_TOKEN}` is expanded at add-time (the literal token value is stored). If you rotate the token, re-run this command.

### Verify MCP

```bash
claude mcp list          # should show cloudflare as ✓ Connected
```

### Rotate Token

When creating a new token:

1. Update `~/.ssh/tokens/CLOUDFLARE_API_TOKEN`
2. Source your shell: `source ~/.zshrc`
3. Re-add the MCP:
   ```bash
   claude mcp remove cloudflare -s user
   claude mcp add --transport http \
     --header "Authorization: Bearer ${CLOUDFLARE_API_TOKEN}" \
     -s user cloudflare https://mcp.cloudflare.com/mcp
   ```
4. Update GitHub Actions secrets if applicable

---

## Deploying Workers

### Local Deploy (Any Repo)

```bash
npx wrangler deploy          # uses CLOUDFLARE_API_TOKEN from env
```

For repos with a build step:

```bash
pnpm run build && npx wrangler deploy
```

### Monorepo Workers (e.g., esolia-2025)

Workers in subdirectories have their own `wrangler.jsonc`:

```bash
cd workers/indexing && npx wrangler deploy
cd workers/search-console-ingest && npx wrangler deploy
```

**Important:** Every sub-worker `wrangler.jsonc` must include `"account_id"`. Account API tokens cannot call the `/memberships` user-level endpoint that wrangler uses to discover the account. With `account_id` in the config, wrangler skips that call entirely.

### Production Deploys

Most repos use **Cloudflare Git Integration** — pushes to `main` trigger automatic builds on Cloudflare's infrastructure (zero GitHub Actions minutes). See `deployment-strategy-guide.md` for the full strategy.

Local `wrangler deploy` is for:

- Deploying standalone workers (indexing, search-console-ingest) not linked to Git Integration
- Hotfixes that need immediate deployment
- Workers in repos without Git Integration

---

## Troubleshooting

### `Authentication failed [code: 9106]` on `/memberships`

This happens when using an **Account API token** (not a User API token). Account tokens can't access user-level endpoints like `/memberships`. Wrangler calls this to discover which account to deploy to.

**Fix:** Add `"account_id": "YOUR_ACCOUNT_ID"` to every `wrangler.jsonc`. This tells wrangler the account directly, skipping the `/memberships` call.

**Why it worked before:** Wrangler caches the account ID in `node_modules/.cache/wrangler/wrangler-account.json` from earlier OAuth sessions. When that cache is cleared or missing, it falls back to `/memberships`.

### `Unable to authenticate request [code: 10001]`

1. Check the token is loaded: `echo ${#CLOUDFLARE_API_TOKEN}` (should be 40)
2. Check for stale OAuth: `cat ~/.wrangler/config/default.toml` — if it exists with an expired `expiration_time`, delete it
3. Test: `npx wrangler whoami`

### MCP returns errors but wrangler works (or vice versa)

The MCP token is stored as a literal value at add-time. If you rotated the token in `~/.ssh/tokens/`, wrangler picks up the new one automatically but the MCP still has the old one. Re-add the MCP (see Rotate Token above).

### `You are logged in with an API Token. Unset the CLOUDFLARE_API_TOKEN...`

Wrangler refuses OAuth login when the env var is set. This is by design — we don't want OAuth. If you see this during `wrangler login`, it means the system is working correctly.

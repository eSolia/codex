# eSolia Standards MCP Server

A remote MCP (Model Context Protocol) server deployed on Cloudflare Workers that exposes eSolia's coding and workflow standards to Claude Code and other MCP clients. This eliminates the need to rsync markdown files across repositories — standards live in one place, accessible from any project.

## How it works

```
┌─────────────────────────────────────────────────────────────────┐
│  Your machine                                                    │
│                                                                  │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐        │
│  │  repo-alpha/  │   │  repo-beta/  │   │  repo-gamma/ │        │
│  │  Claude Code  │   │  Claude Code  │   │  Claude Code │        │
│  └──────┬───────┘   └──────┬───────┘   └──────┬───────┘        │
│         │                  │                   │                 │
│         └──────────────────┼───────────────────┘                │
│                            │ MCP (streamable HTTP)              │
└────────────────────────────┼────────────────────────────────────┘
                             │
                             ▼
               ┌─────────────────────────┐
               │  Cloudflare Worker       │
               │  esolia-standards-mcp    │
               │                          │
               │  Tools:                  │
               │  • list_standards        │
               │  • get_standard          │
               │  • search_standards      │
               └────────────┬─────────────┘
                            │
                            ▼
               ┌─────────────────────────┐
               │  Cloudflare KV           │
               │  Standards documents     │
               │  (markdown + metadata)   │
               └─────────────────────────┘
```

Claude Code in **any** repo calls the remote MCP server over HTTP. The server fetches the relevant standard from KV and returns it. No rsync, no local copies, no per-repo config.

## Quick start

### 1. Create the project

```bash
git clone <this-repo> esolia-standards-mcp
cd esolia-standards-mcp
npm install
```

### 2. Create the KV namespace

```bash
npx wrangler kv namespace create STANDARDS_KV
```

Copy the output ID and update `wrangler.jsonc`:

```jsonc
"kv_namespaces": [
  {
    "binding": "STANDARDS_KV",
    "id": "paste-your-id-here"        // ← production
  }
]
```

### 3. Seed your standards

Place your markdown files in `./standards/` with frontmatter:

```markdown
---
title: Backpressure Patterns
category: Code Quality
tags: [async, flow-control, resilience]
summary: How to use backpressure to write more resilient async code.
---

Your content here...
```

Then seed them to KV:

```bash
npm run seed
```

### 4. Test locally

```bash
npm run dev
# Server starts at http://localhost:8787

# Test with MCP Inspector
npm run inspect
# Enter http://localhost:8787/mcp as the server URL
```

### 5. Deploy

```bash
npm run deploy
```

Your server will be live at `esolia-standards-mcp.<your-subdomain>.workers.dev`.

### 6. (Optional) Add auth

For non-public deployments, set a shared secret:

```bash
npx wrangler secret put SHARED_SECRET
# Enter a strong random value
```

### 7. Connect Claude Code

**Without auth (simplest):**

```bash
claude mcp add --transport http --scope user esolia-standards \
  https://esolia-standards-mcp.<your-subdomain>.workers.dev/mcp
```

**With shared secret auth:**

```bash
claude mcp add --transport http --scope user esolia-standards \
  https://esolia-standards-mcp.<your-subdomain>.workers.dev/mcp \
  -H "Authorization: Bearer YOUR_SHARED_SECRET"
```

The `--scope user` flag makes it available globally across all your repos (stored in `~/.claude/settings.json`). Use `--scope project` to share with your team via `.mcp.json`.

## Available tools

| Tool | Description | Parameters |
|---|---|---|
| `list_standards` | Lists all standards with titles, categories, tags, and summaries | None |
| `get_standard` | Fetches the full markdown content of a specific standard | `slug` (string) |
| `search_standards` | Searches across titles, tags, summaries, and content | `query` (string) |

## Updating standards

### Adding or updating a standard

1. Edit/add a markdown file in `./standards/`
2. Run `npm run seed`
3. The KV store updates immediately — no redeploy needed

### Automating with GitHub Actions

Add a workflow that seeds KV on push to `main`:

```yaml
# .github/workflows/sync-standards.yml
name: Sync Standards to KV
on:
  push:
    branches: [main]
    paths: [standards/**]

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run seed
        env:
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

## Project structure

```
esolia-standards-mcp/
├── src/
│   └── index.ts              # MCP server Worker code
├── scripts/
│   └── seed-standards.mjs    # KV seeding script
├── standards/                 # Your markdown standards (source of truth)
│   ├── backpressure.md
│   ├── article-editing.md
│   └── error-handling.md
├── wrangler.jsonc             # Cloudflare Worker config
├── package.json
├── tsconfig.json
└── worker-configuration.d.ts
```

## Standard file format

Each standard is a markdown file with YAML frontmatter:

```markdown
---
title: Human-Readable Title
category: Code Quality | Content | Infrastructure | Process
tags: [relevant, searchable, tags]
summary: One-line description shown in list_standards output.
---

## Markdown content

Your standard content here, using standard markdown.
Code blocks, tables, lists — all supported.
```

**Slug** is derived from the filename: `backpressure.md` → slug `backpressure`.

## Tips for effective use with Claude Code

Once connected, Claude Code can access your standards naturally:

- _"Check our error handling standard before reviewing this PR"_
- _"What does our backpressure guide say about bounded queues?"_
- _"Search our standards for anything about logging"_
- _"List all our coding standards"_

Claude Code will call the appropriate tool automatically based on your prompt.

## Troubleshooting

**"Connection refused" from Claude Code**
- Verify the URL ends with `/mcp`
- Check `claude mcp list` shows the server
- Try `claude mcp reset esolia-standards` then re-add

**"Unauthorized" responses**
- If using SHARED_SECRET, ensure the header matches exactly
- Check: `curl -H "Authorization: Bearer YOUR_SECRET" https://your-url/health`

**Standards not appearing after seed**
- Verify KV namespace ID in `wrangler.jsonc` matches the one created
- Run `npx wrangler kv key list --binding STANDARDS_KV` to verify keys exist

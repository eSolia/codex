# docs/shared/ — Deprecated

**Status:** Superseded by the eSolia Standards MCP server (March 2026).

## What changed

Standards documents (guides, reference, prompts) are now served on-demand via the
`esolia-standards-mcp` Worker at `https://esolia-standards-mcp.esolia.workers.dev/mcp`.

Claude Code accesses standards through MCP tools:
- `list_standards` — browse all available standards
- `get_standard` — fetch a specific standard by slug
- `search_standards` — search by keyword

## Why these files still exist

Local copies are kept as a reference fallback. They are **not** the source of truth.
The authoritative versions live in R2 (`standards/{slug}.md`) and are maintained via:
1. The Hanawa CMS standards editor (`/standards/[slug]`)
2. Git pushes to `content/standards/` (synced to R2 via GitHub Action)

## What to do

- **Claude Code users**: Use `/standards:list`, `/standards:search`, etc. No local files needed.
- **Consuming repos**: Remove `docs/shared/` copies. Standards are available via MCP from any repo.
- **Nexus rsync**: The `nexus/scripts/sync-shared-docs.sh` script is no longer needed for
  standards distribution. It can be archived once all consuming repos have switched to MCP.

## Migration checklist

| Repo | Status | Notes |
|------|--------|-------|
| codex | Done | MCP server is deployed here |
| nexus | Pending | Archive `sync-shared-docs.sh`, remove shared-rules/shared-commands |
| pulse | Pending | Remove `docs/shared/`, update CLAUDE.md |
| periodic | Pending | Remove `docs/shared/`, update CLAUDE.md |
| chocho | Pending | Remove `docs/shared/`, update CLAUDE.md |
| pub-cogley | Pending | Remove `docs/shared/`, update CLAUDE.md |
| courier | Pending | Remove `docs/shared/`, update CLAUDE.md |

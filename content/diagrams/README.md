# Source Diagrams

This directory contains source `.drawio` files that are automatically exported to SVG, uploaded to R2, and registered as fragment YAML files.

## Workflow

1. Create or edit a `.drawio` file in this directory
2. Run the sync script: `npx tsx scripts/sync-diagrams.ts`
3. The script:
   - Exports `.drawio` → `.svg` using draw.io CLI
   - Uploads SVG to R2 at `diagrams/{name}.svg`
   - Creates/updates fragment at `content/fragments/diagrams/{name}.yaml`
4. Commit the `.drawio` source and generated fragment YAML
5. SVGs are served via Hanawa API at `/api/diagrams/{id}.svg`

## Storage Architecture

```
.drawio file (git)     →  .svg file (R2)      →  fragment.yaml (git/D1)
source of truth           rendered output        metadata + reference
```

| Location | Content | Versioned |
|----------|---------|-----------|
| `content/diagrams/*.drawio` | Editable source | Git |
| R2 `diagrams/*.svg` | Rendered SVG | R2 (overwritten on sync) |
| `content/fragments/diagrams/*.yaml` | Metadata + R2 reference | Git + D1 |

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/diagrams` | List all diagrams |
| `GET /api/diagrams/{id}.svg` | Fetch SVG from R2 |
| `HEAD /api/diagrams/{id}.svg` | Check if diagram exists |

**Example:**
```bash
# List diagrams
curl https://hanawa.esolia.co.jp/api/diagrams

# Fetch specific diagram
curl https://hanawa.esolia.co.jp/api/diagrams/fiber-path-diagram_1.svg
```

## Naming Convention

- Use kebab-case: `network-topology.drawio`
- The filename (without extension) becomes the fragment ID
- Allowed characters: `a-z`, `A-Z`, `0-9`, `-`, `_`
- Add bilingual titles/captions by editing the generated YAML

## Requirements

**Local development:**
- [draw.io Desktop](https://www.drawio.com/) must be installed
- [wrangler](https://developers.cloudflare.com/workers/wrangler/) for R2 uploads

The draw.io CLI is available at:
- macOS: `/Applications/draw.io.app/Contents/MacOS/draw.io`
- Linux: `drawio` or `/usr/bin/drawio`
- Windows: `C:\Program Files\draw.io\draw.io.exe`

**CI/CD:** Uses Docker image `rlespinasse/drawio-export` + wrangler for R2.

## Script Options

```bash
# Default: export SVGs and upload to R2
npx tsx scripts/sync-diagrams.ts

# Local mode: embed SVGs in fragment (skip R2 upload)
npx tsx scripts/sync-diagrams.ts --local

# Dry run: show what would happen without making changes
npx tsx scripts/sync-diagrams.ts --dry-run
```

## Tips

- Keep diagrams simple and readable at small sizes (for PDF embedding)
- Use consistent colors matching eSolia branding (see `config/branding.yaml`)
- For complex diagrams with embedded images/PDFs, R2 storage handles large files efficiently
- Diagrams are cached at the edge (1 hour browser, 1 day CDN)

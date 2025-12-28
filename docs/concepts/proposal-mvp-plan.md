# Proposal Assembly MVP Plan

Minimum viable path to: Assemble fragments → Generate branded PDF → Share manually

## Current State

✅ Fragments exist (`content/fragments/proposals/*.yaml`)
✅ Sample proposal demonstrates assembly pattern
✅ Pandoc + XeLaTeX available locally
❌ No fragment expansion tool
❌ No branded HTML/PDF template
❌ No simple workflow for non-technical use

## MVP Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROPOSAL MVP WORKFLOW                                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. AUTHOR                    2. ASSEMBLE              3. GENERATE          │
│  ────────                     ────────                 ────────             │
│                                                                              │
│  Claude Desktop ──┐           ┌─────────────┐          ┌─────────────┐      │
│  (draft content)  │           │  assemble   │          │  generate   │      │
│                   ├──────────►│  script     │─────────►│  script     │      │
│  Markdown file ───┤           │             │          │             │      │
│  (with {{fragment}})          │  Expands    │          │  HTML→PDF   │      │
│                   │           │  fragments  │          │  (Puppeteer)│      │
│  Fragment YAML ───┘           └─────────────┘          └──────┬──────┘      │
│                                      │                        │             │
│                                      ▼                        ▼             │
│                               assembled.md              proposal.pdf        │
│                                                                              │
│  4. SHARE                                                                   │
│  ─────                                                                      │
│                                                                              │
│  Manual upload to Courier or email attachment (for now)                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## What We Need to Build

### 1. Fragment Assembler Script
**File:** `scripts/assemble-proposal.ts`

```typescript
// Reads markdown with {{fragment:id lang="xx"}} syntax
// Expands from content/fragments/**/*.yaml
// Outputs complete markdown

deno run scripts/assemble-proposal.ts \
  --input content/proposals/drafts/PROP-CLIENT-Support-202501.md \
  --output content/proposals/assembled/PROP-CLIENT-Support-202501.md \
  --lang en
```

### 2. HTML Template with eSolia Branding
**File:** `templates/proposal/template.html`

- eSolia logo header
- Professional typography (IBM Plex Sans)
- eSolia color scheme (navy, orange, cream)
- Cover page layout
- Page numbers, confidential footer
- Table styling

### 3. PDF Generator Script
**File:** `scripts/generate-pdf.ts`

```typescript
// Converts assembled markdown to styled PDF
// Uses Puppeteer for pixel-perfect output

deno run -A scripts/generate-pdf.ts \
  --input content/proposals/assembled/PROP-CLIENT-Support-202501.md \
  --output output/PROP-CLIENT-Support-202501.pdf \
  --template templates/proposal/template.html
```

### 4. One-Command Wrapper
**File:** `scripts/proposal.ts`

```typescript
// Single command for full workflow

deno run -A scripts/proposal.ts \
  content/proposals/drafts/PROP-CLIENT-Support-202501.md \
  --lang en \
  --open  # Opens PDF when done
```

## Dependencies

| Dependency | Purpose | Install |
|------------|---------|---------|
| **Deno** | Script runtime | Already available |
| **Puppeteer** | PDF generation | `deno add npm:puppeteer` |
| **yaml** | Parse fragments | `deno add jsr:@std/yaml` |
| **marked** | Markdown→HTML | `deno add npm:marked` |

## File Structure

```
codex/
├── scripts/
│   ├── assemble-proposal.ts    # Fragment expansion
│   ├── generate-pdf.ts         # PDF generation
│   ├── proposal.ts             # One-command wrapper
│   └── lib/
│       ├── fragments.ts        # Fragment loading/caching
│       ├── markdown.ts         # Markdown processing
│       └── pdf.ts              # PDF utilities
│
├── templates/
│   └── proposal/
│       ├── template.html       # Main HTML template
│       ├── cover.html          # Cover page partial
│       ├── styles.css          # eSolia branded styles
│       └── assets/
│           ├── esolia-logo.svg
│           └── fonts/          # IBM Plex fonts
│
└── content/
    └── proposals/
        ├── drafts/             # Work in progress
        ├── assembled/          # After fragment expansion
        └── samples/            # Examples
```

## Implementation Order

### Phase 1: Core Scripts (Today)
1. ✅ Create `scripts/lib/fragments.ts` - Load and parse YAML fragments
2. ✅ Create `scripts/assemble-proposal.ts` - Expand fragment references
3. ✅ Create basic HTML template with eSolia styling
4. ✅ Create `scripts/generate-pdf.ts` - Puppeteer PDF generation
5. ✅ Test end-to-end with sample proposal

### Phase 2: Polish (This Week)
- Add cover page generation with client logo support
- Add Japanese font support (Noto Sans JP or IBM Plex Sans JP)
- Add confidential watermark option
- Add `--draft` mode with watermark

### Phase 3: Convenience (Next Week)
- Create `scripts/proposal.ts` wrapper
- Add fragment validation
- Add watch mode for live preview
- Consider simple web UI (optional)

## Immediate Next Steps

1. **Install Puppeteer for Deno:**
   ```bash
   cd /Users/rcogley/dev/codex
   deno add npm:puppeteer
   ```

2. **Create the scripts and templates**

3. **Test with sample proposal:**
   ```bash
   deno run -A scripts/proposal.ts \
     content/proposals/samples/PROP-SAMPLE-MedTech-Support-202501.md \
     --open
   ```

## Future: Hanawa Integration

Once Hanawa CMS is built, these scripts become the backend:

```
Hanawa UI → API → same assemble/generate logic → R2 storage → Courier sharing
```

The MVP scripts will be wrapped as Cloudflare Workers functions.

---

**Decision needed:** Should I proceed with building these scripts now?

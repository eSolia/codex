# Hanawa CMS

Content management system for eSolia, named after [Hanawa Hokiichi](https://en.wikipedia.org/wiki/Hanawa_Hokiichi) (塙保己一, 1746–1821), the blind Japanese scholar who spent 41 years compiling the Gunsho Ruijū — a 670-volume collection of 1,273 classical texts organized by category. Hanawa the CMS serves as a path for content to flow into Codex, eSolia's knowledge base.

**Repository:** `packages/hanawa-cms/`
**Deployment:** hanawa.esolia.co.jp (Cloudflare Pages)

```
┌─────────────────────────────────────────────────────────────────┐
│  CONTENT FLOW                                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Hanawa  ──────────┐                                           │
│  (CMS)             │                                            │
│                    ▼                                            │
│  Other sources ──▶ Codex ◀──── Miko                            │
│                    (KB)        (friendly interface)             │
│                                                                 │
│  "Write it in Hanawa, it goes to Codex, ask Miko to find it"   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Technology Stack

| Component | Technology |
|-----------|------------|
| Framework | SvelteKit (Svelte 5) |
| Database | Cloudflare D1 |
| Storage | Cloudflare R2 |
| Editor | Tiptap (ProseMirror) |
| Styling | Tailwind CSS v4 |
| Auth | Cloudflare Access |

---

## Table of Contents

- [Architecture](#architecture)
- [Security](#security)
- [Editor](#editor)
- [Implementation](#implementation)
- [Usage](#usage)
- [Development](#development)

---

## Architecture

```
packages/hanawa-cms/
├── migrations/                  # D1 database migrations
│   ├── 0001_initial.sql        # Core tables
│   └── 0002_security_columns.sql # Security features
├── src/
│   ├── app.css                 # Tailwind + eSolia branding
│   ├── app.d.ts                # TypeScript declarations
│   ├── app.html                # HTML template
│   ├── hooks.server.ts         # Security middleware
│   ├── lib/
│   │   ├── components/
│   │   │   ├── editor/
│   │   │   │   ├── HanawaEditor.svelte  # Main editor
│   │   │   │   └── EditorToolbar.svelte # Formatting toolbar
│   │   │   └── security/
│   │   │       └── ScreenshotShield.svelte # Deterrence UI
│   │   ├── editor/
│   │   │   ├── editor.ts              # Editor factory
│   │   │   └── extensions/
│   │   │       ├── callout.ts         # Alert blocks
│   │   │       ├── status-badge.ts    # Status markers
│   │   │       ├── privacy-mask.ts    # Redactable content
│   │   │       └── fragment-reference.ts # Fragment embeds
│   │   ├── server/
│   │   │   ├── db.ts            # Database utilities
│   │   │   └── security.ts      # Security controls
│   │   ├── stores/
│   │   │   └── editor.ts        # Editor state
│   │   └── types/
│   │       └── index.ts         # Type definitions
│   └── routes/
│       ├── +layout.svelte       # App shell
│       ├── +page.svelte         # Dashboard
│       ├── sites/               # Site management
│       ├── content/             # Content CRUD
│       │   ├── +page.svelte     # Content list
│       │   ├── new/             # Create content
│       │   └── [id]/            # Edit content
│       ├── fragments/           # Fragment library
│       ├── assets/              # Media management
│       ├── preview/[token]/     # Secure previews
│       └── api/
│           └── audit/           # Security event logging
├── svelte.config.js
├── wrangler.jsonc               # Cloudflare config
└── package.json
```

---

## Security

### Content Sensitivity Levels

Content is classified by sensitivity for appropriate security controls:

| Level | Preview | Watermark | Audit | Encryption |
|-------|---------|-----------|-------|------------|
| **Normal** | Immediate | No | Basic | No |
| **Confidential** | After approval | Yes | Detailed | Yes |
| **Embargoed** | After embargo | Yes | Full + alerts | Yes |

### Security Features

1. **Server Middleware** (`hooks.server.ts`):
   - CSRF protection for API routes
   - Rate limiting for auth endpoints
   - Security headers (X-Frame-Options, CSP, etc.)

2. **Content Security** (`lib/server/security.ts`):
   - Preview token management with expiry and view limits
   - IP allowlist support for sensitive previews
   - Content encryption at rest for confidential/embargoed
   - Comprehensive audit logging

3. **Screenshot Shield** (`ScreenshotShield.svelte`):
   - Visible watermark with viewer identity
   - Keyboard shortcut detection
   - Blur on window/tab unfocus
   - Forensic watermark patterns
   - Session duration tracking

### Security Headers

```typescript
// Applied to all responses
"X-Frame-Options": "DENY"
"X-Content-Type-Options": "nosniff"
"Referrer-Policy": "strict-origin-when-cross-origin"
"Content-Security-Policy": "default-src 'self'; ..."

// Additional for previews
"Cache-Control": "private, no-store"
"X-Robots-Tag": "noindex, nofollow"
```

---

## Editor

### Custom Extensions

| Extension | Purpose | Markdown Syntax |
|-----------|---------|-----------------|
| **Callout** | Alert blocks | `:::warning{title="..."}` |
| **Status Badge** | Inline compliance status | `{status:compliant id="..."}` |
| **Privacy Mask** | Redactable content | `{mask type="pii"}...{/mask}` |
| **Fragment Reference** | Embed reusable content | `{{fragment:path lang="en"}}` |

### Slash Commands

Type `/` at the start of a line:

| Command | Result |
|---------|--------|
| `/text` | Plain paragraph |
| `/heading1-3` | Section headings |
| `/bullet` | Bullet list |
| `/numbered` | Numbered list |
| `/task` | Task list |
| `/quote` | Block quote |
| `/code` | Code block |
| `/divider` | Horizontal rule |
| `/table` | Data table |
| `/info` `/warning` `/danger` `/success` | Callout blocks |
| `/status` | Status badge |
| `/evidence` | Evidence link |
| `/mask` | Privacy mask |
| `/toc` | Table of contents |

### Markdown Examples

#### Callouts

```markdown
:::info{title="Note"}
General information goes here.
:::

:::warning{title="Attention Required"}
This needs review before the deadline.
:::

:::danger
Critical issue — immediate action required.
:::

:::success
All requirements verified and documented.
:::
```

#### Status Badges

```markdown
Control CC6.1 is currently {status:compliant id="SOC2-CC6.1"}.

The encryption requirement is {status:in-progress}.
```

Available statuses: `compliant`, `non-compliant`, `in-progress`, `not-applicable`, `pending-review`

#### Evidence Links

```markdown
See the [SOC 2 Audit Report]{evidence id="ev_abc123" type="pdf"} for details.
```

File types: `pdf`, `image`, `document`, `spreadsheet`, `other`

#### Privacy Masks

```markdown
Client: {mask type="pii"}Acme Corporation{/mask}

Revenue: {mask type="financial"}$1.2M{/mask}
```

Mask types: `pii`, `financial`, `internal`, `technical`, `custom`

#### Table of Contents

```markdown
[[toc]]
```

---

## Implementation

### Database Schema

Key tables in D1:

```sql
-- Sites (multi-tenant)
sites (id, name, slug, domain, status, ...)

-- Content with security
content (
  id, site_id, content_type_id,
  title, title_ja, slug, body, body_ja,
  status, language, sensitivity,
  -- Security columns
  embargo_until, approved_for_preview,
  preview_token, preview_expires, preview_max_views,
  preview_ip_allowlist, ...
)

-- Reusable fragments
fragments (id, name, slug, category, content_en, content_ja, ...)

-- Comprehensive audit
audit_log (id, timestamp, action, actor, ip_address, resource_type, ...)
```

### Key Files

| File | Purpose |
|------|---------|
| `lib/editor/editor.ts` | Editor factory with all extensions |
| `lib/editor/extensions/*.ts` | Custom Tiptap extensions |
| `lib/server/security.ts` | Security controls & encryption |
| `lib/server/db.ts` | Database utilities |
| `hooks.server.ts` | Request middleware |

---

## Usage

### Editor Component (Svelte 5)

```svelte
<script lang="ts">
  import HanawaEditor from '$lib/components/editor/HanawaEditor.svelte';

  let content = $state('');
  let sensitivity = $state<'normal' | 'confidential' | 'embargoed'>('normal');

  function handleChange(html: string) {
    content = html;
  }
</script>

<HanawaEditor
  {content}
  {sensitivity}
  onchange={handleChange}
  onsave={() => console.log('Saved!')}
/>
```

### Security Controls

```typescript
import { createPreviewToken, validatePreviewToken } from '$lib/server/security';

// Generate preview token with constraints
const { token, expires } = await createPreviewToken(
  db, contentId, 'confidential', 'user@example.com',
  { maxViews: 5, ipRestrict: ['1.2.3.4'] }
);

// Validate token on access
const result = await validatePreviewToken(db, token, clientIp);
if (!result.valid) {
  throw error(403, result.reason);
}
```

---

## Development

### Local Setup

```bash
cd packages/hanawa-cms

# Install dependencies
npm install

# Run migrations
npm run db:migrate

# Start dev server (with D1/R2 emulation)
npm run dev
```

### Deploy

```bash
# Deploy to Cloudflare Pages
npm run deploy

# Apply D1 migrations to production
npm run db:migrate:prod
```

### Environment

Configure in `wrangler.jsonc`:
- `DB`: D1 database binding (hanawa-db)
- `CODEX_BUCKET`: R2 bucket for published content

---

## Dependencies

```json
{
  "dependencies": {
    "@tiptap/core": "^2.10.4",
    "@tiptap/starter-kit": "^2.10.4",
    "@tiptap/extension-link": "^2.10.4",
    "@tiptap/extension-image": "^2.10.4",
    "@tiptap/extension-table": "^2.10.4",
    "@tiptap/extension-task-list": "^2.10.4",
    "@tiptap/extension-placeholder": "^2.10.4",
    "@tiptap/extension-highlight": "^2.10.4",
    "@tiptap/extension-underline": "^2.10.4",
    "zod": "^3.24.1",
    "date-fns": "^4.1.0"
  },
  "devDependencies": {
    "@sveltejs/adapter-cloudflare": "^4.8.0",
    "@sveltejs/kit": "^2.15.0",
    "svelte": "^5.0.0",
    "tailwindcss": "^4.0.0",
    "wrangler": "^3.99.0"
  }
}
```

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |
| `Ctrl+Shift+S` | Cycle status badge |
| `Ctrl+Shift+C` | Toggle callout |
| `Ctrl+Shift+P` | Toggle privacy mask |
| `Ctrl+Z` | Undo |
| `Ctrl+Shift+Z` | Redo |
| `/` | Open slash command menu |

---

## Related Systems

```
┌─────────────────────────────────────────────────────────────────┐
│  eSolia APPLICATION ECOSYSTEM                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Hanawa     →  CMS / Content editing                           │
│       ↓                                                         │
│  Codex      →  Knowledge base (structured storage)             │
│       ↓                                                         │
│  Miko       →  Friendly interface to find content              │
│                                                                 │
│  Pulse      →  Compliance tracker (separate system)            │
│  Periodic   →  DNS monitoring (separate system)                │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

*Named after Hanawa Hokiichi (塙保己一, 1746–1821), the blind Japanese scholar who compiled 1,273 classical texts into the Gunsho Ruijū over 41 years.*

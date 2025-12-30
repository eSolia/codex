# Shared PDF Generation Worker

A centralized Cloudflare Worker for PDF/screenshot generation that all eSolia apps can use.

## Why a Shared Worker?

| Without | With Shared Worker |
|---------|-------------------|
| Each app has PDF generation code | One codebase, one place to fix |
| Each app needs Browser Rendering token | One token, managed centrally |
| Inconsistent output across apps | Consistent branding/styling |
| Duplicate dependencies | DRY - shared templates |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SHARED PDF WORKER                                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  CLIENTS                           WORKER                    RENDERING      │
│  ───────                           ──────                    ─────────      │
│                                                                              │
│  Codex (proposals) ────┐           ┌───────────────┐                        │
│                        │           │               │         ┌─────────┐    │
│  Chocho (certs) ───────┼──────────►│   pdf.esolia  │────────►│ Browser │    │
│                        │   POST    │   .workers    │         │Rendering│    │
│  Pulse (reports) ──────┤   /pdf    │   .dev        │◄────────│   API   │    │
│                        │   /png    │               │         └─────────┘    │
│  Periodic (exports) ───┘           └───────┬───────┘                        │
│                                            │                                │
│                                            ▼                                │
│                                    ┌───────────────┐                        │
│                                    │      R2       │                        │
│                                    │ (templates,   │                        │
│                                    │  branding)    │                        │
│                                    └───────────────┘                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## API Design

### Endpoints

```
POST /pdf          # HTML → PDF
POST /screenshot   # HTML → PNG
POST /proposal     # Proposal markdown → branded PDF (future)
POST /certificate  # Certificate data → branded PNG/PDF (future)
GET  /health       # Health check
```

### PDF Generation

```typescript
// POST /pdf
interface PdfRequest {
  html: string;                    // Raw HTML to render
  options?: {
    format?: "A4" | "Letter";
    landscape?: boolean;
    margin?: { top: string; right: string; bottom: string; left: string };
    headerTemplate?: string;
    footerTemplate?: string;
    displayHeaderFooter?: boolean;
  };
  // Optional: apply eSolia template
  template?: "proposal" | "report" | "certificate" | "plain";
}

// Response: PDF binary with Content-Type: application/pdf
```

### Screenshot Generation

```typescript
// POST /screenshot
interface ScreenshotRequest {
  html: string;
  options?: {
    width?: number;
    height?: number;
    scale?: number;           // deviceScaleFactor (default 2 for retina)
    fullPage?: boolean;
  };
}

// Response: PNG binary with Content-Type: image/png
```

## Authentication

Since this is internal, use a simple shared secret:

```typescript
// Worker validates incoming requests
const ALLOWED_ORIGINS = [
  "https://codex.esolia.co.jp",
  "https://chocho.esolia.co.jp",
  "https://pulse.esolia.co.jp",
  "https://periodic.esolia.co.jp",
  "http://localhost:*",
];

// Plus API key for non-browser clients
const API_KEY = env.PDF_API_KEY;

function authenticate(request: Request, env: Env): boolean {
  // Check origin for browser requests
  const origin = request.headers.get("Origin");
  if (origin && ALLOWED_ORIGINS.some(o => matchOrigin(origin, o))) {
    return true;
  }

  // Check API key for server-to-server
  const apiKey = request.headers.get("X-API-Key");
  return apiKey === env.PDF_API_KEY;
}
```

## Worker Implementation

```typescript
// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";

const app = new Hono<{ Bindings: Env }>();

// CORS for browser clients
app.use("/*", cors({
  origin: (origin) => ALLOWED_ORIGINS.some(o => matchOrigin(origin, o)) ? origin : null,
}));

// Auth middleware
app.use("/*", async (c, next) => {
  if (!authenticate(c.req.raw, c.env)) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  await next();
});

// PDF generation
app.post("/pdf", async (c) => {
  const body = await c.req.json<PdfRequest>();

  // Apply template if specified
  let html = body.html;
  if (body.template && body.template !== "plain") {
    html = await applyTemplate(c.env, body.template, html);
  }

  // Call Browser Rendering API
  const pdf = await generatePdf(c.env, html, body.options);

  return new Response(pdf, {
    headers: { "Content-Type": "application/pdf" },
  });
});

// Screenshot generation
app.post("/screenshot", async (c) => {
  const body = await c.req.json<ScreenshotRequest>();

  const png = await generateScreenshot(c.env, body.html, body.options);

  return new Response(png, {
    headers: { "Content-Type": "image/png" },
  });
});

// Health check
app.get("/health", (c) => c.json({ status: "ok", version: "1.0.0" }));

export default app;

// Browser Rendering API calls
async function generatePdf(env: Env, html: string, options?: PdfOptions): Promise<ArrayBuffer> {
  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/browser-rendering/pdf`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.CF_API_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        html,
        viewport: { width: options?.landscape ? 1123 : 794, height: options?.landscape ? 794 : 1123 },
        pdfOptions: {
          format: options?.format || "A4",
          landscape: options?.landscape || false,
          margin: options?.margin || { top: "20mm", right: "20mm", bottom: "20mm", left: "20mm" },
          printBackground: true,
          displayHeaderFooter: options?.displayHeaderFooter || false,
          headerTemplate: options?.headerTemplate || "<div></div>",
          footerTemplate: options?.footerTemplate || "<div></div>",
        },
      }),
    }
  );

  if (!response.ok) {
    throw new Error(`Browser Rendering API error: ${response.status}`);
  }

  return response.arrayBuffer();
}
```

## Templates (Stored in R2)

```
R2: pdf-templates/
├── styles/
│   ├── esolia-base.css         # Shared styles
│   ├── proposal.css            # Proposal-specific
│   ├── certificate.css         # Certificate-specific
│   └── report.css              # Report-specific
│
├── templates/
│   ├── proposal.html           # Proposal wrapper
│   ├── certificate.html        # Certificate wrapper
│   └── report.html             # Report wrapper
│
└── assets/
    ├── esolia-logo.svg
    ├── fonts/
    └── ...
```

## Client Usage

### From Codex (Deno script)

```typescript
// scripts/lib/pdf.ts - updated to use shared worker
const PDF_WORKER_URL = "https://pdf.esolia.workers.dev";
const PDF_API_KEY = Deno.env.get("PDF_API_KEY");

export async function generatePdf(html: string, options?: PdfOptions): Promise<Uint8Array> {
  const response = await fetch(`${PDF_WORKER_URL}/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": PDF_API_KEY!,
    },
    body: JSON.stringify({ html, options, template: "proposal" }),
  });

  if (!response.ok) {
    throw new Error(`PDF generation failed: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
```

### From Chocho (SvelteKit)

```typescript
// src/lib/server/certificate.ts - updated
const PDF_WORKER_URL = env.PDF_WORKER_URL || "https://pdf.esolia.workers.dev";

export async function generateCertificatePng(svgHtml: string): Promise<Uint8Array> {
  const response = await fetch(`${PDF_WORKER_URL}/screenshot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.PDF_API_KEY,
    },
    body: JSON.stringify({
      html: svgHtml,
      options: { width: 1123, height: 794, scale: 2 },
    }),
  });

  return new Uint8Array(await response.arrayBuffer());
}
```

## Deployment

### wrangler.toml

```toml
name = "pdf-worker"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[vars]
# Non-sensitive config

# Secrets (set via wrangler secret put)
# CF_ACCOUNT_ID
# CF_API_TOKEN (with Browser Rendering permission)
# PDF_API_KEY (shared secret for client auth)

[[r2_buckets]]
binding = "TEMPLATES"
bucket_name = "pdf-templates"
```

### Secrets Setup

```bash
cd packages/pdf-worker
wrangler secret put CF_ACCOUNT_ID
wrangler secret put CF_API_TOKEN    # Token WITH Browser Rendering permission
wrangler secret put PDF_API_KEY     # Generate: openssl rand -hex 32
```

## Migration Path

1. **Create the worker** in `codex/packages/pdf-worker/`
2. **Deploy** to `pdf.esolia.workers.dev`
3. **Update Codex scripts** to use the worker API
4. **Update Chocho** to use the worker API (remove direct API calls)
5. **Share PDF_API_KEY** across apps via their `.dev.vars` / secrets

## Benefits

| Benefit | Description |
|---------|-------------|
| **DRY** | One PDF codebase for all apps |
| **One Token** | Browser Rendering token managed in one place |
| **Consistent Output** | Shared templates = consistent branding |
| **Easier Updates** | Fix/improve in one place, all apps benefit |
| **Cost Visibility** | All PDF generation in one Worker's analytics |
| **Caching Potential** | Could cache common PDFs in R2 |

## Future Enhancements

1. **High-level endpoints** — `/proposal`, `/certificate`, `/report` that accept structured data (not HTML)
2. **Template versioning** — Support v1, v2 templates for backward compatibility
3. **Batch generation** — Generate multiple PDFs in one request
4. **Webhook delivery** — Generate async, deliver via webhook when done
5. **R2 caching** — Cache generated PDFs by content hash

---

*Decision needed:* Should I create this worker now, or should we first fix the token issue for local development?

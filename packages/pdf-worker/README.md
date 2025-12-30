# PDF Worker

Shared PDF and screenshot generation service for eSolia applications.

## Overview

This Cloudflare Worker provides a centralized API for generating PDFs and screenshots from HTML, using the [Browser Rendering API](https://developers.cloudflare.com/browser-rendering/).

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/pdf` | POST | Generate PDF from HTML |
| `/screenshot` | POST | Generate screenshot from HTML |
| `/health` | GET | Health check |

## Usage

### Generate PDF

```bash
curl -X POST https://pdf.esolia.co.jp/pdf \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"html": "<html><body><h1>Hello</h1></body></html>"}' \
  --output document.pdf
```

### Generate Screenshot

```bash
curl -X POST https://pdf.esolia.co.jp/screenshot \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{"html": "<html><body><h1>Hello</h1></body></html>", "options": {"width": 1200, "height": 800}}' \
  --output screenshot.png
```

### From TypeScript/JavaScript

```typescript
const response = await fetch("https://pdf.esolia.co.jp/pdf", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-API-Key": process.env.PDF_API_KEY,
  },
  body: JSON.stringify({
    html: "<html><body><h1>Hello</h1></body></html>",
    options: {
      format: "A4",
      margin: { top: "20mm", bottom: "20mm", left: "20mm", right: "20mm" },
    },
  }),
});

const pdfBuffer = await response.arrayBuffer();
```

## API Reference

### POST /pdf

Generate a PDF from HTML.

**Request Body:**

```typescript
{
  html: string;              // Required: HTML to render
  options?: {
    format?: "A4" | "Letter";
    landscape?: boolean;
    margin?: {
      top?: string;
      right?: string;
      bottom?: string;
      left?: string;
    };
    displayHeaderFooter?: boolean;
    headerTemplate?: string;
    footerTemplate?: string;
    printBackground?: boolean;
    scale?: number;          // 0.1 to 2
  };
}
```

**Response:** PDF binary with `Content-Type: application/pdf`

### POST /screenshot

Generate a screenshot from HTML.

**Request Body:**

```typescript
{
  html: string;              // Required: HTML to render
  options?: {
    width?: number;          // Viewport width (default: 1200)
    height?: number;         // Viewport height (default: 800)
    scale?: number;          // Device scale factor (default: 2)
    fullPage?: boolean;      // Capture full page
    type?: "png" | "jpeg" | "webp";
    quality?: number;        // For jpeg/webp (0-100)
  };
}
```

**Response:** Image binary with appropriate `Content-Type`

## Authentication

The worker accepts two authentication methods:

1. **Origin-based** (browser requests): Requests from whitelisted origins are allowed
2. **API Key** (server requests): Include `X-API-Key` header

### Whitelisted Origins

- `https://codex.esolia.co.jp`
- `https://hanawa.esolia.co.jp`
- `https://chocho.esolia.co.jp`
- `https://pulse.esolia.co.jp`
- `https://periodic.esolia.co.jp`
- `https://nexus.esolia.co.jp`
- `https://courier.esolia.co.jp`
- `https://*.pages.dev` (staging)
- `http://localhost:*` (development)

## Development

### Setup

```bash
cd packages/pdf-worker
npm install
cp .dev.vars.example .dev.vars
# Edit .dev.vars with your credentials
```

### Run Locally

```bash
npm run dev
```

### Deploy

```bash
# Set secrets first
wrangler secret put CLOUDFLARE_ACCOUNT_ID
wrangler secret put CLOUDFLARE_PDF_RENDER_TOKEN
wrangler secret put PDF_API_KEY

# Deploy
npm run deploy
```

## Configuration

### Required Secrets

| Secret | Description |
|--------|-------------|
| `CLOUDFLARE_ACCOUNT_ID` | Your Cloudflare account ID |
| `CLOUDFLARE_PDF_RENDER_TOKEN` | API token with Browser Rendering permission |
| `PDF_API_KEY` | Shared secret for client authentication |

### Creating the API Token

1. Go to [Cloudflare API Tokens](https://dash.cloudflare.com/profile/api-tokens)
2. Create a token with permission: **Account > Cloudflare Browser Rendering > Edit**
3. Copy the token to `CLOUDFLARE_PDF_RENDER_TOKEN` secret

### Generating PDF_API_KEY

```bash
openssl rand -hex 32
```

Share this key with all client applications that need to call the PDF worker.

## Client Integration

### Codex Scripts

```typescript
// scripts/lib/pdf.ts
const PDF_WORKER_URL = Deno.env.get("PDF_WORKER_URL") || "https://pdf.esolia.co.jp";
const PDF_API_KEY = Deno.env.get("PDF_API_KEY");

export async function generatePdf(html: string): Promise<Uint8Array> {
  const response = await fetch(`${PDF_WORKER_URL}/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": PDF_API_KEY!,
    },
    body: JSON.stringify({ html }),
  });

  if (!response.ok) {
    throw new Error(`PDF generation failed: ${response.status}`);
  }

  return new Uint8Array(await response.arrayBuffer());
}
```

### SvelteKit Apps

```typescript
// src/lib/server/pdf.ts
import { env } from "$env/dynamic/private";

export async function generatePdf(html: string): Promise<ArrayBuffer> {
  const response = await fetch(`${env.PDF_WORKER_URL}/pdf`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": env.PDF_API_KEY,
    },
    body: JSON.stringify({ html }),
  });

  if (!response.ok) {
    throw new Error(`PDF generation failed: ${response.status}`);
  }

  return response.arrayBuffer();
}
```

## Limits

- Maximum HTML size: 5MB
- Browser Rendering API has its own limits (see [Cloudflare docs](https://developers.cloudflare.com/browser-rendering/platform/limits/))

## Monitoring

View logs with:

```bash
npm run tail
```

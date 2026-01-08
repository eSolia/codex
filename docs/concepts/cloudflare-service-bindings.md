# Cloudflare Service Bindings for Worker-to-Worker Communication

This document explains how we use Cloudflare Service Bindings for internal communication between Hanawa CMS and the PDF Worker, and the security considerations involved.

## Overview

Service Bindings allow Cloudflare Workers to call other Workers directly over Cloudflare's internal network, bypassing the public internet entirely.

```
┌─────────────────┐     Service Binding      ┌──────────────┐
│  Hanawa CMS     │ ───────────────────────► │  PDF Worker  │
│  (Pages)        │   (CF internal network)  │  (Worker)    │
└─────────────────┘                          └──────────────┘
        │                                            │
        │  No WAF ✓                                  │
        │  No Bot Fight ✓                            │
        │  No API key needed ✓                       │
        │  No public internet ✓                      │
        └────────────────────────────────────────────┘
```

## Why Service Bindings?

### The Problem

When Hanawa CMS tried to call the PDF Worker via its public URL (`https://pdf.esolia.co.jp/pdf`), requests were blocked by Cloudflare's Bot Fight Mode. The WAF saw server-to-server requests without browser characteristics and returned a JavaScript challenge page.

Options considered:

| Approach | Drawbacks |
|----------|-----------|
| Disable Bot Fight Mode | Exposes PDF worker to abuse |
| WAF exception rule | Complex to maintain, still uses public internet |
| API key over HTTPS | Secret management, still subject to WAF |
| **Service Binding** | ✅ Clean, secure, recommended by Cloudflare |

### Benefits of Service Bindings

1. **No WAF/Bot interference** - Internal traffic bypasses all edge security
2. **No secrets to manage** - The binding itself is the authentication
3. **Lower latency** - No DNS lookup, TLS handshake, or internet routing
4. **No egress costs** - Internal communication is free
5. **Explicit trust** - Only workers you configure can communicate

## Implementation

### 1. Declare the Binding (Hanawa)

In `packages/hanawa-cms/wrangler.jsonc`:

```jsonc
{
  "services": [
    {
      "binding": "PDF_SERVICE",
      "service": "pdf-worker"
    }
  ]
}
```

### 2. Add TypeScript Types (Hanawa)

In `src/app.d.ts`:

```typescript
interface Platform {
  env: {
    // ... other bindings
    PDF_SERVICE?: Fetcher;  // Service binding to PDF Worker
  };
}
```

### 3. Use the Binding (Hanawa)

In `src/routes/documents/[id]/+page.server.ts`:

```typescript
// Get the service binding
const pdfService = platform.env.PDF_SERVICE;

if (!pdfService) {
  return fail(500, { error: 'PDF service not configured' });
}

// Call via service binding (URL is arbitrary, just needs valid format)
const pdfResponse = await pdfService.fetch('https://pdf-worker/pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ html, options }),
});
```

### 4. Accept Service Binding Requests (PDF Worker)

In `packages/pdf-worker/src/auth.ts`:

```typescript
export async function authMiddleware(c: Context, next: Next) {
  const origin = c.req.header("Origin");
  const cfConnectingIp = c.req.header("CF-Connecting-IP");

  // Service binding requests have no Origin and no CF-Connecting-IP
  // because they don't traverse the public internet
  if (!origin && !cfConnectingIp) {
    console.log("Auth: Service binding request (internal)");
    await next();
    return;
  }

  // ... other auth methods for public requests
}
```

## Security Analysis

### Trust Model

Service bindings operate on **explicit declaration trust**:

- Only workers you explicitly bind in `wrangler.jsonc` can call each other
- The binding must be in the same Cloudflare account
- Cloudflare enforces this at the platform level

### Risk Assessment

| Concern | Risk Level | Analysis |
|---------|------------|----------|
| Bypasses WAF/rate limiting | Medium | PDF worker has its own input validation (5MB HTML limit). Rate limiting could be added at application level if needed. |
| No API key rotation needed | ✅ Positive | One less secret to manage and potentially leak. |
| Compromised Hanawa = PDF access | Low | Attacker needs Hanawa access first (protected by CF Access). PDF worker only generates PDFs - limited blast radius. |
| Service binding signature spoofable? | Very Low | `CF-Connecting-IP` is set by Cloudflare's edge, not by clients. Absence indicates internal traffic. |
| Audit trail | Low | Service binding requests appear in worker logs but not WAF analytics. |

### How We Detect Service Binding Requests

Service binding requests have a distinct signature:

```typescript
// External request (public internet):
// - Has CF-Connecting-IP (set by Cloudflare edge)
// - May have Origin header (browser requests)

// Service binding request (internal):
// - No CF-Connecting-IP (doesn't traverse edge)
// - No Origin header (not a browser)
```

This is reliable because:
1. `CF-Connecting-IP` is injected by Cloudflare's edge infrastructure
2. External clients cannot omit or spoof this header
3. Only internal Cloudflare network traffic lacks this header

### Optional: Defense in Depth

For additional security, you could add a shared internal header:

```typescript
// Hanawa sends
headers: { 'X-Internal-Service': 'hanawa-cms' }

// PDF worker validates
if (!origin && !cfConnectingIp) {
  const internalService = c.req.header('X-Internal-Service');
  if (internalService !== 'hanawa-cms') {
    return c.json({ error: 'Invalid internal service' }, 401);
  }
  await next();
}
```

This isn't strictly necessary (the binding itself is authentication), but adds a layer if you want to distinguish between multiple internal callers.

## Comparison to Alternatives

| Method | Security | Complexity | Latency | Cost |
|--------|----------|------------|---------|------|
| Public URL + API Key | Medium (key can leak) | Low | Higher | Egress fees |
| Public URL + mTLS | High | High | Higher | Egress fees |
| Service Binding | High | Low | Lowest | Free |
| Durable Objects RPC | High | Medium | Low | Compute fees |

## Limitations

1. **Same account only** - Both workers must be in the same Cloudflare account
2. **Coupling** - Changing the PDF worker's name requires updating Hanawa's binding
3. **Local development** - Service bindings don't work in local dev; need fallback to public URL or mocks
4. **No edge metrics** - Traffic doesn't appear in WAF/Analytics dashboards

## Local Development Workaround

For local development, you can add a fallback:

```typescript
const pdfService = platform.env.PDF_SERVICE;

if (pdfService) {
  // Production: use service binding
  response = await pdfService.fetch('https://pdf-worker/pdf', options);
} else {
  // Local dev: fall back to public URL with API key
  response = await fetch('https://pdf.esolia.co.jp/pdf', {
    ...options,
    headers: { ...options.headers, 'X-API-Key': env.PDF_API_KEY }
  });
}
```

## References

- [Cloudflare Service Bindings Documentation](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/)
- [Cloudflare Workers Security Model](https://developers.cloudflare.com/workers/learning/security-model/)
- [Service Bindings vs Fetch](https://developers.cloudflare.com/workers/runtime-apis/bindings/service-bindings/#differences-from-external-fetch)

---

*Document created: 2025-01-08*
*Related: Hanawa CMS, PDF Worker*

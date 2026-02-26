# Cloudflare AI Gateway Reference

> eSolia INTERNAL — Not for distribution outside eSolia

A reference for using Cloudflare AI Gateway as a proxy layer for AI provider API calls. AI Gateway adds observability, caching, rate limiting, and fallback routing without changing how you call providers — and without double-charging.

---

## How billing works

AI Gateway operates in two mutually exclusive billing modes:

| Mode                | Who pays the provider                                  | Gateway cost           | When to use                                           |
| ------------------- | ------------------------------------------------------ | ---------------------- | ----------------------------------------------------- |
| **BYO Key**         | You pay the provider directly via your own API key     | Free                   | Default for us — keep existing provider relationships |
| **Unified Billing** | Cloudflare pays on your behalf from pre-loaded credits | Cloudflare credit cost | Consolidating billing across many providers           |

With BYO Key, there is **no additional charge from Cloudflare**. Gateway proxying, logging, caching, and rate limiting are included at no extra cost. When caching serves a repeated request, you **save money** because the request never reaches the provider.

---

## Gateway URL structure

All requests route through a gateway-specific base URL:

```
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/{provider}
```

Replace `{provider}` with the target: `openai`, `anthropic`, `workers-ai`, `azure-openai`, `aws-bedrock`, `google-ai-studio`, `groq`, `huggingface`, `perplexity-ai`, `replicate`, `cerebras`, `deepinfra`, `mistral`, `cohere`, or a custom provider slug.

---

## Calling providers

### Option 1: OpenAI-compatible endpoint (recommended)

The `/compat` endpoint accepts OpenAI SDK format and routes to any supported provider based on the `model` parameter. This is the simplest approach and lets you switch providers without changing code structure.

**Endpoint:**

```
https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/compat/chat/completions
```

**With the OpenAI SDK (works for any provider):**

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: 'YOUR_PROVIDER_API_KEY',
  baseURL: 'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/compat'
});

// Call Anthropic through the OpenAI-compatible endpoint
const response = await client.chat.completions.create({
  model: 'anthropic/claude-sonnet-4-20250514',
  messages: [{ role: 'user', content: 'Summarize this report.' }]
});

// Switch to Google by changing the model string
const response2 = await client.chat.completions.create({
  model: 'google-ai-studio/gemini-2.0-flash',
  messages: [{ role: 'user', content: 'Summarize this report.' }]
});
```

**With fetch:**

```typescript
const response = await fetch(
  'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/compat/chat/completions',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer YOUR_PROVIDER_API_KEY'
    },
    body: JSON.stringify({
      model: 'openai/gpt-4.1',
      messages: [{ role: 'user', content: 'Hello' }]
    })
  }
);
```

### Option 2: Provider-native endpoints

Route to a specific provider using their native API format. Useful when you need provider-specific parameters.

**Anthropic:**

```typescript
const response = await fetch(
  'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/anthropic/v1/messages',
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: 'Hello' }]
    })
  }
);
```

**Anthropic SDK (`@anthropic-ai/sdk`):**

The Anthropic SDK supports `baseURL` override, so you can route through Gateway without changing any call-site code:

```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
  baseURL: 'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/anthropic'
});

// All calls now route through AI Gateway — no other changes needed
const response = await client.messages.create({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello' }]
});
```

When `baseURL` is omitted, the SDK calls `api.anthropic.com` directly. This makes the Gateway opt-in: set `AI_GATEWAY_URL` in production, leave it unset locally.

**OpenAI:**

```typescript
import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: OPENAI_API_KEY,
  baseURL: 'https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}/openai'
});

const response = await client.chat.completions.create({
  model: 'gpt-4.1',
  messages: [{ role: 'user', content: 'Hello' }]
});
```

### Option 3: Workers AI binding (for Cloudflare-hosted models)

When calling Workers AI models from a Cloudflare Worker, use the AI binding with a gateway configuration. No external API key needed.

**wrangler.jsonc:**

```jsonc
{
  "ai": {
    "binding": "AI"
  }
}
```

**Worker code:**

```typescript
const response = await env.AI.run(
  '@cf/meta/llama-3.1-8b-instruct',
  { prompt: 'What is SPF in email security?' },
  {
    gateway: {
      id: '{gateway_name}',
      skipCache: false,
      cacheTtl: 3600
    }
  }
);
```

### Option 4: Workers AI Gateway binding methods

For more control from Workers, use the `run` method on the AI Gateway binding directly.

**wrangler.jsonc:**

```jsonc
{
  "ai": {
    "binding": "AI"
  }
}
```

**Worker code:**

```typescript
const gwResponse = await env.AI.gateway('{gateway_name}').run({
  provider: 'anthropic',
  endpoint: 'v1/messages',
  headers: {
    'x-api-key': env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json'
  },
  query: {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    messages: [{ role: 'user', content: 'Hello' }]
  }
});
```

This approach also exposes `patchLog` (to send feedback/metadata) and `getLog` (to retrieve log details).

---

## Caching

Caching serves identical requests from Cloudflare's edge instead of hitting the provider. This saves cost and reduces latency.

**Configure via request headers (per-request control):**

| Header              | Values                 | Purpose                        |
| ------------------- | ---------------------- | ------------------------------ |
| `cf-aig-cache-ttl`  | Seconds (e.g., `3600`) | How long to cache the response |
| `cf-aig-skip-cache` | `true` / `false`       | Bypass cache for this request  |

**Example:**

```typescript
const response = await fetch(gatewayUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'cf-aig-cache-ttl': '3600'
  },
  body: JSON.stringify({ model: 'gpt-4.1', messages })
});
```

**Via Workers AI binding:**

```typescript
const response = await env.AI.run(model, input, {
  gateway: {
    id: 'my-gateway',
    skipCache: false,
    cacheTtl: 3600
  }
});
```

**Default caching** can also be enabled in the dashboard or via API at the gateway level so all requests are cached without per-request headers.

**Limits:** Cacheable request size is 25 MB. Maximum TTL is 1 month.

---

## Rate limiting

Control request volume per gateway. Configure in the dashboard under AI > AI Gateway > Settings > Rate-limiting, or via API.

Parameters: request count, time window (e.g., 100 requests per 60 seconds), and strategy (fixed or sliding window). Requests exceeding the limit receive a `429 Too Many Requests` response.

---

## BYO Key with Secrets Store

Instead of passing API keys in every request header, store them centrally in Cloudflare Secrets Store and reference them in Gateway configuration.

**Store a key via Wrangler:**

```bash
wrangler secrets-store secret create \
  --store-id <STORE_ID> \
  --name anthropic-api-key \
  --scope ai_gateway
```

**Add via dashboard:** AI Gateway > your gateway > Provider Keys > Add.

Once stored, Gateway injects the key at runtime — no key in request headers needed.

---

## Fallback and retry

Configure fallback providers so if one fails, Gateway automatically tries the next. Configure retries for transient errors.

**Example universal request with fallback (REST API):**

```typescript
const response = await fetch(`https://gateway.ai.cloudflare.com/v1/{account_id}/{gateway_name}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([
    {
      provider: 'openai',
      endpoint: 'v1/chat/completions',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      query: {
        model: 'gpt-4.1',
        messages: [{ role: 'user', content: 'Hello' }]
      }
    },
    {
      provider: 'anthropic',
      endpoint: 'v1/messages',
      headers: {
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01'
      },
      query: {
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        messages: [{ role: 'user', content: 'Hello' }]
      }
    }
  ])
});
```

Gateway tries OpenAI first. If it fails, it falls back to Anthropic.

---

## Authenticated Gateway

When enabled, Authenticated Gateway rejects any request that doesn't include a valid authorization header. This prevents unauthorized callers from hitting your gateway URL directly (the URL is public in `wrangler.jsonc` vars).

**Enable in dashboard:** AI > AI Gateway > [gateway] > Settings > Authenticated Gateway → On.

**Request header:**

```
cf-aig-authorization: Bearer <CF_API_TOKEN>
```

**Token requirements:** The Cloudflare API token must have **AI Gateway: Run** permission. Create a dedicated token scoped to this single permission — don't reuse broad-access tokens.

**SDK integration:** Pass the header via the SDK's `defaultHeaders` option (see Implementation pattern below). When `AI_GATEWAY_TOKEN` is unset (local dev), the header is omitted and calls go direct to the provider.

---

## Observability

Every request through Gateway creates a log entry with: timestamp, status, model, provider, token count, cost estimate, and duration. Cost estimates appear per-request and aggregate in the dashboard — this is the primary way to track AI spend per app.

**Dashboard:** AI > AI Gateway > Logs. Filter by status, provider, model, date range.

**Real-time logs:** Available via WebSocket connection (max 10 concurrent). Useful during development to verify requests are routing through Gateway.

**From Workers (binding methods):**

```typescript
const log = await env.AI.gateway('my-gateway').getLog(logId);
```

**Send feedback on a log:**

```typescript
await env.AI.gateway('my-gateway').patchLog(logId, {
  feedback: 1, // 1 = positive, -1 = negative
  metadata: { userId: 'abc', context: 'quiz-answer' }
});
```

**Structured logging** in your Worker helps correlate Gateway logs with application events. Use JSON format for `console.log` calls to take advantage of Workers Logs query builder.

---

## Limits

| Feature                     | Limit                     |
| --------------------------- | ------------------------- |
| Gateways (free plan)        | 10 per account            |
| Gateways (paid plan)        | 20 per account            |
| Persistent logs             | 10M per gateway           |
| Cacheable request size      | 25 MB                     |
| Cache TTL max               | 1 month                   |
| Custom metadata per request | 5 entries                 |
| Real-time logs              | 10 concurrent connections |

---

## When to use AI Gateway

Use it when your application makes AI inference calls to external providers and you want any of: cost visibility, caching, rate limiting, fallback routing, or audit logging.

Skip it for pure Workers AI usage where you don't need cross-provider routing or advanced observability beyond what Workers Logs provides natively.

For our products: wire it up for any path that calls Anthropic, OpenAI, or other external providers. The retrieval-first pattern (AI Search `.search()`) doesn't go through Gateway since it's a Cloudflare-native call. The expensive `.aiSearch()` fallback path benefits most from Gateway's caching and cost tracking.

---

## eSolia gateway strategy

We use **one AI Gateway per app** so each product gets isolated logs, cost tracking, rate limits, and caching rules.

| App        | Gateway name | URL pattern                                | Status                        |
| ---------- | ------------ | ------------------------------------------ | ----------------------------- |
| Pulse      | `pulse`      | `.../v1/{account_id}/pulse/anthropic`      | Live — authenticated, BYO key |
| Periodic   | `periodic`   | `.../v1/{account_id}/periodic/anthropic`   | Live — authenticated, BYO key |
| Nexus      | `nexus`      | `.../v1/{account_id}/nexus/anthropic`      | Planned                       |
| eSolia Web | `esolia-web` | `.../v1/{account_id}/esolia-web/anthropic` | Planned                       |

**Convention:** the gateway name matches the app's `name` field in `wrangler.jsonc` (minus the `esolia-` prefix where applicable).

### Implementation pattern

Each app stores the gateway URL and auth token in environment variables with graceful fallback.

#### With the Anthropic SDK

```typescript
// In the app's AI client factory (e.g. $lib/server/ai.ts)
export function getClient(env: {
  ANTHROPIC_API_KEY: string;
  AI_GATEWAY_URL?: string;
  AI_GATEWAY_TOKEN?: string;
}) {
  return new Anthropic({
    apiKey: env.ANTHROPIC_API_KEY,
    ...(env.AI_GATEWAY_URL && { baseURL: env.AI_GATEWAY_URL }),
    ...(env.AI_GATEWAY_TOKEN && {
      defaultHeaders: { 'cf-aig-authorization': `Bearer ${env.AI_GATEWAY_TOKEN}` }
    })
  });
}
```

#### With raw fetch (no SDK)

For apps that use `fetch()` directly (e.g. Periodic), create a helper module:

```typescript
// $lib/server/ai.ts
export interface AiEnv {
  ANTHROPIC_API_KEY: string;
  AI_GATEWAY_URL?: string;
  AI_GATEWAY_TOKEN?: string;
}

export function getAnthropicBaseUrl(env: AiEnv): string {
  return env.AI_GATEWAY_URL || 'https://api.anthropic.com';
}

export function getAnthropicHeaders(
  env: AiEnv,
  options?: { cacheTtl?: number }
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-api-key': env.ANTHROPIC_API_KEY,
    'anthropic-version': '2023-06-01'
  };
  if (env.AI_GATEWAY_URL) {
    if (env.AI_GATEWAY_TOKEN) {
      headers['cf-aig-authorization'] = `Bearer ${env.AI_GATEWAY_TOKEN}`;
    }
    if (options?.cacheTtl) {
      headers['cf-aig-cache-ttl'] = String(options.cacheTtl);
    }
  }
  return headers;
}

// Usage:
const response = await fetch(`${getAnthropicBaseUrl(aiEnv)}/v1/messages`, {
  method: 'POST',
  headers: getAnthropicHeaders(aiEnv, { cacheTtl: 3600 }),
  body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1024, messages })
});
```

#### Environment variable setup

- **Production:** `AI_GATEWAY_URL` in `wrangler.jsonc` vars (public URL), `AI_GATEWAY_TOKEN` via `wrangler secret put` (CF API token with AI Gateway: Run permission)
- **Local dev:** Leave both unset — calls go directly to `api.anthropic.com`
- **No code change required** to toggle between direct and proxied modes

### Safe response extraction

The Anthropic SDK returns `content` as an array of content blocks. Always validate the first block exists and is a text block before accessing `.text`:

```typescript
function extractTextContent(content: Anthropic.ContentBlock[]): string {
  const block = content[0];
  if (!block || block.type !== 'text') {
    throw new Error('Expected text response from AI');
  }
  return block.text;
}
```

This prevents runtime crashes when the API returns an unexpected response shape (e.g. tool-use blocks or empty content). Use this helper at every call site instead of raw `content[0].text` access.

### Model selection for bilingual apps

For Japanese translation and bilingual content generation, use **Sonnet-class models or above** (`claude-sonnet-4-20250514`). Haiku-class models produce noticeably lower quality Japanese output — awkward phrasing, inconsistent keigo, and missing nuance. The cost difference is negligible for the short prompts typical in translation and suggestion flows.

### BYO Key via Secrets Store

Each gateway has its provider API key stored in Cloudflare Secrets Store so the gateway injects the key at runtime. The Worker still sends the key via the SDK `apiKey` param (needed for local dev), but in production the gateway takes precedence.

**Setup (per gateway, in dashboard):**

1. Go to **AI > AI Gateway > [gateway] > Provider Keys > Add**
2. Select provider (e.g. Anthropic), paste the API key
3. The dashboard creates a secret in Secrets Store automatically — you **cannot** pick a pre-loaded secret; it always creates a new slot

**Naming convention:** The dashboard names secrets as `{gateway}_{provider}_{alias}`, e.g. `pulse_anthropic_default`.

**Alias behavior:**

- The default alias is `default` — no extra header needed
- If you change the alias (e.g. to `myapp`), requests must include the header `cf-aig-byok-alias: myapp`
- Stick with `default` unless you need multiple keys per provider per gateway

**Scope:** Dashboard-created secrets get `ai_gateway` scope only. To also use them from Workers directly, manually add the `workers` scope in the Secrets Store dashboard.

**Secrets Store limits:** 100 secret slots per store. Each gateway+provider+alias consumes one slot.

---

## Troubleshooting

| Symptom                                                          | Cause                                                                    | Fix                                                                                                                     |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `401 Unauthorized` from gateway                                  | `cf-aig-authorization` header missing or token invalid                   | Verify `AI_GATEWAY_TOKEN` is set via `wrangler secret put`; confirm the CF API token has **AI Gateway: Run** permission |
| `403 Forbidden` from gateway                                     | Authenticated Gateway enabled but request has no auth header             | Ensure `AI_GATEWAY_TOKEN` env var is passed to `getClient()`                                                            |
| Requests show as "direct" in provider logs (not in gateway logs) | `AI_GATEWAY_URL` not set or wrong URL format                             | Check `wrangler.jsonc` vars — URL must end with the provider segment (e.g. `/anthropic`)                                |
| `ENOTFOUND gateway.ai.cloudflare.com` locally                    | Gateway URL set in local env but no internet / DNS issue                 | Unset `AI_GATEWAY_URL` for local dev — calls go direct to provider                                                      |
| Cache not working                                                | Request body differs (different `max_tokens`, timestamp in prompt, etc.) | Cache keys are based on the full request body — ensure identical requests for cache hits                                |
| `429 Too Many Requests`                                          | Gateway rate limit exceeded                                              | Check AI > AI Gateway > Settings > Rate-limiting; increase limits or add backoff                                        |

---

## Contact

**eSolia Inc.**
Shiodome City Center 5F (Work Styling)
1-5-2 Higashi-Shimbashi, Minato-ku, Tokyo, Japan 105-7105
**Tel (Main):** +813-4577-3380
**Web:** https://esolia.co.jp/en
**Preparer:** rick.cogley@esolia.co.jp

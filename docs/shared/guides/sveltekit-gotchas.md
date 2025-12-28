# SvelteKit Application Gotchas

> **Central Reference**: This is the canonical SvelteKit gotchas guide for all eSolia applications (Pulse, Periodic, Courier). Keep this single copy updated rather than maintaining per-app copies.

A reference guide for common pitfalls, security considerations, and edge cases when building SvelteKit applications. Intended for code review and onboarding.

**eSolia apps using SvelteKit:**

| App      | Platform         | Database | Storage |
| -------- | ---------------- | -------- | ------- |
| Pulse    | Cloudflare Pages | D1       | R2      |
| Periodic | Cloudflare Pages | D1       | R2      |
| Courier  | Cloudflare Pages | (Nexus)  | (Nexus) |

## Server/Client Boundary

SvelteKit code runs in two contexts: server-side during SSR, and client-side after hydration. Code in `+page.svelte` executes in **both** environments.

### Browser API Access

```svelte
<script>
  // ❌ ReferenceError on server - window doesn't exist
  console.log(window.innerWidth);
  localStorage.setItem('key', 'value');
</script>
```

**Solution:** Guard browser-only code:

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  // Option 1: Conditional check
  if (browser) {
    localStorage.setItem('key', 'value');
  }

  // Option 2: onMount (only runs client-side)
  onMount(() => {
    console.log(window.innerWidth);
  });
</script>
```

### Hydration Mismatches

When server-rendered HTML differs from client-rendered HTML, you get hydration errors or visual flickers.

**Common causes:**

- `Math.random()` or `Date.now()` during render
- Conditional rendering based on `browser` check
- Third-party scripts modifying the DOM

```svelte
<!-- ✅ Defer to client -->
<script>
  import { onMount } from 'svelte';
  let today = '';
  onMount(() => {
    today = new Date().toLocaleDateString();
  });
</script>

<!-- ❌ Server and client may render different dates -->
<p>Today is {new Date().toLocaleDateString()}</p>
<p>Today is {today || 'Loading...'}</p>
```

## Environment Variables

### The PUBLIC\_ Prefix Requirement

Environment variables are server-only by default. Client-accessible variables must be prefixed with `PUBLIC_`.

```bash
# .env
SECRET_API_KEY=abc123        # Server only
PUBLIC_APP_NAME=MyApp        # Available everywhere
```

```ts
// Correct usage
import { SECRET_API_KEY } from '$env/static/private'; // +page.server.ts only
import { PUBLIC_APP_NAME } from '$env/static/public'; // Works everywhere
```

**Gotcha:** Using a non-PUBLIC variable in client code silently returns `undefined` with no build warning.

## Load Functions

### Non-Serializable Data

Server load functions serialize data via JSON to send to the client. Classes, functions, Maps, Sets, and circular references fail silently or throw.

```ts
// +page.server.ts
export async function load() {
  return {
    user: new User(data), // ❌ Class instance won't survive
    process: () => {}, // ❌ Functions can't serialize
    items: new Map(), // ❌ Maps become empty objects
  };
}
```

**Solution:** Return plain objects. Use `devalue` for richer serialization if needed.

### Load Functions Re-run on Navigation

Navigating from `/blog/1` to `/blog/2` triggers the load function again. This is usually desirable but can cause unexpected refetches or state resets.

```ts
// +page.ts
export async function load({ params, fetch }) {
  // Runs EVERY time params.id changes
  const post = await fetch(`/api/posts/${params.id}`);
  return { post };
}
```

### Layout Load Functions Don't Re-run for Child Routes

`+layout.ts` load functions only re-run when their own dependencies change, not when navigating between child routes.

```
routes/
  +layout.ts        ← Runs once
  blog/
    +page.svelte
    [slug]/
      +page.svelte  ← Navigating here doesn't re-run parent layout
```

## Store Subscriptions

### Memory Leaks from Manual Subscriptions

Manual store subscriptions must be cleaned up. The `$` prefix handles this automatically.

```svelte
<script>
  import { myStore } from '$lib/stores';

  // ❌ Memory leak - subscription never cleaned up
  myStore.subscribe((value) => {
    console.log(value);
  });

  // ✅ Auto-subscribes and cleans up
  $: console.log($myStore);
</script>
```

If you must subscribe manually, use `onDestroy`:

```svelte
<script>
  import { onDestroy } from 'svelte';
  import { myStore } from '$lib/stores';

  const unsubscribe = myStore.subscribe((value) => {
    console.log(value);
  });

  onDestroy(unsubscribe);
</script>
```

## Form Actions

### Missing Return Values

When using `use:enhance`, failing to return from an action leaves the client unaware of the result.

```ts
// +page.server.ts
export const actions = {
  default: async ({ request }) => {
    const data = await request.formData();
    await saveToDatabase(data);
    // ❌ Client doesn't know what happened

    // ✅ Return something
    return { success: true };
  },
};
```

### Progressive Enhancement Testing

`use:enhance` requires JavaScript. Always test forms with JavaScript disabled to ensure baseline functionality.

## Fetch Behavior

### Using the Provided fetch

Inside load functions, use the provided `fetch`—it handles relative URLs, cookies, and optimizes server-side requests.

```ts
export async function load({ fetch }) {
  // ✅ Enhanced fetch
  const res = await fetch('/api/data');

  // ❌ Global fetch breaks on server for relative URLs
  const res2 = await globalThis.fetch('/api/data');
}
```

## Prerendering

### Dynamic Routes Need entries()

Dynamic routes can't be prerendered without specifying which paths exist.

```ts
// +page.ts
export const prerender = true; // ❌ Error for /blog/[slug]

// ✅ Specify entries
export async function entries() {
  const posts = await getPosts();
  return posts.map((post) => ({ slug: post.slug }));
}
```

## Adapter Configuration

Build output depends on your adapter. Mismatches cause deployment failures.

```ts
// svelte.config.js
import adapter from '@sveltejs/adapter-cloudflare';

export default {
  kit: {
    adapter: adapter(),
  },
};
```

**Cloudflare note:** `adapter-cloudflare` (Pages) and `adapter-cloudflare-workers` (Workers) are different packages with different capabilities.

## TypeScript

### Generated Types Require Build

The `.svelte-kit/types` directory is generated during `dev` or `build`. Stale types cause IDE errors for `PageData`, `PageServerLoad`, etc.

**Solution:** Run `npm run dev` or `npm run check` to regenerate types.

---

## Security Considerations (OWASP)

### A01: Broken Access Control

#### Insecure Direct Object References (IDOR)

Load functions often fetch data by ID from URL params without authorization checks.

```ts
// +page.server.ts
export async function load({ params }) {
  // ❌ Any authenticated user can access any client's data
  const client = await db.query('SELECT * FROM clients WHERE id = ?', [params.id]);
  return { client };
}

// ✅ Verify ownership/permission
export async function load({ params, locals }) {
  const client = await db.query('SELECT * FROM clients WHERE id = ? AND org_id = ?', [
    params.id,
    locals.user.orgId,
  ]);
  if (!client) throw error(404, 'Not found');
  return { client };
}
```

#### Authorization in Hooks vs Load Functions

Centralize auth checks in `hooks.server.ts` rather than repeating in every load function.

```ts
// hooks.server.ts
export async function handle({ event, resolve }) {
  const session = await getSession(event.cookies);

  if (event.url.pathname.startsWith('/app') && !session) {
    throw redirect(303, '/login');
  }

  event.locals.user = session?.user;
  return resolve(event);
}
```

**Gotcha:** Client-side navigation bypasses hooks after initial load. Protect sensitive data in load functions too.

### A02: Cryptographic Failures

#### Sensitive Data in Client-Side Load Functions

Data returned from `+page.ts` (not `+page.server.ts`) is visible in the client bundle and network tab.

```ts
// +page.ts - ❌ Runs on client, data exposed
export async function load({ fetch }) {
  const secrets = await fetch('/api/secrets');
  return { secrets }; // Visible in page source
}

// +page.server.ts - ✅ Server only
export async function load({ fetch }) {
  const secrets = await fetch('/api/secrets');
  return { secrets }; // Only serialized result sent to client
}
```

#### Cookie Security Settings

```ts
// hooks.server.ts
cookies.set('session', token, {
  path: '/',
  httpOnly: true, // Prevents XSS access
  secure: true, // HTTPS only
  sameSite: 'lax', // CSRF protection
  maxAge: 60 * 60 * 24, // Explicit expiry
});
```

**Gotcha:** `secure: true` breaks local development. Use environment checks:

```ts
secure: !dev,  // import { dev } from '$app/environment'
```

### A03: Injection

#### XSS via {@html}

The `{@html}` directive renders raw HTML without sanitization.

```svelte
<!-- ✅ Sanitize first -->
<script>
  import DOMPurify from 'dompurify';
  $: sanitized = DOMPurify.sanitize(userProvidedContent);
</script>

<!-- ❌ XSS vulnerability -->
{@html userProvidedContent}
{@html sanitized}
```

#### SQL/NoSQL Injection in Actions

Form actions receive user input. Always use parameterized queries.

```ts
export const actions = {
  search: async ({ request }) => {
    const data = await request.formData();
    const query = data.get('query');

    // ❌ SQL injection
    await db.query(`SELECT * FROM products WHERE name LIKE '%${query}%'`);

    // ✅ Parameterized
    await db.query('SELECT * FROM products WHERE name LIKE ?', [`%${query}%`]);
  },
};
```

### A04: Insecure Design

#### Missing Rate Limiting

SvelteKit has no built-in rate limiting. Implement at the edge (Cloudflare) or in hooks.

```ts
// hooks.server.ts - basic example
const rateLimitMap = new Map();

export async function handle({ event, resolve }) {
  const ip = event.getClientAddress();
  const now = Date.now();
  const windowMs = 60000;
  const maxRequests = 100;

  const requestLog = rateLimitMap.get(ip) || [];
  const recentRequests = requestLog.filter((t) => t > now - windowMs);

  if (recentRequests.length >= maxRequests) {
    throw error(429, 'Too many requests');
  }

  recentRequests.push(now);
  rateLimitMap.set(ip, recentRequests);

  return resolve(event);
}
```

**Recommendation:** Use Cloudflare Rate Limiting rules for production.

### A05: Security Misconfiguration

#### Content Security Policy

Configure CSP headers in hooks or adapter config.

```ts
// hooks.server.ts
export async function handle({ event, resolve }) {
  const response = await resolve(event);

  response.headers.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
  );

  return response;
}
```

**Gotcha:** SvelteKit's inline styles and scripts require `'unsafe-inline'` unless you implement nonces.

#### Security Headers Checklist

```ts
response.headers.set('X-Frame-Options', 'DENY');
response.headers.set('X-Content-Type-Options', 'nosniff');
response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
```

### A07: Identification and Authentication Failures

#### Session Handling

```ts
// ❌ Predictable session IDs
const sessionId = `user-${userId}`;

// ✅ Cryptographically random
import { randomBytes } from 'crypto';
const sessionId = randomBytes(32).toString('hex');
```

#### Logout Implementation

```ts
// +page.server.ts
export const actions = {
  logout: async ({ cookies }) => {
    // Delete server-side session
    await db.query('DELETE FROM sessions WHERE id = ?', [cookies.get('session')]);

    // Clear cookie
    cookies.delete('session', { path: '/' });

    throw redirect(303, '/');
  },
};
```

### A08: Software and Data Integrity Failures

#### CSRF Protection

SvelteKit form actions include CSRF protection by default when using `use:enhance`. However:

```ts
// API routes (+server.ts) have NO automatic CSRF protection
// +server.ts
export async function POST({ request }) {
  // ❌ Vulnerable to CSRF
  const data = await request.json();
  await updateUserEmail(data.email);
}
```

**Solutions:**

1. Use form actions instead of API routes for mutations
2. Implement CSRF tokens manually for API routes
3. Check `Origin` header matches your domain

```ts
// +server.ts
export async function POST({ request, url }) {
  const origin = request.headers.get('origin');
  if (origin !== url.origin) {
    throw error(403, 'CSRF check failed');
  }
  // ... proceed
}
```

### A09: Security Logging and Monitoring Failures

#### Audit Logging in Actions

```ts
export const actions = {
  updateSettings: async ({ request, locals }) => {
    const data = await request.formData();

    // Log before action
    await auditLog({
      action: 'settings.update',
      userId: locals.user.id,
      timestamp: new Date().toISOString(),
      ip: event.getClientAddress(),
      changes: Object.fromEntries(data),
    });

    await updateSettings(data);
    return { success: true };
  },
};
```

### A10: Server-Side Request Forgery (SSRF)

#### User-Controlled URLs in Fetch

```ts
// +page.server.ts
export async function load({ url, fetch }) {
  const target = url.searchParams.get('url');

  // ❌ SSRF - user can access internal services
  const response = await fetch(target);

  // ✅ Validate against allowlist
  const allowedDomains = ['api.example.com', 'cdn.example.com'];
  const targetUrl = new URL(target);
  if (!allowedDomains.includes(targetUrl.hostname)) {
    throw error(400, 'Invalid URL');
  }
  const response = await fetch(target);
}
```

---

## Platform: Deno Deploy with Deno KV

### Adapter Configuration

Deno Deploy requires `adapter-deno` or running SvelteKit through Deno's npm compatibility.

```ts
// svelte.config.js
import adapter from 'svelte-adapter-deno';

export default {
  kit: {
    adapter: adapter(),
  },
};
```

**Gotcha:** The adapter ecosystem for Deno is less mature than Node/Cloudflare. Check compatibility with your SvelteKit version.

### Accessing Deno KV

Deno KV isn't available via the usual SvelteKit patterns. Access it directly via Deno APIs.

```ts
// lib/server/kv.ts
const kv = await Deno.openKv();

export { kv };
```

```ts
// +page.server.ts
import { kv } from '$lib/server/kv';

export async function load() {
  const entry = await kv.get(['users', 'user-123']);
  return { user: entry.value };
}
```

**Gotcha:** `Deno.openKv()` returns a promise. Initialize once and reuse—don't open a new connection per request.

### KV Consistency Model

Deno KV is **eventually consistent by default** for reads. This can cause subtle bugs where writes appear to "disappear."

```ts
// ❌ May not see the write immediately
await kv.set(['counter'], 5);
const result = await kv.get(['counter']); // Might return stale value

// ✅ Strong consistency when needed
const result = await kv.get(['counter'], { consistency: 'strong' });
```

**When to use strong consistency:**

- Reading immediately after a write in the same request
- Critical data where staleness causes errors (auth tokens, counts that must be accurate)
- Transactions or compare-and-swap operations

**Cost:** Strong reads have higher latency and count toward stricter rate limits.

### KV Atomic Operations and Race Conditions

Without atomics, concurrent updates can overwrite each other.

```ts
// ❌ Race condition - two requests can read same value, both increment, one write lost
const entry = await kv.get(['views']);
await kv.set(['views'], (entry.value || 0) + 1);

// ✅ Atomic operation with version check
const entry = await kv.get(['views']);
const result = await kv
  .atomic()
  .check(entry) // Fails if value changed since read
  .set(['views'], (entry.value || 0) + 1)
  .commit();

if (!result.ok) {
  // Handle conflict - retry or return error
}
```

### KV Key Design

Keys are arrays—take advantage of hierarchical structure for efficient queries.

```ts
// Good key design for querying
await kv.set(['org', orgId, 'client', clientId], clientData);
await kv.set(['org', orgId, 'client', clientId, 'dns', recordId], dnsRecord);

// List all clients for an org
const clients = kv.list({ prefix: ['org', orgId, 'client'] });
for await (const entry of clients) {
  console.log(entry.key, entry.value);
}
```

**Gotcha:** KV list operations return an async iterator, not an array. Can't use `.map()` or `.filter()` directly.

```ts
// ❌ Doesn't work
const results = kv.list({ prefix: ['org', orgId] }).map((e) => e.value);

// ✅ Collect to array first
const entries = [];
for await (const entry of kv.list({ prefix: ['org', orgId] })) {
  entries.push(entry.value);
}
```

### KV Value Size Limits

- **Key:** Max 2KB total across all key parts
- **Value:** Max 64KB per entry

```ts
// ❌ Will fail for large objects
await kv.set(['report', reportId], hugeJsonObject);

// ✅ Chunk large data or store reference to external storage
await kv.set(['report', reportId, 'meta'], { chunks: 3, createdAt: Date.now() });
await kv.set(['report', reportId, 'chunk', 0], chunk0);
await kv.set(['report', reportId, 'chunk', 1], chunk1);
await kv.set(['report', reportId, 'chunk', 2], chunk2);
```

### Node.js Compatibility

Deno Deploy supports npm packages but some Node.js APIs don't work.

```ts
// ❌ Node.js crypto may not work as expected
import { randomBytes } from 'crypto';

// ✅ Use Web Crypto API
const array = new Uint8Array(32);
crypto.getRandomValues(array);
const token = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('');
```

**Gotcha:** File system APIs (`fs`) don't work on Deno Deploy. Store persistent data in KV, not files.

### Environment Variables

```ts
// ❌ Node.js pattern doesn't work
const secret = process.env.SECRET_KEY;

// ✅ Deno pattern
const secret = Deno.env.get('SECRET_KEY');

// ✅ SvelteKit's abstraction works in both
import { SECRET_KEY } from '$env/static/private';
```

### Security: KV Access Control

Deno KV has no built-in row-level security. Enforce access control in your application code.

```ts
// +page.server.ts
export async function load({ params, locals }) {
  const record = await kv.get(['org', params.orgId, 'data', params.id]);

  // ❌ Missing authorization check - any user can access any org's data
  return { data: record.value };

  // ✅ Verify user belongs to org
  if (locals.user.orgId !== params.orgId) {
    throw error(403, 'Forbidden');
  }
  return { data: record.value };
}
```

### Security: Sensitive Data in KV

KV values are not encrypted at rest beyond Deno Deploy's infrastructure encryption. Consider encrypting sensitive fields.

```ts
import { encryptValue, decryptValue } from '$lib/server/crypto';

// Storing sensitive data
await kv.set(['user', id, 'apiKey'], await encryptValue(apiKey));

// Retrieving
const entry = await kv.get(['user', id, 'apiKey']);
const apiKey = await decryptValue(entry.value);
```

---

## Platform: Cloudflare Pages with D1 and R2

### Accessing Bindings

Cloudflare bindings (D1, R2, KV) are accessed via `platform.env` in SvelteKit.

```ts
// +page.server.ts
export async function load({ platform }) {
  const db = platform?.env?.DB; // D1 binding
  const bucket = platform?.env?.ASSETS; // R2 binding

  if (!db) throw error(500, 'Database not configured');

  const { results } = await db.prepare('SELECT * FROM clients').all();
  return { clients: results };
}
```

**Gotcha:** `platform` is undefined during `vite dev`. Use wrangler for local development with bindings.

```bash
# Local dev with bindings
npx wrangler pages dev --local -- npm run dev
```

### D1 Connection Handling

D1 doesn't maintain persistent connections. Each request gets a fresh connection. This is different from traditional databases.

```ts
// No connection pooling needed or possible
// Each query is independent

export async function load({ platform }) {
  const db = platform.env.DB;

  // Each prepare/run is a separate round-trip
  const users = await db.prepare('SELECT * FROM users').all();
  const posts = await db.prepare('SELECT * FROM posts').all();

  return { users: users.results, posts: posts.results };
}
```

### D1 Batch Operations

Reduce latency by batching multiple queries into a single request.

```ts
// ❌ Three separate round-trips
const users = await db.prepare('SELECT * FROM users').all();
const orgs = await db.prepare('SELECT * FROM orgs').all();
const roles = await db.prepare('SELECT * FROM roles').all();

// ✅ Single round-trip with batch
const [users, orgs, roles] = await db.batch([
  db.prepare('SELECT * FROM users'),
  db.prepare('SELECT * FROM orgs'),
  db.prepare('SELECT * FROM roles'),
]);
```

### D1 Prepared Statements with Parameters

Always use bound parameters—never interpolate values.

```ts
// ❌ SQL injection vulnerability
const query = `SELECT * FROM clients WHERE org_id = '${orgId}'`;
await db.prepare(query).all();

// ✅ Parameterized query
await db.prepare('SELECT * FROM clients WHERE org_id = ?').bind(orgId).all();

// ✅ Multiple parameters
await db.prepare('SELECT * FROM clients WHERE org_id = ? AND status = ?').bind(orgId, status).all();
```

### D1 Transaction Limitations

D1 doesn't support traditional transactions with rollback. Use batch operations for atomic multi-statement operations.

```ts
// ❌ No transaction support
await db.exec('BEGIN TRANSACTION'); // Doesn't work as expected

// ✅ Batch operations are atomic
await db.batch([
  db.prepare('INSERT INTO audit_log (action) VALUES (?)').bind('delete'),
  db.prepare('DELETE FROM clients WHERE id = ?').bind(clientId),
]);
// Both succeed or both fail
```

### D1 Size and Rate Limits

| Limit            | Free  | Paid |
| ---------------- | ----- | ---- |
| Database size    | 500MB | 10GB |
| Rows read/day    | 5M    | 50B  |
| Rows written/day | 100K  | 50M  |
| Max query rows   | 100K  | 100K |

**Gotcha:** The 100K row limit per query applies regardless of plan. Paginate large result sets.

```ts
// ✅ Paginate large queries
const pageSize = 1000;
const offset = page * pageSize;

const { results } = await db
  .prepare('SELECT * FROM records ORDER BY created_at DESC LIMIT ? OFFSET ?')
  .bind(pageSize, offset)
  .all();
```

### R2 Basics

```ts
// +page.server.ts
export async function load({ platform, params }) {
  const bucket = platform.env.ASSETS;

  // Get object
  const object = await bucket.get(`reports/${params.id}.pdf`);
  if (!object) throw error(404, 'Not found');

  return {
    report: {
      size: object.size,
      uploaded: object.uploaded,
      // Don't return the body in load - it's a stream
    },
  };
}
```

### R2 Streaming Large Files

For large files, stream directly rather than loading into memory.

```ts
// +server.ts
export async function GET({ platform, params }) {
  const bucket = platform.env.ASSETS;
  const object = await bucket.get(`files/${params.filename}`);

  if (!object) throw error(404, 'Not found');

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
      'Content-Length': object.size.toString(),
    },
  });
}
```

### R2 Signed URLs for Private Content

Don't expose R2 objects directly. Use signed URLs for time-limited access.

```ts
// +page.server.ts
import { getSignedUrl } from '$lib/server/r2-signing';

export async function load({ platform, params, locals }) {
  // Verify authorization first
  const canAccess = await checkAccess(locals.user, params.fileId);
  if (!canAccess) throw error(403, 'Forbidden');

  // Generate signed URL valid for 1 hour
  const signedUrl = await getSignedUrl({
    bucket: platform.env.ASSETS,
    key: `private/${params.fileId}`,
    expiresIn: 3600,
  });

  return { downloadUrl: signedUrl };
}
```

### R2 Eventual Consistency

R2 is eventually consistent. A GET immediately after PUT might return stale data or 404.

```ts
// ❌ Might fail or return stale data
await bucket.put('report.pdf', pdfBuffer);
const object = await bucket.get('report.pdf'); // Could be null!

// ✅ Accept eventual consistency or add delay/retry
await bucket.put('report.pdf', pdfBuffer);
return { message: 'Upload complete. File will be available shortly.' };

// Or implement retry with backoff
async function getWithRetry(bucket, key, maxAttempts = 3) {
  for (let i = 0; i < maxAttempts; i++) {
    const object = await bucket.get(key);
    if (object) return object;
    await new Promise((r) => setTimeout(r, 100 * (i + 1)));
  }
  return null;
}
```

### Workers CPU Time Limits

Cloudflare Workers (including Pages Functions) have CPU time limits.

| Plan | CPU Time                |
| ---- | ----------------------- |
| Free | 10ms                    |
| Paid | 50ms (can request more) |

**Gotcha:** This is CPU time, not wall-clock time. Waiting for D1/R2/fetch doesn't count. But JSON parsing, crypto operations, and heavy computation do.

```ts
// ❌ May exceed CPU limits for large datasets
export async function load({ platform }) {
  const { results } = await db.prepare('SELECT * FROM huge_table').all();
  const processed = results.map((r) => heavyComputation(r)); // CPU-bound
  return { data: processed };
}

// ✅ Move heavy computation to the database or paginate
const { results } = await db
  .prepare(
    `
  SELECT id, computed_field  -- Let D1 compute what it can
  FROM huge_table 
  LIMIT 100
`
  )
  .all();
```

### Local Development Setup

Create a proper local dev environment for Cloudflare bindings.

```toml
# wrangler.toml
name = "pulse"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "pulse-db"
database_id = "your-database-id"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "pulse-assets"
```

```bash
# Run local dev with bindings
npx wrangler pages dev --local --persist -- npm run dev
```

**Gotcha:** The `--persist` flag saves D1/R2 data between restarts. Without it, you start fresh each time.

### Security: Binding Exposure

Never pass bindings to client-side code or return them from load functions.

```ts
// +page.server.ts
export async function load({ platform }) {
  // ❌ NEVER do this - exposes binding reference
  return { db: platform.env.DB };

  // ✅ Return only the data
  const { results } = await platform.env.DB.prepare('SELECT * FROM users').all();
  return { users: results };
}
```

### Security: D1 Row-Level Security

D1 has no built-in RLS. Implement tenant isolation in queries.

```ts
// For multi-tenant apps like Pulse, ALWAYS filter by tenant
export async function load({ platform, locals }) {
  const db = platform.env.DB;

  // ❌ Leaks data across tenants
  const { results } = await db
    .prepare('SELECT * FROM compliance_records WHERE id = ?')
    .bind(recordId)
    .all();

  // ✅ Always include tenant filter
  const { results } = await db
    .prepare('SELECT * FROM compliance_records WHERE id = ? AND client_id = ?')
    .bind(recordId, locals.clientId)
    .all();
}
```

### Security: R2 Access Patterns

```ts
// ❌ Predictable paths enable enumeration
await bucket.put(`evidence/${evidenceId}.pdf`, buffer);
// Attacker can try evidence/1.pdf, evidence/2.pdf, etc.

// ✅ Include tenant in path and use UUIDs
await bucket.put(`clients/${clientId}/evidence/${crypto.randomUUID()}.pdf`, buffer);
```

### Deployment Configuration

```ts
// svelte.config.js
import adapter from '@sveltejs/adapter-cloudflare';

export default {
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>'], // Let Cloudflare handle static assets
      },
    }),
  },
};
```

---

## Quick Reference Checklist

### Before Code Review

- [ ] No `{@html}` with unsanitized user content
- [ ] All sensitive data fetched in `+page.server.ts`, not `+page.ts`
- [ ] Authorization checks on all protected routes/data
- [ ] Form actions return appropriate responses
- [ ] API routes (`+server.ts`) have CSRF protection if needed
- [ ] Cookies set with `httpOnly`, `secure`, `sameSite`
- [ ] No secrets in `PUBLIC_` environment variables
- [ ] Parameterized queries for all database operations
- [ ] Rate limiting on authentication endpoints
- [ ] Security headers configured

### Before Deployment

- [ ] Correct adapter configured
- [ ] Environment variables set in production
- [ ] CSP headers appropriate for production
- [ ] Error pages don't leak stack traces
- [ ] Prerender entries specified for static routes
- [ ] Types regenerated and passing

### Deno Deploy Specific

- [ ] Using `Deno.env.get()` or SvelteKit's `$env` (not `process.env`)
- [ ] KV connections initialized once, not per-request
- [ ] Strong consistency used where read-after-write accuracy required
- [ ] Atomic operations for concurrent updates
- [ ] KV values under 64KB limit
- [ ] No file system writes (use KV instead)
- [ ] Web Crypto API used instead of Node crypto
- [ ] Tenant isolation enforced in all KV queries

### Cloudflare Specific

- [ ] Bindings accessed via `platform.env`, never returned to client
- [ ] D1 queries use `.bind()` for all parameters
- [ ] D1 batch operations used to reduce round-trips
- [ ] R2 paths include tenant ID to prevent enumeration
- [ ] R2 signed URLs used for private content
- [ ] Heavy computation offloaded to D1 or paginated
- [ ] Local dev uses wrangler with `--persist` flag
- [ ] Tenant filter included in ALL D1 queries (multi-tenant apps)

---

## eSolia Application Audit Findings

This section documents common security issues found during audits. Add findings from any eSolia app here to help prevent similar issues across all projects.

### Required: Centralized Sanitization Module

Every eSolia SvelteKit app MUST have a `$lib/sanitize.ts` module:

```ts
// src/lib/sanitize.ts
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'b',
  'em',
  'i',
  'u',
  'code',
  'pre',
  'a',
  'ul',
  'ol',
  'li',
  'blockquote',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'span',
  'div',
];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];

/**
 * Sanitize raw HTML from external sources.
 * InfoSec: Prevents XSS from untrusted HTML content.
 */
export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}

/**
 * Convert markdown-like content to safe HTML.
 * Supports: **bold**, *italic*, `code`, [links](url)
 * InfoSec: Sanitizes output to prevent XSS.
 */
export function renderMarkdown(content: string): string {
  if (!content) return '';

  let html = escapeHtml(content)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\n/g, '<br>');

  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

/**
 * Convert newlines to <br> safely.
 * InfoSec: Escapes HTML before adding <br> tags.
 */
export function nlToBr(text: string): string {
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * Escape HTML entities.
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

**Usage:**

- `renderMarkdown()` - User comments with markdown support
- `nlToBr()` - Descriptions/notes that just need line breaks
- `sanitizeHtml()` - Raw HTML from external sources

### Required: CSRF Protection for API Routes

Every app with `/api/*` routes MUST add CSRF validation in `hooks.server.ts`:

```ts
// src/hooks.server.ts
import { error, type Handle } from '@sveltejs/kit';

/**
 * Validate CSRF for API routes.
 * InfoSec: Form actions have built-in protection, but +server.ts routes don't.
 */
function validateCsrf(request: Request, url: URL): void {
  const isApiRoute = url.pathname.startsWith('/api/');
  const isStateChangingMethod = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);

  if (!isApiRoute || !isStateChangingMethod) return;

  const origin = request.headers.get('origin');

  if (!origin) {
    const referer = request.headers.get('referer');
    if (referer) {
      const refererUrl = new URL(referer);
      if (refererUrl.origin !== url.origin) {
        throw error(403, 'CSRF check failed: invalid referer');
      }
    }
    return; // Same-origin requests without headers are OK
  }

  if (origin !== url.origin) {
    throw error(403, 'CSRF check failed: origin mismatch');
  }
}

export const handle: Handle = async ({ event, resolve }) => {
  validateCsrf(event.request, event.url);
  // ... rest of handle
};
```

### Common XSS Vulnerabilities

#### Issue: Unsafe `{@html}` with `.replace()` for Line Breaks

```svelte
<!-- ❌ BAD: XSS vulnerability -->
{@html description.replace(/\n/g, '<br>')}

<!-- ✅ GOOD: Using centralized sanitization -->
<script>
  import { nlToBr } from '$lib/sanitize';
</script>
{@html nlToBr(description)}
```

**Problem:** The naive `.replace()` doesn't escape HTML entities first. Content with `<script>` tags executes.

#### Issue: Markdown Rendering Without Sanitization

```ts
// ❌ BAD: Local renderMarkdown without DOMPurify
function renderMarkdown(content: string): string {
  return content
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
  // Missing sanitization!
}

// ✅ GOOD: Centralized with DOMPurify
import { renderMarkdown } from '$lib/sanitize';
```

**Problem:** Malicious markdown like `[click](javascript:alert(1))` executes.

### Audit Checklist Per App

When auditing any eSolia SvelteKit app, verify:

- [ ] `$lib/sanitize.ts` exists with `sanitizeHtml`, `renderMarkdown`, `nlToBr`
- [ ] All `{@html}` usage passes through sanitization
- [ ] CSRF validation in `hooks.server.ts` for API routes
- [ ] D1 queries use `.bind()` (never string interpolation)
- [ ] R2 paths include tenant ID: `{orgId}/` or `clients/{clientId}/`
- [ ] Session cookie has `httpOnly`, `secure`, `sameSite`
- [ ] Secrets use `$env/static/private` (not `PUBLIC_`)
- [ ] Browser APIs (`window`, `localStorage`) guarded with `browser` check

### Audit Log

| App      | Date       | Auditor | Issues Found | Status |
| -------- | ---------- | ------- | ------------ | ------ |
| Pulse    | 2025-12-06 | Claude  | XSS, CSRF    | Fixed  |
| Periodic | TBD        | -       | -            | -      |
| Courier  | TBD        | -       | -            | -      |

---

**Document Version:** 1.3
**Last Updated:** 2025-12-21
**Applicable SvelteKit Version:** 2.x
**Platforms Covered:** Cloudflare Pages (D1, R2)

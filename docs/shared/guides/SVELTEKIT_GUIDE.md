# SvelteKit + Svelte 5 Development Guide

> **Purpose**: Canonical reference for AI coding assistants (Claude Code, etc.) working on SvelteKit projects. This guide ensures consistent, correct Svelte 5 code generation.
>
> **Last Updated**: December 2025
> **Svelte Version**: 5.x (Runes)
> **SvelteKit Version**: 2.x

---

## Table of Contents

1. [Svelte 5 Fundamentals](#svelte-5-fundamentals)
2. [SvelteKit Patterns](#sveltekit-patterns)
3. [Common Gotchas](#common-gotchas)
4. [Security Requirements](#security-requirements)
5. [Cloudflare Integration](#cloudflare-integration)
6. [Quick Reference](#quick-reference)

---

## Svelte 5 Fundamentals

### Critical: Use Runes Syntax

Svelte 5 uses **Runes** for explicit reactivity. Never generate Svelte 3/4 syntax.

#### ✅ Correct (Svelte 5)

```svelte
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  
  $effect(() => {
    console.log('count changed:', count);
  });
  
  let { title, onAction } = $props();
</script>

<button onclick={() => count++}>
  {count} (doubled: {doubled})
</button>
```

#### ❌ Wrong (Svelte 3/4 - Do Not Use)

```svelte
<script>
  export let title;           // ❌ Use $props()
  let count = 0;              // ❌ Use $state()
  $: doubled = count * 2;     // ❌ Use $derived()
  $: console.log(count);      // ❌ Use $effect()
</script>

<button on:click={() => count++}>  <!-- ❌ Use onclick -->
```

---

### Runes Reference

#### `$state()` - Reactive State

```javascript
// Primitives
let count = $state(0);
let name = $state('');

// Objects (deeply reactive)
let user = $state({ name: 'Rick', email: 'rick@example.com' });
user.name = 'Updated';  // ✅ Triggers reactivity

// Arrays (deeply reactive)
let items = $state([1, 2, 3]);
items.push(4);          // ✅ Triggers reactivity
items[0] = 10;          // ✅ Triggers reactivity

// Raw state (not deeply reactive - for performance)
let largeData = $state.raw({ nested: { big: 'data' } });
```

#### `$derived()` - Computed Values

```javascript
// Simple derivation
let doubled = $derived(count * 2);

// Complex derivation
let filtered = $derived.by(() => {
  return items
    .filter(item => item.active)
    .sort((a, b) => a.name.localeCompare(b.name));
});

// ⚠️ Cannot mutate $state inside $derived (causes infinite loop)
```

#### `$effect()` - Side Effects

```javascript
// Basic effect
$effect(() => {
  document.title = `Count: ${count}`;
});

// Effect with cleanup
$effect(() => {
  const interval = setInterval(() => tick(), 1000);
  return () => clearInterval(interval);  // Cleanup function
});

// Pre-effect (runs before DOM updates)
$effect.pre(() => {
  previousHeight = element?.offsetHeight;
});
```

#### `$props()` - Component Props

```svelte
<script>
  // Basic props with defaults
  let { 
    title,
    description = 'Default description',
    items = [],
    disabled = false
  } = $props();
  
  // Rest props
  let { class: className, ...rest } = $props();
  
  // TypeScript
  interface Props {
    items: Item[];
    onSelect?: (item: Item) => void;
  }
  let { items, onSelect }: Props = $props();
</script>
```

#### `$bindable()` - Two-Way Binding

```svelte
<script>
  let {
    value = $bindable(''),      // Parent CAN use bind:value
    disabled = false            // Parent CANNOT bind (read-only)
  } = $props();
</script>

<!-- Parent usage -->
<TextInput bind:value={formData.email} disabled={isSubmitting} />
```

---

### Snippets (Replacing Slots)

#### Basic Snippets

```svelte
<!-- Card.svelte -->
<script>
  let { header, children, footer } = $props();
</script>

<div class="card">
  {#if header}{@render header()}{/if}
  {@render children?.()}
  {#if footer}{@render footer()}{/if}
</div>

<!-- Usage -->
<Card>
  {#snippet header()}
    <h2>Title</h2>
  {/snippet}
  
  <p>Default content goes here</p>
  
  {#snippet footer()}
    <button>Action</button>
  {/snippet}
</Card>
```

#### Snippets with Parameters

```svelte
<!-- DataTable.svelte -->
<script>
  let { items, row } = $props();
</script>

<table>
  {#each items as item, index}
    {@render row(item, index)}
  {/each}
</table>

<!-- Usage -->
<DataTable {items}>
  {#snippet row(item, index)}
    <tr>
      <td>{index + 1}</td>
      <td>{item.name}</td>
    </tr>
  {/snippet}
</DataTable>
```

#### Reusable Snippets (same component)

```svelte
{#snippet badge(status)}
  <span class="badge badge-{status}">{status}</span>
{/snippet}

<div>{@render badge('active')}</div>
<div>{@render badge('pending')}</div>
```

---

### Event Handling

```svelte
<!-- Svelte 5: Use standard DOM event names as props -->
<button onclick={() => count++}>Click</button>
<input oninput={(e) => name = e.target.value} />
<form onsubmit={handleSubmit}>

<!-- Event modifiers via wrapper functions -->
<button onclick={(e) => { e.preventDefault(); handle(); }}>

<!-- Capture phase -->
<button onclickcapture={handler}>

<!-- ❌ Do NOT use on:directive syntax -->
<button on:click={handler}>  <!-- Wrong -->
```

---

### Reactive Classes (.svelte.ts files)

```typescript
// stores/counter.svelte.ts
export class CounterStore {
  count = $state(0);
  
  get doubled() {
    return $derived(this.count * 2);
  }
  
  increment() {
    this.count++;
  }
  
  reset() {
    this.count = 0;
  }
}

// Usage in component
<script>
  import { CounterStore } from '$lib/stores/counter.svelte';
  const counter = new CounterStore();
</script>

<button onclick={() => counter.increment()}>
  {counter.count} (doubled: {counter.doubled})
</button>
```

**File naming**: Use `.svelte.ts` or `.svelte.js` for files containing runes.

---

## SvelteKit Patterns

### File Structure

```
src/
├── routes/
│   ├── +page.svelte           # Page component
│   ├── +page.ts               # Universal load (client + server)
│   ├── +page.server.ts        # Server-only load + form actions
│   ├── +layout.svelte         # Layout component
│   ├── +layout.ts             # Layout load function
│   ├── +layout.server.ts      # Server-only layout load
│   ├── +error.svelte          # Error boundary
│   ├── +server.ts             # API endpoint
│   └── [param]/               # Dynamic route
│       └── +page.svelte
├── lib/
│   ├── components/            # Reusable components
│   ├── server/                # Server-only code ($lib/server/*)
│   └── stores/                # Reactive stores (.svelte.ts)
├── hooks.server.ts            # Server hooks
├── hooks.client.ts            # Client hooks
└── app.d.ts                   # Type declarations
```

### Load Functions

```typescript
// +page.ts - Universal load (runs on server AND client)
export const load = async ({ params, fetch, parent }) => {
  const parentData = await parent();
  const response = await fetch(`/api/items/${params.id}`);
  return { 
    item: await response.json(),
    ...parentData
  };
};

// +page.server.ts - Server-only load
export const load = async ({ params, platform, locals, cookies }) => {
  // Access server-only resources
  const db = platform.env.DB;
  const session = cookies.get('session');
  
  // This data is serialized and sent to client
  return { 
    secretData: await db.query('...')
  };
};
```

### Form Actions

```typescript
// +page.server.ts
import { fail, redirect } from '@sveltejs/kit';

export const actions = {
  default: async ({ request, locals }) => {
    const data = await request.formData();
    const email = data.get('email');
    
    // Validation
    if (!email) {
      return fail(400, { email, missing: true });
    }
    
    // Process
    await saveToDatabase(email, locals.user.id);
    
    // Success response or redirect
    return { success: true };
    // OR: throw redirect(303, '/success');
  },
  
  // Named action
  delete: async ({ request }) => {
    // ...
  }
};
```

```svelte
<!-- +page.svelte -->
<script>
  import { enhance } from '$app/forms';
  let { form } = $props();
</script>

<form method="POST" use:enhance>
  <input name="email" value={form?.email ?? ''} />
  {#if form?.missing}<p class="error">Email required</p>{/if}
  <button>Submit</button>
</form>

<!-- Named action -->
<form method="POST" action="?/delete" use:enhance>
```

### API Routes (+server.ts)

```typescript
// +server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, platform }) => {
  const id = params.id;
  const query = url.searchParams.get('q');
  
  const data = await fetchData(id);
  if (!data) throw error(404, 'Not found');
  
  return json(data);
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const body = await request.json();
  
  // Always validate
  if (!body.title) throw error(400, 'Title required');
  
  const result = await createItem(body, locals.user.id);
  return json(result, { status: 201 });
};
```

### Hooks

```typescript
// hooks.server.ts
import { redirect, error } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Authentication
  const session = await getSession(event.cookies);
  event.locals.user = session?.user;
  
  // Route protection
  if (event.url.pathname.startsWith('/app') && !session) {
    throw redirect(303, '/login');
  }
  
  // CSRF protection for API routes
  if (event.url.pathname.startsWith('/api/')) {
    const origin = event.request.headers.get('origin');
    if (origin && origin !== event.url.origin) {
      throw error(403, 'CSRF check failed');
    }
  }
  
  const response = await resolve(event);
  
  // Security headers
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  
  return response;
};
```

---

## Common Gotchas

### Server/Client Boundary

```svelte
<script>
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  
  // ❌ Fails on server - window doesn't exist
  console.log(window.innerWidth);
  
  // ✅ Guard browser-only code
  if (browser) {
    localStorage.setItem('key', 'value');
  }
  
  // ✅ Or use onMount (client-only)
  onMount(() => {
    console.log(window.innerWidth);
  });
</script>
```

### Hydration Mismatches

```svelte
<script>
  import { onMount } from 'svelte';
  
  // ❌ Server and client render different values
  let time = new Date().toLocaleTimeString();
  
  // ✅ Initialize on client only
  let time = $state('');
  onMount(() => {
    time = new Date().toLocaleTimeString();
  });
</script>
```

### Non-Serializable Load Data

```typescript
// +page.server.ts
export async function load() {
  return {
    user: new User(data),     // ❌ Classes don't serialize
    process: () => {},        // ❌ Functions don't serialize
    items: new Map(),         // ❌ Maps become empty objects
    
    user: { ...userData },    // ✅ Plain objects work
    items: [...itemsArray],   // ✅ Plain arrays work
  };
}
```

### Environment Variables

```bash
# .env
SECRET_KEY=abc123           # Server only
PUBLIC_API_URL=https://...  # Available everywhere
```

```typescript
// ✅ Correct imports
import { SECRET_KEY } from '$env/static/private';      // Server only
import { PUBLIC_API_URL } from '$env/static/public';   // Anywhere

// ⚠️ Using private vars in client code silently returns undefined
```

### Store Subscriptions (Legacy)

```svelte
<script>
  import { onDestroy } from 'svelte';
  import { myStore } from '$lib/stores';
  
  // ❌ Memory leak - never cleaned up
  myStore.subscribe(value => console.log(value));
  
  // ✅ Clean up subscriptions
  const unsubscribe = myStore.subscribe(value => {
    console.log(value);
  });
  onDestroy(unsubscribe);
  
  // ✅ Or use auto-subscribe syntax
  $: console.log($myStore);
  
  // ✅ Best: Convert to reactive class (Svelte 5)
</script>
```

### Props Reactivity

```javascript
// ❌ Destructured values are not reactive
let { value } = $props();
// value won't update when parent changes it

// ✅ Keep props object for reactivity
let props = $props();
// props.value will update

// ✅ Or use $derived for transformed values
let { value } = $props();
let displayValue = $derived(value.toUpperCase());
```

---

## Security Requirements

### XSS Prevention

```svelte
<script>
  import { sanitizeHtml, nlToBr } from '$lib/sanitize';
</script>

<!-- ❌ XSS vulnerability -->
{@html userContent}
{@html description.replace(/\n/g, '<br>')}

<!-- ✅ Always sanitize -->
{@html sanitizeHtml(userContent)}
{@html nlToBr(description)}
```

**Required sanitization module:**

```typescript
// src/lib/sanitize.ts
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'em', 'a', 'ul', 'ol', 'li', 'code', 'pre'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];

export function sanitizeHtml(html: string): string {
  return DOMPurify.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}

export function nlToBr(text: string): string {
  if (!text) return '';
  return escapeHtml(text).replace(/\n/g, '<br>');
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

### SQL Injection Prevention

```typescript
// ❌ SQL injection vulnerability
await db.query(`SELECT * FROM users WHERE id = '${userId}'`);

// ✅ Always use parameterized queries
await db.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first();
```

### CSRF Protection

```typescript
// hooks.server.ts
// Form actions have built-in CSRF protection
// API routes (+server.ts) do NOT - add manually

function validateCsrf(request: Request, url: URL): void {
  const isApiRoute = url.pathname.startsWith('/api/');
  const isStateChanging = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method);
  
  if (!isApiRoute || !isStateChanging) return;
  
  const origin = request.headers.get('origin');
  if (origin && origin !== url.origin) {
    throw error(403, 'CSRF check failed');
  }
}
```

### Cookie Security

```typescript
cookies.set('session', token, {
  path: '/',
  httpOnly: true,        // Prevents XSS access
  secure: !dev,          // HTTPS only in production
  sameSite: 'lax',       // CSRF protection
  maxAge: 60 * 60 * 24   // Explicit expiry
});
```

### Authorization

```typescript
// Always verify ownership, not just authentication
export async function load({ params, locals, platform }) {
  const db = platform.env.DB;
  
  // ❌ Any authenticated user can access any record
  const record = await db.prepare('SELECT * FROM records WHERE id = ?')
    .bind(params.id).first();
  
  // ✅ Verify ownership
  const record = await db.prepare(
    'SELECT * FROM records WHERE id = ? AND org_id = ?'
  ).bind(params.id, locals.user.orgId).first();
  
  if (!record) throw error(404, 'Not found');
  return { record };
}
```

---

## Cloudflare Integration

### Platform Bindings

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        ASSETS: R2Bucket;
        KV: KVNamespace;
      };
    }
    interface Locals {
      user: User | null;
    }
  }
}

// +page.server.ts
export async function load({ platform, locals }) {
  const db = platform.env.DB;
  const bucket = platform.env.ASSETS;
  
  // ❌ Never return bindings to client
  return { db: platform.env.DB };  // Wrong!
  
  // ✅ Return only data
  const { results } = await db.prepare('SELECT * FROM items').all();
  return { items: results };
}
```

### D1 Database

```typescript
// Single query
const user = await db
  .prepare('SELECT * FROM users WHERE id = ?')
  .bind(userId)
  .first();

// Multiple results
const { results } = await db
  .prepare('SELECT * FROM users WHERE org_id = ?')
  .bind(orgId)
  .all();

// Batch operations (reduces round trips)
const [users, orders] = await db.batch([
  db.prepare('SELECT * FROM users WHERE org_id = ?').bind(orgId),
  db.prepare('SELECT * FROM orders WHERE org_id = ?').bind(orgId)
]);

// Insert with returning
const result = await db
  .prepare('INSERT INTO users (name, email) VALUES (?, ?) RETURNING id')
  .bind(name, email)
  .first();
```

### R2 Storage

```typescript
// Upload
await bucket.put(`${orgId}/files/${fileId}`, fileBuffer, {
  httpMetadata: { contentType: 'application/pdf' }
});

// Download
const object = await bucket.get(`${orgId}/files/${fileId}`);
if (!object) throw error(404, 'File not found');

return new Response(object.body, {
  headers: {
    'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream'
  }
});

// ⚠️ R2 is eventually consistent - immediate GET after PUT may fail
```

### Adapter Configuration

```javascript
// svelte.config.js
import adapter from '@sveltejs/adapter-cloudflare';

export default {
  kit: {
    adapter: adapter({
      routes: {
        include: ['/*'],
        exclude: ['<all>']  // Let Cloudflare handle static assets
      }
    })
  }
};
```

### Local Development

```bash
# Run with Cloudflare bindings
npx wrangler pages dev --local --persist -- npm run dev
```

```toml
# wrangler.toml
name = "my-app"
compatibility_date = "2024-01-01"

[[d1_databases]]
binding = "DB"
database_name = "my-db"
database_id = "xxx"

[[r2_buckets]]
binding = "ASSETS"
bucket_name = "my-assets"
```

---

## Quick Reference

### Svelte 5 Syntax Cheatsheet

| Svelte 4 | Svelte 5 |
|----------|----------|
| `export let prop` | `let { prop } = $props()` |
| `let x = 0` (reactive) | `let x = $state(0)` |
| `$: doubled = x * 2` | `let doubled = $derived(x * 2)` |
| `$: { console.log(x) }` | `$effect(() => { console.log(x) })` |
| `<slot />` | `{@render children?.()}` |
| `<slot name="x" />` | `{@render x?.()}` |
| `<div slot="x">` | `{#snippet x()}...{/snippet}` |
| `on:click={fn}` | `onclick={fn}` |
| `on:click\|preventDefault` | `onclick={(e) => { e.preventDefault(); fn() }}` |
| `createEventDispatcher()` | Use callback props |

### File Types

| Extension | Purpose |
|-----------|---------|
| `+page.svelte` | Page component |
| `+page.ts` | Universal load (client + server) |
| `+page.server.ts` | Server-only load + actions |
| `+layout.svelte` | Layout component |
| `+server.ts` | API endpoint |
| `+error.svelte` | Error boundary |
| `*.svelte.ts` | Files using runes outside components |

### Common Imports

```typescript
// App modules
import { browser, dev } from '$app/environment';
import { goto, invalidate, invalidateAll } from '$app/navigation';
import { page } from '$app/stores';
import { enhance } from '$app/forms';

// Kit utilities
import { json, error, redirect, fail } from '@sveltejs/kit';

// Environment
import { SECRET_KEY } from '$env/static/private';
import { PUBLIC_URL } from '$env/static/public';
```

### Pre-Deployment Checklist

- [ ] No `{@html}` with unsanitized content
- [ ] All DB queries use parameterized bindings
- [ ] Authorization checks on protected routes/data
- [ ] CSRF protection on API routes
- [ ] Cookies set with `httpOnly`, `secure`, `sameSite`
- [ ] No secrets in `PUBLIC_` variables
- [ ] Browser APIs guarded with `browser` check
- [ ] Form actions return appropriate responses
- [ ] Error pages don't leak stack traces
- [ ] Types regenerated (`npm run check`)

---

## Document Info

**Version**: 2.0
**Maintainer**: [Your Team]
**Applies to**: All SvelteKit projects using Svelte 5

---
title: "Claude Project Template"
slug: claude-project-template
category: guides
tags: [claude-code, project-setup, template]
summary: "Template for CLAUDE.md project configuration in eSolia repositories"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
# CLAUDE.md - Project Configuration

> **Purpose**: Project-specific instructions for Claude Code. Contains project context and customizations that extend the shared SvelteKit guide.

---

## Project Overview

<!-- CUSTOMIZE: Update this section for each project -->

| Property           | Value                 |
| ------------------ | --------------------- |
| **Name**           | [PROJECT_NAME]        |
| **Type**           | SvelteKit application |
| **Svelte Version** | 5.x (Runes)           |
| **Deployment**     | Cloudflare Pages      |
| **Database**       | D1                    |
| **Storage**        | R2                    |

### Description

<!-- CUSTOMIZE: Brief description of what this app does -->

[One paragraph describing the application purpose and key functionality]

---

## Critical Rules

### 1. Always Use Svelte 5 Syntax

```svelte
<!-- ✅ CORRECT -->
<script>
  let count = $state(0);
  let doubled = $derived(count * 2);
  let { title, onAction } = $props();
</script>
<button onclick={() => count++}>{count}</button>

<!-- ❌ WRONG - Never generate this -->
<script>
  export let title;
  let count = 0;
  $: doubled = count * 2;
</script>
<button on:click={() => count++}>{count}</button>
```

### 2. Server vs Client Code

- **Sensitive data** → `+page.server.ts` (never `+page.ts`)
- **Platform bindings** → Server-only, accessed via `platform.env`
- **Browser APIs** → Guard with `browser` check or `onMount`

### 3. Security Non-Negotiables

- **Always** use parameterized queries: `.bind(value)`
- **Always** sanitize `{@html}` content via `$lib/sanitize.ts`
- **Always** include tenant/org filter in multi-tenant queries
- **Never** return platform bindings to client

---

## Project Structure

<!-- CUSTOMIZE: Update to match your actual structure -->

```
src/
├── routes/
│   ├── (auth)/              # Authenticated routes group
│   │   ├── dashboard/
│   │   └── settings/
│   ├── (public)/            # Public routes group
│   │   ├── login/
│   │   └── signup/
│   └── api/
│       └── [endpoint]/
├── lib/
│   ├── components/
│   │   ├── ui/              # Base UI components
│   │   └── features/        # Feature-specific components
│   ├── server/              # Server-only utilities
│   │   ├── db.ts            # Database helpers
│   │   └── auth.ts          # Auth utilities
│   ├── stores/              # Reactive stores (.svelte.ts)
│   ├── utils/               # Shared utilities
│   └── sanitize.ts          # XSS sanitization (required)
├── hooks.server.ts
└── app.d.ts
```

---

## Type Definitions

<!-- CUSTOMIZE: Update bindings to match your wrangler.toml -->

```typescript
// src/app.d.ts
declare global {
  namespace App {
    interface Platform {
      env: {
        DB: D1Database;
        ASSETS: R2Bucket;
        // Add other bindings as needed
      };
    }
    interface Locals {
      user: {
        id: string;
        orgId: string;
        email: string;
        role: 'admin' | 'member';
      } | null;
    }
  }
}

export {};
```

---

## Database Schema

<!-- CUSTOMIZE: Document your key tables and relationships -->

### Key Tables

```sql
-- Example: Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'member',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (org_id) REFERENCES organizations(id)
);

-- Example: Add your main tables here
```

### Query Patterns

```typescript
// Always include org_id for tenant isolation
const items = await db
  .prepare('SELECT * FROM items WHERE org_id = ? AND status = ?')
  .bind(locals.user.orgId, 'active')
  .all();

// Use batch for multiple queries
const [users, settings] = await db.batch([
  db.prepare('SELECT * FROM users WHERE org_id = ?').bind(orgId),
  db.prepare('SELECT * FROM settings WHERE org_id = ?').bind(orgId)
]);
```

---

## Component Library

<!-- CUSTOMIZE: Document your UI approach -->

### Styling Approach

<!-- Choose one and delete the others -->

**Option A: Tailwind CSS**

```svelte
<button class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
  Click me
</button>
```

**Option B: Component Library (e.g., shadcn-svelte)**

```svelte
<script>
  import { Button } from '$lib/components/ui/button';
</script>
<Button variant="primary">Click me</Button>
```

**Option C: CSS Modules / Scoped CSS**

```svelte
<button class="btn">Click me</button>
<style>
  .btn { /* styles */ }
</style>
```

### Common Components

<!-- CUSTOMIZE: List your reusable components -->

| Component   | Location                              | Usage                       |
| ----------- | ------------------------------------- | --------------------------- |
| `Button`    | `$lib/components/ui/Button.svelte`    | Primary action buttons      |
| `Input`     | `$lib/components/ui/Input.svelte`     | Form inputs with validation |
| `Modal`     | `$lib/components/ui/Modal.svelte`     | Dialog overlays             |
| `DataTable` | `$lib/components/ui/DataTable.svelte` | Sortable, filterable tables |

---

## Authentication Pattern

<!-- CUSTOMIZE: Document your auth approach -->

```typescript
// hooks.server.ts
export const handle: Handle = async ({ event, resolve }) => {
  const session = await getSession(event.cookies);
  event.locals.user = session?.user ?? null;

  // Protected routes
  if (event.url.pathname.startsWith('/app') && !session) {
    throw redirect(303, '/login');
  }

  return resolve(event);
};
```

### Session Cookie

```typescript
// Set session
cookies.set('session', token, {
  path: '/',
  httpOnly: true,
  secure: !dev,
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7 // 7 days
});

// Clear session
cookies.delete('session', { path: '/' });
```

---

## API Conventions

<!-- CUSTOMIZE: Document your API patterns -->

### Response Format

```typescript
// Success
return json({
  data: result,
  meta: { total: 100, page: 1 }
});

// Error
throw error(400, {
  message: 'Validation failed',
  errors: { email: 'Invalid email format' }
});
```

### Endpoint Naming

| Method | Path              | Action          |
| ------ | ----------------- | --------------- |
| GET    | `/api/items`      | List items      |
| GET    | `/api/items/[id]` | Get single item |
| POST   | `/api/items`      | Create item     |
| PUT    | `/api/items/[id]` | Update item     |
| DELETE | `/api/items/[id]` | Delete item     |

---

## Environment Variables

<!-- CUSTOMIZE: List your env vars -->

```bash
# .env.example

# Server-only (no PUBLIC_ prefix)
DATABASE_URL=
AUTH_SECRET=
STRIPE_SECRET_KEY=

# Public (available in client)
PUBLIC_APP_URL=
PUBLIC_STRIPE_KEY=
```

---

## Development Commands

```bash
# Start dev server with Cloudflare bindings
npm run dev
# or with wrangler for full binding support:
npx wrangler pages dev --local --persist -- npm run dev

# Type checking
npm run check

# Linting
npm run lint

# Testing
npm run test

# Build
npm run build

# Deploy
npx wrangler pages deploy
```

---

## Git Conventions

<!-- CUSTOMIZE: Your commit/branch conventions -->

### Branch Naming

- `feature/` - New features
- `fix/` - Bug fixes
- `refactor/` - Code refactoring

### Commit Messages

```
type(scope): description

feat(auth): add password reset flow
fix(dashboard): correct date formatting
refactor(api): extract validation helpers
```

---

## Known Issues / Tech Debt

<!-- CUSTOMIZE: Track known issues -->

| Issue                              | Impact | Planned Fix |
| ---------------------------------- | ------ | ----------- |
| Example: No rate limiting on login | Medium | Q1 2025     |

---

## Reference Documentation

- **Svelte 5 Docs**: https://svelte.dev/docs
- **SvelteKit Docs**: https://svelte.dev/docs/kit
- **Cloudflare D1**: https://developers.cloudflare.com/d1
- **Cloudflare R2**: https://developers.cloudflare.com/r2

---

## Changelog

<!-- Track significant changes to this file -->

| Date       | Change           |
| ---------- | ---------------- |
| YYYY-MM-DD | Initial creation |

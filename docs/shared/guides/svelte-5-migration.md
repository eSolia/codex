# Svelte 5 Migration Guide: Foundational Changes

> **Central Reference**: This is the canonical Svelte 5 guide for all eSolia applications (Nexus, Pulse, Periodic, Courier). Keep this single copy updated rather than maintaining per-app copies.

## Overview

Svelte 5 represents a philosophical shift from implicit "compiler magic" to explicit, predictable reactivity. This guide covers all foundational changes and provides migration strategies for production applications.

**Key changes:**

- Runes: explicit reactivity system replacing `$:` and implicit `let`
- Snippets: composable markup replacing slots
- Event handling: properties instead of directives
- Props: `$props()` destructuring instead of `export let`
- Remote Functions: new client-server communication paradigm

**Target audience:** Developers migrating existing Svelte 4/SvelteKit applications to Svelte 5.

**eSolia apps using Svelte 5:**

| App      | Status       | Notes                                 |
| -------- | ------------ | ------------------------------------- |
| Pulse    | Svelte 5     | Fully migrated, uses runes throughout |
| Periodic | Svelte 5     | Fully migrated, uses runes throughout |
| Courier  | Svelte 5     | New app, native Svelte 5              |
| Nexus    | Hono (no UI) | N/A - API only, no Svelte             |

---

## Table of Contents

1. [Runes: The New Reactivity System](#runes-the-new-reactivity-system)
2. [Snippets: Replacing Slots](#snippets-replacing-slots)
3. [Event Handling Changes](#event-handling-changes)
4. [Props Declaration](#props-declaration)
5. [Remote Functions](#remote-functions)
6. [Additional Breaking Changes](#additional-breaking-changes)
7. [Migration Strategy](#migration-strategy)
8. [Common Patterns](#common-patterns)
9. [Troubleshooting](#troubleshooting)

---

## Runes: The New Reactivity System

### Concept

Runes are function-like primitives that make reactivity explicit and universal. They work in `.svelte`, `.js`, and `.ts` files, enabling reactive state management outside components.

**Philosophy:** Reactivity determined at runtime, not compile time.

### The Core Runes

#### `$state()` - Reactive State

Declares reactive state that triggers updates when mutated.

**Before (Svelte 4):**

```svelte
<script>
  let count = 0; // Implicitly reactive at top level
  let user = { name: 'Rick', email: 'rick@esolia.co.jp' };
</script>

<button on:click={() => count++}>
  Clicks: {count}
</button>
```

**After (Svelte 5):**

```svelte
<script>
  let count = $state(0); // Explicitly reactive
  let user = $state({ name: 'Rick', email: 'rick@esolia.co.jp' });
</script>

<button onclick={() => count++}>
  Clicks: {count}
</button>
```

**Key behaviors:**

- Objects and arrays are deeply reactive (proxied)
- Primitive values work like regular variables (read/write directly)
- Works anywhere, not just component top-level

**Advanced: `$state.raw()`**

For large data structures where you don't need deep reactivity:

```javascript
// Frozen state - updates replace entire object
let largeDataset = $state.frozen([...1000 items]);

// Shallow reactive - only top-level properties reactive
let config = $state.raw({
  apiKey: '...',
  nested: { /* not reactive */ }
});
```

#### `$derived()` - Computed Values

Declares values computed from reactive state. Dependencies tracked automatically at runtime.

**Before (Svelte 4):**

```svelte
<script>
  let firstName = 'Rick';
  let lastName = 'Cogley';
  $: fullName = `${firstName} ${lastName}`; // Compile-time dependency tracking

  // Problem: dependencies must be visible in statement
  $: doubled = getDoubled(); // Won't track dependencies inside function
  function getDoubled() {
    return count * 2; // count dependency not tracked!
  }
</script>
```

**After (Svelte 5):**

```svelte
<script>
  let firstName = $state('Rick');
  let lastName = $state('Cogley');
  let fullName = $derived(`${firstName} ${lastName}`); // Runtime tracking

  // Fixed: dependencies tracked at runtime
  let doubled = $derived(getDoubled());
  function getDoubled() {
    return count * 2; // count tracked automatically
  }
</script>
```

**Advanced: `$derived.by()`**

For complex computations:

```javascript
let filteredItems = $derived.by(() => {
  let result = items;

  if (searchQuery) {
    result = result.filter((item) => item.name.includes(searchQuery));
  }

  if (sortBy === 'name') {
    result = [...result].sort((a, b) => a.name.localeCompare(b.name));
  }

  return result;
});
```

**Important:** Cannot mutate `$state` inside `$derived` (causes infinite loop).

#### `$effect()` - Side Effects

Runs side effects when dependencies change. Replaces `$:` for imperative code.

**Before (Svelte 4):**

```svelte
<script>
  let count = 0;

  // Runs on every count change
  $: {
    console.log('Count changed:', count);
    document.title = `Count: ${count}`;
  }

  // Cleanup is awkward
  $: {
    const interval = setInterval(() => console.log(count), 1000);
    // No good cleanup mechanism!
  }
</script>
```

**After (Svelte 5):**

```svelte
<script>
  let count = $state(0);

  // Runs on every count change
  $effect(() => {
    console.log('Count changed:', count);
    document.title = `Count: ${count}`;
  });

  // Cleanup is natural
  $effect(() => {
    const interval = setInterval(() => console.log(count), 1000);

    return () => {
      clearInterval(interval); // Called when effect re-runs or component unmounts
    };
  });
</script>
```

**Variants:**

```javascript
// $effect.pre() - runs before DOM updates
$effect.pre(() => {
  // Measure DOM before changes
  const height = element.offsetHeight;
});

// $effect.root() - manually controlled effect
const cleanup = $effect.root(() => {
  $effect(() => {
    // ... effects
  });

  return () => {
    // Cleanup when you call cleanup()
  };
});

// Later: cleanup() to destroy all nested effects
```

#### `$props()` - Component Props

Replaces `export let` for declaring component props.

**Before (Svelte 4):**

```svelte
<script>
  export let title;
  export let description = 'Default description';
  export let tags = [];
  export let disabled = false;
</script>
```

**After (Svelte 5):**

```svelte
<script>
  let { title, description = 'Default description', tags = [], disabled = false } = $props();
</script>
```

**Advanced patterns:**

```javascript
// Rest props (spread remaining props)
let { title, ...rest } = $props();
<div {...rest}>{title}</div>

// Renaming (useful for reserved words)
let { class: className, for: htmlFor } = $props();

// TypeScript
interface Props {
  items: ComplianceItem[];
  onSelect?: (item: ComplianceItem) => void;
}
let { items, onSelect }: Props = $props();
```

#### `$bindable()` - Two-Way Binding

Makes props bindable from parent components. Props are read-only by default.

**Before (Svelte 4):**

```svelte
<!-- All props automatically bindable -->
<script>
  export let value; // Parent can bind:value
  export let disabled; // Parent can bind:disabled (probably shouldn't!)
</script>
```

**After (Svelte 5):**

```svelte
<script>
  let {
    value = $bindable(''), // Parent CAN bind:value
    disabled = false // Parent CANNOT bind:disabled
  } = $props();
</script>

<!-- Parent usage -->
<TextInput bind:value={formData.email} disabled={isSubmitting} />
```

**Why this matters:** Prevents accidental two-way data flow. Makes component contracts explicit.

#### `$inspect()` - Debug Helper

Reactive console.log that only runs when dependencies change.

```javascript
let count = $state(0);
let message = $state('hello');

$inspect(count, message); // Logs when either changes

// With label
$inspect('Debug values:', count, message);
```

Automatically formatted in console, shows before/after values.

### Universal Reactivity: Runes Outside Components

**The game-changer:** Runes work in `.js`/`.ts` files, enabling reactive classes without stores.

**Before (Svelte 4):**

```typescript
// stores/compliance.ts
import { writable, derived } from 'svelte/store';

export const controls = writable([]);
export const filter = writable('all');

export const filteredControls = derived(
  [controls, filter],
  ([$controls, $filter]) => {
    if ($filter === 'all') return $controls;
    return $controls.filter(c => c.status === $filter);
  }
);

// Usage in component (verbose)
<script>
  import { controls, filteredControls } from './stores/compliance';

  let controlsList;
  let filtered;

  const unsubscribe1 = controls.subscribe(val => controlsList = val);
  const unsubscribe2 = filteredControls.subscribe(val => filtered = val);

  onDestroy(() => {
    unsubscribe1();
    unsubscribe2();
  });
</script>
```

**After (Svelte 5):**

```typescript
// stores/compliance.svelte.ts
export class ComplianceStore {
  controls = $state([]);
  filter = $state('all');

  get filteredControls() {
    return $derived(() => {
      if (this.filter === 'all') return this.controls;
      return this.controls.filter(c => c.status === this.filter);
    });
  }

  addControl(control) {
    this.controls.push(control);
  }

  setFilter(newFilter) {
    this.filter = newFilter;
  }
}

// Usage in component (clean)
<script>
  import { ComplianceStore } from './stores/compliance.svelte';

  const store = new ComplianceStore();
</script>

{#each store.filteredControls as control}
  <ControlRow {control} />
{/each}
```

**File naming:** Use `.svelte.ts` or `.svelte.js` extension when using runes in non-component files.

### Migration Checklist: Runes

- [ ] Replace top-level `let` with `$state()` for reactive variables
- [ ] Replace `$: computed = ...` with `let computed = $derived(...)`
- [ ] Replace `$: { /* side effects */ }` with `$effect(() => { /* side effects */ })`
- [ ] Replace `export let prop` with `let { prop } = $props()`
- [ ] Add `$bindable()` to props that need two-way binding
- [ ] Convert store subscriptions to reactive classes (optional but recommended)
- [ ] Add cleanup returns to effects with subscriptions/timers

---

## Snippets: Replacing Slots

### Concept

Snippets are reusable chunks of markup that can be passed as props. They replace slots with a more explicit, powerful system.

**Analogy:** If slots are like mail slots (stick content through a hole), snippets are like function calls (explicitly invoke with parameters).

### Basic Usage

**Before (Svelte 4):**

```svelte
<!-- Card.svelte -->
<div class="card">
  <slot name="header" />
  <slot />
  <!-- default slot -->
  <slot name="footer" />
</div>

<!-- Usage -->
<Card>
  <div slot="header">Title</div>
  <p>Default content</p>
  <div slot="footer">Footer</div>
</Card>
```

**After (Svelte 5):**

```svelte
<!-- Card.svelte -->
<script>
  let { header, children, footer } = $props();
</script>

<div class="card">
  {@render header()}
  {@render children()}
  {@render footer()}
</div>

<!-- Usage -->
<Card {header} {footer}>
  {#snippet header()}
    <div>Title</div>
  {/snippet}

  <p>Default content</p>

  {#snippet footer()}
    <div>Footer</div>
  {/snippet}
</Card>
```

**Default content (children prop):** Unmarked content becomes `children` snippet automatically.

### Snippets with Parameters

**Before (Svelte 4):**

```svelte
<!-- List.svelte -->
<ul>
  {#each items as item, index}
    <slot name="item" {item} {index} />
  {/each}
</ul>

<!-- Usage -->
<List {items} let:item let:index>
  <li slot="item">
    {index}: {item.name}
  </li>
</List>
```

**After (Svelte 5):**

```svelte
<!-- List.svelte -->
<script>
  let { items, row } = $props();
</script>

<ul>
  {#each items as item, index}
    {@render row(item, index)}
  {/each}
</ul>

<!-- Usage -->
<List {items} {row}>
  {#snippet row(item, index)}
    <li>{index}: {item.name}</li>
  {/snippet}
</List>
```

**Key difference:** Parameters are explicit function parameters, not `let:` bindings.

### Advanced: Reusable Snippets

Snippets can be used multiple times in the same component:

```svelte
<script>
  let showPrivate = $state(false);
</script>

{#snippet statusBadge(status)}
  <span class="badge badge-{status}">
    {status}
  </span>
{/snippet}

<div class="header">
  Current status: {@render statusBadge(order.status)}
</div>

<div class="summary">
  {#if showPrivate}
    {@render statusBadge(order.status)}
  {:else}
    <span>••••••</span>
  {/if}
</div>
```

### Conditional Snippets

Snippets can be stored in variables and conditionally rendered:

```svelte
<script>
  let { loading, error, data } = $props();

  // Choose which snippet to render
  const content = loading ? loadingSnippet : error ? errorSnippet : dataSnippet;
</script>

{#snippet loadingSnippet()}
  <div class="spinner">Loading...</div>
{/snippet}

{#snippet errorSnippet()}
  <div class="error">{error}</div>
{/snippet}

{#snippet dataSnippet()}
  <div class="data">{data}</div>
{/snippet}

{@render content()}
```

### Exportable Snippets

Snippets can be exported from `.svelte` files (great for icon libraries):

```svelte
<!-- icons.svelte -->
<script module>
  export { chevronDown, checkCircle, alertTriangle };
</script>

<!-- usage.svelte -->
<script>
  import { chevronDown, checkCircle } from './icons.svelte';
</script>

{#snippet chevronDown()}
  <svg class="icon">
    <path d="M..." />
  </svg>
{/snippet}

{#snippet checkCircle()}
  <svg class="icon">
    <path d="M..." />
  </svg>
{/snippet}

{#snippet alertTriangle()}
  <svg class="icon">
    <path d="M..." />
  </svg>
{/snippet}

{@render chevronDown()}
{@render checkCircle()}
```

**Use case:** Single icon file instead of 50+ component files.

### TypeScript with Snippets

```typescript
import type { Snippet } from 'svelte';

interface Props {
  items: ComplianceItem[];
  row: Snippet<[ComplianceItem, number]>; // Tuple: item and index
  header?: Snippet; // No parameters
  empty?: Snippet;
}

let { items, row, header, empty }: Props = $props();
```

### Migration Checklist: Snippets

- [ ] Replace `<slot />` with `{@render children?.()}`
- [ ] Replace `<slot name="foo" />` with props: `let { foo } = $props(); {@render foo()}`
- [ ] Replace `let:var` with snippet parameters: `{#snippet row(item, index)}`
- [ ] Add `?` for optional snippets: `{@render footer?.()}`
- [ ] Consider extracting slot forwarding to explicit snippet props
- [ ] Update TypeScript types to use `Snippet<[...params]>`

---

## Event Handling Changes

### Event Attributes Replace Directives

Event handlers are now properties (like React), not directives.

**Before (Svelte 4):**

```svelte
<button on:click={handleClick}>Click</button>
<input on:input={handleInput} on:change={handleChange} />
<form on:submit|preventDefault={handleSubmit} />
<div on:click|stopPropagation={handleDiv} />
```

**After (Svelte 5):**

```svelte
<button onclick={handleClick}>Click</button>
<input oninput={handleInput} onchange={handleChange} />
<form
  onsubmit={(e) => {
    e.preventDefault();
    handleSubmit(e);
  }}
/>
<div
  onclick={(e) => {
    e.stopPropagation();
    handleDiv(e);
  }}
/>
```

**Changes:**

- Remove colon: `on:click` → `onclick`
- Event modifiers removed: must call methods explicitly
- Can spread event handlers like any prop

### Event Modifiers Removed

**Before (Svelte 4):**

```svelte
<button on:click|once={handler} />
<button on:click|preventDefault={handler} />
<button on:click|stopPropagation={handler} />
<button on:click|capture={handler} />
<button on:click|passive={handler} />
<button on:click|nonpassive={handler} />
<button on:click|trusted={handler} />
```

**After (Svelte 5):**

```svelte
<!-- For once, track in state -->
<script>
  let clicked = $state(false);
  function handleOnce(e) {
    if (clicked) return;
    clicked = true;
    handler(e);
  }
</script>

<!-- Must implement manually -->
<button
  onclick={(e) => {
    e.preventDefault();
    e.stopPropagation();
    handler(e);
  }}
/>

<!-- For capture, use capture suffix -->
<button onclickcapture={handler} />
<button onclick={handleOnce} />
```

**Legacy option:** Can use `svelte/legacy` for modifier functions:

```javascript
import { preventDefault, stopPropagation } from 'svelte/legacy';

<button onclick={preventDefault(handler)} />;
```

### Component Events: Callback Props

`createEventDispatcher` is deprecated. Use callback props instead.

**Before (Svelte 4):**

```svelte
<!-- Child.svelte -->
<script>
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  function handleClick() {
    dispatch('notify', { message: 'hello', timestamp: Date.now() });
  }
</script>

<button on:click={handleClick}>Notify Parent</button>

<!-- Parent.svelte -->
<script>
  function handleNotify(event) {
    console.log(event.detail); // { message: 'hello', timestamp: ... }
  }
</script>

<Child on:notify={handleNotify} />
```

**After (Svelte 5):**

```svelte
<!-- Child.svelte -->
<script>
  let { onNotify } = $props();

  function handleClick() {
    onNotify?.({ message: 'hello', timestamp: Date.now() });
  }
</script>

<button onclick={handleClick}>Notify Parent</button>

<!-- Parent.svelte -->
<script>
  function handleNotify(payload) {
    console.log(payload); // { message: 'hello', timestamp: ... }
  }
</script>

<Child onNotify={handleNotify} />
```

**TypeScript:**

```typescript
interface Props {
  onNotify?: (payload: { message: string; timestamp: number }) => void;
}

let { onNotify }: Props = $props();
```

### Event Delegation Change (Important!)

**Svelte 5 attaches handlers to `<body>` by default** for better performance. This can break if you use `stopPropagation` in nested elements.

**Problem scenario:**

```svelte
<div onclick={(e) => e.stopPropagation()}>
  <button onclick={handler}>
    Click me <!-- handler won't fire! -->
  </button>
</div>
```

**Solutions:**

1. **Use capture phase:**

```svelte
<button onclickcapture={handler}>Click me</button>
```

2. **Use legacy directive:**

```svelte
<button on:click={handler}>Click me</button>
```

3. **Remove `stopPropagation`** if not necessary

### Spreading Event Handlers

Event handlers can now be spread as props:

```svelte
<script>
  let { onclick, onmouseenter, ...rest } = $props();
</script>

<!-- Spread all props including handlers -->
<button {onclick} {onmouseenter} {...rest}>
  <slot />
</button>

<!-- Or with local handler first -->
<button
  {...rest}
  onclick={(e) => {
    // Local handling
    doStuff(e);
    // Then call parent handler
    onclick?.(e);
  }}
>
  <slot />
</button>
```

### Migration Checklist: Events

- [ ] Replace `on:event` with `onevent` (remove colon)
- [ ] Remove event modifiers, implement explicitly
- [ ] Convert `createEventDispatcher` to callback props
- [ ] Check for `stopPropagation` issues, use capture if needed
- [ ] Update TypeScript interfaces for callback props
- [ ] Test event bubbling behavior in nested components

---

## Props Declaration

### `$props()` Replaces `export let`

**Before (Svelte 4):**

```svelte
<script>
  export let title;
  export let description = 'Default';
  export let items = [];
  export let disabled = false;

  // Props are implicitly bindable
</script>
```

**After (Svelte 5):**

```svelte
<script>
  let { title, description = 'Default', items = [], disabled = false } = $props();

  // Props are read-only by default
  // Must use $bindable() for two-way binding
</script>
```

### Advanced Props Patterns

**Rest props:**

```javascript
let { title, description, ...rest } = $props();

// Spread remaining props
<div {...rest}>
  <h1>{title}</h1>
  <p>{description}</p>
</div>;
```

**Renaming:**

```javascript
// Avoid reserved words
let { class: className, for: htmlFor, style: inlineStyle } = $props();

<label for={htmlFor} class={className} style={inlineStyle} />;
```

**TypeScript:**

```typescript
interface Props {
  items: ComplianceItem[];
  filter?: string;
  onSelect?: (item: ComplianceItem) => void;
}

let { items, filter = 'all', onSelect }: Props = $props();
```

**Generics:**

```typescript
<script lang="ts" generics="T">
  interface Props<T> {
    items: T[];
    renderItem: (item: T) => void;
  }

  let { items, renderItem }: Props<T> = $props();
</script>
```

### Props Are Read-Only by Default

**Svelte 4:** All props bindable
**Svelte 5:** Props read-only unless marked `$bindable()`

```svelte
<!-- TextInput.svelte -->
<script>
  let {
    value = $bindable(''),  // Parent CAN bind
    placeholder = '',       // Parent CANNOT bind
    disabled = false        // Parent CANNOT bind
  } = $props();
</script>

<input
  bind:value
  {placeholder}
  {disabled}
/>

<!-- Parent.svelte -->
<TextInput
  bind:value={formData.email}  ✅ Works
  placeholder="Email"          ✅ Works
  bind:disabled={isDisabled}   ❌ Error!
/>
```

### Migration Checklist: Props

- [ ] Replace `export let` with `let { } = $props()`
- [ ] Add `$bindable()` to props that need two-way binding
- [ ] Use rest props (`...rest`) for prop forwarding
- [ ] Update TypeScript interfaces
- [ ] Test that bindings work as expected

---

## Remote Functions

### Concept

Remote Functions enable type-safe client-server communication without API routes. Functions defined in `.remote.ts` files automatically become fetch calls on the client.

**Philosophy:** Write server functions, import in components, call like regular functions.

### Basic Usage

**Define server function:**

```typescript
// lib/server/db.remote.ts
import { query } from '$app/server';
import { db } from '$lib/database';

export const getUser = query(async (userId: string) => {
  return await db.user.findUnique({
    where: { id: userId },
  });
});

export const getUsers = query(async () => {
  return await db.user.findMany();
});
```

**Use in component:**

```svelte
<script>
  import { getUser, getUsers } from '$lib/server/db.remote';

  let userId = $state('123');
  let user = $state(null);
  let users = $state([]);

  async function loadUser() {
    user = await getUser(userId); // Type-safe!
  }

  async function loadUsers() {
    users = await getUsers();
  }
</script>

<button onclick={loadUser}>Load User</button>
<button onclick={loadUsers}>Load All Users</button>

{#if user}
  <UserCard {user} />
{/if}
```

**On server:** Function executes normally  
**On client:** Function becomes fetch request to SvelteKit endpoint

### Types of Remote Functions

**`query()` - Read operations (GET-like):**

```typescript
import { query } from '$app/server';

export const getCompliance = query(async (clientId: string) => {
  return await db.complianceControl.findMany({
    where: { clientId },
  });
});
```

**`command()` - Write operations (POST-like):**

```typescript
import { command } from '$app/server';

export const updateControl = command(async (controlId: string, status: string) => {
  return await db.complianceControl.update({
    where: { id: controlId },
    data: { status },
  });
});
```

**`form()` - Progressive enhancement for forms:**

```typescript
import { form } from '$app/server';
import * as v from 'valibot';

const schema = v.object({
  email: v.pipe(v.string(), v.email()),
  password: v.pipe(v.string(), v.minLength(8))
});

export const loginForm = form(schema, async (data) => {
  const user = await authenticateUser(data.email, data.password);
  if (!user) {
    throw error(401, 'Invalid credentials');
  }
  return { success: true, userId: user.id };
});

// Usage in component
<script>
  import { loginForm } from './login.remote';
</script>

<form {...loginForm}>
  <input name="email" bind:value={loginForm.fields.email} />
  {#if loginForm.fields.email.issues}
    <span class="error">{loginForm.fields.email.issues[0]}</span>
  {/if}

  <input name="password" type="password" bind:value={loginForm.fields.password} />

  <button type="submit" disabled={loginForm.pending}>
    {loginForm.pending ? 'Logging in...' : 'Log in'}
  </button>
</form>
```

**`prerender()` - Static generation:**

```typescript
import { prerender } from '$app/server';

export const getStaticPosts = prerender(
  async (slug: string) => {
    return await db.post.findUnique({ where: { slug } });
  },
  {
    inputs: () => ['post-1', 'post-2', 'post-3'], // Pre-generate these
  }
);
```

### Advanced: Query Batching

Multiple queries in the same microtask are batched:

```javascript
// Both executed in single request
const [user, settings] = await Promise.all([getUser(userId), getUserSettings(userId)]);
```

**Manual batching:**

```typescript
import { query } from '$app/server';

export const batchedQuery = query.batch(async (userIds: string[]) => {
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
  });

  // Return function that maps input to output
  return (userId, index) => users.find((u) => u.id === userId);
});
```

### Error Handling

```typescript
import { error } from '@sveltejs/kit';

export const getSecretData = query(async (userId: string) => {
  const user = await db.user.findUnique({ where: { id: userId } });

  if (!user) {
    throw error(404, 'User not found');
  }

  if (!user.hasAccess) {
    throw error(403, 'Insufficient permissions');
  }

  return await db.secretData.find({ userId });
});

// In component
<script>
  async function load() {
    try {
      data = await getSecretData(userId);
    } catch (err) {
      if (err.status === 404) {
        errorMessage = 'User not found';
      } else if (err.status === 403) {
        errorMessage = 'Access denied';
      }
    }
  }
</script>
```

### Configuration

Enable in `svelte.config.js`:

```javascript
export default {
  kit: {
    experimental: {
      remoteFunctions: true,
    },
  },
};
```

### When to Use Remote Functions

**Use for:**

- Simple data fetching in components
- Granular data loading (not whole page)
- Progressive enhancement patterns
- Replacing tRPC/GraphQL for simple apps

**Don't use for:**

- Public APIs (use regular endpoints)
- Complex authentication flows
- File uploads (use form actions)
- WebSocket/streaming (use dedicated endpoints)

### Migration from Load Functions

**Before:**

```typescript
// +page.server.ts
export async function load({ params }) {
  const user = await db.user.findUnique({
    where: { id: params.id }
  });
  return { user };
}

// +page.svelte
<script>
  export let data;
</script>

{data.user.name}
```

**After:**

```typescript
// lib/server/users.remote.ts
export const getUser = query(async (id: string) => {
  return await db.user.findUnique({ where: { id } });
});

// +page.svelte
<script>
  import { getUser } from '$lib/server/users.remote';
  import { page } from '$app/stores';

  let user = $state(null);

  $effect(() => {
    getUser($page.params.id).then(u => user = u);
  });
</script>

{user?.name}
```

**Trade-offs:**

- More flexible (load on demand, reload partially)
- Less structured (no automatic serialization)
- More explicit (clear when data fetches)

---

## Additional Breaking Changes

### Class Binding Improvements

**New in Svelte 5.16:** `class` attribute accepts objects/arrays using clsx syntax.

**Before:**

```svelte
<div class:active={isActive} class:disabled={isDisabled} class:loading={isLoading} />
```

**After:**

```svelte
<div
  class={{
    active: isActive,
    disabled: isDisabled,
    loading: isLoading
  }}
/>

<!-- Or arrays -->
<div class={['btn', isActive && 'active', size]} />
```

### Hydration Mismatch Handling

**Svelte 4:** Repaired mismatches automatically (expensive)  
**Svelte 5:** Assumes server/client match (warns in dev)

**Impact:** Don't rely on client-side overrides of SSR content.

### Component Instantiation

**`mount()`/`unmount()` replace `new Component()`:**

**Before:**

```javascript
import MyComponent from './MyComponent.svelte';

const component = new MyComponent({
  target: document.getElementById('app'),
  props: { name: 'Rick' },
});
```

**After:**

```javascript
import { mount } from 'svelte';
import MyComponent from './MyComponent.svelte';

const component = mount(MyComponent, {
  target: document.getElementById('app'),
  props: { name: 'Rick' },
});

// Later
component.unmount();
```

### CSS Scoping Changes

**:where() selector added for specificity control:**

**Before:** `.svelte-xyz123`  
**After:** `.svelte-xyz123:where(.svelte-xyz123)`

**Impact:** Reduces specificity conflicts. If targeting ancient browsers without `:where()` support, manually adjust emitted CSS.

### Error Codes Renamed

**Before:** `foo-bar`  
**After:** `foo_bar`

**Impact:** Update any error handling that checks error codes.

### Transitions

**`mount()` plays transitions by default** (class components didn't).

```javascript
// Disable intro transitions
mount(MyComponent, {
  target: document.body,
  intro: false,
});
```

---

## Migration Strategy

### Automatic Migration

SvelteKit provides migration script:

```bash
npx sv migrate svelte-5
```

**What it handles:**

- `let` → `$state()`
- `$:` → `$derived()` or `$effect()`
- `export let` → `$props()`
- `on:event` → `onevent`
- Slots → Snippets (basic cases)

**Manual work required:**

- `createEventDispatcher` → callback props
- Complex `$:` statements
- Event modifiers
- Custom stores → Runes classes
- Edge cases and optimizations

### Phased Migration Approach

**Phase 1: Assessment (1-2 days)**

- Audit codebase for Svelte 4 patterns
- Identify high-risk areas (heavy slot usage, custom stores, complex reactivity)
- Create test plan for critical user flows

**Phase 2: Preparation (1-2 days)**

- Update SvelteKit and dependencies
- Run migration script on copy of codebase
- Review generated changes, note manual work needed

**Phase 3: Incremental Migration (1-2 weeks)**

- Start with leaf components (no child components)
- Work up dependency tree
- Test thoroughly at each step
- Keep Svelte 4 syntax where migration is risky

**Phase 4: Optimization (1 week)**

- Convert stores to reactive classes
- Extract reusable hooks
- Optimize derived computations
- Implement Remote Functions for data fetching

**Phase 5: Cleanup**

- Remove legacy code
- Update documentation
- Train team on new patterns

### Testing Strategy

**Unit tests:**

- Ensure reactivity triggers correctly
- Test derived computations with various inputs
- Verify effect cleanup runs

**Integration tests:**

- Test component props and bindings
- Verify event handlers fire correctly
- Check snippet rendering with parameters

**E2E tests:**

- Run existing E2E suite (should mostly pass)
- Focus on user interactions (clicks, form submissions)
- Test data loading and error states

### Rollback Plan

**Keep Svelte 4 syntax working:**

- Most Svelte 4 patterns still work in Svelte 5
- Components can mix old and new syntax
- Incremental migration reduces risk

**Git strategy:**

- Feature branch for migration
- Commit small, testable chunks
- Easy to revert specific components if issues arise

---

## Common Patterns

### Reactive Form Handling

```svelte
<script>
  let formData = $state({
    email: '',
    password: '',
    rememberMe: false
  });

  let errors = $state({});
  let touched = $state({});

  // Validate as user types (derived)
  let isValid = $derived(formData.email.includes('@') && formData.password.length >= 8);

  // Track field touched state
  function markTouched(field) {
    touched[field] = true;
  }

  // Validate on blur (effect)
  $effect(() => {
    if (touched.email) {
      errors.email = formData.email.includes('@') ? null : 'Invalid email';
    }
  });

  async function handleSubmit(e) {
    e.preventDefault();
    if (!isValid) return;

    // Submit logic
  }
</script>

<form onsubmit={handleSubmit}>
  <input bind:value={formData.email} onblur={() => markTouched('email')} />
  {#if errors.email}
    <span class="error">{errors.email}</span>
  {/if}

  <button type="submit" disabled={!isValid}> Submit </button>
</form>
```

### Debounced Search

```svelte
<script>
  let searchQuery = $state('');
  let results = $state([]);
  let loading = $state(false);

  // Debounced search effect
  $effect(() => {
    const query = searchQuery;

    if (!query) {
      results = [];
      return;
    }

    loading = true;

    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${query}`);
        results = await response.json();
      } finally {
        loading = false;
      }
    }, 300);

    return () => clearTimeout(timer);
  });
</script>

<input bind:value={searchQuery} placeholder="Search..." />

{#if loading}
  <div>Searching...</div>
{:else if results.length > 0}
  <ul>
    {#each results as result}
      <li>{result.name}</li>
    {/each}
  </ul>
{:else if searchQuery}
  <div>No results</div>
{/if}
```

### Reactive Class Store

```typescript
// stores/pagination.svelte.ts
export class PaginationStore {
  page = $state(1);
  perPage = $state(25);
  total = $state(0);

  get totalPages() {
    return $derived(Math.ceil(this.total / this.perPage));
  }

  get offset() {
    return $derived((this.page - 1) * this.perPage);
  }

  get hasNext() {
    return $derived(this.page < this.totalPages);
  }

  get hasPrev() {
    return $derived(this.page > 1);
  }

  next() {
    if (this.hasNext) this.page++;
  }

  prev() {
    if (this.hasPrev) this.page--;
  }

  goTo(page: number) {
    this.page = Math.max(1, Math.min(page, this.totalPages));
  }
}
```

### Filterable Table with Snippets

```svelte
<script>
  import type { Snippet } from 'svelte';

  interface Props {
    items: any[];
    columns: string[];
    row: Snippet<[any, number]>;
    filterBy?: string;
  }

  let { items, columns, row, filterBy }: Props = $props();

  let filterText = $state('');

  let filteredItems = $derived.by(() => {
    if (!filterText || !filterBy) return items;

    return items.filter((item) =>
      String(item[filterBy]).toLowerCase().includes(filterText.toLowerCase())
    );
  });
</script>

{#if filterBy}
  <input bind:value={filterText} placeholder="Filter by {filterBy}..." />
{/if}

<table>
  <thead>
    <tr>
      {#each columns as col}
        <th>{col}</th>
      {/each}
    </tr>
  </thead>
  <tbody>
    {#each filteredItems as item, index}
      {@render row(item, index)}
    {/each}
  </tbody>
</table>
```

---

## Troubleshooting

### "Cannot read property of undefined" in `$derived`

**Problem:** Accessing nested properties that might be undefined.

```javascript
// ❌ Breaks if user is null
let fullName = $derived(user.firstName + ' ' + user.lastName);
```

**Solution:** Optional chaining

```javascript
// ✅ Returns undefined if user is null
let fullName = $derived(user ? `${user.firstName} ${user.lastName}` : undefined);
```

### Infinite Loop in `$effect`

**Problem:** Effect mutates state it depends on.

```javascript
// ❌ Infinite loop
let count = $state(0);

$effect(() => {
  count++; // Triggers effect again!
});
```

**Solution:** Use guards or move mutation to event handler.

```javascript
// ✅ Only runs once
let initialized = $state(false);

$effect(() => {
  if (!initialized) {
    count++;
    initialized = true;
  }
});
```

### Event Handler Not Firing (Delegation Issue)

**Problem:** Parent uses `stopPropagation`, child handler doesn't fire.

```svelte
<!-- ❌ Child click handler won't fire -->
<div onclick={(e) => e.stopPropagation()}>
  <button onclick={handler}>Click</button>
</div>
```

**Solution:** Use capture phase.

```svelte
<!-- ✅ Works -->
<div onclick={(e) => e.stopPropagation()}>
  <button onclickcapture={handler}>Click</button>
</div>
```

### Props Not Updating

**Problem:** Destructured props are not reactive.

```javascript
// ❌ value is fixed at first render
let { value } = $props();
console.log(value); // Always initial value
```

**Solution:** Don't destructure if you need reactivity.

```javascript
// ✅ props.value is reactive
let props = $props();
console.log(props.value); // Updates
```

Or use `$derived`:

```javascript
let { value } = $props();
let reactiveValue = $derived(value); // Tracks changes
```

### Store Subscriptions Not Cleaning Up

**Problem:** Svelte 4 auto-subscribed to stores with `$store` syntax. Svelte 5 doesn't.

```javascript
// ❌ In Svelte 5, this doesn't auto-subscribe
import { myStore } from './stores';

$effect(() => {
  console.log($myStore); // Won't update!
});
```

**Solution:** Convert to reactive class or manually subscribe.

```javascript
// Option 1: Reactive class
let myState = $state(myStore.get());
$effect(() => {
  const unsub = myStore.subscribe((val) => (myState = val));
  return unsub;
});

// Option 2: Convert store to class (preferred)
```

---

## Resources

**Official Documentation:**

- [Svelte 5 Docs](https://svelte.dev/docs)
- [Migration Guide](https://svelte.dev/docs/svelte/v5-migration-guide)
- [Runes Introduction](https://svelte.dev/blog/runes)
- [Remote Functions RFC](https://github.com/sveltejs/kit/discussions/13897)

**Community Resources:**

- [Svelte Discord](https://svelte.dev/chat) - `#svelte-5-runes` channel
- [Frontend Masters: Svelte 5 Runes Guide](https://frontendmasters.com/blog/snippets-in-svelte-5/)
- [Svelte Society YouTube](https://www.youtube.com/@SvelteSociety)

**Migration Tools:**

- `npx sv migrate svelte-5` - Automated migration script
- [Svelte 5 Preview Playground](https://svelte-5-preview.vercel.app/)

---

## Glossary

**Rune:** Function-like primitive that makes reactivity explicit (e.g., `$state`, `$derived`, `$effect`)

**Snippet:** Reusable chunk of markup that can be passed as props and rendered with parameters

**Signal:** Pattern for fine-grained reactivity where only minimal parts of UI update when data changes

**Remote Function:** Server-only function in `.remote.ts` file that becomes fetch call on client

**Universal Reactivity:** Runes work in `.js`/`.ts` files, not just `.svelte` components

**Capture Phase:** Event handling phase that runs before bubbling; use `onclickcapture` for handlers

---

## Changelog

**Version 1.0** (2025-12-09)

- Initial guide covering Svelte 5 foundational changes
- Includes Runes, Snippets, Events, Props, Remote Functions
- Migration strategies and troubleshooting

---

_This guide is maintained for eSolia's internal use. Feedback and updates welcome._

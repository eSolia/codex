# TypeScript and Coding Practices

> **Central Reference**: This is the canonical coding standards guide for all eSolia applications.

## Core Principles

1. **Type safety first** - No `any`, explicit types for public APIs
2. **Fail fast** - Validate early, throw on invalid state
3. **Explicit over implicit** - Clear code over clever code
4. **Consistency** - Same patterns across all apps

---

## Project Configuration

### Required Files

Every eSolia project MUST have these configuration files:

#### `.editorconfig`

```ini
# EditorConfig - consistent formatting across editors
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
trim_trailing_whitespace = true
indent_style = space
indent_size = 2

[*.md]
trim_trailing_whitespace = false

[Makefile]
indent_style = tab
```

#### `.prettierrc` (Hono/Workers - Nexus)

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "singleQuote": true,
  "trailingComma": "es5",
  "printWidth": 100,
  "semi": true
}
```

#### `.prettierrc` (SvelteKit - Pulse, Periodic, Courier)

```json
{
  "useTabs": false,
  "tabWidth": 2,
  "singleQuote": true,
  "trailingComma": "none",
  "printWidth": 100,
  "semi": true,
  "plugins": ["prettier-plugin-svelte", "prettier-plugin-tailwindcss"],
  "overrides": [
    {
      "files": "*.svelte",
      "options": {
        "parser": "svelte"
      }
    }
  ]
}
```

**Note:** SvelteKit apps use `"trailingComma": "none"` for compatibility with Svelte's generated code.

#### `tsconfig.json` (SvelteKit)

```json
{
  "extends": "./.svelte-kit/tsconfig.json",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

#### `tsconfig.json` (Hono/Workers)

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules"]
}
```

---

## TypeScript Rules

### No `any` Type

```typescript
// ❌ BAD: any type
function processData(data: any): any {
  return data.value;
}

// ✅ GOOD: Explicit types
interface DataPayload {
  value: string;
  timestamp: number;
}

function processData(data: DataPayload): string {
  return data.value;
}
```

### Use `unknown` for External Data

```typescript
// ❌ BAD: Trusting external data
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  return response.json(); // Returns any!
}

// ✅ GOOD: Validate external data
import { z } from 'zod';

const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string(),
  orgId: z.string(),
});

type User = z.infer<typeof UserSchema>;

async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  const data: unknown = await response.json();
  return UserSchema.parse(data); // Throws if invalid
}
```

### Exhaustive Switch Statements

```typescript
type Status = 'pending' | 'active' | 'completed' | 'failed';

// ❌ BAD: Missing cases silently ignored
function getStatusColor(status: Status): string {
  switch (status) {
    case 'pending':
      return 'yellow';
    case 'active':
      return 'blue';
    // Missing 'completed' and 'failed'!
  }
  return 'gray';
}

// ✅ GOOD: Exhaustive with never check
function getStatusColor(status: Status): string {
  switch (status) {
    case 'pending':
      return 'yellow';
    case 'active':
      return 'blue';
    case 'completed':
      return 'green';
    case 'failed':
      return 'red';
    default:
      // TypeScript error if any case is missing
      const _exhaustive: never = status;
      throw new Error(`Unhandled status: ${_exhaustive}`);
  }
}
```

### Prefer Type Narrowing

```typescript
// ❌ BAD: Type assertion
function processResult(result: Result | Error) {
  const data = (result as Result).data; // Unsafe!
}

// ✅ GOOD: Type narrowing
function processResult(result: Result | Error) {
  if (result instanceof Error) {
    throw result;
  }
  // TypeScript knows result is Result here
  return result.data;
}

// ✅ GOOD: Discriminated union
type ApiResponse = { success: true; data: User } | { success: false; error: string };

function handleResponse(response: ApiResponse) {
  if (response.success) {
    // TypeScript knows response.data exists
    return response.data;
  }
  // TypeScript knows response.error exists
  throw new Error(response.error);
}
```

### Readonly by Default

```typescript
// ❌ BAD: Mutable by default
interface Config {
  apiUrl: string;
  timeout: number;
}

// ✅ GOOD: Readonly for immutable data
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
}

// ✅ GOOD: Readonly arrays
function processItems(items: readonly string[]): void {
  // items.push('new'); // Error!
}
```

---

## Naming Conventions

### Files and Folders

| Type               | Convention             | Example                     |
| ------------------ | ---------------------- | --------------------------- |
| Components         | PascalCase             | `UserCard.svelte`           |
| Utilities          | camelCase              | `formatDate.ts`             |
| Types              | camelCase              | `types.ts`, `user.types.ts` |
| Constants          | camelCase              | `constants.ts`              |
| Routes (SvelteKit) | lowercase with hyphens | `magic-link/+page.svelte`   |

### Code

| Type             | Convention                | Example                        |
| ---------------- | ------------------------- | ------------------------------ |
| Variables        | camelCase                 | `userName`, `isActive`         |
| Constants        | UPPER_SNAKE_CASE          | `MAX_RETRIES`, `API_URL`       |
| Functions        | camelCase                 | `getUserById`, `validateEmail` |
| Types/Interfaces | PascalCase                | `User`, `ApiResponse`          |
| Enums            | PascalCase + UPPER values | `Status.PENDING`               |
| Private fields   | underscore prefix         | `_internalState`               |

```typescript
// ✅ GOOD: Consistent naming
const MAX_RETRY_ATTEMPTS = 3;
const DEFAULT_TIMEOUT_MS = 5000;

interface UserProfile {
  id: string;
  displayName: string;
  emailVerified: boolean;
}

enum AuthStatus {
  PENDING = 'pending',
  AUTHENTICATED = 'authenticated',
  EXPIRED = 'expired',
}

function validateUserInput(input: unknown): UserProfile {
  // ...
}
```

---

## Error Handling

### Use Result Types for Expected Failures

```typescript
// ✅ GOOD: Result type for operations that can fail
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };

async function createShare(data: ShareInput): Promise<Result<Share, string>> {
  try {
    const share = await db.insert(data);
    return { success: true, data: share };
  } catch (e) {
    if (e instanceof UniqueConstraintError) {
      return { success: false, error: 'Share already exists' };
    }
    throw e; // Unexpected errors should still throw
  }
}

// Usage
const result = await createShare(input);
if (!result.success) {
  return fail(400, { error: result.error });
}
const share = result.data;
```

### Throw for Unexpected Errors

```typescript
// ✅ GOOD: Throw for programming errors
function divide(a: number, b: number): number {
  if (b === 0) {
    throw new Error('Division by zero');
  }
  return a / b;
}

// ✅ GOOD: Custom error classes
class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends Error {
  constructor(
    message: string,
    public readonly requiredPermission: string
  ) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
```

### Never Swallow Errors

```typescript
// ❌ BAD: Swallowing errors
try {
  await riskyOperation();
} catch {
  // Silent failure - debugging nightmare
}

// ❌ BAD: Logging but not handling
try {
  await riskyOperation();
} catch (e) {
  console.error(e);
  // What happens next? Undefined behavior
}

// ✅ GOOD: Handle or rethrow
try {
  await riskyOperation();
} catch (e) {
  if (e instanceof RecoverableError) {
    return fallbackValue;
  }
  // Log and rethrow for unexpected errors
  console.error('Unexpected error in riskyOperation:', e);
  throw e;
}
```

---

## Async Patterns

### Always Await or Return Promises

```typescript
// ❌ BAD: Floating promise
async function saveData(data: Data) {
  db.save(data); // Promise not awaited!
  return 'saved';
}

// ✅ GOOD: Await the promise
async function saveData(data: Data) {
  await db.save(data);
  return 'saved';
}
```

### Use Promise.all for Parallel Operations

```typescript
// ❌ BAD: Sequential when parallel is possible
async function loadDashboard(userId: string) {
  const user = await getUser(userId);
  const stats = await getStats(userId);
  const notifications = await getNotifications(userId);
  return { user, stats, notifications };
}

// ✅ GOOD: Parallel loading
async function loadDashboard(userId: string) {
  const [user, stats, notifications] = await Promise.all([
    getUser(userId),
    getStats(userId),
    getNotifications(userId),
  ]);
  return { user, stats, notifications };
}
```

### Handle Promise.all Failures

```typescript
// ❌ BAD: One failure kills everything
const [a, b, c] = await Promise.all([fetchA(), fetchB(), fetchC()]);

// ✅ GOOD: Handle partial failures with allSettled
const results = await Promise.allSettled([fetchA(), fetchB(), fetchC()]);

const data = results.map((result, index) => {
  if (result.status === 'fulfilled') {
    return result.value;
  }
  console.error(`Fetch ${index} failed:`, result.reason);
  return null;
});
```

---

## Comments and Documentation

### InfoSec Comments

Security-relevant code MUST have InfoSec comments:

```typescript
// InfoSec: Validate tenant isolation - prevents IDOR
const { results } = await db
  .prepare('SELECT * FROM records WHERE id = ? AND org_id = ?')
  .bind(id, locals.orgId)
  .all();

// InfoSec: Rate limit login attempts - prevents brute force
if (attempts > MAX_LOGIN_ATTEMPTS) {
  throw error(429, 'Too many attempts');
}

// InfoSec: Sanitize HTML output - prevents XSS
const safeHtml = sanitizeHtml(userContent);
```

### JSDoc for Public APIs

```typescript
/**
 * Creates a new share with PIN protection.
 *
 * @param options - Share creation options
 * @param options.recipientEmail - Email of the share recipient
 * @param options.expiresIn - Days until expiration (1-30)
 * @param options.files - Array of file IDs to include
 * @returns The created share with PIN
 * @throws {ValidationError} If input is invalid
 * @throws {QuotaExceededError} If org has reached share limit
 *
 * @example
 * const share = await createShare({
 *   recipientEmail: 'user@example.com',
 *   expiresIn: 7,
 *   files: ['file-1', 'file-2'],
 * });
 */
export async function createShare(options: CreateShareOptions): Promise<Share> {
  // ...
}
```

### Avoid Obvious Comments

```typescript
// ❌ BAD: Obvious comments
// Increment counter
counter++;

// Get user from database
const user = await getUser(id);

// ✅ GOOD: Explain why, not what
// Use exponential backoff to avoid overwhelming the API
await delay(Math.pow(2, attempt) * 1000);

// Cache for 5 minutes to reduce D1 read units during traffic spikes
const cached = await kv.get(key, { cacheTtl: 300 });
```

---

## Imports

### Order Imports Consistently

```typescript
// 1. Node/Deno built-ins
import { createHash } from 'crypto';

// 2. External packages
import { Hono } from 'hono';
import { z } from 'zod';

// 3. Internal aliases ($lib, etc.)
import { db } from '$lib/server/db';
import type { User } from '$lib/types';

// 4. Relative imports
import { validateInput } from './validation';
import type { LocalTypes } from './types';
```

### Use Type-Only Imports

```typescript
// ❌ BAD: Importing type as value
import { User } from '$lib/types';

// ✅ GOOD: Explicit type import
import type { User } from '$lib/types';

// ✅ GOOD: Mixed import
import { createUser, type User } from '$lib/users';
```

---

## Testing

### Test File Naming

```
src/
├── lib/
│   ├── utils.ts
│   └── utils.test.ts      # Co-located tests
├── routes/
│   └── api/
│       └── users/
│           ├── +server.ts
│           └── users.test.ts
```

### Test Structure

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';

describe('createShare', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('creates a share with valid input', async () => {
    const result = await createShare({
      recipientEmail: 'test@example.com',
      expiresIn: 7,
    });

    expect(result.success).toBe(true);
    expect(result.data.pin).toHaveLength(6);
  });

  it('fails with invalid email', async () => {
    const result = await createShare({
      recipientEmail: 'not-an-email',
      expiresIn: 7,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('email');
  });

  it('fails when quota exceeded', async () => {
    // Test quota logic
  });
});
```

---

## Git Commit Messages

Follow conventional commits:

```
type(scope): description

[optional body]

[optional footer]
```

### Types

| Type       | Description                 |
| ---------- | --------------------------- |
| `feat`     | New feature                 |
| `fix`      | Bug fix                     |
| `docs`     | Documentation only          |
| `style`    | Formatting, no code change  |
| `refactor` | Code change, no feature/fix |
| `test`     | Adding tests                |
| `chore`    | Build, config, dependencies |

### Examples

```
feat(auth): add magic link authentication

Implements passwordless login via email magic links.
Uses Nexus OAuth for token exchange.

InfoSec: Uses PKCE for OAuth flow

fix(share): prevent IDOR in share access

Added org_id check to share queries to prevent
users from accessing other organizations' shares.

InfoSec: Fixes broken access control (OWASP A01)

docs: update security checklist with ASVS checks
```

---

## Pre-commit Hooks

Use Husky + lint-staged:

```json
// package.json
{
  "scripts": {
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{js,ts,svelte}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yaml,yml}": ["prettier --write"]
  }
}
```

```bash
# .husky/pre-commit
npm run lint-staged
```

---

**Document Version:** 1.0
**Last Updated:** December 2025

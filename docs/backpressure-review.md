# Backpressure Review — Hanawa CMS

**Date:** 2026-02-12
**Reviewer:** Claude Code (automated backpressure audit)
**Overall readiness:** Phase 1 (foundation partially in place)

---

## Scorecard

| Area | Rating | Key finding |
|------|--------|-------------|
| Type system | **weak** | `Locals.user` is `User \| undefined`, not a discriminated union; no `TenantContext` type; missing `noUncheckedIndexedAccess` |
| Data boundaries | **adequate** | All 39 `db.prepare()` calls use `.bind()` (excellent); centralized db.ts exists; but 0 `safeParse()` vs 59 `.parse()` calls, and DB results use `as` casts instead of Zod validation |
| CLAUDE.md | **weak** | ~19 statements that could be lint rules, ~3 that could be types — too much mechanical enforcement living in prose |
| Lint rules | **weak** | No oxlint installed; no custom backpressure rules; no `eslint-rules/` directory; no `eslint-plugin-oxlint` |
| Test coverage | **weak** | Zero test files; no vitest/jest configured; no `verify` script |
| Tenant isolation | **weak** | Multi-site via `site_id` but no default filtering in queries; all CF Access users get admin role; no user-site membership |

---

## Recommended next actions

1. **Install oxlint + create `verify` script + add `noUncheckedIndexedAccess` to tsconfig.** This is Phase 1 of the backpressure guide — zero-effort constraints that immediately narrow the corridor for AI-generated code. Takes ~30 minutes.

2. **Implement the four custom ESLint rules** (`no-raw-html`, `no-binding-leak`, `no-schema-parse`, `no-silent-catch`) and register the `esolia` plugin. The code templates are already written in `LINTING_STRATEGY.md` — they need to be copied into an `eslint-rules/` directory and wired into `eslint.config.js`.

3. **Add vitest and write initial tests** for `sanitize.ts` (the highest-risk module) and `db.ts` transform functions. Then wire vitest into the `verify` script. This completes the self-verification loop so Claude Code can validate its own output.

---

## Detailed findings

### 1. Type system audit

**`Locals.user` definition** (`src/app.d.ts:22-28`):

```typescript
user?: {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'editor' | 'viewer';
};
```

This is `User | undefined` — the weakest pattern. An AI-generated load function can easily forget to check `if (!locals.user)` and access `locals.user.email` without guard. The backpressure guide recommends a discriminated union:

```typescript
auth:
  | { authenticated: true; user: User }
  | { authenticated: false; user: null };
```

This forces exhaustive handling at every access point.

**No `TenantContext` type.** The `Locals` interface has 11 optional service fields but no structural guarantee that queries are scoped. Services are injected in `hooks.server.ts` but the pattern doesn't prevent unscoped DB access.

**`tsconfig.json` strictness:**
- `strict: true` — enabled (good)
- `noUncheckedIndexedAccess` — **not enabled** (should be)
- `exactOptionalPropertyTypes` — **not enabled** (recommended)

**`satisfies` usage:** No load functions use `satisfies` on return values. Return types are inferred, which means shape mismatches are caught late (if at all).

**Rating: weak.** The type system permits too many invalid states. The `user?:` pattern and absence of tenant context types mean the compiler provides no structural guarantees on the two most critical invariants (authentication and data scoping).

---

### 2. Data boundary validation

**Parameterized queries: excellent.** All 39 `db.prepare()` calls use `.bind()` with parameterized placeholders. No string interpolation detected in SQL. InfoSec comment in `db.ts:17` documents this.

**Centralized query helper: exists** (`src/lib/server/db.ts`, 337 lines). Provides:
- `buildUpdate()` — safe UPDATE builder with allowed-field whitelist
- `parseJson()` — safe JSON field parsing with fallback
- `generateId()` — crypto-secure ID generation
- CRUD operations: `getSites()`, `getSite()`, `getContent()`, `getFragment()`, etc.

However, ~24 `db.prepare()` calls exist **outside** `db.ts` — in `delivery.ts` (4), `webhooks.ts` (4), `media.ts` (2), `scheduling.ts` (1), `previews.ts` (2), `codex.ts` (1), `comments.ts` (1), and various route files (~6). These bypass the centralized module.

**Zod validation at boundaries:**
- 59 `.parse()` calls, **0 `.safeParse()` calls** across the entire codebase
- DB results use `as Record<string, unknown>` casts in transform functions rather than Zod schema validation
- Form actions and API routes use `.parse()` which throws uncontrolled errors

**`{@html}` sanitization: excellent.** All 10 `{@html}` instances are wrapped with `sanitizeHtml()`, `sanitizeComment()`, `nlToBr()`, or `renderContent()` (which internally sanitizes). Each has an InfoSec comment.

**Empty catch blocks: none found.** Clean.

**`platform.env` in return statements: none found.** Services are properly injected via `hooks.server.ts` locals, not returned from load functions.

**Rating: adequate.** The parameterized query discipline and `{@html}` sanitization are strong. The `safeParse()` gap and `as` casts on DB results are the main weaknesses — they mean validation failures throw uncontrolled errors and the type system trusts DB shape blindly.

---

### 3. CLAUDE.md audit

Every "always"/"never"/"must"/"critical" statement from the project's CLAUDE.md files, assessed for mechanical enforceability:

| Statement | Source | Can be a type? | Can be a lint rule? | Can be a test? | Should stay in CLAUDE.md? |
|-----------|--------|:-:|:-:|:-:|:-:|
| NEVER add AI attribution to commits | Root + Global | No | No | No | Yes (behavioral) |
| ALWAYS run preflight checks before commits | Root + Global | No | No | Yes (pre-commit hook) | No |
| ALWAYS include InfoSec comments for security-relevant code | Root + Global | No | Partially | No | Yes (judgment needed) |
| NEVER use `any` type in TypeScript | Root + Global | Yes (`strict`) | Yes (`no-explicit-any`) | No | No |
| ALWAYS validate external data with Zod schemas | Root | Partially | Yes (custom rule) | Yes | No |
| ALWAYS use Svelte 5 Runes syntax | Root | No | Yes (svelte plugin) | No | No |
| Never generate Svelte 3/4 syntax | Root | No | Yes (svelte plugin) | No | No |
| Use `onclick` handlers (not `on:click`) | Root | No | Yes (svelte plugin) | No | No |
| No `{@html}` with unsanitized content | Root checklist | No | Yes (`no-raw-html`) | Yes | No |
| All DB queries use `.bind()` | Root checklist | No | Yes (custom rule) | Yes (contract test) | No |
| Cookies set with `httpOnly`, `secure`, `sameSite` | Root checklist | Partially | Yes (custom rule) | Yes | No |
| No secrets in `PUBLIC_` env vars | Root checklist | No | Yes (custom rule) | No | No |
| Browser APIs guarded with `browser` check | Root checklist | No | Yes (custom rule) | No | No |
| Types regenerated (`npm run check`) | Root checklist | No | No | Yes (CI step) | No |
| Error pages don't leak stack traces | Root checklist | No | No | Yes (E2E test) | Yes (judgment) |
| All `{@html}` must pass through `$lib/sanitize.ts` | hanawa-cms | No | Yes (`no-raw-html`) | Yes | No |
| Use Zod schemas for all user input | hanawa-cms | Partially | Yes (custom rule) | Yes | No |
| All security-relevant code must include InfoSec comments | hanawa-cms | No | Partially | No | Yes (judgment) |
| ALL version references must be updated when releasing | hanawa-cms | No | No | Yes (`version:check`) | Yes (process) |
| Authorization checks on protected routes/data | Root checklist | No | No | Yes (integration test) | Yes (domain) |
| CSRF protection on API routes | Root checklist | No | Partially | Yes | Yes (domain) |

**Count:** Of ~21 enforcement statements, **~14 could be mechanically enforced** via types, lint rules, or tests. Only ~7 genuinely require prose documentation (behavioral directives, domain knowledge, process notes).

**Rating: weak.** The CLAUDE.md files carry too much enforcement burden. When a statement like "never use `any`" lives in prose, it competes with hundreds of other lines for attention. Moving it to `@typescript-eslint/no-explicit-any: error` makes it a compiler error that can't be ignored.

---

### 4. Lint rule coverage

**Oxlint layer (fast pass):**

| Requirement | Status |
|-------------|--------|
| `oxlint` installed as devDependency | **Missing** |
| `.oxlintrc.json` with `correctness: error`, `suspicious: warn`, `perf: warn` | **Missing** (file doesn't exist) |
| Plugins: `typescript`, `import`, `unicorn`, `promise` | **N/A** (no config) |
| Svelte-incompatible rules disabled (`no-unused-vars` off) | **N/A** (no config) |

**ESLint layer (Svelte + custom rules):**

| Requirement | Status |
|-------------|--------|
| `eslint-plugin-svelte` installed + configured | **Present** (v2.46.0, flat/recommended) |
| `eslint-plugin-oxlint` installed, placed last in flat config | **Missing** |
| Custom `no-raw-html` rule implemented | **Missing** |
| Custom `no-binding-leak` rule implemented | **Missing** |
| Custom `no-schema-parse` rule implemented | **Missing** |
| Custom `no-silent-catch` rule implemented | **Missing** |
| `esolia` plugin registered | **Missing** |
| `eslint-rules/` directory exists | **Missing** |

**Script wiring:**

| Requirement | Status |
|-------------|--------|
| `lint` script chains oxlint before eslint | **No** — `lint` is `eslint .` only |
| `verify` script chains `lint` → `check` → `test:unit` | **Missing** (no `verify` script) |

**What IS in place:**
- ESLint 9.17.0 with flat config
- `eslint-plugin-svelte` 2.46.0 with Svelte 5 recommended rules
- `typescript-eslint` 8.19.0
- Prettier 3.4.2 + `prettier-plugin-svelte`
- Husky pre-commit hook running `lint-staged` (eslint --fix + prettier)

**Rating: weak.** The ESLint + Svelte foundation is solid, but the two-tier strategy from `LINTING_STRATEGY.md` is not implemented. The fast oxlint pass, the custom backpressure rules, and the `verify` script are all absent.

---

### 5. Test coverage assessment

| Question | Answer |
|----------|--------|
| Unit tests for utility functions? | **None** — `sanitize.ts`, `db.ts` transform functions, and validation helpers have zero test coverage |
| Contract tests for D1/R2/KV? | **None** |
| `verify` script? | **Missing** |
| Test runner configured? | **No** — no vitest or jest in devDependencies, no test config file |

**Most impactful missing test:** Unit tests for `src/lib/sanitize.ts`. This module is the XSS prevention boundary — every `{@html}` in the app relies on it. A single regression in `sanitizeHtml()` would expose all 10 `{@html}` sites to XSS. This is the highest-value test in the entire codebase.

**Second most impactful:** Contract tests for D1's `.first()` (returns `null`, not `undefined`) and `.batch()` (returns array of result objects). These behavioral guarantees are easy to get wrong and would catch AI-generated code that assumes the wrong return shape.

**Rating: weak.** The complete absence of tests means the verification pyramid has no behavioral layer. The self-verification loop described in the backpressure guide cannot function — Claude Code generates code but has no way to validate it beyond type checking and linting.

---

### 6. Tenant isolation

**Architecture:** Hanawa is a **multi-site CMS** (not a multi-tenant SaaS). The isolation unit is `site_id`, not `org_id`. eSolia controls all sites.

**Schema:** Content tables have `site_id` foreign keys, but it's optional on `fragments` and `assets` (allowing global/shared resources).

**Query patterns:** Load functions in `src/routes/` query content across **all sites** by default. Site filtering is applied only when the user provides a `?site=` query parameter. There is no default "show only your site" behavior.

**Authentication:** CF Access JWT validates identity. The user object is set in `hooks.server.ts:106-117` with a hardcoded `role: 'admin'` for all authenticated users. A TODO comment notes: "Implement role lookup from D1 users table."

**No user-site membership table.** The schema has no `user_sites` or equivalent junction table. There's no way to restrict which sites a user can access.

**Risk assessment:** For a single-organization internal tool behind CF Access, this is **acceptable but fragile**. The risk is low today (all users are trusted eSolia staff). But as the system grows or if external collaborators gain access, the lack of site-level authorization becomes a vulnerability. An authenticated user can view and modify content for any site.

**Rating: weak** (for formal multi-site isolation). The backpressure guide's tenant isolation pattern (scoped query helpers, `TenantContext` type, `no-raw-db-prepare` lint rule) is not implemented. However, the urgency is lower than in a true multi-tenant SaaS because the trust boundary is CF Access, not per-site membership.

---

## Gap summary vs. LINTING_STRATEGY.md

| Component | Reference config | Current state | Gap |
|-----------|-----------------|---------------|-----|
| oxlint | `pnpm add -D oxlint` | Not installed | Full |
| `.oxlintrc.json` | SvelteKit template with plugins | Doesn't exist | Full |
| `eslint-plugin-oxlint` | Last entry in flat config | Not installed | Full |
| `eslint-rules/no-raw-html.js` | Implementation provided | Doesn't exist | Full |
| `eslint-rules/no-binding-leak.js` | Implementation provided | Doesn't exist | Full |
| `eslint-rules/no-schema-parse.js` | Implementation provided | Doesn't exist | Full |
| `eslint-rules/no-silent-catch.js` | Implementation provided | Doesn't exist | Full |
| `esolia` plugin in eslint.config.js | Plugin object with 4 rules | Not registered | Full |
| `lint` script | `oxlint && eslint .` | `eslint .` only | Partial |
| `verify` script | `lint && check && test:unit` | Doesn't exist | Full |
| vitest | `vitest run` in test:unit | Not installed | Full |
| `noUncheckedIndexedAccess` | Enabled in tsconfig | Not enabled | Full |
| `exactOptionalPropertyTypes` | Enabled in tsconfig | Not enabled | Full |

---

## Phase assessment

Per the backpressure guide's phased implementation plan:

- **Phase 1 (Foundation):** Partially complete. `strict: true` is enabled and `eslint-plugin-svelte` is configured. But `noUncheckedIndexedAccess`, the `verify` script, and oxlint are missing.
- **Phase 2 (Custom rules):** Not started. No custom ESLint rules exist.
- **Phase 3 (Contract tests):** Not started. No tests of any kind exist.
- **Phase 4 (Shared tooling):** Not applicable yet.

**Overall readiness: early Phase 1.**

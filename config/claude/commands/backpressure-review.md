# Backpressure Review

Deep review of this project against the quality enforcement strategy. This command handles the judgment-based checks that deterministic tools cannot cover.

## Instructions

First, fetch the `sveltekit-backpressure` standard from the esolia-standards MCP server (or read `docs/shared/guides/SVELTEKIT_BACKPRESSURE.md` if available locally).

Perform the following review, then output a structured report.

### 1. Type system audit

Examine `src/app.d.ts` (or equivalent):

- Is `Locals.user` a simple `User | null`, or a discriminated union that forces exhaustive handling?
- Is there a `TenantContext` type (or equivalent) that makes unscoped queries structurally impossible?
- Are load function return types narrow and explicit (using `satisfies`), or wide and trusting?

Rate: strong / adequate / weak. Recommend specific changes.

### 2. Data boundary validation

Search for D1 query patterns (`db.prepare`, `.first()`, `.all()`, `.batch()`):

- Are results validated through Zod schemas at the boundary, or cast with `as`?
- Is `safeParse()` used in form actions and API routes, or bare `.parse()`?
- Are there raw `db.prepare()` calls scattered across load functions, or centralized in a query helper module?

Rate: strong / adequate / weak. Count the violations.

### 3. CLAUDE.md audit

Read this project's `CLAUDE.md` and identify every "always" or "never" statement. For each one, assess:

| Statement | Can be a type? | Can be a lint rule? | Can be a test? | Should stay in CLAUDE.md? |
| --------- | -------------- | ------------------- | -------------- | ------------------------- |

Statements that can be mechanically enforced should migrate out of CLAUDE.md.

### 4. Lint rule coverage

Check the linting configuration against the `linting-strategy` standard:

- Is oxlint installed with `.oxlintrc.json`?
- Is `eslint-plugin-svelte` configured for Svelte 5?
- Is `eslint-plugin-oxlint` placed last in flat config?
- Are custom backpressure rules implemented?
- Does `package.json` chain oxlint before eslint?

Rate: strong / adequate / weak.

### 5. Test coverage assessment

- Are there unit tests for utility functions?
- Are there contract tests for D1/R2/KV behaviors?
- Is there a `verify` script that chains all checks?
- What's the most impactful missing test?

### 6. Tenant isolation

For multi-tenant repos:

- Are queries scoped via a helper module?
- Could an AI-generated load function skip the tenant filter?
- Would the type system catch it?

## Output format

Write to `docs/backpressure-review.md`:

```markdown
# Backpressure Review — [project name]

**Date:** [today]
**Overall readiness:** [Phase 1 / Phase 2 / Phase 3 / Phase 4]

## Scorecard

| Area             | Rating                   | Key finding |
| ---------------- | ------------------------ | ----------- |
| Type system      | strong/adequate/weak     | ...         |
| Data boundaries  | strong/adequate/weak     | ...         |
| CLAUDE.md        | strong/adequate/weak     | ...         |
| Lint rules       | strong/adequate/weak     | ...         |
| Test coverage    | strong/adequate/weak     | ...         |
| Tenant isolation | strong/adequate/weak/n-a | ...         |

## Recommended next actions

1. [highest-impact action]
2. [second action]
3. [third action]

## Detailed findings

[One section per area above]
```

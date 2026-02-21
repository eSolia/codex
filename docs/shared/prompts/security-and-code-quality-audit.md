# Security & Code Quality Audit Prompt

> **Purpose**: Paste this prompt into a Claude Code session to perform a comprehensive security hardening and code quality audit on a SvelteKit project.
>
> **Prerequisites**: The project should have `docs/shared/guides/SVELTEKIT_GUIDE.md` available (or rsynced) for CSP/nonce reference.
>
> **Last Updated**: February 2026
> **Version**: 1.2

---

## The Prompt

```
Perform a comprehensive security hardening and code quality audit of this project.
Read CLAUDE.md, any project guides (especially docs/shared/guides/SVELTEKIT_GUIDE.md),
and the full codebase structure before making any changes.

Work through the phases below in order. After each phase, summarize findings before
proceeding to implementation. Group related changes into logical commits.

=============================================================================
CRITICAL: PRE-AUDIT SAFETY CHECKS
=============================================================================

Before disabling ANY feature or config flag for security reasons, you MUST:

1. **Check if the feature is actively used in the codebase.** Search for imports,
   references, and consumers. If it's in use, DO NOT disable it without migrating
   all consumers first.

2. **Check if a CVE is already patched in the installed version.** Run
   `npm list <package>` to verify the current version. If the project is already
   on a patched version, disabling the feature is unnecessary and harmful.

3. **Verify your change doesn't break client-side navigation.** After any config
   change, run `npm run build` and test that the app loads and navigates correctly.

### Known Dangerous Mistakes

- **DO NOT disable `remoteFunctions`** if the project uses `data.remote.ts` files
  with top-level `await` in components. Disabling it breaks ALL client-side
  navigation with "Could not get the request store" errors. CVE-2026-22803 is
  patched in @sveltejs/kit 2.49.5+ — verify the installed version instead.

- **DO NOT disable `compilerOptions.experimental.async`** if `remoteFunctions` is
  enabled. They are a pair — async enables the top-level await that remote
  functions require.

- **DO NOT remove or comment out config flags without checking what depends on
  them.** Always grep the codebase for usage patterns first.

- **DO NOT put inline `<script>` tags in `<svelte:head>`** in layout or page
  components. During client-side navigation, Svelte re-creates `<head>` elements
  dynamically without the original SSR nonce, causing CSP violations. Put
  page-load scripts (e.g., dark mode detection) in `src/app.html` instead —
  SvelteKit auto-injects nonces there during SSR, and they run once without
  being re-inserted on navigation.

=============================================================================
PART A: SECURITY HARDENING
=============================================================================

## A1: Security Headers

Add security headers in hooks.server.ts (create if it doesn't exist):
- Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
- X-Content-Type-Options: nosniff
- X-Frame-Options: DENY
- Referrer-Policy: strict-origin-when-cross-origin
- Permissions-Policy: camera=(), microphone=(), geolocation=()
- X-XSS-Protection: 0

Do NOT set Content-Security-Policy manually — that's handled by kit.csp (A2).

## A2: CSP with Automatic Nonces

Add kit.csp.directives to svelte.config.js. SvelteKit auto-generates nonces
for inline scripts, eliminating 'unsafe-inline' from script-src.

Audit the codebase first to determine what external origins are needed:
- Search for fetch() calls, <script src>, <link href>, <img src> to find external domains
- Check for CDN fonts, analytics scripts, image CDNs, API endpoints
- Check for PWA manifests from external domains (needs manifest-src)
- Check for platform-injected scripts not visible in source code:
  - Cloudflare Pages auto-injects Web Analytics (`static.cloudflareinsights.com`)
    — add to both script-src AND connect-src
  - Vercel injects analytics/speed insights if enabled
  - Other hosting platforms may inject their own scripts

Build the CSP directives based on what the app actually uses:
- default-src: 'self'
- script-src: 'self' + any analytics/external script domains
- style-src: 'self' 'unsafe-inline' + any CDN font/style domains (unsafe-inline required for Svelte transitions)
- font-src: 'self' + any CDN font domains
- img-src: 'self' + image CDN domains + data: (+ blob: if needed)
- connect-src: 'self' + API domains + analytics domains
- frame-ancestors: 'none'
- base-uri: 'self'
- form-action: 'self'

Check for inline scripts that will cause CSP violations:
- Any `<script>` inside `<svelte:head>` in .svelte files must be moved to
  `src/app.html` — nonces are only reliable on initial SSR, not on client-side
  navigation when Svelte dynamically re-creates head elements
- `{@html}` that renders `<script>` tags bypasses nonce injection entirely

See docs/shared/guides/SVELTEKIT_GUIDE.md "Content Security Policy (CSP)" section
for full implementation details.

## A3: CVE Version Verification

Check installed versions against known CVEs. DO NOT disable features — verify
the installed version is patched:

- Run `npm list svelte @sveltejs/kit devalue` and compare against minimum safe
  versions in SVELTEKIT_GUIDE.md
- If a version is below the minimum, update it (do not disable the feature)
- If already at or above the minimum, note it as "patched" and move on
- Check `svelte.config.js` for experimental flags — verify they are needed by
  searching for their consumers (e.g., `data.remote.ts` files for remoteFunctions)

## A4: API Auth (if applicable)

If this project has an API with write endpoints:
- Add a global auth gate that blocks POST/PUT/PATCH/DELETE unless authenticated
- Whitelist genuinely public write endpoints (webhooks, federation inboxes, etc.)
- Ensure client-side write calls route through a server-side proxy that injects auth headers

## A5: Fetch Call Audit

Review all fetch() calls in .svelte files:
- Write operations (POST/PUT/PATCH/DELETE) should go through a server-side proxy
  or use server-only load functions — never send secrets from the client
- GET calls to public APIs are fine from the client
- Check for any hardcoded secrets or API keys in client code
- Check all {@html} usage is sanitized

=============================================================================
PART B: CODE QUALITY AUDIT
=============================================================================

## B1: Inventory

Map out the full codebase structure:
- List all components, routes, utilities, and their purposes
- Identify the tech stack, styling approach, and architectural patterns in use
- Note any conventions from CLAUDE.md or project config

## B2: Duplicate & Dead Code Detection

Search for:
- Components that do the same thing (or nearly the same thing) — consolidate into one
- Utility functions duplicated across files — extract to shared module
- Unused imports, unused variables, unused components, unused routes
- CSS classes defined but never applied
- Files that exist but are never imported anywhere
- Copy-pasted code blocks that differ only in minor details — extract a shared function

## B3: Pattern Consistency

Check for:
- Mixed patterns for the same task (e.g., some fetch calls use one style, others another)
- Inconsistent error handling (some endpoints handle errors, others don't)
- Inconsistent naming conventions (camelCase vs snake_case mixing)
- Components that take props they never use
- State management inconsistencies (some use $state, some use older patterns)
- Svelte 5 compliance: ensure $state/$derived/$props/$effect everywhere, no legacy syntax

## B4: Simplification Opportunities

Look for:
- Over-engineered abstractions (wrapper functions that just pass through)
- Config objects that could be simpler
- Deeply nested conditionals that could be flattened
- Components doing too many things that should be split
- Components that are too granular and should be merged
- Hardcoded values that should be constants or config
- Repeated inline styles that should be CSS classes

## B5: Implementation

For each finding:
1. Explain what you found and why it should change
2. Propose the specific change
3. Make the change

=============================================================================
RULES
=============================================================================

- Read every file before suggesting changes to it
- Do NOT add docstrings, comments, or type annotations to code you didn't otherwise change
- Do NOT add error handling for scenarios that can't happen
- Do NOT refactor working code just for style preferences
- Focus on genuine improvements to security, maintainability, readability, and correctness
- Keep changes focused and minimal — don't over-engineer
- Group related changes into logical commits with conventional commit messages
- Add InfoSec annotation to commit messages for security-relevant changes

=============================================================================
VERIFICATION
=============================================================================

After each security change, verify locally:
- `npm run check` — 0 type errors
- `npm run build` — successful build
- No new lint warnings from `npm run lint`

After deploying, verify in production:
- curl -sI https://your-site.com/ | grep -i content-security-policy (should contain nonce)
- Test at https://securityheaders.com — target A+ grade
- Test client-side navigation works (click nav links — pages must render, not just URL change)
- Test all write operations still work through the auth chain
- Open browser dev tools Console — no "request store" or CSP errors
- Confirm no regressions in UI functionality
```

---

## Usage

Reference this file in your session:

```
Please read /path/to/docs/shared/prompts/security-and-code-quality-audit.md and execute the audit described in it.
```

Or if the prompt file has been rsynced into the project:

```
Please read docs/shared/prompts/security-and-code-quality-audit.md and execute the audit described in it.
```

---
title: "SvelteKit SEO Checklist"
slug: sveltekit-seo-checklist
category: guides
tags: [sveltekit, seo, meta-tags, structured-data]
summary: "SEO best practices and checklist for SvelteKit applications"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
# SEO Checklist for Small Sites

Practical checklist for eSolia web properties (esolia.co.jp, Pulse, Periodic, Courier, Chōchō, Nexus, etc.) deployed on Cloudflare Workers. Covers the fundamentals that make a site "clean" for search engines before submitting sitemaps.

Works with **any framework** that renders HTML — SvelteKit, Hono, Astro, plain HTML. Framework-specific examples are provided where implementation differs.

**Common stack:** TypeScript, Cloudflare Workers, pnpm

---

## 1. Trailing Slashes

Pick a consistent URL style and stick with it — mixed styles cause duplicate content and wasted crawl budget from 301 redirects.

### Why this matters more than it looks

When your server redirects `/services` to `/services/` (or vice versa), the page still loads, so everything _appears_ fine. But:

1. **Every redirect burns a crawl.** Google allocates a crawl budget per site. A 301 from `/services` to `/services/` counts as two requests for one page. For small sites with limited crawl budget, this wastes discovery of other pages.
2. **Link equity splits.** External sites linking to `/services` pass PageRank to the non-canonical URL. The 301 forwards _most_ of it, but not 100%. Over time this leaks ranking power.
3. **Validation tools hide the problem.** Link checkers (including our own `checkBrokenLinks` and most CI tools) normalize trailing slashes before validating, so they report "all links OK" even when every link is triggering a redirect. You won't see the issue unless you explicitly check for it.
4. **Google Search Console shows it.** Under Coverage → "Page with redirect", you'll see every internal URL that redirects. A clean site should have zero of these for internal navigation.

The fix is simple but tedious: every `href`, every markdown `[link](/path/)`, every `<a>` in HTML content must match your chosen style. Server-side config alone is not enough — it only handles the _response_, not the links your pages emit.

### Configuration

<details>
<summary><strong>SvelteKit</strong></summary>

```ts
// src/routes/+layout.server.ts (or +layout.ts)
export const trailingSlash = 'always';
```

This makes SvelteKit:

- Generate all prerendered pages at `/path/index.html` (not `/path.html`)
- 301-redirect any request to `/path` → `/path/`
- Generate `<a>` tags from `goto()` and `$app/navigation` with trailing slashes

But it does **not** fix hardcoded links in your templates, markdown content, or YAML data files.

</details>

<details>
<summary><strong>Hono</strong></summary>

```ts
// src/index.ts or src/middleware/trailing-slash.ts
import { trimTrailingSlash } from 'hono/trailing-slash';

// Option A: enforce trailing slashes (redirect /path → /path/)
app.use(appendTrailingSlash());

// Option B: strip trailing slashes (redirect /path/ → /path)
app.use(trimTrailingSlash());
```

Hono's built-in middleware handles the redirect. If you prefer not to use middleware, handle it manually:

```ts
app.use('*', async (c, next) => {
  const url = new URL(c.req.url);
  if (url.pathname !== '/' && !url.pathname.endsWith('/') && !url.pathname.includes('.')) {
    return c.redirect(url.pathname + '/' + url.search, 301);
  }
  await next();
});
```

</details>

<details>
<summary><strong>Static HTML / Other</strong></summary>

For static sites or other frameworks, enforce trailing slashes at the CDN/server level (e.g., Cloudflare Page Rules or `_redirects` file) and ensure all hardcoded links match.

</details>

### What to check

| Location          | Example                  | Fix                       |
| ----------------- | ------------------------ | ------------------------- |
| HTML templates    | `href="/services"`       | `href="/services/"`       |
| Template literals | `` href=`/services` ``   | `` href=`/services/` ``   |
| Markdown links    | `[text](/about/contact)` | `[text](/about/contact/)` |
| HTML in markdown  | `<a href="/pricing">`    | `<a href="/pricing/">`    |
| YAML/JSON data    | `ctaurl: "/en/services"` | `ctaurl: "/en/services/"` |
| JSON-LD schemas   | `"url": "/en/about"`     | `"url": "/en/about/"`     |
| Sitemap entries   | `<loc>.../path</loc>`    | `<loc>.../path/</loc>`    |

### What to skip

Not everything needs a trailing slash:

- **Root `/`** — already correct
- **Static assets** — `/assets/logo.png`, `/favicon.ico`, etc.
- **Files with extensions** — `.pdf`, `.xml`, `.json`, `.txt`
- **External links** — only internal paths matter
- **Anchors/queries** — `/path/?q=x` and `/path/#section` are fine (the path part has the slash)

### Quick grep to find violations

```bash
# HTML/template files: internal links missing trailing slashes
grep -rn 'href="\/[^"]*[^/"]"' src/ --include="*.svelte" --include="*.ts" --include="*.tsx" --include="*.html" \
  | grep -v '/assets/' | grep -v '\.\w\+"'

# Markdown files: links missing trailing slashes
grep -rn '\](/[^)]*[^/)])' content/ --include="*.md" \
  | grep -v '/assets/' | grep -v '\.\w\+)'

# YAML data files
grep -rn 'url:.*"/[^"]*[^/"]"' src/ content/ --include="*.yml" --include="*.yaml"
```

### Automated enforcement (recommended)

For the main eSolia site, we added a `checkTrailingSlashes()` function to the content quality test suite. For other sites, we have a portable vitest test file and a GitHub Actions workflow. See [Appendix A: Reusable SEO Test Suite](#appendix-a-reusable-seo-test-suite).

---

## 2. Meta Tags: Title and Description

Every public page needs a unique `<title>` and `<meta name="description">`. These are what Google shows in search results.

### Length guidelines

| Field           | English      | Japanese     | Why                                         |
| --------------- | ------------ | ------------ | ------------------------------------------- |
| **Title**       | 10–70 chars  | 2–40 chars   | Google truncates ~60 EN / ~32 full-width JA |
| **Description** | 50–160 chars | 20–160 chars | Both engines cap at ~160                    |

JA limits are lower in character count because each character carries more information.

### Implementation

<details>
<summary><strong>SvelteKit</strong></summary>

```svelte
<!-- src/routes/+layout.svelte or per-page +page.svelte -->
<script lang="ts">
    let { data } = $props();
</script>

<svelte:head>
    <title>{data.title}</title>
    <meta name="description" content={data.description} />
</svelte:head>
```

</details>

<details>
<summary><strong>Hono (HTML template strings)</strong></summary>

```ts
// In your route handler or render function
const html = `<!DOCTYPE html>
<html lang="${lang}">
<head>
    <title>${title}</title>
    <meta name="description" content="${description}" />
</head>
...`;
```

</details>

### Common mistakes

- **Same title on every page** — each page must be unique
- **"Home" or "Welcome" as title** — wasted; use your brand + value prop
- **No description** — Google will auto-generate one (poorly)
- **Keyword stuffing** — write for humans, not bots

---

## 3. Canonical URL

The canonical tag tells search engines which URL is the "real" one when the same content is reachable at multiple URLs.

<details>
<summary><strong>SvelteKit</strong></summary>

```svelte
<!-- src/routes/+layout.svelte -->
<script lang="ts">
    import { page } from '$app/stores';
    const SITE_URL = 'https://your-domain.com';
    let canonical = $derived(`${SITE_URL}${$page.url.pathname}`);
</script>

<svelte:head>
    <link rel="canonical" href={canonical} />
</svelte:head>
```

</details>

<details>
<summary><strong>Hono</strong></summary>

```ts
const SITE_URL = 'https://your-domain.com';

// In your HTML render function
const canonical = `${SITE_URL}${new URL(c.req.url).pathname}`;
const html = `<link rel="canonical" href="${canonical}" />`;
```

</details>

### Rules

- Always use the **full absolute URL** with `https://`
- Use the **preferred domain** (with or without `www` — pick one)
- Include the trailing slash if you enforce them
- Never include query parameters or fragments in the canonical
- For bilingual sites, each language version is its own canonical (don't point JA → EN)

---

## 4. Open Graph and Twitter Meta

These control how the page looks when shared on social media, Slack, Teams, etc.

```html
<!-- Open Graph -->
<meta property="og:type" content="website" />
<meta property="og:url" content="https://your-domain.com/page/" />
<meta property="og:title" content="Page Title" />
<meta property="og:description" content="Page description" />
<meta property="og:image" content="https://your-domain.com/og-image.png" />
<meta property="og:locale" content="ja_JP" />

<!-- Twitter -->
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="Page Title" />
<meta name="twitter:description" content="Page description" />
<meta name="twitter:image" content="https://your-domain.com/og-image.png" />
```

These tags are plain HTML — the same in every framework. Just include them in your `<head>`.

### OG image

- Recommended size: **1200x630px**
- Place in `static/og-image.png` (or equivalent static assets directory)

---

## 5. Structured Data (JSON-LD)

Structured data helps search engines understand your content and enables rich snippets.

### Minimal: Organization schema

Every site should have at least this on the homepage:

```html
<script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "eSolia Inc.",
    "alternateName": "株式会社イソリア",
    "url": "https://esolia.co.jp",
    "logo": "https://esolia.co.jp/logo.png",
    "contactPoint": {
      "@type": "ContactPoint",
      "telephone": "+81-3-4577-3380",
      "contactType": "customer service",
      "availableLanguage": ["English", "Japanese"]
    }
  }
</script>
```

### Product/SaaS landing sites

For Pulse, Periodic, Courier, Nexus, etc., add `SoftwareApplication` or `Product` schema:

```json
{
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  "name": "PROdb Pulse",
  "applicationCategory": "BusinessApplication",
  "operatingSystem": "Web",
  "url": "https://pulse.esolia.co.jp",
  "description": "Real-time business metrics dashboard",
  "provider": {
    "@type": "Organization",
    "name": "eSolia Inc.",
    "url": "https://esolia.co.jp"
  }
}
```

### Safety: sanitize JSON-LD

If any schema values come from user input or dynamic data, escape `</script>` sequences:

```ts
function safeJsonLd(obj: Record<string, unknown>): string {
  return JSON.stringify(obj).replace(/<\/script/gi, '<\\/script');
}
```

### Validate

- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema.org Validator](https://validator.schema.org/)

---

## 6. Sitemap

A sitemap tells search engines which pages exist and when they last changed.

<details>
<summary><strong>SvelteKit (server route)</strong></summary>

```ts
// src/routes/sitemap.xml/+server.ts
import type { RequestHandler } from './$types';

const SITE_URL = 'https://your-domain.com';
const pages = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/en/', priority: '1.0', changefreq: 'weekly' }
  // ... all your pages
];

export const GET: RequestHandler = () => {
  const urls = pages
    .map(
      (p) => `  <url>
    <loc>${SITE_URL}${p.path}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join('\n');

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    { headers: { 'Content-Type': 'application/xml' } }
  );
};

export const prerender = true;
```

</details>

<details>
<summary><strong>Hono (route handler)</strong></summary>

```ts
const SITE_URL = 'https://your-domain.com';
const pages = [
  { path: '/', priority: '1.0', changefreq: 'weekly' },
  { path: '/en/', priority: '1.0', changefreq: 'weekly' }
];

app.get('/sitemap.xml', (c) => {
  const urls = pages
    .map(
      (p) => `  <url>
    <loc>${SITE_URL}${p.path}</loc>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join('\n');

  return c.body(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>`,
    200,
    { 'Content-Type': 'application/xml' }
  );
});
```

</details>

<details>
<summary><strong>Static file</strong></summary>

Place a `sitemap.xml` in your `static/` directory. Fine for sites where the page list rarely changes.

</details>

### Key rules

- **Include every indexable page** — if it has `noindex`, leave it out
- **Use absolute URLs** with the canonical domain
- **Include trailing slashes** to match your URL style
- **Both language versions** get separate entries
- For **bilingual sites**, add hreflang in the sitemap (see section 9)

---

## 7. Robots.txt

Tells crawlers which paths to avoid and where to find the sitemap.

<details>
<summary><strong>SvelteKit (server route)</strong></summary>

```ts
// src/routes/robots.txt/+server.ts
import type { RequestHandler } from './$types';

export const GET: RequestHandler = () => {
  return new Response(
    `User-agent: *
Allow: /
Disallow: /api/
Disallow: /dash/

Sitemap: https://your-domain.com/sitemap.xml`,
    {
      headers: { 'Content-Type': 'text/plain' }
    }
  );
};

export const prerender = true;
```

</details>

<details>
<summary><strong>Hono (route handler)</strong></summary>

```ts
app.get('/robots.txt', (c) => {
  return c.text(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /s/

Sitemap: https://your-domain.com/sitemap.xml`);
});
```

</details>

<details>
<summary><strong>Static file</strong></summary>

Place a `robots.txt` in your `static/` directory.

</details>

### Rules

- `Allow: /` is the default — only add `Disallow` for paths you want hidden
- Always include the `Sitemap:` directive with full URL
- Don't block CSS/JS — Google needs them to render your pages
- For Hono apps: disallow `/api/`, `/admin/`, `/s/` (share tokens), `/auth/` etc.

---

## 8. Security Headers (SEO-Adjacent)

Google considers HTTPS and page experience signals. These headers should be on every response.

<details>
<summary><strong>SvelteKit (hooks.server.ts)</strong></summary>

```ts
const securityHeaders: Record<string, string> = {
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
};

for (const [key, value] of Object.entries(securityHeaders)) {
  response.headers.set(key, value);
}
```

</details>

<details>
<summary><strong>Hono (secureHeaders middleware)</strong></summary>

```ts
import { secureHeaders } from 'hono/secure-headers';

app.use(
  secureHeaders({
    strictTransportSecurity: 'max-age=63072000; includeSubDomains; preload',
    xContentTypeOptions: 'nosniff',
    xFrameOptions: 'DENY',
    referrerPolicy: 'strict-origin-when-cross-origin',
    permissionsPolicy: {
      camera: [],
      microphone: [],
      geolocation: []
    }
  })
);
```

</details>

---

## 9. Hreflang Tags (Bilingual Sites)

For sites with JA and EN versions, hreflang tells Google which version to show based on the searcher's language.

```html
<link rel="alternate" hreflang="ja" href="https://your-domain.com/" />
<link rel="alternate" hreflang="en" href="https://your-domain.com/en/" />
<link rel="alternate" hreflang="x-default" href="https://your-domain.com/" />
```

`x-default` points to the "fallback" version — typically the primary language (JA for eSolia).

### In sitemap (alternative to HTML tags)

```xml
<url>
  <loc>https://your-domain.com/</loc>
  <xhtml:link rel="alternate" hreflang="ja" href="https://your-domain.com/" />
  <xhtml:link rel="alternate" hreflang="en" href="https://your-domain.com/en/" />
</url>
```

Add `xmlns:xhtml="http://www.w3.org/1999/xhtml"` to the `<urlset>` tag.

---

## 10. Pre-Submission Checklist

Run through this before submitting a sitemap to Google Search Console or Bing Webmaster Tools.

### Automated checks

```bash
# Build the site (catches build errors)
pnpm run build

# Check the sitemap is valid XML
curl -s https://your-domain.com/sitemap.xml | head -20

# Check robots.txt
curl -s https://your-domain.com/robots.txt

# Check trailing slashes (should 200, not 301)
curl -sI https://your-domain.com/features/ | head -1

# Check a page without trailing slash redirects properly
curl -sI https://your-domain.com/features | grep -E "HTTP|Location"

# Validate structured data
# → https://search.google.com/test/rich-results
```

### Manual review

- [ ] Every public page has a unique `<title>` within length limits
- [ ] Every public page has a unique `<meta name="description">` within length limits
- [ ] Every public page has a `<link rel="canonical">` with absolute URL
- [ ] Homepage has Organization JSON-LD schema
- [ ] Product/service pages have appropriate schema
- [ ] Sitemap lists all indexable pages with correct URLs
- [ ] Robots.txt exists and references the sitemap
- [ ] All internal links use consistent trailing slash style
- [ ] OG meta tags present (title, description, image, url)
- [ ] Hreflang tags present on bilingual pages
- [ ] Security headers set (HSTS, nosniff, X-Frame-Options)
- [ ] No `noindex` tags on pages you want indexed
- [ ] Images have `alt` text
- [ ] Pages load in < 3 seconds (check with Lighthouse)
- [ ] Non-public routes disallowed in robots.txt (`/api/`, `/admin/`, `/s/`, `/auth/`)

### Submit sitemaps

```bash
# Google Search Console
# → https://search.google.com/search-console
# Add property → URL prefix → your domain
# Sitemaps → Add → sitemap.xml

# Bing Webmaster Tools
# → https://www.bing.com/webmasters
# Add site → verify → Submit sitemap
# Or use the API:
npx tsx scripts/submit-bing.mts
```

### IndexNow (instant Bing/Yandex notification)

For Cloudflare-hosted sites, IndexNow notifies Bing immediately when pages change. See the main eSolia repo's `indexnow.yml` workflow for the pattern.

---

## Quick Reference: Minimal Setup for a New Site

### SvelteKit

1. `src/routes/+layout.server.ts` — set `trailingSlash = 'always'`
2. `src/routes/+layout.svelte` — canonical, hreflang, OG tags
3. `src/routes/+page.svelte` — homepage title, description, JSON-LD
4. `src/routes/sitemap.xml/+server.ts` — sitemap route
5. `src/routes/robots.txt/+server.ts` — robots route
6. `src/hooks.server.ts` — security headers

### Hono

1. Trailing slash middleware in `src/index.ts`
2. Meta tags (title, description, canonical, OG) in HTML render functions
3. JSON-LD schema in landing/homepage HTML
4. `app.get('/sitemap.xml', ...)` route
5. `app.get('/robots.txt', ...)` route (or `static/robots.txt`)
6. `secureHeaders()` middleware

---

## Appendix A: Reusable SEO Test Suite

A portable vitest test file and GitHub Actions workflow you can drop into any repo. The test suite checks:

1. **Trailing slashes** — all internal `href` and markdown links end with `/`
2. **Meta tag presence** — pages have `<title>`, root layout/page has canonical and OG tags
3. **Title/description lengths** — hardcoded strings checked against per-language limits
4. **JSON-LD presence** — homepage includes `application/ld+json`

### Setup

**1. Copy the test file** into your repo:

```
docs/shared/guides/seo-check.test.ts  →  src/lib/seo/seo-check.test.ts
                                      (or tests/seo-check.test.ts for non-SvelteKit)
```

**2. Edit `SITE_CONFIG`** at the top of the test file:

```ts
const SITE_CONFIG = {
  framework: 'sveltekit', // 'sveltekit' | 'hono' | 'generic'
  sourceDir: path.resolve('src'),
  routesDir: path.resolve('src/routes'), // SvelteKit routes
  contentDirs: [], // markdown/YAML content dirs
  primaryLang: 'ja' as 'ja' | 'en',
  exemptRoutes: new Set(['dash', 'settings', 'login', 'callback', 'api']),
  // For Hono/generic: files that render public HTML
  htmlRenderFiles: [], // e.g. ['src/routes/landing/index.ts']
  titleLimits: { en: { min: 10, max: 70 }, ja: { min: 2, max: 40 } },
  descriptionLimits: { en: { min: 50, max: 160 }, ja: { min: 20, max: 160 } }
};
```

**For Hono apps**, set:

- `framework: 'hono'`
- `htmlRenderFiles`: list the specific `.ts` files that return public HTML (e.g., landing page, security pages). The test will scan these for meta tags and JSON-LD.
- `routesDir`: still useful for trailing-slash scanning across all source files
- `exemptRoutes`: add `api`, `admin`, `auth`, `s` (share tokens), etc.

**3. Run locally:**

```bash
pnpm vitest run src/lib/seo/seo-check.test.ts
# or for non-SvelteKit:
pnpm vitest run tests/seo-check.test.ts
```

**4. Copy the GitHub Actions workflow** into your repo:

```
docs/shared/guides/seo-check.yml  →  .github/workflows/seo-check.yml
```

Remove the `pnpm svelte-kit sync` step if your project is not SvelteKit.

### What the tests do

#### Trailing slashes

Scans source files for internal links:

- `href="/path"` in HTML/Svelte/TSX
- `href=\`/path\`` in template literals
- `[text](/path)` in markdown

Flags any internal path that doesn't end with `/`, skipping root `/`, static assets, and comments.

**File types scanned by framework:**

- SvelteKit: `.svelte`, plus `.md`/`.yml` in content dirs
- Hono/generic: `.ts`, `.tsx`, `.html`, plus `.md`/`.yml` in content dirs

#### Meta tag presence

- **SvelteKit**: Root `+layout.svelte` must have canonical and OG tags. Every non-exempt `+page.svelte` must have `<svelte:head>` with `<title>`.
- **Hono/generic**: Each file in `htmlRenderFiles` must include `<title>`, `<meta name="description"`, and `<link rel="canonical"`.

#### Meta tag lengths

For **hardcoded** title/description strings (not dynamic expressions): checks against language-appropriate min/max limits.

#### JSON-LD

Checks that at least one root-level page file includes `application/ld+json`.

### The workflow

```yaml
name: SEO Check
on:
  push:
    branches: [main]
    paths: ['src/**', 'content/**', 'static/**', 'package.json']
  pull_request:
    branches: [main]
    paths: ['src/**', 'content/**', 'static/**', 'package.json']

jobs:
  seo-check:
    name: SEO Quality
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm svelte-kit sync # Remove this line for non-SvelteKit projects
      - run: pnpm vitest run --reporter=verbose src/lib/seo/seo-check.test.ts
```

**For non-SvelteKit projects:** Remove the `svelte-kit sync` step and adjust the test file path if you placed it elsewhere (e.g., `tests/seo-check.test.ts`).

### Limitations

- **Dynamic meta tags** — titles/descriptions from load functions or API data can't be length-checked at the source level
- **Template literal links** — dynamic segments in template strings are partially checked
- **Content from CMS/API** — source-level checks can't see runtime data

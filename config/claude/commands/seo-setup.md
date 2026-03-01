# SEO Setup

Apply the SEO checklist to this project. Works with SvelteKit, Hono, and generic web projects. Checks trailing slashes, meta tags, JSON-LD, sitemap, robots.txt, and optionally installs a CI workflow.

## Instructions

Fetch the `sveltekit-seo-checklist` standard from the esolia-standards MCP server (or read `docs/shared/guides/SVELTEKIT_SEO_CHECKLIST.md` if available locally).

Arguments: $ARGUMENTS — Optional: "audit" (report only, no changes) or "ci" (only install the CI workflow).

### 1. Detect the framework

Read `package.json` and determine the project type:

- **SvelteKit**: has `@sveltejs/kit` in dependencies
- **Hono**: has `hono` in dependencies
- **Generic**: anything else

### 2. Understand the project

- Read `package.json` for dependencies and scripts
- Check for `content/` directory (markdown content pipeline)
- Check for existing `static/sitemap.xml`, `static/robots.txt`
- Check for existing security headers configuration

### 3. Audit current SEO state

| Check              | Status | Notes |
| ------------------ | ------ | ----- |
| Trailing slashes   | ?      |       |
| Meta tags          | ?      |       |
| Canonical URL      | ?      |       |
| OG tags            | ?      |       |
| Title/desc lengths | ?      |       |
| JSON-LD            | ?      |       |
| Sitemap            | ?      |       |
| robots.txt         | ?      |       |
| Security headers   | ?      |       |
| hreflang           | ?      |       |

If `$ARGUMENTS` is "audit", stop here.

### 4. Install fixes and CI workflow

Apply fixes for each failing check. Install the SEO test suite and CI workflow as appropriate.

**Do not commit — let the user review first.**

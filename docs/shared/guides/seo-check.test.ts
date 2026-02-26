/**
 * SEO quality checks for web projects.
 *
 * Works with SvelteKit, Hono, and generic HTML/TypeScript projects.
 * Drop this file into any repo and run with `pnpm vitest run`.
 *
 * Checks:
 *   1. Trailing slashes on internal links
 *   2. Meta tag presence (<title>, description, canonical, OG)
 *   3. Title/description length (hardcoded strings only)
 *   4. JSON-LD schema presence on root/landing page
 *
 * Configure SITE_CONFIG below for your site.
 */

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// ============================================================================
// CONFIGURATION — edit these for your site
// ============================================================================

const SITE_CONFIG = {
  /**
   * Framework type — determines which file patterns to scan and what to check.
   *   'sveltekit' — scans .svelte files, checks +page.svelte / +layout.svelte
   *   'hono'      — scans .ts/.tsx files, checks htmlRenderFiles for meta tags
   *   'generic'   — scans .ts/.tsx/.html files, checks htmlRenderFiles
   */
  framework: 'sveltekit' as 'sveltekit' | 'hono' | 'generic',

  /** Root source directory */
  sourceDir: path.resolve('src'),

  /** Root directory for SvelteKit routes (ignored for hono/generic) */
  routesDir: path.resolve('src/routes'),

  /** Additional directories to scan for links (content, data, etc.) */
  contentDirs: [] as string[],

  /** Site's primary language */
  primaryLang: 'ja' as 'ja' | 'en',

  /**
   * Pages/routes that don't need SEO meta (behind auth, utility pages, etc.)
   * Use the route directory name (e.g., 'settings', 'dash', 'login', 'api', 'admin')
   */
  exemptRoutes: new Set(['dash', 'settings', 'login', 'callback', 'api', 'admin', 'auth']),

  /**
   * For hono/generic: specific files that render public-facing HTML.
   * These will be checked for meta tags, canonical, OG, and JSON-LD.
   * Use paths relative to project root (e.g., 'src/routes/landing/index.ts')
   */
  htmlRenderFiles: [] as string[],

  /** Title length limits by language */
  titleLimits: {
    en: { min: 10, max: 70 },
    ja: { min: 2, max: 40 },
  },

  /** Description length limits by language */
  descriptionLimits: {
    en: { min: 50, max: 160 },
    ja: { min: 20, max: 160 },
  },
};

// ============================================================================
// HELPERS
// ============================================================================

const STATIC_PREFIXES = [
  '/assets/',
  '/images/',
  '/data/',
  '/favicon',
  '/.well-known/',
  '/_app/',
  '/static/',
];
const STATIC_EXTENSIONS = [
  '.pdf',
  '.svg',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.ico',
  '.vcf',
  '.xml',
  '.txt',
  '.json',
  '.woff',
  '.woff2',
  '.css',
  '.js',
  '.mjs',
  '.yaml',
  '.yml',
];

function isStaticAsset(href: string): boolean {
  if (STATIC_PREFIXES.some((p) => href.startsWith(p))) return true;
  const ext = path.extname(href).toLowerCase();
  return STATIC_EXTENSIONS.includes(ext);
}

function isExemptRoute(filePath: string): boolean {
  const baseDir =
    SITE_CONFIG.framework === 'sveltekit' ? SITE_CONFIG.routesDir : SITE_CONFIG.sourceDir;
  const relPath = path.relative(baseDir, filePath);
  const segments = relPath.split(path.sep);
  return segments.some((s) => {
    const cleaned = s.replace(/^\+.*/, '').replace(/\[.*\]/, '');
    return SITE_CONFIG.exemptRoutes.has(cleaned);
  });
}

/** Recursively find files matching a pattern */
function findFiles(dir: string, extensions: string[]): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      results.push(...findFiles(fullPath, extensions));
    } else if (extensions.some((ext) => entry.name.endsWith(ext))) {
      results.push(fullPath);
    }
  }
  return results;
}

interface LinkViolation {
  file: string;
  line: number;
  href: string;
  issue: string;
}

/** Extract internal links and check trailing slashes */
function checkTrailingSlashes(filePath: string, content: string): LinkViolation[] {
  const violations: LinkViolation[] = [];
  const lines = content.split('\n');
  const relFile = path.relative(process.cwd(), filePath);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === undefined) continue;

    // Skip comments
    if (line.trimStart().startsWith('//') || line.trimStart().startsWith('*')) continue;

    // Match href="/path" patterns (HTML, Svelte, JSX)
    const hrefRe =
      /href="(\/[^"#?\s]*)(?:[#?][^"\s]*)?"|\bhref=\{`(\/[^`#?\s]*)(?:[#?][^`\s]*)?`\}/g;
    let match: RegExpExecArray | null;
    while ((match = hrefRe.exec(line)) !== null) {
      const href = match[1] ?? match[2];
      if (!href || href === '/') continue;
      if (isStaticAsset(href)) continue;

      if (!href.endsWith('/')) {
        violations.push({
          file: relFile,
          line: i + 1,
          href,
          issue: 'missing trailing slash',
        });
      }
    }

    // Match template literal href patterns: href: `/path` or `<a href="/path">`
    const templateRe = /href=["']?(\/[^"'#?\s>]*)(?:[#?][^"'\s>]*)?["']?/g;
    while ((match = templateRe.exec(line)) !== null) {
      // Skip if already caught by the stricter regex above
      if (line.includes('href="') && match[0].startsWith('href="')) continue;
      if (line.includes('href={`') && match[0].startsWith('href={`')) continue;

      const href = match[1];
      if (!href || href === '/') continue;
      if (isStaticAsset(href)) continue;

      if (!href.endsWith('/')) {
        violations.push({
          file: relFile,
          line: i + 1,
          href,
          issue: 'missing trailing slash',
        });
      }
    }

    // Match markdown links [text](/path)
    const mdRe = /\[(?:[^\]]*)\]\((\/[^)#?\s]*)(?:[#?][^)\s]*)?\)/g;
    while ((match = mdRe.exec(line)) !== null) {
      const href = match[1];
      if (!href || href === '/') continue;
      if (isStaticAsset(href)) continue;

      if (!href.endsWith('/')) {
        violations.push({
          file: relFile,
          line: i + 1,
          href,
          issue: 'missing trailing slash',
        });
      }
    }
  }

  return violations;
}

// ---- SvelteKit-specific checks ----

function checkSvelteMetaPresence(filePath: string, content: string) {
  const relFile = path.relative(process.cwd(), filePath);
  const issues: string[] = [];

  const basename = path.basename(filePath);
  if (basename !== '+page.svelte' && basename !== '+layout.svelte') {
    return { file: relFile, issues: [] };
  }

  const isRootLayout =
    basename === '+layout.svelte' && path.dirname(filePath) === SITE_CONFIG.routesDir;

  if (isRootLayout) {
    if (!content.includes('rel="canonical"') && !content.includes("rel='canonical'")) {
      issues.push('Root layout missing <link rel="canonical">');
    }
    if (!content.includes('og:title') && !content.includes('og:description')) {
      issues.push('Root layout missing Open Graph meta tags');
    }
  }

  if (basename === '+page.svelte' && !isExemptRoute(filePath)) {
    const hasSvelteHead = content.includes('<svelte:head');
    if (!hasSvelteHead) {
      issues.push('Page missing <svelte:head> block');
    } else if (!content.includes('<title')) {
      issues.push('Page has <svelte:head> but no <title>');
    }
  }

  return { file: relFile, issues };
}

// ---- Hono/generic checks ----

function checkHtmlRenderFileMeta(filePath: string, content: string) {
  const relFile = path.relative(process.cwd(), filePath);
  const issues: string[] = [];

  // Check for <title> (in template strings, the tag appears as literal text)
  if (!content.includes('<title')) {
    issues.push('Missing <title> tag');
  }

  // Check for meta description
  if (
    !content.includes('name="description"') &&
    !content.includes("name='description'") &&
    !content.includes('name=\\"description\\"')
  ) {
    issues.push('Missing <meta name="description">');
  }

  // Check for canonical
  if (
    !content.includes('rel="canonical"') &&
    !content.includes("rel='canonical'") &&
    !content.includes('rel=\\"canonical\\"')
  ) {
    issues.push('Missing <link rel="canonical">');
  }

  // Check for OG tags
  if (!content.includes('og:title') && !content.includes('og:description')) {
    issues.push('Missing Open Graph meta tags');
  }

  return { file: relFile, issues };
}

/** Extract hardcoded title/description strings and check lengths */
function checkMetaLengths(filePath: string, content: string) {
  const relFile = path.relative(process.cwd(), filePath);
  const issues: string[] = [];

  // Extract hardcoded <title>string</title> (skip dynamic {expressions} and ${expressions})
  const titleMatch = content.match(/<title>([^{<$]+)<\/title>/);
  if (titleMatch?.[1]) {
    const title = titleMatch[1].trim();
    const lang =
      filePath.includes('/en/') || filePath.includes('/en.') || content.includes("lang === 'en'")
        ? 'en'
        : SITE_CONFIG.primaryLang;
    const limits = SITE_CONFIG.titleLimits[lang];

    if (title.length < limits.min) {
      issues.push(`Title "${title}" is ${title.length} chars (min ${limits.min} for ${lang})`);
    }
    if (title.length > limits.max) {
      issues.push(`Title "${title}" is ${title.length} chars (max ${limits.max} for ${lang})`);
    }
  }

  // Extract hardcoded description content="string"
  const descMatch = content.match(/meta\s+name=["']description["']\s+content=["']([^"'{$]+)["']/);
  if (descMatch?.[1]) {
    const desc = descMatch[1].trim();
    const lang =
      filePath.includes('/en/') || filePath.includes('/en.') ? 'en' : SITE_CONFIG.primaryLang;
    const limits = SITE_CONFIG.descriptionLimits[lang];

    if (desc.length < limits.min) {
      issues.push(`Description is ${desc.length} chars (min ${limits.min} for ${lang})`);
    }
    if (desc.length > limits.max) {
      issues.push(`Description is ${desc.length} chars (max ${limits.max} for ${lang})`);
    }
  }

  return { file: relFile, issues };
}

// ============================================================================
// TESTS
// ============================================================================

// Determine which file extensions to scan based on framework
const sourceExtensions: string[] = (() => {
  switch (SITE_CONFIG.framework) {
    case 'sveltekit':
      return ['.svelte'];
    case 'hono':
      return ['.ts', '.tsx'];
    case 'generic':
      return ['.ts', '.tsx', '.html'];
  }
})();

// Collect all files to scan
const sourceFiles = findFiles(SITE_CONFIG.sourceDir, sourceExtensions);
const contentFiles = SITE_CONFIG.contentDirs.flatMap((dir) =>
  findFiles(path.resolve(dir), ['.md', '.yml', '.yaml', '.svelte', '.html'])
);
const allFiles = [...sourceFiles, ...contentFiles];

// ---- Trailing slashes ----

describe('SEO: trailing slashes on internal links', () => {
  const filesWithLinks = allFiles.filter((f) => {
    // Skip exempt routes for link checking too
    if (isExemptRoute(f)) return false;
    const content = fs.readFileSync(f, 'utf-8');
    return (
      content.includes('href="/') ||
      content.includes("href='/") ||
      content.includes('href=`/') ||
      content.includes('](/')
    );
  });

  if (filesWithLinks.length === 0) {
    it('no internal links found (nothing to check)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  it.each(filesWithLinks.map((f) => [path.relative(process.cwd(), f), f] as const))(
    '%s',
    (_label, filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const violations = checkTrailingSlashes(filePath, content);

      expect(
        violations,
        violations.map((v) => `Line ${v.line}: ${v.href} (${v.issue}) in ${v.file}`).join('\n')
      ).toHaveLength(0);
    }
  );
});

// ---- Meta tag presence ----

describe('SEO: meta tag presence', () => {
  if (SITE_CONFIG.framework === 'sveltekit') {
    // SvelteKit: check +page.svelte and +layout.svelte files
    const pageFiles = sourceFiles.filter(
      (f) => (f.endsWith('+page.svelte') || f.endsWith('+layout.svelte')) && !isExemptRoute(f)
    );

    const rootLayout = path.join(SITE_CONFIG.routesDir, '+layout.svelte');
    if (fs.existsSync(rootLayout) && !pageFiles.includes(rootLayout)) {
      pageFiles.unshift(rootLayout);
    }

    if (pageFiles.length === 0) {
      it('no page files found', () => {
        expect(true).toBe(true);
      });
      return;
    }

    it.each(pageFiles.map((f) => [path.relative(process.cwd(), f), f] as const))(
      '%s',
      (_label, filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const result = checkSvelteMetaPresence(filePath, content);

        expect(
          result.issues,
          result.issues.map((issue) => `${issue} in ${result.file}`).join('\n')
        ).toHaveLength(0);
      }
    );
  } else {
    // Hono/generic: check configured htmlRenderFiles
    const renderFiles = SITE_CONFIG.htmlRenderFiles
      .map((f) => path.resolve(f))
      .filter((f) => fs.existsSync(f));

    if (renderFiles.length === 0) {
      it('no htmlRenderFiles configured (set SITE_CONFIG.htmlRenderFiles)', () => {
        expect(true).toBe(true);
      });
      return;
    }

    it.each(renderFiles.map((f) => [path.relative(process.cwd(), f), f] as const))(
      '%s',
      (_label, filePath) => {
        const content = fs.readFileSync(filePath, 'utf-8');
        const result = checkHtmlRenderFileMeta(filePath, content);

        expect(
          result.issues,
          result.issues.map((issue) => `${issue} in ${result.file}`).join('\n')
        ).toHaveLength(0);
      }
    );
  }
});

// ---- Meta tag lengths (hardcoded strings only) ----

describe('SEO: meta tag lengths', () => {
  // Determine which files to check
  const candidateFiles: string[] = (() => {
    if (SITE_CONFIG.framework === 'sveltekit') {
      return sourceFiles.filter((f) => f.endsWith('+page.svelte') && !isExemptRoute(f));
    }
    // For hono/generic, check the htmlRenderFiles
    return SITE_CONFIG.htmlRenderFiles.map((f) => path.resolve(f)).filter((f) => fs.existsSync(f));
  })();

  const filesWithMeta = candidateFiles.filter((f) => {
    const content = fs.readFileSync(f, 'utf-8');
    return (
      /<title>[^{<$]+<\/title>/.test(content) ||
      /meta\s+name=["']description["']\s+content=["'][^"'{$]+["']/.test(content)
    );
  });

  if (filesWithMeta.length === 0) {
    it('no hardcoded meta strings found (dynamic values not checked)', () => {
      expect(true).toBe(true);
    });
    return;
  }

  it.each(filesWithMeta.map((f) => [path.relative(process.cwd(), f), f] as const))(
    '%s',
    (_label, filePath) => {
      const content = fs.readFileSync(filePath, 'utf-8');
      const result = checkMetaLengths(filePath, content);

      expect(
        result.issues,
        result.issues.map((issue) => `${issue} in ${result.file}`).join('\n')
      ).toHaveLength(0);
    }
  );
});

// ---- JSON-LD presence on root page ----

describe('SEO: JSON-LD structured data', () => {
  it('root page or landing page includes JSON-LD schema', () => {
    const candidates: string[] = (() => {
      if (SITE_CONFIG.framework === 'sveltekit') {
        return [
          path.join(SITE_CONFIG.routesDir, '+page.svelte'),
          path.join(SITE_CONFIG.routesDir, '+layout.svelte'),
        ];
      }
      // For hono/generic, check htmlRenderFiles
      return SITE_CONFIG.htmlRenderFiles.map((f) => path.resolve(f));
    })();

    const hasJsonLd = candidates.some((f) => {
      if (!fs.existsSync(f)) return false;
      const content = fs.readFileSync(f, 'utf-8');
      return content.includes('application/ld+json');
    });

    expect(
      hasJsonLd,
      SITE_CONFIG.framework === 'sveltekit'
        ? 'No JSON-LD schema found in root +page.svelte or +layout.svelte. ' +
            'Add at least an Organization schema.'
        : 'No JSON-LD schema found in any htmlRenderFiles. ' +
            'Add at least an Organization schema to your landing/homepage.'
    ).toBe(true);
  });
});

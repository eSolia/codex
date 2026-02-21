/**
 * D1 Contract Tests
 *
 * These tests verify that our db.ts functions correctly handle
 * D1's behavioral contracts via a lightweight in-memory stub.
 * The stub documents what D1 actually returns — not SQL correctness.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createD1Stub } from './d1-stub';
import {
  getSite,
  getSiteBySlug,
  getSites,
  createSite,
  getContent,
  getContentBySite,
  createContent,
  updateContent,
  getFragment,
  getFragmentBySlug,
  getFragments,
  createFragment,
  updateFragment,
} from './db';

// Fixture factories
function makeSiteInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 's1',
    name: 'Test Site',
    slug: 'test-site',
    domain: 'test.example.com',
    description: 'A test site',
    default_language: 'ja',
    languages: ['ja', 'en'],
    settings: { theme: 'dark', features: ['comments'] },
    ...overrides,
  };
}

function makeContentInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c1',
    site_id: 's1',
    content_type_id: 'ct1',
    slug: 'hello-world',
    path: '/hello-world',
    title: 'Hello World',
    title_translations: { ja: 'こんにちは世界' },
    body: '<p>Hello</p>',
    body_translations: { ja: '<p>こんにちは</p>' },
    frontmatter: { draft: true, tags: ['intro'] },
    excerpt: 'A greeting',
    status: 'draft' as const,
    language: 'en',
    published_at: null,
    author_id: 'u1',
    ...overrides,
  };
}

function makeFragmentInput(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'f1',
    site_id: null,
    name: 'M365 Business Premium',
    slug: 'products/m365-business-premium',
    category: 'products',
    content_en: 'Microsoft 365 Business Premium overview...',
    content_ja: 'Microsoft 365 Business Premium の概要...',
    description: 'Product overview fragment',
    tags: ['m365', 'licensing'],
    version: '2025-01',
    status: 'active' as const,
    ...overrides,
  };
}

describe('D1 contract: .first() returns null for missing rows', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createD1Stub();
  });

  it('getSite returns null for nonexistent id', async () => {
    const result = await getSite(db, 'nonexistent');
    // D1 contract: .first() returns null, not undefined
    expect(result).toBeNull();
    expect(result).not.toBeUndefined();
  });

  it('getSiteBySlug returns null for nonexistent slug', async () => {
    const result = await getSiteBySlug(db, 'nope');
    expect(result).toBeNull();
  });

  it('getContent returns null for nonexistent id', async () => {
    const result = await getContent(db, 'nonexistent');
    expect(result).toBeNull();
  });

  it('getFragment returns null for nonexistent id', async () => {
    const result = await getFragment(db, 'nonexistent');
    expect(result).toBeNull();
  });

  it('getFragmentBySlug returns null for nonexistent slug', async () => {
    const result = await getFragmentBySlug(db, 'nope');
    expect(result).toBeNull();
  });
});

describe('D1 contract: .all() wraps results correctly', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createD1Stub();
    // Seed data
    await createSite(db, makeSiteInput());
    await createSite(db, makeSiteInput({ id: 's2', name: 'Other Site', slug: 'other' }));
    await createContent(db, makeContentInput());
    await createContent(db, makeContentInput({ id: 'c2', slug: 'second', title: 'Second Post' }));
    await createFragment(db, makeFragmentInput());
    await createFragment(
      db,
      makeFragmentInput({
        id: 'f2',
        slug: 'services/consulting',
        category: 'services',
        name: 'Consulting',
      })
    );
  });

  it('getSites returns typed array from .all().results', async () => {
    const sites = await getSites(db);
    expect(Array.isArray(sites)).toBe(true);
    expect(sites.length).toBe(2);
    expect(sites[0]!.name).toBe('Test Site');
  });

  it('getContentBySite returns array for matching site', async () => {
    const content = await getContentBySite(db, 's1');
    expect(Array.isArray(content)).toBe(true);
    expect(content.length).toBe(2);
  });

  it('getContentBySite returns empty array for nonexistent site', async () => {
    const content = await getContentBySite(db, 'nonexistent');
    expect(content).toEqual([]);
  });

  it('getFragments returns all fragments', async () => {
    const fragments = await getFragments(db);
    expect(fragments.length).toBe(2);
  });

  it('getFragments filters by category', async () => {
    const fragments = await getFragments(db, { category: 'products' });
    expect(fragments.length).toBe(1);
    expect(fragments[0]!.category).toBe('products');
  });
});

describe('D1 contract: write operations round-trip', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createD1Stub();
  });

  it('createSite inserts and retrieves correctly', async () => {
    const input = makeSiteInput();
    const site = await createSite(db, input);

    expect(site.id).toBe('s1');
    expect(site.name).toBe('Test Site');
    expect(site.slug).toBe('test-site');
    expect(site.domain).toBe('test.example.com');

    // Verify retrieval
    const retrieved = await getSite(db, 's1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe('s1');
  });

  it('createContent inserts and retrieves correctly', async () => {
    const input = makeContentInput();
    const content = await createContent(db, input);

    expect(content.id).toBe('c1');
    expect(content.title).toBe('Hello World');
    expect(content.status).toBe('draft');

    const retrieved = await getContent(db, 'c1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.title).toBe('Hello World');
  });

  it('createFragment inserts and retrieves correctly', async () => {
    const input = makeFragmentInput();
    const fragment = await createFragment(db, input);

    expect(fragment.id).toBe('f1');
    expect(fragment.name).toBe('M365 Business Premium');
    expect(fragment.site_id).toBeNull();

    const retrieved = await getFragment(db, 'f1');
    expect(retrieved).not.toBeNull();
    expect(retrieved!.slug).toBe('products/m365-business-premium');
  });

  it('updateContent applies changes and retrieves', async () => {
    await createContent(db, makeContentInput());

    const updated = await updateContent(db, 'c1', {
      title: 'Updated Title',
      status: 'published',
    });

    expect(updated.title).toBe('Updated Title');
    expect(updated.status).toBe('published');
  });

  it('updateFragment applies changes and retrieves', async () => {
    await createFragment(db, makeFragmentInput());

    const updated = await updateFragment(db, 'f1', {
      name: 'Updated Fragment',
      status: 'deprecated',
    });

    expect(updated.name).toBe('Updated Fragment');
    expect(updated.status).toBe('deprecated');
  });
});

describe('D1 contract: JSON field handling', () => {
  let db: D1Database;

  beforeEach(() => {
    db = createD1Stub();
  });

  it('Site languages and settings survive JSON round-trip', async () => {
    const input = makeSiteInput({
      languages: ['ja', 'en', 'zh'],
      settings: { theme: 'dark', features: ['comments', 'versions'], nested: { key: 'val' } },
    });
    const site = await createSite(db, input);

    expect(site.languages).toEqual(['ja', 'en', 'zh']);
    expect(site.settings).toEqual({
      theme: 'dark',
      features: ['comments', 'versions'],
      nested: { key: 'val' },
    });
  });

  it('Content frontmatter and translations survive JSON round-trip', async () => {
    const input = makeContentInput({
      title_translations: { ja: 'テスト', en: 'Test', zh: '测试' },
      body_translations: { ja: '<p>日本語</p>' },
      frontmatter: { tags: ['a', 'b'], meta: { priority: 1 } },
    });
    const content = await createContent(db, input);

    expect(content.title_translations).toEqual({ ja: 'テスト', en: 'Test', zh: '测试' });
    expect(content.body_translations).toEqual({ ja: '<p>日本語</p>' });
    expect(content.frontmatter).toEqual({ tags: ['a', 'b'], meta: { priority: 1 } });
  });

  it('Fragment tags survive JSON round-trip', async () => {
    const input = makeFragmentInput({
      tags: ['m365', 'licensing', 'business-premium', '日本語タグ'],
    });
    const fragment = await createFragment(db, input);

    expect(fragment.tags).toEqual(['m365', 'licensing', 'business-premium', '日本語タグ']);
  });
});

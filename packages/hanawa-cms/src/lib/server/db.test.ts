import { describe, it, expect } from 'vitest';
import {
  parseJson,
  buildUpdate,
  transformSite,
  transformContent,
  transformFragment,
  generateId,
} from './db';

describe('parseJson', () => {
  it('parses valid JSON string', () => {
    expect(parseJson('{"a":1}', {})).toEqual({ a: 1 });
  });

  it('returns fallback for null input', () => {
    expect(parseJson(null, { default: true })).toEqual({ default: true });
  });

  it('returns fallback for empty string', () => {
    expect(parseJson('', [])).toEqual([]);
  });

  it('returns fallback for invalid JSON', () => {
    expect(parseJson('{bad json', 'fallback')).toBe('fallback');
  });

  it('handles nested object round-trip', () => {
    const obj = { a: { b: [1, 2, 3] }, c: 'hello' };
    expect(parseJson(JSON.stringify(obj), {})).toEqual(obj);
  });
});

describe('buildUpdate', () => {
  it('builds SET clause for a single field', () => {
    const result = buildUpdate({ title: 'New Title' }, ['title']);
    expect(result.setClauses).toContain('title = ?');
    expect(result.values).toEqual(['New Title']);
    expect(result.setClauses).toContain("updated_at = datetime('now')");
  });

  it('builds SET clause for multiple fields in order', () => {
    const result = buildUpdate({ title: 'T', body: 'B', status: 'published' }, [
      'title',
      'body',
      'status',
    ]);
    expect(result.setClauses[0]).toBe('title = ?');
    expect(result.setClauses[1]).toBe('body = ?');
    expect(result.setClauses[2]).toBe('status = ?');
    expect(result.values).toEqual(['T', 'B', 'published']);
  });

  it('serializes JSON fields', () => {
    const tags = ['a', 'b'];
    const result = buildUpdate({ tags }, ['tags'], new Set(['tags']));
    expect(result.values[0]).toBe(JSON.stringify(tags));
  });

  it('filters out undefined fields', () => {
    const result = buildUpdate({ title: 'T', body: undefined }, ['title', 'body']);
    expect(result.setClauses).toHaveLength(2); // title + updated_at
    expect(result.values).toEqual(['T']);
  });

  it('returns only updated_at for empty updates', () => {
    const result = buildUpdate({}, ['title', 'body']);
    expect(result.setClauses).toEqual(["updated_at = datetime('now')"]);
    expect(result.values).toEqual([]);
  });

  it('ignores fields not in allowedFields', () => {
    const result = buildUpdate({ title: 'T', secret: 'S' }, ['title']);
    expect(result.setClauses).not.toContain('secret = ?');
    expect(result.values).toEqual(['T']);
  });
});

describe('transformSite', () => {
  it('maps all fields correctly', () => {
    const row = {
      id: 's1',
      name: 'Test Site',
      slug: 'test',
      domain: 'example.com',
      description: 'A test site',
      default_language: 'ja',
      languages: '["ja","en"]',
      settings: '{"theme":"dark"}',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    };
    const site = transformSite(row);
    expect(site.id).toBe('s1');
    expect(site.languages).toEqual(['ja', 'en']);
    expect(site.settings).toEqual({ theme: 'dark' });
  });

  it('uses fallback for null JSON fields', () => {
    const row = {
      id: 's1',
      name: 'Test',
      slug: 'test',
      domain: null,
      description: null,
      default_language: 'en',
      languages: null,
      settings: null,
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    };
    const site = transformSite(row);
    expect(site.languages).toEqual(['ja', 'en']);
    expect(site.settings).toEqual({});
  });
});

describe('transformContent', () => {
  it('maps all fields and parses JSON', () => {
    const row = {
      id: 'c1',
      site_id: 's1',
      content_type_id: 'ct1',
      slug: 'hello',
      path: '/hello',
      title: 'Hello',
      title_translations: '{"ja":"Konnichiwa"}',
      body: '<p>World</p>',
      body_translations: '{"ja":"Sekai"}',
      frontmatter: '{"draft":true}',
      excerpt: 'Summary',
      status: 'draft',
      language: 'en',
      published_at: null,
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
      author_id: 'u1',
    };
    const content = transformContent(row);
    expect(content.title_translations).toEqual({ ja: 'Konnichiwa' });
    expect(content.frontmatter).toEqual({ draft: true });
    expect(content.body_translations).toEqual({ ja: 'Sekai' });
  });

  it('uses fallback for missing JSON fields', () => {
    const row = {
      id: 'c1',
      site_id: 's1',
      content_type_id: 'ct1',
      slug: 'test',
      path: null,
      title: 'Test',
      title_translations: null,
      body: null,
      body_translations: null,
      frontmatter: null,
      excerpt: null,
      status: 'published',
      language: 'en',
      published_at: null,
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
      author_id: null,
    };
    const content = transformContent(row);
    expect(content.title_translations).toEqual({});
    expect(content.body_translations).toEqual({});
    expect(content.frontmatter).toEqual({});
  });
});

describe('transformFragment', () => {
  it('maps all fields and parses tags', () => {
    const row = {
      id: 'f1',
      site_id: null,
      name: 'M365 Intro',
      slug: 'products/m365',
      category: 'products',
      content_en: 'English content',
      content_ja: 'Japanese content',
      description: 'A fragment',
      tags: '["m365","licensing"]',
      version: '2025-01',
      status: 'active',
      created_at: '2025-01-01',
      updated_at: '2025-01-02',
    };
    const fragment = transformFragment(row);
    expect(fragment.tags).toEqual(['m365', 'licensing']);
    expect(fragment.status).toBe('active');
  });

  it('uses fallback for null tags', () => {
    const row = {
      id: 'f1',
      site_id: 's1',
      name: 'Test',
      slug: 'test',
      category: null,
      content_en: null,
      content_ja: null,
      description: null,
      tags: null,
      version: '1.0',
      status: 'draft',
      created_at: '2025-01-01',
      updated_at: '2025-01-01',
    };
    const fragment = transformFragment(row);
    expect(fragment.tags).toEqual([]);
  });
});

describe('generateId', () => {
  it('generates id with prefix', () => {
    const id = generateId('doc');
    expect(id).toMatch(/^doc_/);
  });

  it('generates id without prefix', () => {
    const id = generateId();
    expect(id).not.toContain('_');
  });

  it('produces unique IDs across calls', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId('test')));
    expect(ids.size).toBe(100);
  });

  it('includes 8-char random portion after timestamp', () => {
    const id = generateId('x');
    const parts = id.split('_');
    // The second part is timestamp (base36) + 8 random chars
    expect(parts[1]!.length).toBeGreaterThanOrEqual(9); // at least 1 timestamp char + 8 random
  });
});

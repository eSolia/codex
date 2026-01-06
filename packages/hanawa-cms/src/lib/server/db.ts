// Database utilities for Hanawa CMS

import type { Site, ContentType, Content, Fragment, Asset, User } from '$lib/types';

// Helper to parse JSON fields from D1
function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// Transform D1 row to typed object
function transformSite(row: Record<string, unknown>): Site {
  return {
    id: row.id as string,
    name: row.name as string,
    slug: row.slug as string,
    domain: row.domain as string | null,
    description: row.description as string | null,
    default_language: row.default_language as string,
    languages: parseJson<string[]>(row.languages as string, ['ja', 'en']),
    settings: parseJson<Record<string, unknown>>(row.settings as string, {}),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function transformContent(row: Record<string, unknown>): Content {
  return {
    id: row.id as string,
    site_id: row.site_id as string,
    content_type_id: row.content_type_id as string,
    slug: row.slug as string,
    path: row.path as string | null,
    title: row.title as string,
    title_translations: parseJson<Record<string, string>>(row.title_translations as string, {}),
    body: row.body as string | null,
    body_translations: parseJson<Record<string, string>>(row.body_translations as string, {}),
    frontmatter: parseJson<Record<string, unknown>>(row.frontmatter as string, {}),
    excerpt: row.excerpt as string | null,
    status: row.status as Content['status'],
    language: row.language as string,
    published_at: row.published_at as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    author_id: row.author_id as string | null,
  };
}

function transformFragment(row: Record<string, unknown>): Fragment {
  return {
    id: row.id as string,
    site_id: row.site_id as string | null,
    name: row.name as string,
    slug: row.slug as string,
    category: row.category as string | null,
    content_en: row.content_en as string | null,
    content_ja: row.content_ja as string | null,
    description: row.description as string | null,
    tags: parseJson<string[]>(row.tags as string, []),
    version: row.version as string,
    status: row.status as Fragment['status'],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

// Sites
export async function getSites(db: D1Database): Promise<Site[]> {
  const result = await db.prepare('SELECT * FROM sites ORDER BY name').all();
  return result.results.map(transformSite);
}

export async function getSite(db: D1Database, id: string): Promise<Site | null> {
  const result = await db.prepare('SELECT * FROM sites WHERE id = ?').bind(id).first();
  return result ? transformSite(result as Record<string, unknown>) : null;
}

export async function getSiteBySlug(db: D1Database, slug: string): Promise<Site | null> {
  const result = await db.prepare('SELECT * FROM sites WHERE slug = ?').bind(slug).first();
  return result ? transformSite(result as Record<string, unknown>) : null;
}

export async function createSite(
  db: D1Database,
  site: Omit<Site, 'created_at' | 'updated_at'>
): Promise<Site> {
  await db
    .prepare(
      `INSERT INTO sites (id, name, slug, domain, description, default_language, languages, settings)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      site.id,
      site.name,
      site.slug,
      site.domain,
      site.description,
      site.default_language,
      JSON.stringify(site.languages),
      JSON.stringify(site.settings)
    )
    .run();
  return (await getSite(db, site.id))!;
}

// Content
export async function getContentBySite(
  db: D1Database,
  siteId: string,
  options?: { status?: string; limit?: number; offset?: number }
): Promise<Content[]> {
  let query = 'SELECT * FROM content WHERE site_id = ?';
  const params: (string | number)[] = [siteId];

  if (options?.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }

  query += ' ORDER BY updated_at DESC';

  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
    if (options?.offset) {
      query += ' OFFSET ?';
      params.push(options.offset);
    }
  }

  const result = await db
    .prepare(query)
    .bind(...params)
    .all();
  return result.results.map(transformContent);
}

export async function getContent(db: D1Database, id: string): Promise<Content | null> {
  const result = await db.prepare('SELECT * FROM content WHERE id = ?').bind(id).first();
  return result ? transformContent(result as Record<string, unknown>) : null;
}

export async function createContent(
  db: D1Database,
  content: Omit<Content, 'created_at' | 'updated_at'>
): Promise<Content> {
  await db
    .prepare(
      `INSERT INTO content (
        id, site_id, content_type_id, slug, path, title, title_translations,
        body, body_translations, frontmatter, excerpt, status, language,
        published_at, author_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      content.id,
      content.site_id,
      content.content_type_id,
      content.slug,
      content.path,
      content.title,
      JSON.stringify(content.title_translations),
      content.body,
      JSON.stringify(content.body_translations),
      JSON.stringify(content.frontmatter),
      content.excerpt,
      content.status,
      content.language,
      content.published_at,
      content.author_id
    )
    .run();
  return (await getContent(db, content.id))!;
}

export async function updateContent(
  db: D1Database,
  id: string,
  updates: Partial<Content>
): Promise<Content> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.body !== undefined) {
    fields.push('body = ?');
    values.push(updates.body);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.frontmatter !== undefined) {
    fields.push('frontmatter = ?');
    values.push(JSON.stringify(updates.frontmatter));
  }
  if (updates.published_at !== undefined) {
    fields.push('published_at = ?');
    values.push(updates.published_at);
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await db
    .prepare(`UPDATE content SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return (await getContent(db, id))!;
}

// Fragments
export async function getFragments(
  db: D1Database,
  options?: { siteId?: string | null; category?: string; status?: string }
): Promise<Fragment[]> {
  let query = 'SELECT * FROM fragments WHERE 1=1';
  const params: (string | null)[] = [];

  if (options?.siteId !== undefined) {
    if (options.siteId === null) {
      query += ' AND site_id IS NULL';
    } else {
      query += ' AND (site_id = ? OR site_id IS NULL)';
      params.push(options.siteId);
    }
  }

  if (options?.category) {
    query += ' AND category = ?';
    params.push(options.category);
  }

  if (options?.status) {
    query += ' AND status = ?';
    params.push(options.status);
  }

  query += ' ORDER BY category, name';

  const result = await db
    .prepare(query)
    .bind(...params)
    .all();
  return result.results.map(transformFragment);
}

export async function getFragment(db: D1Database, id: string): Promise<Fragment | null> {
  const result = await db.prepare('SELECT * FROM fragments WHERE id = ?').bind(id).first();
  return result ? transformFragment(result as Record<string, unknown>) : null;
}

export async function getFragmentBySlug(
  db: D1Database,
  slug: string,
  siteId?: string | null
): Promise<Fragment | null> {
  const query =
    siteId === null
      ? 'SELECT * FROM fragments WHERE slug = ? AND site_id IS NULL'
      : 'SELECT * FROM fragments WHERE slug = ? AND (site_id = ? OR site_id IS NULL) ORDER BY site_id DESC LIMIT 1';

  const result =
    siteId === null
      ? await db.prepare(query).bind(slug).first()
      : await db.prepare(query).bind(slug, siteId).first();

  return result ? transformFragment(result as Record<string, unknown>) : null;
}

export async function createFragment(
  db: D1Database,
  fragment: Omit<Fragment, 'created_at' | 'updated_at'>
): Promise<Fragment> {
  await db
    .prepare(
      `INSERT INTO fragments (
        id, site_id, name, slug, category, content_en, content_ja,
        description, tags, version, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      fragment.id,
      fragment.site_id,
      fragment.name,
      fragment.slug,
      fragment.category,
      fragment.content_en,
      fragment.content_ja,
      fragment.description,
      JSON.stringify(fragment.tags),
      fragment.version,
      fragment.status
    )
    .run();
  return (await getFragment(db, fragment.id))!;
}

export async function updateFragment(
  db: D1Database,
  id: string,
  updates: Partial<Fragment>
): Promise<Fragment> {
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.content_en !== undefined) {
    fields.push('content_en = ?');
    values.push(updates.content_en);
  }
  if (updates.content_ja !== undefined) {
    fields.push('content_ja = ?');
    values.push(updates.content_ja);
  }
  if (updates.category !== undefined) {
    fields.push('category = ?');
    values.push(updates.category);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.tags !== undefined) {
    fields.push('tags = ?');
    values.push(JSON.stringify(updates.tags));
  }

  fields.push("updated_at = datetime('now')");
  values.push(id);

  await db
    .prepare(`UPDATE fragments SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values)
    .run();

  return (await getFragment(db, id))!;
}

// Generate unique IDs
// InfoSec (ASVS V2.2.1): Using crypto.getRandomValues for secure random IDs
export function generateId(prefix: string = ''): string {
  const timestamp = Date.now().toString(36);
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const random = Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, '0'))
    .join('')
    .substring(0, 8);
  return prefix ? `${prefix}_${timestamp}${random}` : `${timestamp}${random}`;
}

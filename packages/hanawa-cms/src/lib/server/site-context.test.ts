/**
 * Site-context tests.
 *
 * Uses the D1 stub to verify site-scoped query helpers enforce
 * correct tenant isolation.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createD1Stub } from './d1-stub';
import type { SiteContext } from './site-context';
import {
  siteFirst,
  siteAll,
  siteOrGlobalAll,
  unscopedFirst,
  unscopedAll,
  unscopedRun,
} from './site-context';

// Seed the stub with test rows
async function seedData(db: D1Database) {
  // Insert sites
  await db
    .prepare('INSERT INTO sites (id, name, slug) VALUES (?, ?, ?)')
    .bind('s1', 'Site One', 'site-one')
    .run();
  await db
    .prepare('INSERT INTO sites (id, name, slug) VALUES (?, ?, ?)')
    .bind('s2', 'Site Two', 'site-two')
    .run();

  // Insert content scoped to sites
  await db
    .prepare('INSERT INTO content (id, site_id, title) VALUES (?, ?, ?)')
    .bind('c1', 's1', 'Post A')
    .run();
  await db
    .prepare('INSERT INTO content (id, site_id, title) VALUES (?, ?, ?)')
    .bind('c2', 's1', 'Post B')
    .run();
  await db
    .prepare('INSERT INTO content (id, site_id, title) VALUES (?, ?, ?)')
    .bind('c3', 's2', 'Post C')
    .run();

  // Insert fragments: some scoped, some global
  await db
    .prepare('INSERT INTO fragments (id, site_id, name, slug) VALUES (?, ?, ?, ?)')
    .bind('f1', 's1', 'Site Fragment', 'site-frag')
    .run();
  await db
    .prepare('INSERT INTO fragments (id, site_id, name, slug) VALUES (?, ?, ?, ?)')
    .bind('f2', null, 'Global Fragment', 'global-frag')
    .run();
  await db
    .prepare('INSERT INTO fragments (id, site_id, name, slug) VALUES (?, ?, ?, ?)')
    .bind('f3', 's2', 'Other Site Fragment', 'other-frag')
    .run();
}

describe('siteFirst', () => {
  let db: D1Database;
  let ctx: SiteContext;

  beforeEach(async () => {
    db = createD1Stub();
    await seedData(db);
    ctx = { db, siteId: 's1' };
  });

  it('returns matching row scoped to site', async () => {
    const row = await siteFirst<{ id: string; title: string }>(
      ctx,
      'SELECT * FROM content WHERE id = ?',
      'c1'
    );
    expect(row).not.toBeNull();
    expect(row!.title).toBe('Post A');
  });

  it('returns null for row belonging to different site', async () => {
    const row = await siteFirst(ctx, 'SELECT * FROM content WHERE id = ?', 'c3');
    expect(row).toBeNull();
  });

  it('throws when siteId is null', async () => {
    const nullCtx: SiteContext = { db, siteId: null };
    await expect(siteFirst(nullCtx, 'SELECT * FROM content WHERE id = ?', 'c1')).rejects.toThrow(
      'siteFirst() requires a site context'
    );
  });
});

describe('siteAll', () => {
  let db: D1Database;
  let ctx: SiteContext;

  beforeEach(async () => {
    db = createD1Stub();
    await seedData(db);
    ctx = { db, siteId: 's1' };
  });

  it('returns only rows for current site', async () => {
    const rows = await siteAll<{ id: string }>(ctx, 'SELECT * FROM content WHERE 1=1');
    expect(rows.length).toBe(2);
  });

  it('throws when siteId is null', async () => {
    const nullCtx: SiteContext = { db, siteId: null };
    await expect(siteAll(nullCtx, 'SELECT * FROM content WHERE 1=1')).rejects.toThrow(
      'siteAll() requires a site context'
    );
  });
});

describe('siteOrGlobalAll', () => {
  let db: D1Database;
  let ctx: SiteContext;

  beforeEach(async () => {
    db = createD1Stub();
    await seedData(db);
    ctx = { db, siteId: 's1' };
  });

  it('returns site-specific and global fragments', async () => {
    const rows = await siteOrGlobalAll<{ id: string }>(ctx, 'SELECT * FROM fragments WHERE 1=1');
    // Should get f1 (site_id=s1) and f2 (site_id=null), not f3 (site_id=s2)
    const ids = rows.map((r) => r.id);
    expect(ids).toContain('f1');
    expect(ids).toContain('f2');
    expect(ids).not.toContain('f3');
  });

  it('throws when siteId is null', async () => {
    const nullCtx: SiteContext = { db, siteId: null };
    await expect(siteOrGlobalAll(nullCtx, 'SELECT * FROM fragments WHERE 1=1')).rejects.toThrow(
      'siteOrGlobalAll() requires a site context'
    );
  });
});

describe('unscoped helpers', () => {
  let db: D1Database;

  beforeEach(async () => {
    db = createD1Stub();
    await seedData(db);
  });

  it('unscopedFirst returns any matching row regardless of site', async () => {
    const row = await unscopedFirst<{ id: string; title: string }>(
      db,
      'SELECT * FROM content WHERE id = ?',
      'c3'
    );
    expect(row).not.toBeNull();
    expect(row!.title).toBe('Post C');
  });

  it('unscopedAll returns all rows regardless of site', async () => {
    const rows = await unscopedAll<{ id: string }>(db, 'SELECT * FROM content WHERE 1=1');
    expect(rows.length).toBe(3);
  });

  it('unscopedRun executes mutations', async () => {
    await unscopedRun(db, 'DELETE FROM content WHERE id = ?', 'c1');
    const row = await unscopedFirst(db, 'SELECT * FROM content WHERE id = ?', 'c1');
    expect(row).toBeNull();
  });
});

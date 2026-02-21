/**
 * Site-scoped query helpers.
 *
 * Makes site isolation structurally visible: every query either
 * passes through siteFirst/siteAll (scoped) or unscopedFirst/unscopedAll
 * (explicitly unscoped — stands out in code review).
 *
 * InfoSec: Enforces tenant isolation at the query level (OWASP A01)
 */

export interface SiteContext {
  readonly db: D1Database;
  readonly siteId: string | null; // null = no site selected (dashboard)
}

/**
 * Run a SELECT query scoped to the current site.
 * Appends `AND site_id = ?` to the SQL and binds siteId.
 * Throws if siteId is null (caller must be in a site context).
 *
 * InfoSec: Prevents cross-site data access by structural enforcement.
 */
export async function siteFirst<T>(
  ctx: SiteContext,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  if (ctx.siteId === null) {
    throw new Error('siteFirst() requires a site context (siteId must not be null)');
  }
  const scopedSql = `${sql} AND site_id = ?`;
  const result = await ctx.db
    .prepare(scopedSql)
    .bind(...params, ctx.siteId)
    .first();
  return (result as T) ?? null;
}

/**
 * Run a SELECT query scoped to the current site, returning all matches.
 * Appends `AND site_id = ?` to the SQL.
 * Throws if siteId is null.
 */
export async function siteAll<T>(
  ctx: SiteContext,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  if (ctx.siteId === null) {
    throw new Error('siteAll() requires a site context (siteId must not be null)');
  }
  const scopedSql = `${sql} AND site_id = ?`;
  const result = await ctx.db
    .prepare(scopedSql)
    .bind(...params, ctx.siteId)
    .all<T>();
  return result.results;
}

/**
 * Run a SELECT query returning rows for the current site OR global (site_id IS NULL).
 * Useful for fragments and assets that can be site-specific or shared.
 * Throws if siteId is null.
 */
export async function siteOrGlobalAll<T>(
  ctx: SiteContext,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  if (ctx.siteId === null) {
    throw new Error('siteOrGlobalAll() requires a site context (siteId must not be null)');
  }
  const scopedSql = `${sql} AND (site_id = ? OR site_id IS NULL)`;
  const result = await ctx.db
    .prepare(scopedSql)
    .bind(...params, ctx.siteId)
    .all<T>();
  return result.results;
}

/**
 * Explicitly unscoped .first() — stands out in code review.
 * Use for cross-site queries (dashboard, admin).
 */
export async function unscopedFirst<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T | null> {
  const result = await db
    .prepare(sql)
    .bind(...params)
    .first();
  return (result as T) ?? null;
}

/**
 * Explicitly unscoped .all() — stands out in code review.
 * Use for cross-site queries (dashboard, admin).
 */
export async function unscopedAll<T>(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const result = await db
    .prepare(sql)
    .bind(...params)
    .all<T>();
  return result.results;
}

/**
 * Explicitly unscoped .run() — stands out in code review.
 * Use for cross-site mutations (admin operations).
 */
export async function unscopedRun(
  db: D1Database,
  sql: string,
  ...params: unknown[]
): Promise<void> {
  await db
    .prepare(sql)
    .bind(...params)
    .run();
}

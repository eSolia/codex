---
title: "Cloudflare D1 Maintenance"
slug: cloudflare-d1-maintenance
category: guides
tags: [cloudflare, d1, database, maintenance]
summary: "D1 database maintenance procedures, backups, and monitoring"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
# D1 Database Maintenance and Optimization Guide

> eSolia INTERNAL — Not for distribution outside eSolia

This guide covers routine maintenance, performance optimization, and operational best practices for Cloudflare D1 databases across eSolia's per-client isolation architecture.

---

## Overview

Each client runs isolated D1 databases (e.g., `acme-d1`, `widgetco-d1`). D1 is single-threaded — throughput scales inversely with query duration. A 1ms query yields ~1,000 QPS; a 100ms query yields ~10 QPS. Maintenance focuses on keeping queries fast, databases healthy, and storage lean.

---

## Indexing

Indexes are the single most impactful optimization. Every hot-path query should hit an index rather than scan the full table.

### When to create indexes

Create indexes on columns that appear frequently in `WHERE`, `JOIN`, `ORDER BY`, or `GROUP BY` clauses. Good candidates in our architecture:

- `org_id` or `client_id` (tenant scoping)
- `created_at` or `updated_at` (time-range queries)
- `token` or `share_id` (direct lookups)
- Composite indexes on columns filtered together, such as `(client_id, created_at)`

Tables with an `INTEGER PRIMARY KEY` already have an implicit index on that column — no need to create a separate one.

### Creating an index

```sql
-- Single column
CREATE INDEX idx_orders_customer_id ON orders (customer_id);

-- Composite (column order matters — put the most selective column first)
CREATE INDEX idx_audit_client_date ON audit_log (client_id, created_at);

-- Unique constraint
CREATE UNIQUE INDEX idx_users_email ON users (email);

-- Partial index (only indexes rows matching the WHERE)
CREATE INDEX idx_shares_active ON shares (token) WHERE revoked_at IS NULL;
```

### Verifying index usage

Use `EXPLAIN QUERY PLAN` to confirm a query uses an index rather than scanning:

```bash
npx wrangler d1 execute acme-d1 --remote \
  --command="EXPLAIN QUERY PLAN SELECT * FROM orders WHERE customer_id = 'abc123'"
```

Look for `SEARCH` (index hit) vs. `SCAN` (full table scan). A `SCAN` on a large table is a red flag.

### Listing existing indexes

```bash
npx wrangler d1 execute acme-d1 --remote \
  --command="SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' ORDER BY tbl_name"
```

### Running PRAGMA optimize

After migrations, bulk imports, or significant data changes, run `PRAGMA optimize` to refresh SQLite's internal statistics so the query planner makes better decisions:

```bash
npx wrangler d1 execute acme-d1 --remote --command='PRAGMA optimize'
```

Think of this as recalibrating a GPS after the road map changed — without it, the planner may choose inefficient routes.

---

## Health checks

### Integrity check

`PRAGMA quick_check` validates database structure — corrupt records, missing pages, multiply-used or unused sections:

```bash
npx wrangler d1 execute acme-d1 --remote --command='PRAGMA quick_check'
```

Expected result: a single row containing `ok`. Anything else indicates corruption that needs investigation.

### Foreign key validation

If your schema uses foreign keys (common with Drizzle ORM), check for orphaned references:

```bash
npx wrangler d1 execute acme-d1 --remote --command='PRAGMA foreign_key_check'
```

An empty result set means all references are valid.

---

## Query performance analysis

### Using `wrangler d1 insights`

D1 captures query strings (without bound parameters) and provides aggregated performance metrics.

```bash
# Top 10 queries by total execution time
npx wrangler d1 insights acme-d1 --sort-type=sum --sort-by=time --limit=10

# Top 10 queries by frequency
npx wrangler d1 insights acme-d1 --sort-type=sum --sort-by=count --limit=10

# Top 10 queries by rows read (potential full scans)
npx wrangler d1 insights acme-d1 --sort-type=sum --sort-by=reads --limit=10
```

**What to look for:**

- High `avgRowsRead` relative to result count — suggests missing index.
- High `totalDurationMs` — candidate for optimization or caching (see three-layer cache pattern).
- High `numberOfTimesRun` with moderate latency — small per-query cost that adds up. Consider KV caching.

---

## Size monitoring

Each D1 database has a hard 10GB limit that cannot be increased.

```bash
npx wrangler d1 info acme-d1
```

The output includes current database size. For our per-client model, individual databases are unlikely to hit 10GB, but audit logs and telemetry data can grow quietly.

### Archiving strategy

When a database approaches capacity (or when old data is no longer queried):

1. Export old records to R2 as JSON or CSV using a scheduled Worker or Workflow.
2. Delete archived records from D1.
3. Run `PRAGMA optimize` after the bulk delete.

This keeps D1 lean for active data while R2 provides cheap, durable cold storage with zero egress costs.

---

## Backups and Time Travel

Time Travel provides 30-day point-in-time recovery. It is always on and incurs no extra cost.

### Pre-migration bookmark

Before any schema migration, capture a bookmark:

```bash
npx wrangler d1 time-travel info acme-d1
```

Record the bookmark value. If the migration fails, restore to it:

```bash
npx wrangler d1 time-travel restore acme-d1 --bookmark=<BOOKMARK>
```

**Important:** Restoring overwrites the database in place. Always grab a _current_ bookmark before restoring to an older one, so you can undo the restore if needed.

### Long-term backups beyond 30 days

For compliance-sensitive clients, export D1 to R2 on a schedule using Cloudflare Workflows. See Cloudflare's [Export and save D1 database](https://developers.cloudflare.com/workflows/examples/backup-d1/) example.

---

## Batch operations

Use `db.batch()` to execute multiple queries in a single round-trip. This is especially important when the Worker runs at the edge but D1 primary is in APAC:

```typescript
const results = await db.batch([
  db.prepare('INSERT INTO audit_log (event, user_id) VALUES (?, ?)').bind('login', userId),
  db.prepare('UPDATE users SET last_login = ? WHERE id = ?').bind(now, userId)
]);
```

Each statement in a batch is still subject to individual limits (100KB SQL, 100 bound parameters), but the network round-trip cost is paid only once.

---

## Read replication

For client-facing dashboards with globally distributed users, enable D1 read replication to route read queries to nearby replicas.

**Enable:** D1 → Select database → Settings → Enable Read Replication.

**Discipline required:** Use the Sessions API with `first-primary` strategy immediately after writes so users see their own changes. Use `first-unconstrained` for read-only dashboard views to get the best latency.

---

## Recommended cadence

| Task                        | Frequency                        | Command / action                                                         |
| --------------------------- | -------------------------------- | ------------------------------------------------------------------------ |
| Review `d1 insights`        | Monthly                          | `wrangler d1 insights <db> --sort-by=time`                               |
| `PRAGMA optimize`           | After migrations or bulk imports | `wrangler d1 execute <db> --remote --command='PRAGMA optimize'`          |
| `PRAGMA quick_check`        | Quarterly                        | `wrangler d1 execute <db> --remote --command='PRAGMA quick_check'`       |
| `PRAGMA foreign_key_check`  | Quarterly                        | `wrangler d1 execute <db> --remote --command='PRAGMA foreign_key_check'` |
| Database size check         | Monthly                          | `wrangler d1 info <db>`                                                  |
| Time Travel bookmark        | Every migration                  | `wrangler d1 time-travel info <db>`                                      |
| Archive old audit/telemetry | Quarterly                        | Export to R2, delete from D1                                             |
| Index audit on hot paths    | Quarterly                        | `EXPLAIN QUERY PLAN` on top queries from insights                        |

---

## Automation

A Claude Code slash command (`/d1-health`) automates the discovery and execution of these checks across all D1 databases in a repository. See the companion slash command file for details.

---

## References

- [D1 Best Practices: Use Indexes](https://developers.cloudflare.com/d1/best-practices/use-indexes/)
- [D1 Metrics and Analytics](https://developers.cloudflare.com/d1/observability/metrics-analytics/)
- [D1 Time Travel and Backups](https://developers.cloudflare.com/d1/reference/time-travel/)
- [D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)
- [D1 Read Replication](https://developers.cloudflare.com/d1/best-practices/read-replication/)
- [Export D1 to R2 with Workflows](https://developers.cloudflare.com/workflows/examples/backup-d1/)

---

## お問い合わせ

**株式会社イソリア**
〒105-7105　東京都港区東新橋一丁目５番２号
汐留シティセンター５階（Work Styling）
**Tel (代表):** +813-4577-3380
**Web:** https://esolia.co.jp
**作成担当:** rick.cogley@esolia.co.jp

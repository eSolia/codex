---
title: "D1 Migration Patterns"
slug: d1-migrations
category: guides
tags: [cloudflare, d1, migrations, database]
summary: "Patterns and conventions for Cloudflare D1 database migrations"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
# D1 Database Migration & Synchronization Guide

## For Multi-Client Cloudflare D1 Architecture

**Purpose:** Establish reliable patterns for managing schema migrations across multiple D1 databases in a multi-tenant FSA compliance application.

**Architecture Context:** Separate D1 databases per client for complete data isolation (required for FSA regulatory compliance).

---

## Quick Start: Claude Code Commands

For day-to-day operations, use these slash commands in Claude Code:

| Command                 | Purpose                                       |
| ----------------------- | --------------------------------------------- |
| `/db:status`            | Show status of all local and remote databases |
| `/db:migrate central`   | Apply migrations to central database          |
| `/db:migrate client`    | Apply migrations to client database           |
| `/db:sync pull central` | Pull production data to local                 |
| `/db:reset all`         | Reset local databases to clean state          |

These commands handle the complexity of database identification and use the correct tools automatically.

---

## CRITICAL: sqlite3 vs wrangler for Local Development

**Always use sqlite3 directly for local database operations.**

Wrangler has known bugs with D1 operations:

- `--file` flag fails with large SQL files (FileHandle garbage collection)
- Shell escaping issues with complex SQL in `--command`
- Inconsistent behavior across versions

**Local operations (use sqlite3):**

```bash
# Find the database file first (identified by tables)
D1_DIR=".wrangler/state/v3/d1/miniflare-D1DatabaseObject"
for db in "$D1_DIR"/*.sqlite; do
  has_orgs=$(sqlite3 "$db" "SELECT 1 FROM sqlite_master WHERE name='organizations';" 2>/dev/null)
  if [ "$has_orgs" = "1" ]; then
    CENTRAL_DB="$db"
  fi
done

# Apply SQL with sqlite3 (reliable)
sqlite3 "$CENTRAL_DB" < schema-central.sql
```

**Remote operations (must use wrangler):**

```bash
# Only wrangler can access remote D1
npx wrangler d1 execute pulse-central --remote --file=migration.sql
```

---

## Local Database Identification

Miniflare (wrangler's local D1 emulator) names sqlite files with **hash-based names**, not the database names from `wrangler.toml`. This makes manual identification difficult.

**Location:** `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/`

**Identification by signature tables:**

| Database                  | Signature Table                              | Purpose                        |
| ------------------------- | -------------------------------------------- | ------------------------------ |
| Central (`pulse-central`) | `organizations`                              | Users, orgs, control templates |
| Client (`pulse-client-*`) | `control_statuses` (but NOT `organizations`) | Per-client compliance data     |

**Quick identification script:**

```bash
D1_DIR=".wrangler/state/v3/d1/miniflare-D1DatabaseObject"
for db in "$D1_DIR"/*.sqlite; do
  has_orgs=$(sqlite3 "$db" "SELECT 1 FROM sqlite_master WHERE name='organizations';" 2>/dev/null)
  has_statuses=$(sqlite3 "$db" "SELECT 1 FROM sqlite_master WHERE name='control_statuses';" 2>/dev/null)

  if [ "$has_orgs" = "1" ]; then
    echo "CENTRAL: $db"
  elif [ "$has_statuses" = "1" ]; then
    echo "CLIENT:  $db"
  else
    echo "UNKNOWN: $db"
  fi
done
```

---

## Table of Contents

1. [Understanding D1's Sync Model](#1-understanding-d1s-sync-model)
2. [Migration File Structure](#2-migration-file-structure)
3. [Local Development Workflow](#3-local-development-workflow)
4. [Migration Tracking System](#4-migration-tracking-system)
5. [Multi-Client Migration Scripts](#5-multi-client-migration-scripts)
6. [CI/CD Pipeline Integration](#6-cicd-pipeline-integration)
7. [Rollback Strategies](#7-rollback-strategies)
8. [Best Practices for FSA Compliance](#8-best-practices-for-fsa-compliance)

---

## 1. Understanding D1's Sync Model

### The Mental Model

D1 databases do **not** automatically synchronize between environments. Think of each database instance as a completely independent filing cabinet:

```
┌─────────────────────────────────────────────────────────────────┐
│                        YOUR CODEBASE                            │
│                     (Source of Truth)                           │
│                                                                 │
│   migrations/                                                   │
│   ├── 0001_initial_schema.sql                                   │
│   ├── 0002_add_audit_fields.sql                                 │
│   └── 0003_sensitivity_labels.sql                               │
└─────────────────────────────────────────────────────────────────┘
           │                    │                    │
           ▼                    ▼                    ▼
    ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
    │   LOCAL     │     │  STAGING    │     │ PRODUCTION  │
    │   SQLite    │     │    D1       │     │    D1       │
    │             │     │             │     │             │
    │ .wrangler/  │     │ pulse-stg   │     │ client-a-db │
    │ state/d1/   │     │             │     │ client-b-db │
    │             │     │             │     │ client-c-db │
    └─────────────┘     └─────────────┘     └─────────────┘

    No automatic sync between any of these environments.
    YOU are the synchronization mechanism via migration scripts.
```

### Key Principles

1. **Migrations are code** - Version controlled, reviewed, tested
2. **Apply in order** - Sequential numbering ensures consistency
3. **Never modify applied migrations** - Create new ones instead
4. **Track what's applied** - Each database needs migration history

---

## 2. Migration File Structure

### Recommended Project Structure

```
project-root/
├── migrations/
│   ├── 0001_initial_schema.sql
│   ├── 0002_add_audit_fields.sql
│   ├── 0003_add_compliance_tracking.sql
│   └── README.md
├── scripts/
│   ├── migrate.sh
│   ├── migrate-all-clients.sh
│   └── rollback.sh
├── seed/
│   ├── test_data.sql
│   └── demo_client.sql
├── wrangler.toml
└── src/
```

### Migration File Naming Convention

```
NNNN_descriptive_name.sql

Examples:
0001_initial_schema.sql
0002_add_user_roles.sql
0003_create_audit_log_table.sql
0004_add_index_on_created_at.sql
0005_add_sensitivity_labels.sql
```

### Migration File Template

```sql
-- Migration: 0003_create_audit_log_table.sql
-- Description: Creates audit log table for FSA compliance tracking
-- Author: [Your Name]
-- Date: 2025-01-15
--
-- IMPORTANT: This migration is NOT reversible automatically.
-- See rollback file: rollbacks/0003_rollback.sql

-- ============================================================
-- UP MIGRATION
-- ============================================================

-- Create audit log table
CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    old_values TEXT,  -- JSON
    new_values TEXT,  -- JSON
    changed_by TEXT NOT NULL,
    changed_at TEXT NOT NULL DEFAULT (datetime('now')),
    ip_address TEXT,
    user_agent TEXT
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_audit_log_table_record
    ON audit_log(table_name, record_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_at
    ON audit_log(changed_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_changed_by
    ON audit_log(changed_by);

-- Record this migration
INSERT INTO _migrations (version, name, applied_at)
VALUES ('0003', 'create_audit_log_table', datetime('now'));
```

### The Migrations Tracking Table

Every database should have this table to track applied migrations:

```sql
-- migrations/0000_migrations_table.sql
-- This should be the FIRST migration applied to any new database

CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    checksum TEXT  -- Optional: SHA256 of migration file for integrity
);

CREATE INDEX IF NOT EXISTS idx_migrations_version ON _migrations(version);
```

---

## 3. Local Development Workflow

### Initial Setup

```bash
# 1. Create local database (happens automatically with wrangler dev)
wrangler dev

# 2. Apply all migrations to local
for file in migrations/*.sql; do
    echo "Applying $file to local..."
    wrangler d1 execute YOUR_DB --local --file="$file"
done

# 3. Seed with test data
wrangler d1 execute YOUR_DB --local --file=seed/test_data.sql
```

### Daily Development Cycle

```bash
# Start development server (uses local SQLite)
wrangler dev

# Check current migration state
wrangler d1 execute YOUR_DB --local \
    --command="SELECT * FROM _migrations ORDER BY version"

# Create new migration
touch migrations/0006_add_new_feature.sql
# Edit the file...

# Apply new migration locally
wrangler d1 execute YOUR_DB --local --file=migrations/0006_add_new_feature.sql

# Test your changes...

# When ready, commit the migration file
git add migrations/0006_add_new_feature.sql
git commit -m "Add migration: 0006_add_new_feature"
```

### Resetting Local Database

Sometimes you need a fresh start:

```bash
# Option 1: Delete local state and re-run migrations
rm -rf .wrangler/state/v3/d1

# Restart wrangler dev, then apply all migrations
wrangler dev &
for file in migrations/*.sql; do
    wrangler d1 execute YOUR_DB --local --file="$file"
done

# Option 2: Export production schema (without data) for local testing
wrangler d1 execute YOUR_DB --command=".schema" > schema_export.sql
wrangler d1 execute YOUR_DB --local --file=schema_export.sql
```

### Debugging: Compare Local vs Production Schema

```bash
# Export schemas
wrangler d1 execute YOUR_DB --local --command=".schema" > local_schema.sql
wrangler d1 execute YOUR_DB --command=".schema" > prod_schema.sql

# Compare
diff local_schema.sql prod_schema.sql
```

---

## 4. Migration Tracking System

### Check Migration Status Script

Create `scripts/migration-status.sh`:

```bash
#!/bin/bash
# scripts/migration-status.sh
# Check which migrations have been applied to a database

DB_NAME=${1:-"pulse-db"}
ENV=${2:-"local"}  # "local" or "remote"

if [ "$ENV" == "local" ]; then
    LOCAL_FLAG="--local"
else
    LOCAL_FLAG=""
fi

echo "=== Migration Status for $DB_NAME ($ENV) ==="
echo ""

# Get applied migrations
echo "Applied migrations:"
wrangler d1 execute "$DB_NAME" $LOCAL_FLAG \
    --command="SELECT version, name, applied_at FROM _migrations ORDER BY version" \
    2>/dev/null || echo "  (No migrations table found - database may be empty)"

echo ""
echo "Migration files in codebase:"
ls -1 migrations/*.sql 2>/dev/null | while read file; do
    version=$(basename "$file" | cut -d'_' -f1)
    name=$(basename "$file" .sql | cut -d'_' -f2-)
    echo "  $version: $name"
done

echo ""
echo "=== Pending Migrations ==="

# Compare and show pending
wrangler d1 execute "$DB_NAME" $LOCAL_FLAG \
    --command="SELECT version FROM _migrations" 2>/dev/null | \
    grep -E "^[0-9]+" > /tmp/applied_versions.txt || touch /tmp/applied_versions.txt

ls -1 migrations/*.sql 2>/dev/null | while read file; do
    version=$(basename "$file" | cut -d'_' -f1)
    if ! grep -q "^$version$" /tmp/applied_versions.txt; then
        echo "  PENDING: $file"
    fi
done
```

### Automated Migration Runner

Create `scripts/migrate.sh`:

```bash
#!/bin/bash
# scripts/migrate.sh
# Apply pending migrations to a D1 database

set -e  # Exit on error

DB_NAME=${1:-"pulse-db"}
ENV=${2:-"local"}  # "local" or "remote"

if [ "$ENV" == "local" ]; then
    LOCAL_FLAG="--local"
    echo "🔧 Running migrations on LOCAL database: $DB_NAME"
else
    LOCAL_FLAG=""
    echo "🚀 Running migrations on REMOTE database: $DB_NAME"
    echo "⚠️  This will modify PRODUCTION data. Continue? (y/N)"
    read -r confirm
    if [ "$confirm" != "y" ]; then
        echo "Aborted."
        exit 1
    fi
fi

# Ensure migrations table exists
echo "Ensuring _migrations table exists..."
wrangler d1 execute "$DB_NAME" $LOCAL_FLAG --command="
CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
"

# Get list of applied migrations
APPLIED=$(wrangler d1 execute "$DB_NAME" $LOCAL_FLAG \
    --command="SELECT version FROM _migrations" 2>/dev/null | \
    grep -E "^[0-9]+" || echo "")

# Apply pending migrations in order
for file in migrations/*.sql; do
    if [ ! -f "$file" ]; then
        continue
    fi

    version=$(basename "$file" | cut -d'_' -f1)
    name=$(basename "$file" .sql)

    # Skip if version starts with 0000 (migrations table itself)
    if [ "$version" == "0000" ]; then
        continue
    fi

    # Check if already applied
    if echo "$APPLIED" | grep -q "^$version$"; then
        echo "  ✓ $name (already applied)"
    else
        echo "  → Applying $name..."
        wrangler d1 execute "$DB_NAME" $LOCAL_FLAG --file="$file"

        # Record the migration (if not already in the file)
        if ! grep -q "_migrations" "$file"; then
            wrangler d1 execute "$DB_NAME" $LOCAL_FLAG --command="
                INSERT INTO _migrations (version, name, applied_at)
                VALUES ('$version', '$name', datetime('now'));
            "
        fi

        echo "  ✓ $name applied successfully"
    fi
done

echo ""
echo "✅ All migrations complete for $DB_NAME ($ENV)"
```

---

## 5. Multi-Client Migration Scripts

### Client Database Registry

Create `config/clients.json`:

```json
{
  "clients": [
    {
      "id": "client-a",
      "name": "Client A Fund Management",
      "database_name": "pulse-client-a",
      "database_id": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
      "active": true
    },
    {
      "id": "client-b",
      "name": "Client B Asset Management",
      "database_name": "pulse-client-b",
      "database_id": "yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy",
      "active": true
    },
    {
      "id": "client-c",
      "name": "Client C Securities",
      "database_name": "pulse-client-c",
      "database_id": "zzzzzzzz-zzzz-zzzz-zzzz-zzzzzzzzzzzz",
      "active": true
    }
  ],
  "staging": {
    "database_name": "pulse-staging",
    "database_id": "staging-id-here"
  }
}
```

### Multi-Client Migration Script

Create `scripts/migrate-all-clients.sh`:

```bash
#!/bin/bash
# scripts/migrate-all-clients.sh
# Apply migrations to ALL client databases

set -e

CONFIG_FILE="config/clients.json"
MIGRATION_FILE=${1:-""}  # Optional: specific migration file

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           MULTI-CLIENT DATABASE MIGRATION                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "❌ Error: jq is required but not installed."
    echo "   Install with: brew install jq"
    exit 1
fi

# Get client databases
CLIENTS=$(jq -r '.clients[] | select(.active==true) | .database_name' "$CONFIG_FILE")
CLIENT_COUNT=$(echo "$CLIENTS" | wc -l | tr -d ' ')

echo "Found $CLIENT_COUNT active client databases."
echo ""

if [ -n "$MIGRATION_FILE" ]; then
    echo "Migration file: $MIGRATION_FILE"
else
    echo "Mode: Apply all pending migrations"
fi

echo ""
echo "⚠️  This will modify PRODUCTION databases for ALL clients."
echo "    Databases to be updated:"
echo "$CLIENTS" | while read db; do
    echo "      - $db"
done
echo ""
echo "Continue? (type 'yes' to confirm)"
read -r confirm
if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "Starting migrations..."
echo ""

# Track results
SUCCESS=0
FAILED=0
FAILED_DBS=""

for DB_NAME in $CLIENTS; do
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📦 Database: $DB_NAME"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

    if [ -n "$MIGRATION_FILE" ]; then
        # Apply specific migration
        if wrangler d1 execute "$DB_NAME" --file="$MIGRATION_FILE" 2>&1; then
            echo "✅ Success: $DB_NAME"
            ((SUCCESS++))
        else
            echo "❌ Failed: $DB_NAME"
            ((FAILED++))
            FAILED_DBS="$FAILED_DBS $DB_NAME"
        fi
    else
        # Apply all pending migrations using migrate.sh
        if ./scripts/migrate.sh "$DB_NAME" "remote" <<< "y" 2>&1; then
            echo "✅ Success: $DB_NAME"
            ((SUCCESS++))
        else
            echo "❌ Failed: $DB_NAME"
            ((FAILED++))
            FAILED_DBS="$FAILED_DBS $DB_NAME"
        fi
    fi

    echo ""
done

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                    MIGRATION SUMMARY                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "  ✅ Successful: $SUCCESS"
echo "  ❌ Failed:     $FAILED"

if [ $FAILED -gt 0 ]; then
    echo ""
    echo "  Failed databases:$FAILED_DBS"
    echo ""
    echo "  ⚠️  Some migrations failed. Review errors above."
    exit 1
fi

echo ""
echo "🎉 All client databases migrated successfully!"
```

### Staging-First Migration Workflow

Create `scripts/migrate-staged.sh`:

```bash
#!/bin/bash
# scripts/migrate-staged.sh
# Safe migration workflow: Local → Staging → Production

set -e

MIGRATION_FILE=${1:-""}

if [ -z "$MIGRATION_FILE" ]; then
    echo "Usage: ./scripts/migrate-staged.sh migrations/NNNN_name.sql"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              STAGED MIGRATION WORKFLOW                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
echo "Migration: $MIGRATION_FILE"
echo ""

# Stage 1: Local
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Stage 1/3: LOCAL DATABASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
wrangler d1 execute pulse-db --local --file="$MIGRATION_FILE"
echo "✅ Local migration successful"
echo ""
echo "Test your changes locally, then press Enter to continue to staging..."
read -r

# Stage 2: Staging
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Stage 2/3: STAGING DATABASE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
STAGING_DB=$(jq -r '.staging.database_name' config/clients.json)
wrangler d1 execute "$STAGING_DB" --file="$MIGRATION_FILE"
echo "✅ Staging migration successful"
echo ""
echo "Verify staging environment, then press Enter to continue to production..."
echo "Or press Ctrl+C to abort."
read -r

# Stage 3: Production (all clients)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Stage 3/3: PRODUCTION DATABASES (ALL CLIENTS)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
./scripts/migrate-all-clients.sh "$MIGRATION_FILE"

echo ""
echo "🎉 Staged migration complete!"
```

---

## 6. CI/CD Pipeline Integration

### GitHub Actions Workflow

Create `.github/workflows/migrate.yml`:

```yaml
name: Database Migrations

on:
  push:
    branches:
      - main
    paths:
      - 'migrations/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - staging
          - production
      migration_file:
        description: 'Specific migration file (optional, leave empty for all pending)'
        required: false

env:
  CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}

jobs:
  validate:
    name: Validate Migrations
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install Wrangler
        run: npm install -g wrangler

      - name: Validate SQL Syntax
        run: |
          for file in migrations/*.sql; do
            echo "Validating $file..."
            # Basic syntax check - ensure file is valid SQL
            if ! head -1 "$file" | grep -qE "^--|^CREATE|^ALTER|^INSERT|^DROP"; then
              echo "Warning: $file may not start with valid SQL"
            fi
          done

      - name: Check Migration Sequence
        run: |
          # Ensure no gaps in migration numbering
          expected=1
          for file in migrations/*.sql; do
            num=$(basename "$file" | cut -d'_' -f1 | sed 's/^0*//')
            if [ "$num" != "0" ] && [ "$num" != "$expected" ]; then
              echo "❌ Gap in migration sequence: expected $expected, found $num"
              exit 1
            fi
            ((expected++))
          done
          echo "✅ Migration sequence is valid"

  migrate-staging:
    name: Migrate Staging
    needs: validate
    runs-on: ubuntu-latest
    if: github.event_name == 'push' || github.event.inputs.environment == 'staging'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Install Wrangler
        run: npm install -g wrangler

      - name: Apply Migrations to Staging
        run: |
          chmod +x scripts/migrate.sh
          ./scripts/migrate.sh pulse-staging remote <<< "y"

      - name: Verify Migration
        run: |
          wrangler d1 execute pulse-staging \
            --command="SELECT * FROM _migrations ORDER BY version DESC LIMIT 5"

  migrate-production:
    name: Migrate Production
    needs: [validate, migrate-staging]
    runs-on: ubuntu-latest
    if: github.event.inputs.environment == 'production'
    environment: production
    steps:
      - uses: actions/checkout@v4

      - name: Install Dependencies
        run: |
          npm install -g wrangler
          sudo apt-get install -y jq

      - name: Apply Migrations to All Clients
        run: |
          chmod +x scripts/migrate-all-clients.sh

          if [ -n "${{ github.event.inputs.migration_file }}" ]; then
            ./scripts/migrate-all-clients.sh "${{ github.event.inputs.migration_file }}"
          else
            ./scripts/migrate-all-clients.sh
          fi

      - name: Generate Migration Report
        run: |
          echo "## Migration Report" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Database | Status | Last Migration |" >> $GITHUB_STEP_SUMMARY
          echo "|----------|--------|----------------|" >> $GITHUB_STEP_SUMMARY

          for db in $(jq -r '.clients[].database_name' config/clients.json); do
            last=$(wrangler d1 execute "$db" \
              --command="SELECT version || ': ' || name FROM _migrations ORDER BY version DESC LIMIT 1" \
              2>/dev/null | tail -1 || echo "Unknown")
            echo "| $db | ✅ | $last |" >> $GITHUB_STEP_SUMMARY
          done
```

### Wrangler Configuration for Multiple Environments

Update `wrangler.toml`:

```toml
name = "pulse-app"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Default (local development)
[[d1_databases]]
binding = "DB"
database_name = "pulse-local"
database_id = "local-dev-id"

# Staging environment
[env.staging]
[[env.staging.d1_databases]]
binding = "DB"
database_name = "pulse-staging"
database_id = "your-staging-db-id"

# Production - Client A
[env.client-a]
[[env.client-a.d1_databases]]
binding = "DB"
database_name = "pulse-client-a"
database_id = "client-a-db-id"

# Production - Client B
[env.client-b]
[[env.client-b.d1_databases]]
binding = "DB"
database_name = "pulse-client-b"
database_id = "client-b-db-id"

# Production - Client C
[env.client-c]
[[env.client-c.d1_databases]]
binding = "DB"
database_name = "pulse-client-c"
database_id = "client-c-db-id"
```

---

## 7. Rollback Strategies

### Manual Rollback Files

For each migration, create a corresponding rollback:

```
migrations/
├── 0003_create_audit_log_table.sql
rollbacks/
├── 0003_rollback.sql
```

Example rollback file:

```sql
-- rollbacks/0003_rollback.sql
-- Rollback for: 0003_create_audit_log_table.sql
-- ⚠️  WARNING: This will DELETE the audit_log table and ALL its data!

DROP INDEX IF EXISTS idx_audit_log_table_record;
DROP INDEX IF EXISTS idx_audit_log_changed_at;
DROP INDEX IF EXISTS idx_audit_log_changed_by;
DROP TABLE IF EXISTS audit_log;

-- Remove migration record
DELETE FROM _migrations WHERE version = '0003';
```

### Rollback Script

Create `scripts/rollback.sh`:

```bash
#!/bin/bash
# scripts/rollback.sh
# Rollback a specific migration

set -e

VERSION=${1:-""}
DB_NAME=${2:-"pulse-db"}
ENV=${3:-"local"}

if [ -z "$VERSION" ]; then
    echo "Usage: ./scripts/rollback.sh <version> [database] [local|remote]"
    echo "Example: ./scripts/rollback.sh 0003 pulse-db local"
    exit 1
fi

ROLLBACK_FILE="rollbacks/${VERSION}_rollback.sql"

if [ ! -f "$ROLLBACK_FILE" ]; then
    echo "❌ Rollback file not found: $ROLLBACK_FILE"
    exit 1
fi

if [ "$ENV" == "local" ]; then
    LOCAL_FLAG="--local"
else
    LOCAL_FLAG=""
    echo "⚠️  WARNING: This will rollback PRODUCTION database!"
    echo "    Database: $DB_NAME"
    echo "    Version:  $VERSION"
    echo ""
    echo "Type 'ROLLBACK' to confirm:"
    read -r confirm
    if [ "$confirm" != "ROLLBACK" ]; then
        echo "Aborted."
        exit 1
    fi
fi

echo "Rolling back version $VERSION on $DB_NAME..."
wrangler d1 execute "$DB_NAME" $LOCAL_FLAG --file="$ROLLBACK_FILE"
echo "✅ Rollback complete"
```

### Safe Migration Pattern: Additive Only

For FSA compliance, prefer additive migrations that don't require rollbacks:

```sql
-- SAFE: Add new column (can be ignored if rollback needed)
ALTER TABLE security_controls ADD COLUMN new_field TEXT;

-- SAFE: Add new table (can be dropped if rollback needed)
CREATE TABLE IF NOT EXISTS new_feature (...);

-- RISKY: Modify existing column (harder to rollback)
-- Instead, add new column and migrate data gradually
ALTER TABLE users ADD COLUMN email_new TEXT;
UPDATE users SET email_new = email;
-- Later migration: DROP COLUMN email (after verification)

-- RISKY: Drop column (data loss, cannot rollback)
-- Instead, deprecate in code first, drop in later migration
```

---

## 8. Best Practices for FSA Compliance

### Audit Trail for Schema Changes

Create `migrations/0002_schema_audit_log.sql`:

```sql
-- Track all schema changes for FSA compliance
CREATE TABLE IF NOT EXISTS _schema_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    migration_version TEXT NOT NULL,
    migration_name TEXT NOT NULL,
    applied_by TEXT,  -- Service account or user
    applied_at TEXT NOT NULL DEFAULT (datetime('now')),
    environment TEXT,  -- 'local', 'staging', 'production'
    git_commit TEXT,   -- Commit hash for traceability
    notes TEXT
);
```

### Pre-Migration Checklist

Before applying any migration to production:

```markdown
## Migration Pre-Flight Checklist

- [ ] Migration tested on local database
- [ ] Migration tested on staging database
- [ ] Rollback script created and tested
- [ ] Migration reviewed by second team member
- [ ] Backup of production databases confirmed
- [ ] Maintenance window scheduled (if needed)
- [ ] Client notification sent (if needed)
- [ ] Git commit tagged with migration version
```

### Backup Before Migration

```bash
#!/bin/bash
# scripts/backup-before-migrate.sh

TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="backups/$TIMESTAMP"
mkdir -p "$BACKUP_DIR"

echo "Creating pre-migration backups..."

for db in $(jq -r '.clients[].database_name' config/clients.json); do
    echo "Backing up $db..."
    wrangler d1 export "$db" --output="$BACKUP_DIR/${db}.sql"
done

echo "✅ Backups saved to $BACKUP_DIR"
echo ""
echo "To restore: wrangler d1 execute <db-name> --file=$BACKUP_DIR/<db-name>.sql"
```

### Documentation Template

For each migration, document in `migrations/README.md`:

```markdown
# Migration Log

## 0005_add_compliance_fields.sql

**Date:** 2025-01-15
**Author:** Rick
**Ticket:** PULSE-123

**Purpose:**
Add fields required for FSA audit compliance tracking.

**Changes:**

- Added `last_reviewed_at` to `security_controls` table
- Added `reviewer_id` to `security_controls` table
- Created index on `last_reviewed_at` for reporting queries

**Rollback:**
Run `rollbacks/0005_rollback.sql` - will remove added columns.

**Testing:**

- [x] Local testing passed
- [x] Staging testing passed
- [x] Performance impact assessed (minimal)

**Notes:**
Coordinate with Q1 compliance review timeline.
```

---

## Quick Reference Commands

| Task                            | Command                                                                                                    |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Check migration status (local)  | `./scripts/migration-status.sh pulse-db local`                                                             |
| Check migration status (remote) | `./scripts/migration-status.sh pulse-db remote`                                                            |
| Apply all pending (local)       | `./scripts/migrate.sh pulse-db local`                                                                      |
| Apply all pending (remote)      | `./scripts/migrate.sh pulse-db remote`                                                                     |
| Apply to all clients            | `./scripts/migrate-all-clients.sh`                                                                         |
| Apply specific migration        | `./scripts/migrate-all-clients.sh migrations/0005_xyz.sql`                                                 |
| Staged workflow                 | `./scripts/migrate-staged.sh migrations/0005_xyz.sql`                                                      |
| Rollback                        | `./scripts/rollback.sh 0005 pulse-db local`                                                                |
| Backup all clients              | `./scripts/backup-before-migrate.sh`                                                                       |
| Compare schemas                 | `diff <(wrangler d1 execute DB --local --command=".schema") <(wrangler d1 execute DB --command=".schema")` |

---

## Summary

The key insight: **Your codebase is the source of truth, not the databases.** Migrations flow one direction:

```
Code Repository
      │
      ▼
Local Development  →  Staging  →  Production (Client A)
                                →  Production (Client B)
                                →  Production (Client C)
```

For FSA compliance:

1. Track every schema change with version numbers
2. Test migrations on staging before production
3. Maintain rollback scripts for every migration
4. Keep audit logs of when migrations were applied
5. Back up before any production migration
6. Document the purpose and impact of each migration

---

_Document Version: 1.0_
_Last Updated: November 2025_
_Author: eSolia IT Consulting_

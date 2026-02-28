---
title: "eSolia Resource Naming Conventions"
slug: esolia-resource-naming
category: reference
tags: [naming, conventions, cloudflare, infrastructure]
summary: "Naming conventions for Cloudflare resources and infrastructure"
author: "eSolia Technical Team"
created: "2025-12-29"
modified: "2026-03-01"
---
# eSolia Resource Naming Convention

This document describes the naming convention for Cloudflare resources (D1 databases, R2 buckets) across all eSolia applications.

## Overview

All eSolia applications (Nexus, Pulse, Periodic) share a unified resource naming scheme that enables:

- **Cross-service correlation** - Easily identify all resources for a single client
- **Consistent provisioning** - Same pattern across all apps
- **Future-proofing** - Resources named correctly from the start (they cannot be renamed later)

## Naming Pattern

```
esolia-{app}-{client-slug}-{hash}
```

### Components

| Component       | Description                             | Example                      |
| --------------- | --------------------------------------- | ---------------------------- |
| `esolia`        | Fixed prefix for all eSolia resources   | `esolia`                     |
| `{app}`         | Application identifier                  | `nexus`, `pulse`, `periodic` |
| `{client-slug}` | URL-safe organization slug              | `jac`, `esolia`, `acme-corp` |
| `{hash}`        | 4-character alphanumeric correlation ID | `3119`, `7q6g`               |

### Examples

```
esolia-periodic-jac-3119       # JAC's Periodic D1/R2
esolia-periodic-esolia-7q6g    # eSolia's Periodic D1/R2
esolia-pulse-jac-3119          # JAC's Pulse D1/R2
esolia-nexus-jac-3119          # JAC's Nexus R2 bucket
```

## The Hash

The 4-character hash is:

- **Generated once** when an organization is created in Nexus
- **Stored centrally** in the Nexus `organizations.resource_ids` JSON field
- **Reused across all services** for that organization
- **Random but permanent** - generated from 3 cryptographically random bytes converted to base36

```javascript
function generateResourceHash(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(3));
  const num = (bytes[0] << 16) | (bytes[1] << 8) | bytes[2];
  return num.toString(36).padStart(4, '0').slice(0, 4);
}
```

## Why This Matters

**Cloudflare resources cannot be renamed after creation:**

- D1 databases are permanently named at creation
- R2 buckets are permanently named at creation
- Changing names requires creating new resources and migrating data

By pre-allocating organization IDs and hashes before creating any resources, we ensure consistent naming from day one.

## Pre-Allocated Organizations

The following organizations have pre-allocated hashes. Use these exact values when creating resources.

### JAC (Japan Association for Clinical Engineering)

| Field        | Value     |
| ------------ | --------- |
| Nexus Org ID | `org-jac` |
| Slug         | `jac`     |
| Hash         | `3119`    |

**Resources:**

```
esolia-nexus-jac-3119      # Nexus R2 bucket
esolia-pulse-jac-3119      # Pulse D1 database + R2 bucket
esolia-periodic-jac-3119   # Periodic D1 database + R2 bucket
```

### eSolia Inc.

| Field        | Value        |
| ------------ | ------------ |
| Nexus Org ID | `org-esolia` |
| Slug         | `esolia`     |
| Hash         | `7q6g`       |

**Resources:**

```
esolia-nexus-esolia-7q6g      # Nexus R2 bucket
esolia-pulse-esolia-7q6g      # Pulse D1 database + R2 bucket
esolia-periodic-esolia-7q6g   # Periodic D1 database + R2 bucket
```

## Creating Resources for Periodic

When migrating Periodic to Cloudflare, create resources using the pre-allocated names:

### D1 Databases

```bash
# JAC
wrangler d1 create esolia-periodic-jac-3119

# eSolia
wrangler d1 create esolia-periodic-esolia-7q6g
```

### R2 Buckets

```bash
# JAC
wrangler r2 bucket create esolia-periodic-jac-3119

# eSolia
wrangler r2 bucket create esolia-periodic-esolia-7q6g
```

## Resource Types by App

| App      | D1 Database  | R2 Bucket | Notes                   |
| -------- | ------------ | --------- | ----------------------- |
| Nexus    | Central only | Per-org   | File sharing storage    |
| Pulse    | Per-org      | Per-org   | Client control tracking |
| Periodic | Per-org      | Per-org   | Check results, reports  |

## Adding New Organizations

When onboarding a new client:

1. **Generate hash** - Use the `generateResourceHash()` function or ask for a pre-allocated value
2. **Document** - Add to both this file and `nexus/CLAUDE.md`
3. **Create Nexus org** - With the pre-allocated hash in `resource_ids`
4. **Create app resources** - Using the same slug and hash

## Migrating Existing Resources

If resources were created with old naming (e.g., `pulse-client-jac`), migration requires:

1. Create new resource with correct name
2. Migrate data (export/import for D1, copy objects for R2)
3. Update wrangler.toml bindings
4. Delete old resource

This is why pre-allocation is important - avoid migration overhead.

## Reference

- **Nexus CLAUDE.md** - Authoritative source for org allocations
- **Nexus schema** - `organizations.resource_ids` stores the hash
- **Nexus utils.ts** - `generateResourceHash()` function

---

_Last updated: 2025-12-11_
_Pre-allocated orgs: JAC (3119), eSolia (7q6g)_

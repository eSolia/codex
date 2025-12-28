# File Naming Convention & Client Code Validation

Consistent naming for traceability, and client code validation as a data loss prevention safeguard.

## Design Principles

1. **Self-documenting** — Filename tells you source, type, destination, and when
2. **Sortable** — Chronological sorting works naturally
3. **Searchable** — Find all files for a client or project quickly
4. **Validatable** — Client codes enable automated recipient checking
5. **URL-safe** — No spaces, special characters, or ambiguous symbols

## Naming Convention

### Standard Pattern

```
{Source}-{ClientCode}-{Type}-{Identifier}-{Date}.{ext}
```

### Components

| Component | Format | Description | Examples |
|-----------|--------|-------------|----------|
| **Source** | `eSolia` or app name | Origin system | `eSolia`, `Periodic`, `Pulse`, `Hanawa` |
| **ClientCode** | 3-6 uppercase letters | Client identifier | `ACME`, `JAC`, `NQNJ`, `GLOBEX` |
| **Type** | PascalCase | Document type | `Proposal`, `SOW`, `MSA`, `Report`, `Invoice` |
| **Identifier** | Descriptive slug | What this specific document is | `SecurityInfra`, `M365Migration`, `Q1Review` |
| **Date** | `YYYYMMDD` | Creation or version date | `20250127` |

### Examples

```
eSolia-ACME-Proposal-SecurityInfra-20250127.pdf
eSolia-JAC-SOW-TotalSupport-20250101.pdf
eSolia-NQNJ-Report-SecurityAssessment-20251219.pdf
Periodic-GLOBEX-Report-DNSRemediation-20250115.pdf
Pulse-ACME-Report-ComplianceQ1-20250331.pdf
Hanawa-JAC-Proposal-CloudflareMigration-20251218.pdf
```

### Internal Documents (No Client)

For internal documents, use `INT` as the client code:

```
eSolia-INT-SOP-OnboardingChecklist-20250101.pdf
eSolia-INT-Template-ProposalStructure-20250101.md
```

### Draft vs Final

Append `-DRAFT` before the date for work-in-progress:

```
eSolia-ACME-Proposal-SecurityInfra-DRAFT-20250125.pdf
eSolia-ACME-Proposal-SecurityInfra-20250127.pdf     # Final
```

### Versions

If multiple versions on the same date, append `-v2`, `-v3`:

```
eSolia-ACME-Proposal-SecurityInfra-20250127.pdf
eSolia-ACME-Proposal-SecurityInfra-20250127-v2.pdf
eSolia-ACME-Proposal-SecurityInfra-20250127-v3.pdf
```

## Client Code Registry

Central mapping of client codes to allowed domains and metadata.

### Registry Structure

```yaml
# config/client-registry.yaml

clients:
  ACME:
    name_en: "Acme Corporation"
    name_ja: "アクメ株式会社"
    allowed_domains:
      - acme.com
      - acme.co.jp
    contacts:
      - john.smith@acme.com
      - tanaka@acme.co.jp
    status: active
    created: "2020-03-15"

  JAC:
    name_en: "Japan Activation Capital, Inc."
    name_ja: "ジャパン・アクティベーション・キャピタル株式会社"
    allowed_domains:
      - japanactivationcapital.com
    contacts:
      - hotsuka@japanactivationcapital.com
      - ysaegusa@japanactivationcapital.com
    status: active
    created: "2024-10-01"

  NQNJ:
    name_en: "Norqain Japan K.K."
    name_ja: "ノルケイン・ジャパン株式会社"
    allowed_domains:
      - norqain.co.jp
      - norqain.com
    contacts:
      - japan@norqain.com
    status: active
    created: "2025-12-01"

  INT:
    name_en: "eSolia Internal"
    name_ja: "イソリア社内"
    allowed_domains:
      - esolia.co.jp
      - esolia.com
    internal: true
    status: active

# Aliases for common variations
aliases:
  JAPAN-ACTIVATION: JAC
  NORQAIN: NQNJ
```

### TypeScript Types

```typescript
// packages/shared/src/types/client-registry.ts

export interface ClientEntry {
  name_en: string;
  name_ja: string;
  allowed_domains: string[];
  contacts?: string[];
  internal?: boolean;
  status: 'active' | 'inactive' | 'archived';
  created: string;
  notes?: string;
}

export interface ClientRegistry {
  clients: Record<string, ClientEntry>;
  aliases: Record<string, string>;
}

export function resolveClientCode(code: string, registry: ClientRegistry): string {
  const upper = code.toUpperCase();
  return registry.aliases[upper] ?? upper;
}

export function getClient(code: string, registry: ClientRegistry): ClientEntry | null {
  const resolved = resolveClientCode(code, registry);
  return registry.clients[resolved] ?? null;
}
```

## Recipient Validation

### Validation Rules

When sharing a file via Courier or any delivery mechanism:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RECIPIENT VALIDATION FLOW                                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. EXTRACT CLIENT CODE                                                      │
│     ├── Parse filename: eSolia-{CLIENTCODE}-...                             │
│     ├── Scan document content for client codes                              │
│     └── Check document metadata/provenance                                   │
│                                                                              │
│  2. LOOKUP ALLOWED DOMAINS                                                   │
│     ├── Resolve any aliases (NORQAIN → NQNJ)                                │
│     ├── Get allowed_domains from registry                                   │
│     └── Include esolia.co.jp, esolia.com (always allowed)                   │
│                                                                              │
│  3. VALIDATE RECIPIENT                                                       │
│     ├── Extract domain from recipient email                                 │
│     ├── Check if domain is in allowed list                                  │
│     └── Return: ALLOWED | BLOCKED | WARN                                    │
│                                                                              │
│  4. ENFORCEMENT                                                              │
│     ├── ALLOWED: Proceed with share                                         │
│     ├── WARN: Show confirmation dialog with reason                          │
│     └── BLOCKED: Prevent share, require override                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// packages/shared/src/validation/recipient-validation.ts

export interface ValidationResult {
  status: 'allowed' | 'warn' | 'blocked';
  reason?: string;
  clientCode?: string;
  expectedDomains?: string[];
  actualDomain?: string;
}

export interface ValidateRecipientOptions {
  filename: string;
  documentContent?: string;
  recipientEmail: string;
  registry: ClientRegistry;
  strictMode?: boolean; // Block vs warn on mismatch
}

export function validateRecipient(options: ValidateRecipientOptions): ValidationResult {
  const { filename, documentContent, recipientEmail, registry, strictMode = false } = options;

  // Extract recipient domain
  const recipientDomain = recipientEmail.split('@')[1]?.toLowerCase();
  if (!recipientDomain) {
    return { status: 'blocked', reason: 'Invalid recipient email format' };
  }

  // eSolia domains always allowed
  const esoliaDomains = ['esolia.co.jp', 'esolia.com'];
  if (esoliaDomains.includes(recipientDomain)) {
    return { status: 'allowed' };
  }

  // Extract client code from filename
  const clientCode = extractClientCodeFromFilename(filename);
  if (!clientCode) {
    // No client code in filename - allow but warn
    return {
      status: 'warn',
      reason: 'Filename does not follow naming convention (no client code detected)',
    };
  }

  // Look up client
  const client = getClient(clientCode, registry);
  if (!client) {
    return {
      status: 'warn',
      reason: `Unknown client code: ${clientCode}`,
      clientCode,
    };
  }

  // Check if recipient domain is allowed
  const allowedDomains = client.allowed_domains.map(d => d.toLowerCase());
  if (allowedDomains.includes(recipientDomain)) {
    return { status: 'allowed', clientCode };
  }

  // Mismatch detected
  const result: ValidationResult = {
    status: strictMode ? 'blocked' : 'warn',
    reason: `Recipient domain "${recipientDomain}" is not in allowed list for client ${clientCode}`,
    clientCode,
    expectedDomains: allowedDomains,
    actualDomain: recipientDomain,
  };

  // Additional content scan for client codes
  if (documentContent) {
    const contentCodes = extractClientCodesFromContent(documentContent, registry);
    if (contentCodes.length > 0 && !contentCodes.includes(clientCode)) {
      result.reason += `. Document also references: ${contentCodes.join(', ')}`;
    }
  }

  return result;
}

function extractClientCodeFromFilename(filename: string): string | null {
  // Pattern: Source-ClientCode-Type-...
  const match = filename.match(/^[A-Za-z]+-([A-Z]{2,6})-/);
  return match?.[1] ?? null;
}

function extractDocumentType(filename: string): string | null {
  // Pattern: Source-ClientCode-Type-...
  const match = filename.match(/^[A-Za-z]+-[A-Z]{2,6}-([A-Za-z]+)-/);
  return match?.[1] ?? null;
}

// Document types and their default sensitivity
const DOCUMENT_SENSITIVITY: Record<string, 'normal' | 'confidential' | 'internal'> = {
  Proposal: 'confidential',
  SOW: 'confidential',
  MSA: 'confidential',
  Report: 'confidential',
  Invoice: 'confidential',
  Omiyage: 'normal',
  Guide: 'normal',
  SOP: 'internal',
};

function extractClientCodesFromContent(
  content: string,
  registry: ClientRegistry
): string[] {
  const allCodes = [
    ...Object.keys(registry.clients),
    ...Object.keys(registry.aliases),
  ];

  const found = new Set<string>();
  for (const code of allCodes) {
    // Look for code as whole word (case insensitive)
    const regex = new RegExp(`\\b${code}\\b`, 'gi');
    if (regex.test(content)) {
      found.add(resolveClientCode(code, registry));
    }
  }

  return Array.from(found);
}
```

## Nexus Integration

Nexus is the secure sharing backend - all share URLs are served from Nexus. Recipient validation happens at share creation time.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  RECIPIENT VALIDATION IN SHARE FLOW                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Source App                    Nexus                        Recipient       │
│  (Periodic/Pulse/Hanawa)       (Sharing Backend)            (Client)        │
│                                                                              │
│  1. Generate PDF/HTML                                                        │
│     with client code in                                                      │
│     filename + provenance                                                    │
│           │                                                                  │
│           ▼                                                                  │
│  2. POST /api/v1/shares ──────►  3. Validate recipient:                     │
│     {                               ├── Extract client code from filename   │
│       filename: "eSolia-ACME-...",  ├── Lookup allowed domains              │
│       recipient_email: "...",       ├── Check recipient domain              │
│       provenance: {...}             └── Return error or proceed             │
│     }                                                                        │
│           │                              │                                   │
│           │◄─────────────────────────────┘                                   │
│           │   4. If BLOCKED/WARN:                                           │
│           │      Return validation error                                     │
│           │                                                                  │
│           │   5. If ALLOWED:                                                │
│           │      Create share, return URL + PIN                             │
│           │                                                                  │
│           ▼                                                                  │
│  6. Show result to user                                                     │
│     (success or warning dialog)                                              │
│           │                                                                  │
│           ▼                                                                  │
│  7. If warning acknowledged ──────► 8. POST with override flag              │
│                                         │                                    │
│                                         ▼                                    │
│                                     9. Create share ─────────► 10. Access   │
│                                        (audit logged)              share    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Nexus API Changes

Add validation to `POST /api/v1/shares`:

```typescript
// nexus/src/routes/api/v1/shares.ts

import { validateRecipient, loadClientRegistry } from '../../../lib/client-validation';

sharesApi.post('/', async (c) => {
  const body = await c.req.json<CreateShareRequest>();

  // ... existing validation ...

  // NEW: Recipient validation based on filename client code
  if (body.recipient_email) {
    const registry = await loadClientRegistry(c.env);

    // Determine strict mode from document type (extracted from filename)
    // Proposal, SOW, MSA, Report, Invoice → Confidential → strict (block)
    const docType = extractDocumentType(body.filename);
    const confidentialTypes = ['Proposal', 'SOW', 'MSA', 'Report', 'Invoice'];
    const isConfidential = confidentialTypes.includes(docType) ||
                           body.provenance?.classification === 'CONFIDENTIAL';

    const validation = validateRecipient({
      filename: body.filename,
      recipientEmail: body.recipient_email,
      registry,
      strictMode: isConfidential,  // Block on mismatch for confidential docs
    });

    if (validation.status === 'blocked') {
      return c.json({
        error: 'Recipient validation failed',
        code: 'RECIPIENT_BLOCKED',
        details: {
          reason: validation.reason,
          clientCode: validation.clientCode,
          expectedDomains: validation.expectedDomains,
          actualDomain: validation.actualDomain,
        },
      }, 403);
    }

    if (validation.status === 'warn' && !body.acknowledge_recipient_warning) {
      return c.json({
        error: 'Recipient validation warning - confirmation required',
        code: 'RECIPIENT_WARNING',
        details: {
          reason: validation.reason,
          clientCode: validation.clientCode,
          expectedDomains: validation.expectedDomains,
          actualDomain: validation.actualDomain,
        },
      }, 400);
    }

    // Log override if warning was acknowledged
    if (validation.status === 'warn' && body.acknowledge_recipient_warning) {
      await logRecipientOverride(c.env, {
        shareId,
        filename: body.filename,
        clientCode: validation.clientCode,
        recipientEmail: body.recipient_email,
        reason: validation.reason,
        acknowledgedBy: body.provenance?.generated_by_user_email,
      });
    }
  }

  // ... proceed with share creation ...
});
```

### Client Registry in Nexus

Store client registry in D1 for Nexus access:

```sql
-- nexus/schema/nexus.sql (additions)

CREATE TABLE client_codes (
  code TEXT PRIMARY KEY,
  name_en TEXT NOT NULL,
  name_ja TEXT,
  status TEXT DEFAULT 'active',
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE client_allowed_domains (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_code TEXT NOT NULL REFERENCES client_codes(code),
  domain TEXT NOT NULL,
  UNIQUE(client_code, domain)
);

CREATE TABLE client_code_aliases (
  alias TEXT PRIMARY KEY,
  client_code TEXT NOT NULL REFERENCES client_codes(code)
);

-- Validation override audit log
CREATE TABLE recipient_validation_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  share_id TEXT,
  filename TEXT NOT NULL,
  client_code TEXT,
  recipient_email TEXT NOT NULL,
  recipient_domain TEXT NOT NULL,
  expected_domains TEXT,  -- JSON array
  reason TEXT NOT NULL,
  acknowledged_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

### Sync from Codex

Client registry lives in Codex (`config/client-registry.yaml`) and syncs to Nexus D1:

```typescript
// codex/scripts/sync-client-registry.ts

import { parse } from 'yaml';
import { readFileSync } from 'fs';

async function syncClientRegistry(nexusApiUrl: string, apiKey: string) {
  const registry = parse(readFileSync('config/client-registry.yaml', 'utf8'));

  for (const [code, client] of Object.entries(registry.clients)) {
    await fetch(`${nexusApiUrl}/api/admin/client-codes`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code,
        name_en: client.name_en,
        name_ja: client.name_ja,
        status: client.status,
        is_internal: client.internal ?? false,
        allowed_domains: client.allowed_domains,
      }),
    });
  }

  // Sync aliases
  for (const [alias, code] of Object.entries(registry.aliases)) {
    await fetch(`${nexusApiUrl}/api/admin/client-code-aliases`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ alias, client_code: code }),
    });
  }
}
```

### Courier UI Integration

Courier (the sharing UI) shows validation results from Nexus:

```svelte
<!-- courier/src/routes/share/+page.svelte -->

{#if shareError?.code === 'RECIPIENT_WARNING'}
  <div class="warning-dialog">
    <h3>⚠️ Recipient Validation Warning</h3>

    <p>{shareError.details.reason}</p>

    {#if shareError.details.expectedDomains}
      <p class="expected">
        <strong>Expected domains for {shareError.details.clientCode}:</strong>
        {shareError.details.expectedDomains.join(', ')}
      </p>
      <p class="actual">
        <strong>Recipient domain:</strong> {shareError.details.actualDomain}
      </p>
    {/if}

    <div class="actions">
      <button onclick={cancel}>Cancel</button>
      <button onclick={acknowledgeAndRetry} class="danger">
        I understand the risk, proceed anyway
      </button>
    </div>
  </div>
{:else if shareError?.code === 'RECIPIENT_BLOCKED'}
  <div class="error-dialog">
    <h3>🛑 Sharing Blocked</h3>
    <p>{shareError.details.reason}</p>
    <p>This document is marked as confidential and cannot be shared to unauthorized domains.</p>
    <button onclick={cancel}>Close</button>
  </div>
{/if}
```

### App Integration (Periodic/Pulse/Hanawa)

Apps generating shares include client code in filename:

```typescript
// periodic/src/lib/server/nexus.ts

export async function requestNexusProjectPdf(
  env: NexusEnv,
  request: NexusProjectPdfRequest
): Promise<NexusProjectPdfResponse> {

  // Generate filename with client code
  const clientCode = await getClientCode(env, request.externalOrgId);
  const filename = generateFilename({
    source: 'Periodic',
    clientCode,
    type: 'Report',
    identifier: 'DNSRemediation',
    date: new Date(),
  });

  // ... rest of PDF generation ...

  // If sharing after generation:
  const shareResult = await createShare({
    filename,  // Includes client code
    recipient_email: recipientEmail,
    provenance: {
      source_app: 'periodic',
      // ...
    },
  });

  // Handle validation response
  if (shareResult.code === 'RECIPIENT_WARNING') {
    // Return to app to show warning UI
    return { requiresConfirmation: true, warning: shareResult.details };
  }
}
```

## Hanawa Integration

### Filename Generation

When exporting from Hanawa:

```typescript
// packages/hanawa-cms/src/lib/export/filename.ts

import { format } from 'date-fns';

export interface FilenameOptions {
  source?: string;          // Default: 'Hanawa'
  clientCode: string;
  type: DocumentType;
  identifier: string;
  date?: Date;              // Default: now
  draft?: boolean;
  version?: number;
}

export function generateFilename(options: FilenameOptions, ext: string): string {
  const {
    source = 'Hanawa',
    clientCode,
    type,
    identifier,
    date = new Date(),
    draft = false,
    version,
  } = options;

  // Sanitize identifier (remove spaces, special chars)
  const safeIdentifier = identifier
    .replace(/[^a-zA-Z0-9-]/g, '')
    .replace(/-+/g, '-');

  const dateStr = format(date, 'yyyyMMdd');

  let filename = `${source}-${clientCode.toUpperCase()}-${type}-${safeIdentifier}`;

  if (draft) {
    filename += '-DRAFT';
  }

  filename += `-${dateStr}`;

  if (version && version > 1) {
    filename += `-v${version}`;
  }

  return `${filename}.${ext}`;
}

// Usage in export flow
const filename = generateFilename({
  clientCode: proposal.clientCode,
  type: 'Proposal',
  identifier: proposal.slug,
  draft: proposal.status === 'draft',
}, 'pdf');

// Result: Hanawa-ACME-Proposal-SecurityInfra-20250127.pdf
```

### Automatic Client Code Detection

When importing content or creating new documents:

```typescript
// Suggest client code from content
function detectClientCode(content: string, registry: ClientRegistry): string | null {
  const codes = extractClientCodesFromContent(content, registry);

  if (codes.length === 1) {
    return codes[0]; // Unambiguous
  }

  if (codes.length > 1) {
    // Multiple found - return null, let user choose
    return null;
  }

  return null;
}
```

## Provenance Metadata

Filenames are mirrored in document metadata:

```yaml
# Embedded in PDF and stored in D1
provenance:
  filename: "eSolia-ACME-Proposal-SecurityInfra-20250127.pdf"
  source: "Hanawa"
  client_code: "ACME"
  document_type: "Proposal"
  identifier: "SecurityInfra"
  created_date: "2025-01-27"
  created_by: "rick.cogley@esolia.co.jp"

  # Validation record
  validation:
    performed_at: "2025-01-27T10:30:00Z"
    recipient: "john.smith@acme.com"
    result: "allowed"
    client_match: true
```

## Audit Trail

All validation decisions are logged:

```sql
-- D1: recipient_validations table
CREATE TABLE recipient_validations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  client_code TEXT,
  recipient_email TEXT NOT NULL,
  recipient_domain TEXT NOT NULL,
  validation_result TEXT NOT NULL,  -- 'allowed' | 'warn' | 'blocked'
  reason TEXT,
  user_acknowledged BOOLEAN DEFAULT FALSE,
  validated_at TEXT NOT NULL,
  validated_by TEXT NOT NULL
);

-- Query: Find all warnings that were overridden
SELECT *
FROM recipient_validations
WHERE validation_result = 'warn'
  AND user_acknowledged = TRUE
ORDER BY validated_at DESC;
```

## Quick Reference

### Naming Pattern

```
{Source}-{ClientCode}-{Type}-{Identifier}-{Date}.{ext}
```

### Valid Document Types

| Type | Description | Default Sensitivity |
|------|-------------|---------------------|
| `Proposal` | Sales proposals | **Confidential** |
| `SOW` | Statement of Work | **Confidential** |
| `MSA` | Master Service Agreement | **Confidential** |
| `Report` | Assessment, audit, status reports | Confidential |
| `Invoice` | Billing documents | Confidential |
| `Omiyage` | Curated content packages | Normal |
| `Guide` | How-to, reference documents | Normal |
| `SOP` | Standard Operating Procedures | Internal |

**Note:** Confidential documents will **block** (not warn) on recipient mismatch.

### Validation Flow

1. Parse filename for client code and document type
2. Look up allowed domains in client registry
3. Determine sensitivity from document type:
   - `Proposal`, `SOW`, `MSA`, `Report`, `Invoice` → **Confidential** (strict)
   - `Guide`, `Omiyage` → Normal (warn only)
   - `SOP` → Internal (block external)
4. Compare recipient domain against allowed domains
5. Result:
   - **Match** → Allow
   - **Mismatch + Confidential** → **Block** (no override)
   - **Mismatch + Normal** → Warn (override with acknowledgment)

### Commands

```bash
# Validate a filename
npm run validate:filename "eSolia-ACME-Proposal-Test-20250127.pdf"

# Check recipient
npm run validate:recipient \
  --file "eSolia-ACME-Proposal-Test-20250127.pdf" \
  --recipient "user@acme.com"

# List all client codes
npm run clients:list
```

---

*Document version: 1.0*
*Last updated: 2025-12-27*

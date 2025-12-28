# Proposal Personalization System

How Codex handles client logos, branding, and customization in proposals.

## Overview

Proposals need to feel tailored to each client while leveraging reusable fragments. The personalization system handles:

1. **Client Identity** — Logos, colors, names
2. **Content Customization** — Industry-relevant examples, past project history
3. **Output Formatting** — Branded PDF generation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  PROPOSAL PERSONALIZATION FLOW                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. SELECT CLIENT              2. LOAD BRANDING         3. ASSEMBLE          │
│  ─────────────────             ──────────────           ────────            │
│                                                                              │
│  Client Registry ────┐         ┌─► Logo (R2)            Fragments +          │
│  (client-registry.yaml)        │   Client colors         Personalization     │
│        │              │        │   Industry metadata         │              │
│        ▼              │        │                             ▼              │
│  [ACME] ─────────────┴────────►│                       ┌──────────┐         │
│                                │                       │  Hanawa  │         │
│  Past Projects ───────────────►│                       │  Editor  │         │
│  (D1: client_history)          │                       └────┬─────┘         │
│                                                              │              │
│  4. GENERATE                   5. OUTPUT                     │              │
│  ────────                      ──────                        │              │
│                                                              ▼              │
│  Puppeteer (via Nexus) ◄──────────────────────────── Assembled MD          │
│        │                                                                    │
│        ▼                                                                    │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │  Cover PDF  │    │  Body PDF   │    │  Combined   │                     │
│  │  (branded)  │    │  (content)  │    │  Final PDF  │                     │
│  └─────────────┘    └─────────────┘    └─────────────┘                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Client Branding Storage

### R2 Bucket Structure

```
codex-content/
├── branding/
│   ├── esolia/
│   │   ├── logo-full.svg           # eSolia full logo
│   │   ├── logo-mark.svg           # eSolia mark only
│   │   └── colors.json             # eSolia CI colors
│   │
│   └── clients/
│       ├── ACME/
│       │   ├── logo.svg            # Client logo (vector preferred)
│       │   ├── logo.png            # Fallback PNG
│       │   └── branding.json       # Colors, fonts (optional)
│       │
│       ├── JAC/
│       │   └── logo.svg
│       │
│       └── NQNJ/
│           ├── logo.svg
│           └── branding.json
```

### Branding Configuration

```json
// R2:/branding/clients/NQNJ/branding.json
{
  "client_code": "NQNJ",
  "logo": {
    "primary": "logo.svg",
    "fallback": "logo.png",
    "min_width": 120,
    "max_width": 200
  },
  "colors": {
    "primary": "#1a1a1a",
    "secondary": "#c4a35a",
    "accent": null
  },
  "fonts": null,
  "special_requirements": null
}
```

## Personalization in Hanawa

### Proposal Creation Flow

```typescript
// In Hanawa CMS - proposal assembly
interface ProposalPersonalization {
  client: {
    code: string;                // From client registry
    name_en: string;
    name_ja: string;
    logo_url: string | null;     // R2 URL
    industry: string;
  };

  contacts: Array<{
    name: string;
    title: string;
    email: string;
  }>;

  proposal: {
    title_en: string;
    title_ja: string;
    date: string;
    version: string;
    preparers: string[];
    language: 'en' | 'ja' | 'bilingual';
  };

  branding: {
    show_client_logo: boolean;
    logo_position: 'left' | 'right' | 'center';
    color_accent: string | null;  // Override default accent
  };
}
```

### Cover Page Generation

```typescript
// Generate personalized cover page
async function generateCover(
  personalization: ProposalPersonalization,
  env: Env
): Promise<string> {
  // Fetch client logo if specified
  let clientLogoHtml = '';
  if (personalization.branding.show_client_logo && personalization.client.logo_url) {
    const logoUrl = await getSignedUrl(env.R2, personalization.client.logo_url);
    clientLogoHtml = `<img src="${logoUrl}" class="client-logo" alt="${personalization.client.name_en}">`;
  }

  return `
    <div class="proposal-cover">
      <header class="cover-header">
        <img src="/branding/esolia/logo-full.svg" class="esolia-logo" alt="eSolia Inc.">
        ${clientLogoHtml}
      </header>

      <main class="cover-content">
        <h1 class="proposal-title">
          ${personalization.proposal.title_en}
          ${personalization.proposal.title_ja ? `<br><span class="title-ja">${personalization.proposal.title_ja}</span>` : ''}
        </h1>

        <div class="proposal-meta">
          <p><strong>Date:</strong> ${personalization.proposal.date}</p>
          <p><strong>Version:</strong> ${personalization.proposal.version}</p>
          <p><strong>Prepared by:</strong> ${personalization.proposal.preparers.join(', ')}</p>
        </div>

        <div class="attention-block">
          <p><strong>Attention:</strong></p>
          ${personalization.contacts.map(c => `
            <p>${c.name}<br><span class="title">${c.title}</span></p>
          `).join('')}
          <p><strong>${personalization.client.name_en}</strong></p>
          ${personalization.client.name_ja ? `<p>${personalization.client.name_ja}</p>` : ''}
        </div>
      </main>
    </div>
  `;
}
```

## Industry-Based Customization

### Project Type Filtering

When including the `esolia-project-types` fragment, filter by client industry:

```typescript
const INDUSTRY_PROJECT_PRIORITIES: Record<string, string[]> = {
  'Medical Devices': [
    'Compliance & Audit',      // FDA, SOX
    'Infrastructure',
    'Microsoft & Enterprise Systems',
  ],
  'Finance': [
    'Compliance & Audit',      // SOX, SSAE
    'Annual Operations',       // BCP
    'Security',
  ],
  'Legal': [
    'Infrastructure',
    'Microsoft & Enterprise Systems',
    'Support & Training',
  ],
  'Retail': [
    'Office & Facilities',     // Shops, kiosks
    'Communications & AV',
    'Infrastructure',
  ],
};

function prioritizeProjectTypes(
  fragment: Fragment,
  industry: string
): Fragment {
  const priorities = INDUSTRY_PROJECT_PRIORITIES[industry] || [];
  // Reorder content sections based on industry relevance
  // ...
}
```

### Client History Injection

Add client-specific past projects after the generic list:

```typescript
async function getClientHistory(
  clientCode: string,
  env: Env
): Promise<string> {
  const projects = await env.DB.prepare(`
    SELECT year, project_name, description
    FROM client_projects
    WHERE client_code = ?
    ORDER BY year DESC
    LIMIT 20
  `).bind(clientCode).all();

  if (projects.results.length === 0) return '';

  let byYear: Record<string, string[]> = {};
  for (const p of projects.results) {
    if (!byYear[p.year]) byYear[p.year] = [];
    byYear[p.year].push(p.project_name);
  }

  let markdown = `\n### Past Projects with ${clientCode}\n\n`;
  for (const [year, projectList] of Object.entries(byYear).sort().reverse()) {
    markdown += `**${year}**\n`;
    for (const project of projectList) {
      markdown += `- ${project}\n`;
    }
    markdown += '\n';
  }

  return markdown;
}
```

## PDF Generation

### Cover + Body Assembly

```typescript
// Generate final PDF via Nexus/Puppeteer
async function generateProposalPdf(
  proposalHtml: string,
  personalization: ProposalPersonalization,
  env: Env
): Promise<ArrayBuffer> {
  // Generate cover page separately (for potential different styling)
  const coverHtml = await generateCover(personalization, env);

  // Combine with body
  const fullHtml = `
    <!DOCTYPE html>
    <html lang="${personalization.proposal.language === 'ja' ? 'ja' : 'en'}">
    <head>
      <meta charset="UTF-8">
      <link rel="stylesheet" href="/styles/proposal.css">
      <style>
        :root {
          --accent-color: ${personalization.branding.color_accent || 'var(--esolia-orange)'};
        }
      </style>
    </head>
    <body>
      ${coverHtml}
      <div class="page-break"></div>
      ${proposalHtml}
    </body>
    </html>
  `;

  // Send to Nexus for PDF generation
  const response = await fetch(`${NEXUS_URL}/api/v1/render/pdf`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${env.NEXUS_API_KEY}`,
    },
    body: JSON.stringify({
      html: fullHtml,
      options: {
        format: 'A4',
        margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' },
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: `
          <div style="font-size: 10px; width: 100%; text-align: center; color: #666;">
            <span>CONFIDENTIAL</span> |
            <span>${personalization.proposal.date}</span> |
            <span class="pageNumber"></span> / <span class="totalPages"></span>
          </div>
        `,
      },
    }),
  });

  return await response.arrayBuffer();
}
```

## Logo Guidelines

### Acceptable Formats

| Format | Priority | Use Case |
|--------|----------|----------|
| **SVG** | Preferred | Scales perfectly for any output |
| **PNG** | Fallback | When SVG not available (min 300 DPI) |
| **JPG** | Avoid | Only if PNG/SVG unavailable |

### Logo Requirements

- **Minimum size:** 120px wide at 72 DPI for screen
- **Maximum size:** 200px wide (prevents overwhelming cover)
- **Aspect ratio:** Preserved automatically
- **Background:** Transparent preferred

### Requesting Client Logos

When onboarding a new client:

1. Request vector logo (AI, EPS, SVG)
2. If unavailable, request high-resolution PNG (1000px+ wide)
3. Ask about brand color preferences
4. Store in R2 under `/branding/clients/{CLIENT_CODE}/`

## Database Schema

```sql
-- D1: Client branding metadata (supplements R2 storage)
CREATE TABLE client_branding (
  client_code TEXT PRIMARY KEY,
  logo_filename TEXT,
  primary_color TEXT,
  secondary_color TEXT,
  accent_color TEXT,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- D1: Client project history for proposal injection
CREATE TABLE client_projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_code TEXT NOT NULL,
  year TEXT NOT NULL,
  project_name TEXT NOT NULL,
  description TEXT,
  category TEXT,  -- 'Office', 'Compliance', 'Infrastructure', etc.
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_client_projects_code ON client_projects(client_code);
CREATE INDEX idx_client_projects_year ON client_projects(year);
```

## Security Considerations

### Logo Access

- Client logos stored in R2 are **not publicly accessible**
- Signed URLs generated only during PDF generation
- URLs expire after 1 hour

### Proposal Sensitivity

- All proposals default to **CONFIDENTIAL** classification
- Recipient validation enforced via file naming convention
- Audit trail maintained for all generated proposals

---

## Quick Reference

### Adding a New Client's Branding

1. Obtain logo from client (SVG preferred)
2. Add to R2: `PUT /branding/clients/{CODE}/logo.svg`
3. Optionally add `branding.json` with color preferences
4. Update `client_branding` table in D1

### Creating a Personalized Proposal

1. Select client from registry
2. Fill proposal personalization fields
3. Assemble from fragments
4. Add custom sections (requirements, offer)
5. Generate PDF via Hanawa

### Updating eSolia Branding

Update files in `R2:/branding/esolia/`:
- `logo-full.svg` — Full logo with text
- `logo-mark.svg` — Mark only
- `colors.json` — CI color definitions

---

*Document version: 1.0*
*Last updated: 2025-12-27*

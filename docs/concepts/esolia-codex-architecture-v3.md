# eSolia Codex: Unified Knowledge Platform (v3)

## Executive Summary

Codex is eSolia's unified knowledge infrastructure—a single source of truth for content, illustrations, and documentation that powers multiple products and touchpoints. The platform combines two authoring paths (a database-first CMS for non-technical staff and a Git repo for Claude Code power users), both publishing to R2 which feeds **two distribution channels**: Cloudflare's AI Search (RAG) for intelligent retrieval and SharePoint for M365 integration.

The conversational interface to Codex is **Miko** (巫女)—an approachable name that works in both Japanese and English, evoking a shrine maiden who serves as an intermediary between people and knowledge.

---

## The Core Concept

Think of Codex as the **knowledge infrastructure** for eSolia—like municipal water mains that feed every building in the city. The CMS and Git repo are two treatment plants preparing water, R2 is the main reservoir, AI Search and SharePoint are two distribution networks (external and internal), and the various touchpoints (apps, blogs, omiyage, Copilot) are the taps.

```
+-----------------------------------------------------------------------------+
|                              eSolia CODEX                                   |
|                       (Conversational Interface: Miko)                      |
+-----------------------------------------------------------------------------+
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  |                     DUAL AUTHORING PATHS                              |  |
|  |                                                                       |  |
|  |   +---------------------------+      +---------------------------+    |  |
|  |   |     Codex CMS (D1)        |      |    Git Repo (Codex)       |    |  |
|  |   |                           |      |                           |    |  |
|  |   |  Content:                 |      |  Content:                 |    |  |
|  |   |  * Blog posts             |      |  * Concepts (EN/JA)       |    |  |
|  |   |  * Help articles          |      |  * How-to guides          |    |  |
|  |   |  * Client docs            |      |  * Technical reference    |    |  |
|  |   |                           |      |                           |    |  |
|  |   |  Illustrations:           |      |  Illustrations:           |    |  |
|  |   |  * AI generation UI       |      |  * Mermaid files          |    |  |
|  |   |  * Browse & share         |      |  * draw.io sources        |    |  |
|  |   |  * Edit-a-copy            |      |  * SVG assets             |    |  |
|  |   +------------+--------------+      +------------+--------------+    |  |
|  |                |                                  |                   |  |
|  |                | On publish                       | CI on push        |  |
|  |                v                                  v                   |  |
|  |   +---------------------------------------------------------------+   |  |
|  |   |                R2 Bucket (codex-content)                      |   |  |
|  |   |                                                               |   |  |
|  |   |  /content/blog/*.md            (CMS-owned)                   |   |  |
|  |   |  /content/concepts/*.md        (Git-owned)                   |   |  |
|  |   |  /illustrations/*.mmd          (Mermaid diagrams)            |   |  |
|  |   |  /illustrations/*.svg          (Rendered/static)             |   |  |
|  |   |  /illustrations/*.drawio       (Editable sources)            |   |  |
|  |   +-------------------------------+-------------------------------+   |  |
|  |                                   |                                   |  |
|  +-----------------------------------+-----------------------------------+  |
|                                      |                                      |
|  +-----------------------------------+-----------------------------------+  |
|  |                     DISTRIBUTION CHANNELS                             |  |
|  |                                   |                                   |  |
|  |              +--------------------+--------------------+              |  |
|  |              |                                        |              |  |
|  |              v                                        v              |  |
|  |  +-----------------------------+    +-----------------------------+  |  |
|  |  |   AI SEARCH (Cloudflare)    |    |   SHAREPOINT (M365)         |  |  |
|  |  |                             |    |                             |  |  |
|  |  |  Indexes .md, .pdf, images  |    |  PDF export via Graph API   |  |  |
|  |  |  .search() -> 1-2 Neurons   |    |  Same filename = version    |  |  |
|  |  |  .aiSearch() -> 100-200     |    |  M365 Search indexes all    |  |  |
|  |  +-------------+---------------+    +-------------+---------------+  |  |
|  |                |                                  |                  |  |
|  |    +-----------+----------+-----------+           |                  |  |
|  |    |           |          |           |           |                  |  |
|  |    v           v          v           v           v                  |  |
|  | +-------+ +--------+ +--------+ +--------+ +-------------------+     |  |
|  | |CMS API| |RAG/Miko| |Illustr.| |Omiyage | |Copilot, Teams,    |     |  |
|  | |       | |        | |Library | |Tool    | |Outlook Search     |     |  |
|  | +---+---+ +----+---+ +----+---+ +----+---+ +---------+---------+     |  |
|  |     |          |          |          |               |               |  |
|  +-----+----------+----------+----------+---------------+---------------+  |
|        |          |          |          |               |                  |
+--------+----------+----------+----------+---------------+------------------+
         |          |          |          |               |
         v          v          v          v               v
  +-----------+ +--------+ +--------+ +----------+ +------------------+
  |   Apps    | | "Ask   | |Diagram | | Client   | | Internal Staff   |
  |           | | Miko"  | |Sharing | | Packages | | & Client M365    |
  | Periodic  | |        | |        | |          | |                  |
  | Pulse     | |In apps,| |Stand-  | |Content + | |"Hey Copilot,     |
  | Quiz      | |blog,   | |alone   | |diagrams  | | find our SPF     |
  |           | |help    | |or sets | |via Nexus | | guide"           |
  +-----------+ +--------+ +--------+ +----------+ +------------------+
```

---

## Distribution Channels

The key architectural insight: **same content, multiple distribution channels** optimized for different audiences.

### Channel Comparison

| Aspect | AI Search (Cloudflare) | SharePoint (M365) |
|--------|------------------------|-------------------|
| **Audience** | External clients, public help | Internal staff, client M365 tenants |
| **Discovery** | Miko widget, portal browse | Copilot, Teams search, Outlook |
| **Format** | Native markdown, images | PDF (converted on publish) |
| **Indexing** | Automatic (~3 min sync) | M365 Search (automatic) |
| **Cost** | Neurons (per-query) | Included in M365 license |
| **Best for** | Q&A, semantic search | Internal reference, client handoffs |

### Publish Targets Flow

```
CMS / Git
    |
    +---> R2 ---> AI Search ---> Miko, Portal, Apps
    |
    +---> SharePoint (PDF) ---> M365 Search ---> Copilot, Teams, Outlook

Same source, multiple distribution channels
```

---

## Branding, Provenance & Consistency

Every artifact leaving Codex—whether a PDF export, Miko response, omiyage package, or SharePoint document—carries eSolia's identity and traceable origins. Think of this like a mint mark on a coin: it tells you where it came from, who made it, and guarantees authenticity.

### Design Principles

```
+-------------------------------------------------------------------------+
|  ARTIFACT IDENTITY SYSTEM                                               |
+-------------------------------------------------------------------------+
|                                                                         |
|  Every Codex artifact must answer:                                      |
|                                                                         |
|  WHO made this?     --> eSolia branding (logo, contacts, website)       |
|  WHAT version?      --> Embedded metadata (version, date, source)       |
|  WHERE to verify?   --> Canonical URL or Codex reference page           |
|  HOW to cite?       --> AI-readable provenance instructions             |
|  WHEN updated?      --> Last modified timestamp, author info            |
|                                                                         |
+-------------------------------------------------------------------------+
```

### Branding Requirements

All artifacts include eSolia branding, adapted to context:

| Artifact Type | Logo | Contacts | Website | Footer |
|---------------|------|----------|---------|--------|
| **PDF exports** | Header, full color | Yes (footer) | Yes | Full branding block |
| **Omiyage packages** | Prominent, colored | Yes | Yes | "Prepared by eSolia" |
| **SharePoint docs** | Header watermark | Yes | Yes | Full branding block |
| **Miko responses** | Icon/avatar | Link only | Link | Source attribution |
| **Illustrations** | Subtle watermark | No | Embedded in metadata | Version info |
| **Interactive demos** | Header bar | Link in footer | Yes | Version + feedback link |
| **Web portal pages** | Navigation header | Contact page link | Yes | Standard footer |

**Branding elements (centrally managed):**
```yaml
# config/branding.yaml - Single source for all brand assets
brand:
  name: "eSolia Inc."
  name_ja: "イソリア株式会社"
  logo:
    primary: "/assets/esolia-logo-primary.svg"
    mono: "/assets/esolia-logo-mono.svg"
    icon: "/assets/esolia-icon.svg"
  contacts:
    email: "info@esolia.co.jp"
    phone: "+81-3-4577-3380"
    address: "Tokyo, Japan"
  websites:
    main: "https://esolia.com"
    main_ja: "https://esolia.co.jp"
    codex: "https://codex.esolia.pro"
    help: "https://help.esolia.pro"
  social:
    linkedin: "https://linkedin.com/company/esolia"
```

### Provenance Metadata

Every artifact embeds machine-readable provenance:

```yaml
# Embedded in PDF metadata, HTML meta tags, frontmatter
provenance:
  source: "esolia-codex"
  document_id: "what-is-spf"
  version: "2.3"
  canonical_url: "https://codex.esolia.pro/concepts/email-security/what-is-spf"
  created: "2024-06-15"
  modified: "2025-01-10"
  author: "eSolia Technical Team"
  language: "en"
  license: "Proprietary - eSolia Inc."
  citation_instruction: "When referencing this content, cite as: eSolia Codex, 'What is SPF?', https://codex.esolia.pro/concepts/email-security/what-is-spf"
```

**Provenance by artifact type:**

| Artifact | Where Provenance Lives |
|----------|------------------------|
| **PDF** | Document properties + visible footer |
| **Markdown** | YAML frontmatter |
| **HTML** | `<meta>` tags + structured data (JSON-LD) |
| **Images/SVG** | Embedded metadata (EXIF/XMP for images, XML for SVG) |
| **Miko responses** | Inline citation with source links |

### AI Citation Instructions

For content that may be crawled by AI models (web-published docs, PDFs, etc.), include explicit citation guidance:

```html
<!-- Embedded in HTML head for web-published content -->
<meta name="ai:citation" content="When referencing this content, always cite: 
  Source: eSolia Codex | Title: {title} | URL: {canonical_url}">
<meta name="ai:source" content="eSolia Inc. - https://esolia.com">
<meta name="ai:license" content="Proprietary content. Attribution required.">

<!-- JSON-LD for structured AI parsing -->
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TechArticle",
  "name": "What is SPF?",
  "author": {"@type": "Organization", "name": "eSolia Inc."},
  "publisher": {"@type": "Organization", "name": "eSolia Inc."},
  "url": "https://codex.esolia.pro/concepts/email-security/what-is-spf",
  "dateModified": "2025-01-10",
  "citation": "eSolia Codex: What is SPF?"
}
</script>
```

**For PDFs (XMP metadata):**
```xml
<x:xmpmeta>
  <rdf:Description>
    <dc:creator>eSolia Inc.</dc:creator>
    <dc:rights>Proprietary - eSolia Inc. Attribution required when citing.</dc:rights>
    <esolia:citationInstruction>Cite as: eSolia Codex, "{title}", {canonical_url}</esolia:citationInstruction>
    <esolia:codexSource>true</esolia:codexSource>
  </rdf:Description>
</x:xmpmeta>
```

### Visual Consistency Standards

All Codex artifacts share a unified visual language:

**Typography:**
```css
/* Standard Codex typography - applied to all rendered outputs */
:root {
  --font-sans: "IBM Plex Sans JP", "IBM Plex Sans", system-ui, sans-serif;
  --font-mono: "IBM Plex Mono", "Consolas", monospace;
  
  /* Font weights */
  --font-weight-normal: 400;
  --font-weight-medium: 500;
  --font-weight-bold: 600;
}

body { font-family: var(--font-sans); }
code, pre { font-family: var(--font-mono); }
```

**Color palette:**
```css
:root {
  /* Primary brand colors */
  --esolia-blue: #0066cc;
  --esolia-blue-dark: #004d99;
  
  /* Diagram colors - consistent across Mermaid, draw.io, SVG */
  --diagram-primary: #0066cc;
  --diagram-secondary: #6699cc;
  --diagram-accent: #ff9933;
  --diagram-neutral: #666666;
  --diagram-background: #f5f7fa;
  --diagram-border: #cccccc;
}
```

**Diagram styling (Mermaid defaults):**
```javascript
// Applied to all AI-generated and authored Mermaid diagrams
const mermaidConfig = {
  theme: 'base',
  themeVariables: {
    primaryColor: '#e6f0ff',
    primaryBorderColor: '#0066cc',
    primaryTextColor: '#333333',
    secondaryColor: '#fff5e6',
    tertiaryColor: '#f0f0f0',
    fontFamily: '"IBM Plex Sans JP", "IBM Plex Sans", sans-serif',
    fontSize: '14px'
  }
};
```

**PDF template structure:**
```
+------------------------------------------+
|  [eSolia Logo]                    v2.3   |  <- Header
+------------------------------------------+
|                                          |
|  Document Title                          |
|  ==================                      |
|                                          |
|  Content body with consistent            |
|  typography and spacing...               |
|                                          |
|  [Diagrams with branded styling]         |
|                                          |
+------------------------------------------+
|  eSolia Inc. | esolia.com | info@...     |  <- Footer
|  Source: Codex | Modified: 2025-01-10    |
|  Cite: https://codex.esolia.pro/...      |
+------------------------------------------+
```

### Bulk Update Capability

Branding elements are centrally managed for easy updates:

```
+-------------------------------------------------------------------------+
|  BULK UPDATE ARCHITECTURE                                               |
+-------------------------------------------------------------------------+
|                                                                         |
|  +-------------------+                                                  |
|  | config/           |                                                  |
|  | branding.yaml     |  <-- Single source of truth                     |
|  +--------+----------+                                                  |
|           |                                                             |
|           | Referenced by:                                              |
|           |                                                             |
|  +--------v----------+  +------------------+  +------------------+      |
|  | PDF Templates     |  | Web Components   |  | Email Templates  |      |
|  | (WeasyPrint CSS)  |  | (Svelte)         |  | (Mjml)           |      |
|  +-------------------+  +------------------+  +------------------+      |
|                                                                         |
|  To update branding across all artifacts:                               |
|  1. Edit config/branding.yaml                                           |
|  2. Commit and push                                                     |
|  3. CI regenerates templates                                            |
|  4. New exports use updated branding                                    |
|  5. (Optional) Batch re-export existing docs                            |
|                                                                         |
+-------------------------------------------------------------------------+
```

**What can be bulk-updated:**
- Logo (all variants)
- Company name / legal name
- Contact information (email, phone, address)
- Website URLs
- Social media links
- Copyright year
- Color palette (for future rebranding)

**Implementation:**
```javascript
// PDF generation reads from central config
import { brand } from '$lib/config/branding';

async function generatePdf(document) {
  const html = renderTemplate(document, {
    logo: brand.logo.primary,
    companyName: brand.name,
    contacts: brand.contacts,
    codexUrl: brand.websites.codex,
    copyrightYear: new Date().getFullYear()
  });
  
  return await convertToPdf(html);
}
```

### Writing Style: Google + Diataxis

All Codex content follows a hybrid style guide:

**Diataxis structure** — Content categorized by purpose:
- **Tutorials** — Learning-oriented (step-by-step)
- **How-to guides** — Task-oriented (goal-focused)
- **Reference** — Information-oriented (accurate, complete)
- **Explanation** — Understanding-oriented (concepts, context)

**Google Developer Documentation Style:**
- Present tense, active voice
- Second person ("you") for instructions
- Short sentences, clear structure
- Avoid jargon; explain when necessary
- Front-load important information

**Example transformation:**
```
Before: "The SPF record can be configured by the administrator 
         in order to specify which servers are permitted."

After:  "Configure your SPF record to specify which servers 
         can send email for your domain."
```

### Style Enforcement (Linting)

Authors can't be expected to memorize style guides. Automated feedback catches issues before publish:

```
+-------------------------------------------------------------------------+
|  STYLE LINTING PIPELINE                                                 |
+-------------------------------------------------------------------------+
|                                                                         |
|  CMS Editor (real-time)           Git Commits (CI check)                |
|  ----------------------           ------------------                    |
|                                                                         |
|  Author types -> Vale linter      Push -> GitHub Action                 |
|  runs in browser -> inline        runs Vale + markdownlint              |
|  warnings like spellcheck         -> PR blocked if errors               |
|                                                                         |
|  "Passive voice detected"         "Build failed: 3 style issues"        |
|  "Sentence too long (>25 words)"  - line 42: passive voice              |
|  "Jargon: consider simpler term"  - line 58: jargon 'utilize'           |
|                                   - line 71: missing alt text           |
|                                                                         |
+-------------------------------------------------------------------------+
```

**Linting tools:**
- **Vale** — Prose linter with Google style rules, custom eSolia rules
- **markdownlint** — Structure and formatting
- **Custom rules** — Diataxis category validation, frontmatter schema check

**Vale configuration example:**
```yaml
# .vale.ini
StylesPath = .vale/styles
MinAlertLevel = suggestion

[*.md]
BasedOnStyles = Google, eSolia

# eSolia custom rules
eSolia.Jargon = YES        # Flag internal jargon
eSolia.Passive = YES       # Warn on passive voice
eSolia.SentenceLength = YES # Max 25 words
eSolia.Frontmatter = YES   # Validate required fields
```

### Artifact Checklist

Before any artifact leaves Codex:

```
[ ] eSolia logo present (appropriate variant for context)
[ ] Contact information included (or linked)
[ ] Website reference included
[ ] Version number embedded
[ ] Last modified date visible
[ ] Author/source attribution
[ ] Canonical URL (if applicable)
[ ] AI citation instruction embedded
[ ] Fonts: IBM Plex Sans JP / Mono
[ ] Colors: Within brand palette
[ ] Diagrams: Using standard styling
[ ] Content: Diataxis-appropriate structure
[ ] Tone: Google style guide compliant (linting passed)
```

---

## Interactive Demos

Beyond static diagrams and documents, Codex includes **interactive demos**—self-contained experiences that let users explore concepts hands-on. Think Linear's product tours or Stripe's API explorer: engaging, educational, and memorable.

### The Concept

```
+-------------------------------------------------------------------------+
|  INTERACTIVE DEMOS                                                      |
+-------------------------------------------------------------------------+
|                                                                         |
|  What they are:                                                         |
|  * Self-contained mini-applications                                     |
|  * Embeddable in any eSolia web property                               |
|  * Shareable via standalone URL                                         |
|  * Educational, not just decorative                                     |
|                                                                         |
|  Examples:                                                              |
|  +------------------+  +------------------+  +------------------+       |
|  | SPF Record       |  | Network Topology |  | Password         |       |
|  | Builder          |  | Simulator        |  | Strength Checker |       |
|  |                  |  |                  |  |                  |       |
|  | User enters      |  | Drag/drop nodes, |  | Real-time        |       |
|  | domain, picks    |  | see traffic flow,|  | feedback as      |       |
|  | options, sees    |  | simulate failure |  | user types,      |       |
|  | generated record |  | scenarios        |  | explains why     |       |
|  +------------------+  +------------------+  +------------------+       |
|                                                                         |
|  +------------------+  +------------------+  +------------------+       |
|  | M365 License     |  | Backup Recovery  |  | DNS Propagation  |       |
|  | Comparison       |  | Time Calculator  |  | Visualizer       |       |
|  |                  |  |                  |  |                  |       |
|  | Interactive      |  | Input data size, |  | Enter domain,    |       |
|  | feature matrix,  |  | connection speed,|  | watch records    |       |
|  | filter by need   |  | see RTO/RPO      |  | update globally  |       |
|  +------------------+  +------------------+  +------------------+       |
|                                                                         |
+-------------------------------------------------------------------------+
```

### Demo Architecture

Demos are built as **standalone Svelte components** that can be:
- Embedded via iframe or web component
- Loaded directly at their own URL
- Bundled into omiyage packages

```
+-------------------------------------------------------------------------+
|  DEMO DISTRIBUTION                                                      |
+-------------------------------------------------------------------------+
|                                                                         |
|       +-------------------+                                             |
|       |  Demo Component   |  (Svelte, self-contained)                   |
|       |  /demos/spf-builder|                                            |
|       +---------+---------+                                             |
|                 |                                                       |
|       +---------+---------+---------+---------+                         |
|       |         |         |         |         |                         |
|       v         v         v         v         v                         |
|   +-------+ +-------+ +-------+ +-------+ +----------+                  |
|   |Standalone| |Blog  | |Help  | |Omiyage| |Client   |                  |
|   |URL     | |Post  | |Article| |Package| |Portal   |                  |
|   |        | |Embed | |Embed | |Embed | |(Nexus)  |                  |
|   +-------+ +-------+ +-------+ +-------+ +----------+                  |
|                                                                         |
|   demos.esolia.pro/spf-builder  <- Standalone, shareable                |
|   blog.esolia.pro/email-security#demo  <- Embedded in context           |
|   nexus.esolia.pro/package/xyz  <- Part of omiyage                      |
|                                                                         |
+-------------------------------------------------------------------------+
```

### Demo Types

| Type | Purpose | Interaction Level | Example |
|------|---------|-------------------|---------|
| **Calculator** | Compute values from inputs | Low | Backup RTO calculator, license cost estimator |
| **Builder** | Generate config/code | Medium | SPF record builder, firewall rule generator |
| **Simulator** | Explore scenarios | Medium | Network traffic flow, failure mode visualization |
| **Explorer** | Navigate complex info | Medium | M365 license comparison, compliance framework browser |
| **Tutorial** | Guided walkthrough | High | Step-by-step config wizard, interactive onboarding |

### Technical Implementation

```
codex/
├── demos/
│   ├── spf-builder/
│   │   ├── SPFBuilder.svelte      # Main component
│   │   ├── logic.ts               # Business logic (testable)
│   │   ├── demo.config.yaml       # Metadata, embed settings
│   │   └── README.md              # Documentation
│   │
│   ├── network-simulator/
│   │   ├── NetworkSimulator.svelte
│   │   ├── topology.ts
│   │   └── demo.config.yaml
│   │
│   └── shared/
│       ├── DemoWrapper.svelte     # Standard chrome (branding, share button)
│       ├── EmbedHelper.ts         # iframe/web component utilities
│       └── analytics.ts           # Usage tracking
```

**Demo config schema:**
```yaml
# demos/spf-builder/demo.config.yaml
id: spf-builder
title:
  en: "SPF Record Builder"
  ja: "SPFレコードビルダー"
description:
  en: "Interactively build and validate SPF records for your domain"
  ja: "ドメインのSPFレコードを対話的に作成・検証"

# Embedding settings
embed:
  min_width: 400
  min_height: 500
  responsive: true
  allow_fullscreen: true

# Branding (inherits from global, can override)
branding:
  show_logo: true
  show_footer: true
  
# Related content (for "Learn More" links)
related:
  - concepts/email-security/what-is-spf
  - how-to/microsoft/configure-spf-m365

# Analytics
tracking:
  category: "demo"
  events:
    - "record_generated"
    - "validation_run"
    - "copied_to_clipboard"

# Provenance (auto-populated on build)
provenance:
  version: "1.2"
  canonical_url: "https://demos.esolia.pro/spf-builder"
```

### Demo Wrapper (Standard Chrome)

Every demo gets wrapped with consistent branding and functionality:

```
+-------------------------------------------------------------------------+
|  [eSolia Logo]              SPF Record Builder              [Share] [?] |
+-------------------------------------------------------------------------+
|                                                                         |
|                                                                         |
|                      [ Demo Content Area ]                              |
|                                                                         |
|                                                                         |
+-------------------------------------------------------------------------+
|  Learn more: What is SPF? | Configure SPF for M365     [Fullscreen]    |
+-------------------------------------------------------------------------+
|  esolia.com | v1.2 | Feedback                                          |
+-------------------------------------------------------------------------+
```

**Wrapper features:**
- eSolia branding (configurable visibility)
- Share button (copies standalone URL)
- Help/info button (shows description)
- Related content links
- Fullscreen toggle (for embedded contexts)
- Version and feedback link

### Embedding Options

**1. iframe (simplest, most isolated):**
```html
<iframe 
  src="https://demos.esolia.pro/spf-builder?embed=true" 
  width="100%" 
  height="500"
  frameborder="0"
  allow="clipboard-write">
</iframe>
```

**2. Web Component (cleaner integration):**
```html
<script src="https://demos.esolia.pro/embed.js"></script>
<esolia-demo name="spf-builder" theme="light"></esolia-demo>
```

**3. Svelte import (for eSolia properties):**
```svelte
<script>
  import SPFBuilder from '@esolia/codex-demos/spf-builder';
</script>

<SPFBuilder showBranding={true} onComplete={handleComplete} />
```

### Demo Lifecycle

```
+-------------------------------------------------------------------------+
|  DEMO DEVELOPMENT FLOW                                                  |
+-------------------------------------------------------------------------+
|                                                                         |
|  1. PROPOSE                                                             |
|     "We keep explaining SPF to clients—let's build an interactive tool" |
|                                                                         |
|  2. DESIGN                                                              |
|     Sketch interactions, define inputs/outputs, identify edge cases     |
|                                                                         |
|  3. BUILD                                                               |
|     Svelte component + logic, follows Codex styling                     |
|                                                                         |
|  4. REVIEW                                                              |
|     Test on mobile, verify branding, check accessibility                |
|                                                                         |
|  5. PUBLISH                                                             |
|     Deploy to demos.esolia.pro, register in Codex catalog               |
|                                                                         |
|  6. EMBED                                                               |
|     Add to relevant blog posts, help articles, omiyage packages         |
|                                                                         |
|  7. ITERATE                                                             |
|     Analytics show drop-off -> improve UX -> version bump               |
|                                                                         |
+-------------------------------------------------------------------------+
```

### Integration with Other Codex Components

| Component | How Demos Integrate |
|-----------|---------------------|
| **Content (blog, help)** | Embed demos inline where they add value |
| **Illustrations** | Demos can include/generate diagrams |
| **Omiyage** | Package demos with explanatory content |
| **Miko** | "Show me how SPF works" → links to demo |
| **SharePoint** | Link to demo URL (can't embed interactive) |

### Demo Ideas Backlog

| Demo | Value | Complexity | Notes |
|------|-------|------------|-------|
| **How a VPN Works** | High | Medium | Packet journey visualization, encryption envelope animation |
| **How Routing Works** | High | Medium | Hop-by-hop path visualization, "what happens when you visit a website" |
| **Cloud Phone System** | High | Medium | Call flow from desk phone → cloud → PSTN/mobile, failover scenarios |
| **Cable Bend Radius** | High | Low-Medium | Drag to bend, watch signal degrade, cross-section view |
| **Structured Cabling Explained** | High | Medium-High | 6-section interactive: why structured, impedance, installation, DIY, reuse, slack |
| SPF Record Builder | High (common question) | Medium | Input domain, select options, generate record |
| DMARC Policy Tester | High | Medium | Paste policy, see what it does, test scenarios |
| Password Strength Analyzer | Medium (client education) | Low | Real-time feedback, explain why weak/strong |
| M365 License Comparison | High (sales support) | Medium | Interactive feature matrix, filter by need |
| Network Topology Builder | High (omiyage visual) | High | Drag/drop, export as diagram |
| Backup RTO/RPO Calculator | Medium | Low | Input data size, connection speed, see recovery time |
| DNS Record Explainer | Medium | Medium | Paste any record, see plain-English explanation |
| Firewall Rule Visualizer | Medium | Medium | Input rules, see what traffic allowed/blocked |

### Cloudflare Tech for Interactive Demos

Beyond basic SvelteKit/Pages hosting, several Cloudflare services could enhance demos:

```
+-------------------------------------------------------------------------+
|  CLOUDFLARE TECH OPTIONS FOR DEMOS                                      |
+-------------------------------------------------------------------------+
|                                                                         |
|  MOST DEMOS (Static + Client-Side Interactivity)                       |
|  ────────────────────────────────────────────────                       |
|  Pages + SvelteKit = sufficient                                         |
|  All state lives in browser (Svelte stores)                            |
|  No backend needed for simulators, explorers, calculators              |
|                                                                         |
|  WITH PERSISTENCE (Save Progress, Shareable Configs)                   |
|  ────────────────────────────────────────────────────                   |
|  D1 — User progress, quiz scores, completion tracking                  |
|  KV — Fast reads for leaderboards, cached config                       |
|  R2 — User-generated exports (diagrams, configs)                       |
|                                                                         |
|  REAL-TIME COLLABORATION ("Same Room" Features)                        |
|  ────────────────────────────────────────────────                       |
|  Durable Objects + WebSockets                                          |
|  • Multiple users manipulating same diagram                            |
|  • Live cursor positions ("Alice is here")                             |
|  • Turn-based simulations                                              |
|  • Chat alongside demo                                                 |
|                                                                         |
|  VIDEO CONTENT (Explainer Clips)                                       |
|  ────────────────────────────────                                       |
|  Stream — Pre-recorded 30-60 second overviews                          |
|  • "Watch first, then try" pattern                                     |
|  • Signed URLs for access control                                      |
|  • Embeds alongside interactive portion                                |
|                                                                         |
|  LIVE VIDEO (Expert Assistance) — Probably Overkill                    |
|  ────────────────────────────────────────────────────                   |
|  Realtime/Calls — WebRTC, <100ms latency                               |
|  • "Expert joins your session" feature                                 |
|  • Complex, high-cost, Phase 10+ territory                             |
|                                                                         |
+-------------------------------------------------------------------------+
```

**Practical Assessment:**

| Use Case | Tech | Worth It? | Complexity |
|----------|------|-----------|------------|
| Single-user simulators (VPN, routing, cabling) | Pages only | ✅ Start here | Low |
| Save user's demo progress | D1 | ✅ Nice addition | Low |
| "Share my configuration" links | KV or D1 | ✅ Valuable touch | Low |
| Short video explanations | Stream | ✅ For complex topics | Low-Med |
| Multiple users in same demo | Durable Objects | 🤔 Later phase | Medium |
| Live expert assistance | Realtime/Calls | ❌ Overkill for now | High |

**Durable Objects Sweet Spot:**

DOs shine when multiple users need to see the same state. The obvious pitch is "collaborative network design with clients," but there's a psychological reality: **most people hate creating in front of an audience.** Impostor syndrome is real—one wrong label while the client watches and confidence evaporates.

The more realistic sweet spot is **internal peer pairing**:

```
+-------------------------------------------------------------------------+
|  SHARED EDITOR: REALISTIC USE CASES                                    |
+-------------------------------------------------------------------------+
|                                                                         |
|  CLIENT-FACING (High pressure — probably won't use)                    |
|  ─────────────────────────────────────────────────                      |
|  ✗ "Let me draw your network while you watch"                          |
|     → Most staff would freeze                                          |
|     → Mistakes feel like judgment                                      |
|     → Better to prepare materials BEFORE the meeting                   |
|                                                                         |
|  PEER PAIRING (Low pressure — real value here)                         |
|  ────────────────────────────────────────────────                       |
|  ✓ "You do the network side, I'll do cabling"                         |
|     → Mistakes are just "oh, move that"                                |
|     → Faster than email back-and-forth                                 |
|                                                                         |
|  ✓ "Let's review this report together"                                 |
|     → Both see same doc, point at sections                             |
|     → 2.5 days of async ping-pong → 30-minute sync                     |
|                                                                         |
|  ✓ "Show me how you'd structure this" (mentoring)                      |
|     → Junior watches senior work                                       |
|     → Senior reviews junior's draft live                               |
|                                                                         |
+-------------------------------------------------------------------------+
```

**The async ping-pong problem this solves:**

```
CURRENT (email/chat back-and-forth):

Mon 10:00  A sends draft
Mon 15:00  B finally opens it
Mon 16:00  B sends comments
Tue 09:00  A sees comments
Tue 11:00  A sends revision
Tue 14:00  B reviews, more comments
Wed 10:00  A finalizes

Elapsed: ~2.5 days for 1 hour of actual work

WITH SHARED EDITOR:

Mon 10:00  "Got 30 mins to go through this?"
Mon 10:30  Done.
```

**Architecture sketch (for when we explore this):**

```
+-------------------------------------------------------------------------+
|  SHARED EDITOR ARCHITECTURE                                            |
+-------------------------------------------------------------------------+
|                                                                         |
|  Browser A                      Browser B                               |
|       │                              │                                  |
|       │    WebSocket                 │    WebSocket                     |
|       └──────────────┬───────────────┘                                  |
|                      │                                                  |
|                      ▼                                                  |
|           ┌──────────────────────┐                                      |
|           │   Durable Object     │                                      |
|           │   "session-abc123"   │                                      |
|           │                      │                                      |
|           │  SQLite: shapes,     │  <- Persistent diagram state        |
|           │  connections, notes  │                                      |
|           │                      │                                      |
|           │  Memory: cursors,    │  <- Transient (don't need to save)  |
|           │  who's online        │                                      |
|           │                      │                                      |
|           │  Broadcasts changes  │                                      |
|           │  to all connections  │                                      |
|           └──────────────────────┘                                      |
|                                                                         |
|  On "Save to Library":                                                  |
|  Export SVG → R2 → D1 metadata → appears in Illustration Library       |
|                                                                         |
+-------------------------------------------------------------------------+
```

**Recommendation: Explore, don't commit**

Add a discovery spike to validate whether this solves a real ops pain point before investing 4-6 weeks of build effort:

- How often does async ping-pong actually slow things down?
- Would staff use a shared editor, or default to "I'll just do it myself"?
- Is the integration effort worth it vs. just using existing tools (Figma, etc.)?

If answers are positive → real phase. If not → we've spent a day learning, not weeks building.

**Stream for Video Explainers:**

Short clips complement interactive demos beautifully:

```
+-------------------------------------------------------------------------+
|  VIDEO + INTERACTIVE PATTERN                                           |
+-------------------------------------------------------------------------+
|                                                                         |
|  ┌──────────────────────────┐  ┌────────────────────────────────────┐  |
|  │                          │  │                                    │  |
|  │  [▶ 45-second overview] │  │      INTERACTIVE DEMO              │  |
|  │                          │  │                                    │  |
|  │  Stream embed            │  │  Toggle VPN on/off                │  |
|  │  Narrated explanation    │  │  See packets encrypted            │  |
|  │                          │  │  Click to inspect                 │  |
|  └──────────────────────────┘  │                                    │  |
|                                │                                    │  |
|  • Sets context before play   └────────────────────────────────────┘  |
|  • Accessible (audio/captions)                                         |
|  • Reusable across demos                                               |
|  • Analytics on watch completion                                       |
|                                                                         |
+-------------------------------------------------------------------------+
```

Stream pricing: ~$5/1000 minutes watched + $1/1000 minutes stored.
For 30-60 second explainer clips, very affordable.

**Recommended Phasing:**

```
Phase 6.5: Single-user demos (Pages + SvelteKit only)
  └── Ship fast, no backend complexity
  └── VPN, routing, cabling demos
  
Phase 7+: Add persistence (D1)
  └── Save progress, shareable config URLs
  └── "Share my SPF record" links
  
Phase 8+: Video explainers (Stream)  
  └── "Watch the 30-second intro" clips
  └── Pre-demo context setting
  
Phase 9: Shared Editor Spike (1-2 days exploration)
  └── Does async ping-pong actually slow ops enough to fix?
  └── Would staff use it, or stick to "I'll just do it myself"?
  └── Build vs. use existing tools (Figma, Miro)?
  └── If validated → Phase 10 becomes real build
  
Phase 10+: Shared Editor Build (Durable Objects) — only if spike validates
  └── Peer pairing for diagrams, reports
  └── Kill the 2.5-day email back-and-forth
  └── NOT for client-facing (impostor syndrome is real)
```

Start simple—single-user demos deliver 90% of the value with 10% of the complexity.

**How a VPN Works**

```
+-------------------------------------------------------------------------+
|  VPN DEMO CONCEPT                                                       |
+-------------------------------------------------------------------------+
|                                                                         |
|  Scene: Your laptop connecting to office server                         |
|                                                                         |
|  [Your Laptop] ----> [Coffee Shop WiFi] ----> [Internet] ----> [Office] |
|                                                                         |
|  Toggle: VPN OFF                                                        |
|  - Packets shown as open envelopes (readable)                           |
|  - "Hacker" icon at coffee shop can see contents                        |
|  - Data: "Salary: ¥5,000,000" visible                                   |
|                                                                         |
|  Toggle: VPN ON                                                         |
|  - Packets wrapped in encrypted tunnel (sealed box)                     |
|  - Hacker sees only encrypted blob                                      |
|  - Tunnel endpoint at office "unwraps" to reveal data                   |
|                                                                         |
|  Interactive elements:                                                  |
|  - Toggle VPN on/off                                                    |
|  - Click packet to see contents (or encrypted gibberish)                |
|  - Hover over hacker to see "what they can see"                         |
|  - Speed slider to watch journey fast/slow                              |
|                                                                         |
+-------------------------------------------------------------------------+
```

**How Routing Works**

```
+-------------------------------------------------------------------------+
|  ROUTING DEMO CONCEPT                                                   |
+-------------------------------------------------------------------------+
|                                                                         |
|  "What happens when you visit esolia.com?"                              |
|                                                                         |
|  Step-by-step journey with map visualization:                           |
|                                                                         |
|  1. [Your Browser] "I need esolia.com"                                  |
|         |                                                               |
|         v                                                               |
|  2. [Local DNS] "Let me look that up... 104.26.10.52"                  |
|         |                                                               |
|         v                                                               |
|  3. [Your Router] "Office network -> ISP gateway"                       |
|         |                                                               |
|         v                                                               |
|  4. [ISP Router] "Japan -> US West Coast (3 hops shown)"               |
|         |                                                               |
|         v                                                               |
|  5. [Cloudflare Edge] "Closest server responds"                         |
|         |                                                               |
|         v                                                               |
|  6. [Response] travels back (reverse path)                              |
|                                                                         |
|  Interactive elements:                                                  |
|  - Enter any URL to trace                                               |
|  - Click each hop to learn what it does                                 |
|  - "Simulate failure" button (show rerouting)                           |
|  - Latency display at each hop                                          |
|  - World map with actual path visualization                             |
|                                                                         |
+-------------------------------------------------------------------------+
```

**Cloud Phone System**

```
+-------------------------------------------------------------------------+
|  CLOUD PHONE DEMO CONCEPT                                               |
+-------------------------------------------------------------------------+
|                                                                         |
|  "What happens when someone calls your office?"                         |
|                                                                         |
|  Scenario selector:                                                     |
|  [ ] Incoming call to main number                                       |
|  [ ] Internal extension to extension                                    |
|  [ ] Outbound call to mobile                                            |
|  [ ] Office internet goes down (failover)                               |
|                                                                         |
|  Visualization:                                                         |
|                                                                         |
|  [Caller] --PSTN--> [Cloud PBX] --Internet--> [Office Desk Phone]       |
|              |            |                          |                  |
|              |            +---> [Mobile App]         |                  |
|              |            |                          |                  |
|              |            +---> [Voicemail]          |                  |
|              |                                       |                  |
|              +---> [SIP Trunk] <---------------------+                  |
|                                                                         |
|  Interactive elements:                                                  |
|  - Select call scenario                                                 |
|  - Watch call flow animate through system                               |
|  - Click components to see "what this does"                             |
|  - Toggle "internet down" to see failover to mobile                     |
|  - Show ring groups, queues, IVR decision points                        |
|  - Compare: traditional PBX vs cloud (side by side)                     |
|                                                                         |
+-------------------------------------------------------------------------+
```

### Demo Value Assessment

These demos address the "explain it again" problem:

| Demo | Why It Matters |
|------|----------------|
| **VPN** | Every remote work discussion. "Why do I need this?" Security without jargon. |
| **Routing** | Demystifies the internet. Helps clients understand latency, CDNs, why location matters. |
| **Cloud Phone** | Key differentiator for eSolia. Shows sophistication vs "just phones." Failover story is compelling. |
| **Bend Radius** | The "aha moment" in every cabling discussion. Why proper installation matters. |

**Cable Bend Radius**

```
+-------------------------------------------------------------------------+
|  BEND RADIUS DEMO CONCEPT                                               |
+-------------------------------------------------------------------------+
|                                                                         |
|  "Why can't we just run the cable around that corner?"                  |
|                                                                         |
|  +---------------------------+  +---------------------------+           |
|  |  PROPER BEND             |  |  TOO TIGHT                |           |
|  |                          |  |                           |           |
|  |      ___                 |  |      /\                   |           |
|  |     /   \    Gentle      |  |     /  \   Sharp          |           |
|  |    |     |   curve       |  |    |    |  kink           |           |
|  |    |     |               |  |    |    |                 |           |
|  |                          |  |                           |           |
|  |  Signal: ████████ 100%   |  |  Signal: ███░░░░░ 40%     |           |
|  |  Speed:  1 Gbps          |  |  Speed:  100 Mbps (maybe) |           |
|  |  Status: ✓ Healthy       |  |  Status: ⚠ Degraded       |           |
|  +---------------------------+  +---------------------------+           |
|                                                                         |
|  Interactive elements:                                                  |
|                                                                         |
|  [Drag handle to bend cable]                                            |
|       |                                                                 |
|       v                                                                 |
|  ════════╗                                                              |
|          ║  <- Drag this corner                                         |
|          ╚════════  Real-time signal meter reacts                       |
|                                                                         |
|  As user tightens bend:                                                 |
|  - Cable color shifts green → yellow → red                              |
|  - Signal strength meter drops                                          |
|  - Speed indicator decreases                                            |
|  - At critical point: "KINK!" warning, signal drops sharply             |
|  - Cross-section view shows fiber/copper deformation                    |
|                                                                         |
|  Presets:                                                               |
|  [ ] Cat6 (min radius: 4x cable diameter)                               |
|  [ ] Cat6a (min radius: 4x cable diameter)                              |
|  [ ] Fiber single-mode (min radius: 30mm)                              |
|  [ ] Fiber multi-mode (min radius: 25mm)                               |
|                                                                         |
|  Cross-section view toggle:                                             |
|  +-------------+  +-------------+                                       |
|  |   Normal    |  |  Kinked     |                                       |
|  |   ○ ○ ○ ○   |  |   ○ ○       |  <- Fiber strands                     |
|  |   ○ ○ ○ ○   |  |    ○ ○○    |     compressed/misaligned              |
|  |   ○ ○ ○ ○   |  |     ○○ ○   |                                       |
|  +-------------+  +-------------+                                       |
|                                                                         |
|  "The rule of thumb" callout:                                           |
|  ┌─────────────────────────────────────────────────────────────┐       |
|  │ Minimum bend radius = 4× the cable diameter (copper)        │       |
|  │ For a 6mm Cat6 cable: minimum 24mm radius curve             │       |
|  │                                                              │       |
|  │ Think of it like a garden hose—kink it, water stops flowing │       |
|  └─────────────────────────────────────────────────────────────┘       |
|                                                                         |
+-------------------------------------------------------------------------+
```

**Structured Cabling Explained** (Multi-section interactive)

```
+-------------------------------------------------------------------------+
|  STRUCTURED CABLING DEMO CONCEPT                                        |
+-------------------------------------------------------------------------+
|                                                                         |
|  "Why can't we just use really long patch cables?"                      |
|                                                                         |
|  Navigation: [Overview] [Impedance] [Installation] [DIY] [Reuse] [Slack]|
|                                                                         |
|  =========================================================================
|  SECTION 1: WHY STRUCTURED CABLING?                                     |
|  =========================================================================
|                                                                         |
|  Toggle view: [ Patch cables everywhere ] vs [ Structured cabling ]     |
|                                                                         |
|  PATCH CABLE CHAOS:                STRUCTURED SYSTEM:                   |
|                                                                         |
|  [PC]---50m cable---[Switch]       [PC]--3m--[Wall Jack]                |
|  [PC]---45m cable---[Switch]              |                             |
|  [PC]---60m cable---[Switch]         [Horizontal: 90m max]              |
|                                           |                             |
|  Problems:                           [Patch Panel]--3m--[Switch]        |
|  - Tangled mess under floor                                             |
|  - Can't trace faults               Benefits:                           |
|  - Can't certify performance        - Every run tested & labeled        |
|  - Replace = re-run everything      - Fault = swap patch cord           |
|  - Fire hazard (cable density)      - Certifiable performance           |
|                                     - Moves/changes = just re-patch     |
|                                                                         |
|  Click any component to learn more                                      |
|                                                                         |
|  =========================================================================
|  SECTION 2: IMPEDANCE MATCHING                                          |
|  =========================================================================
|                                                                         |
|  "Why can't I mix Cat5e, Cat6, and Cat6a?"                             |
|                                                                         |
|  Think of it like water pipes with different diameters:                 |
|                                                                         |
|  ══════════╗                                                            |
|    Cat6a   ║═══════╗                                                    |
|  (100 ohm) ║ Cat5e ║═══════════                                        |
|            ║(100Ω*)║  Cat6a     <- Signal reflects at transitions       |
|            ╚═══════╝                                                    |
|                 ^                                                       |
|                 |                                                       |
|         "Impedance mismatch here"                                       |
|                                                                         |
|  *100 ohm nominal, but tolerances differ:                               |
|  +------------------+------------+------------------+                   |
|  | Category         | Tolerance  | Signal Integrity |                   |
|  +------------------+------------+------------------+                   |
|  | Cat5e            | ±15 ohms   | ████████░░ Good  |                   |
|  | Cat6             | ±10 ohms   | █████████░ Better|                   |
|  | Cat6a            | ±5 ohms    | ██████████ Best  |                   |
|  +------------------+------------+------------------+                   |
|                                                                         |
|  Interactive: Build a cable run mixing categories                       |
|  [Cat5e]--[Cat6]--[Cat6a]--[Cat6]--[Cat5e]                             |
|                                                                         |
|  Signal meter: ███░░░░░░░ 35%  "Multiple reflection points!"           |
|                                                                         |
|  =========================================================================
|  SECTION 3: WHY CAT6A/7 IS HARDER TO INSTALL                           |
|  =========================================================================
|                                                                         |
|  "Higher spec = more demanding installation"                            |
|                                                                         |
|  Cable comparison (drag to feel stiffness):                             |
|                                                                         |
|  Cat5e: ═══════~~~~~~~  Flexible, forgiving                            |
|         5.0mm diameter                                                  |
|         Easy around corners                                             |
|                                                                         |
|  Cat6:  ═══════~~~~     Less flexible                                   |
|         6.0mm diameter                                                  |
|         Mind the bend radius                                            |
|                                                                         |
|  Cat6a: ═══════~~       Stiff, thick                                   |
|         7.5mm diameter                                                  |
|         Requires careful routing                                        |
|                                                                         |
|  Cat7:  ════════        Very stiff                                     |
|         8.0mm diameter                                                  |
|         Individual pair shielding                                       |
|         Professional installation only                                  |
|                                                                         |
|  Consequences:                                                          |
|  - Larger conduit needed        - Tighter bend radius tolerance         |
|  - More pull force required     - Heavier cable trays                   |
|  - Termination more critical    - Higher installation cost              |
|                                                                         |
|  =========================================================================
|  SECTION 4: DIY CABLES - WHEN OK, WHEN NOT                             |
|  =========================================================================
|                                                                         |
|  "Can't I just make my own cables?"                                    |
|                                                                         |
|  First, understand the difference:                                      |
|                                                                         |
|  PATCH CABLES (stranded)         HORIZONTAL RUNS (solid)                |
|  +------------------------+      +------------------------+             |
|  |  ~~~~~ ~~~~~ ~~~~~    |      |  _____ _____ _____     |             |
|  |  Flexible strands     |      |  Rigid solid core      |             |
|  |  Bends easily         |      |  Holds shape           |             |
|  |  For: desk to wall    |      |  For: in-wall/ceiling  |             |
|  +------------------------+      +------------------------+             |
|                                                                         |
|  DIY Reality Check:                                                     |
|  +------------------+--------+--------+----------+                      |
|  | Category         | Tools  | Skill  | Our Take |                      |
|  +------------------+--------+--------+----------+                      |
|  | Cat5e            | Cheap  | Easy   | OK       |                      |
|  | Cat6             | $$$    | Hard   | Risky    |                      |
|  | Cat6a            | $$$$   | Expert | Don't    |                      |
|  +------------------+--------+--------+----------+                      |
|                                                                         |
|  The problem: tolerance for error shrinks dramatically                  |
|                                                                         |
|  Cat5e: Untwist up to 13mm from termination — forgiving                |
|         Basic crimper from Amazon works fine                            |
|                                                                         |
|  Cat6:  Untwist max 13mm, but pair geometry now critical               |
|         Cheap crimper = out of spec, intermittent faults               |
|         Even pros fail certification sometimes                          |
|                                                                         |
|  Cat6a: Untwist max 6mm (!), shielding alignment critical              |
|         Specialized tools cost more than hiring a pro                   |
|         This is why cabling is a trade skill                            |
|                                                                         |
|  Our recommendation:                                                    |
|  +-----------------------------------------------------------------+   |
|  | For anything new: buy factory-tested patch cables               |   |
|  |                                                                 |   |
|  | The cost difference vs. your time + risk of intermittent        |   |
|  | "it works sometimes" faults = not worth it                      |   |
|  |                                                                 |   |
|  | DIY Cat5e for your home lab? Sure, go for it.                   |   |
|  | DIY Cat6/6a for production office? Please don't.                |   |
|  +-----------------------------------------------------------------+   |
|                                                                         |
|  =========================================================================
|  SECTION 5: CAN WE REUSE OLD CABLE?                                    |
|  =========================================================================
|                                                                         |
|  "We have cable in our old office, can't you just move it?"            |
|                                                                         |
|  The short answer: Horizontal cable runs? No.                           |
|                                                                         |
|  THE REAL REASON:                                                       |
|  +-----------------------------------------------------------------+   |
|  | Cablers won't certify reused cable, and won't warranty it.      |   |
|  |                                                                 |   |
|  | No certification = no guarantee it meets spec                   |   |
|  | No warranty = you own all future problems                       |   |
|  |                                                                 |   |
|  | "It worked at the old office" is not a test result.             |   |
|  +-----------------------------------------------------------------+   |
|                                                                         |
|  DAMAGE: VISIBLE AND INVISIBLE                                          |
|                                                                         |
|  Visible:                          Invisible:                           |
|  - Jacket cuts, kinks              - Internal pair damage               |
|  - Crushed sections                - Stretched conductors               |
|  - UV degradation                  - Insulation breakdown               |
|  - Rodent damage                   - Impedance changes                  |
|                                                                         |
|  You can see the kink. You can't see the micro-fractures               |
|  in the copper from when someone stood on the cable tray.              |
|                                                                         |
|  WHAT *CAN* BE REUSED:                                                  |
|                                                                         |
|  +---------------------+-------------------------------------------+    |
|  | Item                | Reusable? | Notes                         |    |
|  +---------------------+-----------+-------------------------------+    |
|  | Horizontal cable    | No        | Certification/warranty issue  |    |
|  | Patch cords         | Maybe     | If new-ish and undamaged      |    |
|  | Modular jack boxes  | Maybe     | Need to pry open, labor cost  |    |
|  | Ring runs           | Yes       | Rack cable management         |    |
|  | PDUs                | Yes       | Power distribution, easy move |    |
|  | Patch panels        | Maybe     | If same port count needed     |    |
|  | Racks               | It depends| See below                     |    |
|  +---------------------+-----------+-------------------------------+    |
|                                                                         |
|  THE RACK PROBLEM:                                                      |
|                                                                         |
|  Racks are in use until the day of the move.                           |
|  A 150kg loaded rack can't be "pre-moved."                             |
|                                                                         |
|  Timeline reality:                                                      |
|  Day -1:  Old office still running, rack full of equipment             |
|  Day 0:   Move day - tear down, transport, rebuild                     |
|  Day +1:  New office needs working infrastructure                      |
|                                                                         |
|  Trying to install a heavy rack while people are moving in,            |
|  furniture arriving, internet being connected = chaos.                  |
|                                                                         |
|  Often better to: Buy new rack, install in advance, move equipment     |
|                                                                         |
|  COST COMPARISON (interactive calculator):                              |
|                                                                         |
|  Reuse attempt:                    New installation:                    |
|  +---------------------------+     +---------------------------+        |
|  | Careful extraction  ¥¥¥  |     | New cable           ¥¥¥  |        |
|  | Transport          ¥¥    |     | Professional install ¥¥¥ |        |
|  | Inspection         ¥     |     | Certification       incl |        |
|  | Re-termination     ¥¥    |     | Warranty            incl |        |
|  | No certification   ---   |     | Peace of mind       incl |        |
|  | No warranty        ---   |     |                          |        |
|  | Future problems    ???   |     |                          |        |
|  +---------------------------+     +---------------------------+        |
|  | Total: Often comparable or MORE than new!                  |        |
|  +------------------------------------------------------------+        |
|                                                                         |
|  =========================================================================
|  SECTION 6: SERVICE LOOPS (SLACK)                                      |
|  =========================================================================
|                                                                         |
|  "Why leave extra cable coiled up?"                                    |
|                                                                         |
|  Scenario simulator:                                                    |
|                                                                         |
|  WITHOUT SERVICE LOOP:              WITH SERVICE LOOP:                  |
|                                                                         |
|  [Patch Panel]════════[Jack]       [Patch Panel]══╗   ╔══[Jack]        |
|                                                    ╚═══╝                |
|  3 years later, need to move                    (coil in ceiling)       |
|  jack 2 meters...                                                       |
|                                    3 years later, need to move          |
|  Options:                          jack 2 meters...                     |
|  1. Run entirely new cable ¥¥¥¥                                        |
|  2. Splice (not to code) ✗        Just uncoil and re-terminate ¥       |
|  3. Leave it, run surface duct                                         |
|                                                                         |
|  Real scenarios where slack saves the day:                              |
|  - Furniture layout changes                                             |
|  - Wall jack damaged, need to re-terminate                             |
|  - Patch panel moved to new rack                                        |
|  - Floor/ceiling access point changes                                   |
|  - Test equipment needs extra length                                    |
|                                                                         |
|  Rule of thumb:                                                         |
|  ┌─────────────────────────────────────────────────────────────┐       |
|  │ Leave 3-5m service loop at each end                         │       |
|  │ Coil diameter: minimum 10× cable diameter (avoid kinks!)    │       |
|  │ Future you will thank present you                           │       |
|  └─────────────────────────────────────────────────────────────┘       |
|                                                                         |
+-------------------------------------------------------------------------+
```

This multi-section demo could be:
- **One big interactive** with tabbed navigation (for deep dives)
- **Six mini-demos** linked together (for embedding individually)
- **Both** — unified experience + standalone sections

Perfect for:
- Pre-project client education ("watch this before our planning meeting")
- Post-project omiyage ("here's why we did what we did")
- Sales support ("this is why proper cabling costs what it costs")
- Training for junior staff
- **Tactile** — Dragging to bend makes it physical, not abstract
- **Immediate feedback** — Signal meter responds in real-time
- **The "oh!" moment** — Watching speed drop from 1Gbps to 100Mbps is visceral
- **Memorable analogy** — Garden hose reference sticks
- **Practical** — Different cable type presets for real-world application

Perfect for:
- Office move planning ("this is why we need proper cable management")
- Post-incident explanation ("this is what we found behind the cabinet")
- Omiyage after cabling project ("here's why we did it this way")

All four featured demos are:
- **Evergreen** — Concepts don't change often
- **Reusable** — Work in blog posts, proposals, omiyage, training
- **Shareable** — Client can forward to their boss who asks "why are we paying for this?"

---

## SharePoint Integration

### Why SharePoint?

1. **M365 Intelligence** — Content automatically indexed by Microsoft Search, accessible via Copilot
2. **Internal Knowledge Base** — Staff can ask Copilot "find our SPF guide" and get results
3. **Version History** — Same filename = automatic versioning
4. **Client-Ready Library** — Curated docs staff can share *from* eSolia's SharePoint (not to client tenants)

Note: All SharePoint content lives in eSolia's tenant. For client delivery, staff share links or export PDFs—we don't push directly to client SharePoint tenants.

### Implementation Options

**Option 1: On-demand export**
Staff clicks "Export to SharePoint" in CMS, gets PDF uploaded to a designated library.

**Option 2: Auto-publish**
Certain collections (e.g., internal procedures, client-ready docs) automatically sync to SharePoint on publish.

**Option 3: Hybrid**
- Internal procedures → auto-sync
- Client docs → manual export (choose destination)
- Blog posts → AI Search only (no SharePoint)

### Technical Implementation

```javascript
// Graph API upload - same filename creates new version
async function publishToSharePoint(document, siteId, libraryPath) {
  const pdfBuffer = await convertToPdf(document);
  const filename = `${document.slug}.pdf`;
  
  await graph.api(
    `/sites/${siteId}/drive/root:/${libraryPath}/${filename}:/content`
  ).put(pdfBuffer);
  
  // Log for audit trail
  await logPublish('sharepoint', {
    documentId: document.id,
    siteId,
    path: `${libraryPath}/${filename}`,
    version: 'auto-incremented'
  });
}
```

### PDF Conversion Pipeline

| Source | Conversion Method |
|--------|-------------------|
| Markdown content | md → HTML → PDF (puppeteer or weasyprint) |
| Mermaid diagrams | mermaid-cli → SVG → embedded in PDF |
| draw.io | Export as PDF from source |
| SVG illustrations | Direct embed in PDF |

### SharePoint Folder Structure

```
SharePoint Site (eSolia Knowledge)
├── Internal/
│   ├── Procedures/           ← Auto-sync from CMS
│   ├── Technical Reference/  ← Auto-sync from Git
│   └── Training Materials/
├── Client-Ready/
│   ├── Email Security/       ← Manual export
│   ├── Infrastructure/
│   └── Cloud Services/
└── Templates/
    └── Omiyage Exports/      ← Generated packages
```

---

## Content Consumption Matrix (Updated)

| Consumer | What It Needs | Source |
|----------|---------------|--------|
| Periodic /docs | Published docs | CMS API or R2 direct |
| Periodic "Ask Miko" | Answers from KB | RAG (indexes R2) |
| Blog site pages | Published posts | CMS API (D1) or R2 |
| Blog "Ask Miko" | Contextual Q&A | RAG (indexes R2) |
| Help site browse | Published help | CMS API or R2 |
| Help site search | Semantic search | RAG (indexes R2) |
| Omiyage builder | Published content | CMS API (for metadata) |
| Editorial review | Draft posts | CMS preview tokens |
| Client doc review | Confidential drafts | CMS preview tokens |
| **Internal staff** | **Quick reference** | **SharePoint + Copilot** |
| **Client M365 users** | **Shared knowledge** | **SharePoint (their tenant)** |

---

## Authoring Architecture

### Two Paths, One Destination (Now Two Destinations)

```
+-------------------------------------------------------------------------+
|  AUTHORING PATHS                                                        |
+-------------------------------------------------------------------------+
|                                                                         |
|  CMS AUTHORS (Non-Technical Staff)     GIT AUTHORS (Claude Code)        |
|  --------------------------------      -------------------------        |
|                                                                         |
|  Requirements:                         Requirements:                    |
|  * Cloudflare Access login             * GitHub account                 |
|  * No Git knowledge needed             * Git/CLI familiarity            |
|                                                                         |
|  Best for:                             Best for:                        |
|  * Blog posts                          * Bilingual content drafting     |
|  * Quick updates                       * Bulk content generation        |
|  * Client-facing documents             * Complex technical docs         |
|  * Content needing approval            * Version-controlled authoring   |
|  * Sensitive pre-release content       * Cost-effective AI assistance   |
|                                                                         |
|  Flow:                                 Flow:                            |
|  1. Edit in CMS forms                  1. Draft with Claude Code        |
|  2. Preview with security controls     2. Create EN + JA versions       |
|  3. Approval if confidential           3. Commit and push               |
|  4. Publish -> writes to R2            4. CI syncs to R2                |
|  5. Optional: Export to SharePoint     5. Optional: CI syncs to SP      |
|                                                                         |
|  Both paths write to R2, which feeds both AI Search and SharePoint      |
|                                                                         |
+-------------------------------------------------------------------------+
```

---

## Cloudflare Services Used (Updated)

| Service | Purpose | Pricing |
|---------|---------|---------|
| **D1** | CMS database, metadata, audit logs | Free tier generous |
| **R2** | Media files, illustration sources, **PDF exports** | Free up to 10GB |
| **AI Search** | RAG retrieval + optional generation | Free to enable (beta) |
| **Workers AI** | Embedding + LLM inference | 10k Neurons/day free |
| **Vectorize** | Vector embeddings | Free up to 5M vectors |
| **Workers** | API endpoints, Git sync, **SharePoint sync** | Free tier generous |
| **Pages** | SvelteKit frontend | Free |
| **Access** | CMS authentication | Included |

---

## Implementation Phases (Updated)

### Phase 1: R2 + AI Search Foundation (2-3 weeks)
*No changes*

### Phase 1.5: Branding & Style Infrastructure (1-2 weeks) — NEW

**Goal:** Establish centralized branding and visual consistency framework

**Scope:**
- Create `config/branding.yaml` with all brand assets
- Set up IBM Plex Sans JP / Mono font hosting
- Create PDF template with header/footer branding
- Define Mermaid theme configuration
- Create HTML template with meta tags for AI citation
- Document provenance metadata schema
- Create style guide page on Codex portal

**Success Metrics:**
- All templates reference central branding config
- Font and color consistency verified across outputs
- AI citation metadata validates correctly
- Sample PDF passes branding checklist

### Phase 2: CMS Foundation (5-6 weeks)
- *Includes*: Automatic provenance embedding on save
- *Includes*: Branding config integration in templates

### Phase 3: Omiyage MVP (4-5 weeks)
*No changes*

### Phase 3.5: SharePoint Integration (2-3 weeks) — NEW

**Goal:** Enable M365 distribution channel

**Scope:**
- PDF conversion pipeline (markdown → PDF)
- Graph API integration for uploads
- Manual "Export to SharePoint" in CMS
- Configure SharePoint folder structure
- Test with internal procedures

**Success Metrics:**
- PDF conversion quality acceptable
- Staff can export to SharePoint in <3 clicks
- Copilot returns relevant results for exported content

### Phase 4: Claude Code Content Pipeline (2-3 weeks)
*No changes*

### Phase 5: "Ask Miko" Widget (4-5 weeks)
*No changes*

### Phase 6: App Integration (Ongoing)
*No changes*

### Phase 6.5: Interactive Demos Foundation (3-4 weeks) — NEW

**Goal:** Establish demo infrastructure and build first high-value demos

**Scope:**
- Create DemoWrapper component (standard branding chrome)
- Set up demos.esolia.pro subdomain
- Build embed.js for web component distribution
- Create demo.config.yaml schema
- Build 2-3 initial demos (SPF Builder, Password Analyzer, one more)
- Integrate demo catalog into CMS for discovery

**Success Metrics:**
- Demos render correctly embedded and standalone
- Share URLs work and track analytics
- Staff can find and embed demos without developer help
- At least one demo included in an omiyage package

### Phase 7: Auto-Sync to SharePoint (Optional, 1-2 weeks)

**Goal:** Automated publishing for select collections

**Scope:**
- CI workflow for Git → R2 → SharePoint
- CMS workflow for publish → R2 + SharePoint
- Collection-level configuration (which go where)

---

## Appendix: Quick Reference

### Platform Components (Updated)

| Component | Purpose | URL/Location |
|-----------|---------|--------------|
| **Codex CMS** | Content authoring, preview, publish | `cms.esolia.pro` (via CF Access) |
| **Codex Git Repo** | Claude Code authoring, version history | `github.com/esolia/codex` |
| **R2 Bucket** | Published content storage, AI Search source | `codex-content` |
| **AI Search** | RAG retrieval, powers Miko | Cloudflare dashboard |
| **SharePoint** | M365 distribution, Copilot access | `esolia.sharepoint.com` |
| **Demos** | Interactive tools, embeddable experiences | `demos.esolia.pro` |
| **Nexus** | Omiyage delivery, client-facing share links | `nexus.esolia.pro` |

### Key API Endpoints (Updated)

```
# CMS Content
GET    /api/cms/documents
POST   /api/cms/documents
GET    /api/cms/documents/:id/preview
POST   /api/cms/documents/:id/publish
POST   /api/cms/documents/:id/export-sharepoint  # NEW

# Illustrations  
GET    /api/cms/illustrations
POST   /api/cms/illustrations
POST   /api/cms/illustrations/generate
GET    /api/cms/illustrations/:id/share

# RAG / Miko
POST   /api/miko/ask
GET    /api/miko/search

# Omiyage
GET    /api/packages
POST   /api/packages/:id/share

# Branding (internal)
GET    /api/config/branding       # Returns current branding config
```

### Branding Assets Reference

| Asset | Location | Format |
|-------|----------|--------|
| **Primary logo** | `/assets/esolia-logo-primary.svg` | SVG (scalable) |
| **Monochrome logo** | `/assets/esolia-logo-mono.svg` | SVG |
| **Icon/favicon** | `/assets/esolia-icon.svg` | SVG, 32x32 PNG |
| **PDF template** | `/templates/pdf/base.html` | HTML (WeasyPrint) |
| **Mermaid theme** | `/config/mermaid-theme.json` | JSON |
| **Font files** | `/assets/fonts/ibm-plex-*` | WOFF2 |
| **Color tokens** | `/config/colors.css` | CSS custom properties |
| **Branding config** | `/config/branding.yaml` | YAML |

### Provenance Metadata Schema

```yaml
# Required fields for all Codex artifacts
provenance:
  source: string          # Always "esolia-codex"
  document_id: string     # Unique slug
  version: string         # Semantic version
  canonical_url: string   # Authoritative URL
  created: date           # ISO 8601
  modified: date          # ISO 8601
  author: string          # Creator or team
  language: string        # "en" or "ja"
  
# Optional fields
  license: string         # Default: "Proprietary - eSolia Inc."
  citation_instruction: string
  related_documents: array
```

---

## Honest Assessment (Updated)

### Strengths

**Two distribution channels serve different audiences** — AI Search for external/public, SharePoint for internal/M365. Staff can ask Copilot. Clients with M365 get content in their familiar environment.

**Consistent brand identity across all outputs** — Every PDF, omiyage, Miko response carries eSolia branding. Clients receive professional, recognizable materials regardless of delivery channel.

**Traceable provenance** — Every artifact carries its origins. When a client asks "where did this come from?", the answer is embedded in the document itself.

**Future-proofed for AI** — With citation instructions embedded, AI systems that index eSolia content will know to attribute it properly. Early investment in metadata pays dividends as AI assistants become more prevalent.

**Bulk update capability** — When eSolia rebrands, updates contact info, or changes website URLs, a single config change propagates everywhere.

### Challenges

**PDF conversion quality** — Markdown to PDF conversion needs to look professional. May need investment in templates and styling. Diagrams (especially Mermaid) need careful handling. IBM Plex fonts must render correctly.

**Style consistency requires tooling, not discipline** — Expecting authors to internalize Google/Diataxis style is unrealistic. Need automated linting (markdownlint, Vale, custom rules) with immediate feedback in the CMS editor and CI checks on Git commits. "Red squiggles" are more effective than style guides.

**Metadata maintenance** — Provenance metadata is only valuable if kept accurate. Stale version numbers or broken canonical URLs undermine trust. Automate where possible (auto-increment version on publish, validate canonical URLs in CI).

**Font licensing/hosting** — IBM Plex is open source (good), but needs reliable hosting for PDFs and web. May need self-hosting or CDN setup.

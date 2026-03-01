# Rich Text Editor, Multi-Tenant CMS & Proposal Builder Research

> eSolia INTERNAL — Not for distribution outside eSolia

**Purpose**: Compare rich text editor frameworks for SvelteKit, outline multi-tenant CMS architecture options, and design an AI-assisted proposal builder pipeline.

**Date**: 2026-02-26
**Status**: Research / Planning
**Related**: [CMS Evaluation for Blog Migration](eSolia-SvelteKit-CMS-Evaluation-INTERNAL-20260226-en.md)

---

## Rich Text Editor Comparison

For any CMS solution — whether adopting Keystatic/Sveltia or building a custom multi-tenant CMS — the editor is the core UX. Two frameworks dominate the modern landscape.

### Tiptap vs Lexical

Think of it as choosing between a well-furnished apartment (Tiptap) and an empty loft with great bones (Lexical). The apartment lets you move in immediately; the loft rewards patience with total customization.

| Dimension | Tiptap | Lexical |
|---|---|---|
| **Foundation** | Built on ProseMirror (battle-tested by NYT, Asana) | Meta's from-scratch engine (successor to Draft.js) |
| **Svelte support** | Official integration. First-class. | Community `svelte-lexical` package. Not official. |
| **Bundle size** | Heavier (ProseMirror + Tiptap layers) | ~22KB core (lighter, but plugins add up) |
| **DX analogy** | "Plug socket — just connect" | "Buy wires, make your own — lighter once done" |
| **Maturity** | Stable, mature ecosystem | Pre-1.0. Liveblocks found it needs more time to mature. |
| **Markdown** | Official `@tiptap/markdown` extension (v3.7.0+). Bidirectional, CommonMark-compliant. | No equivalent first-party solution. |
| **Collaboration** | Yjs integration, Tiptap Collab service | Possible but more manual |
| **Best for** | Vue/Svelte projects, standard editors, faster shipping | React-first projects, highly custom editors, Meta-scale performance |

**Recommendation**: Tiptap is the pragmatic choice for SvelteKit. Existing Svelte 5 bridge experience, official framework support, and the new first-party markdown extension make it the lower-risk path.

### Tiptap Markdown Extension (@tiptap/markdown)

Released in Tiptap 3.7.0 as an official open-source extension. Supersedes the community `tiptap-markdown` package.

Key capabilities:

- **Bidirectional**: parse markdown → Tiptap JSON → WYSIWYG editing → serialize back to markdown
- **CommonMark-compliant** via MarkedJS tokenizer, with GFM support (tables, task lists) via config flag
- **Per-extension parse/render handlers**: each Tiptap extension defines how it maps to/from markdown
- **Custom tokenizers**: teach the editor non-standard syntax (admonitions, shortcodes, embeds) without data loss
- **HTML-in-markdown**: parsed via Tiptap's existing `parseHTML` rules
- **Round-trip fidelity**: standard blog content survives parse → edit → serialize cleanly

Caveats:

- Markdown formatting gets normalized on save (e.g., `__bold__` → `**bold**`, whitespace standardized). Creates diff noise if developers also hand-edit the same files.
- Not a raw `.md` editor — markdown is the storage format, but editing happens in WYSIWYG with an intermediate JSON representation.
- Multiple representations of the same construct converge to one canonical form.

For a CMS workflow where the CMS owns the output format, normalization is a feature, not a bug.

**Usage pattern**:

```typescript
import { Markdown } from '@tiptap/markdown'

const editor = new Editor({
  extensions: [StarterKit, Markdown],
  content: markdownFromGit,
  contentType: 'markdown',
})

// Save: const markdown = editor.getMarkdown()
```

Markdown is the storage format. Editing is WYSIWYG. The lifecycle is: parse → edit → serialize.

---

## Multi-Tenant CMS Architecture

### The Opportunity

Rather than running separate CMS instances per client, build a single SvelteKit application that serves as a multi-tenant, git-backed CMS for eSolia's client sites.

### Architecture Options

#### Option A: Routing Layer + Multiple Keystatic Containers

A Worker routes authenticated requests to per-client containers, each running stock Keystatic.

- **Pros**: No custom code beyond routing. Stock Keystatic per client.
- **Cons**: One container per client. Cost scales linearly.

#### Option B: Keystatic Cloud Per Client

Each client gets their own Keystatic Cloud project. Free ≤3 users.

- **Pros**: Zero infrastructure maintenance.
- **Cons**: SaaS dependency. Less control over customization.

#### Option C: Custom Multi-Tenant CMS (SvelteKit + Tiptap)

A purpose-built SvelteKit app with tenant-aware routing, Tiptap editors, and GitHub API integration.

```
cms.esolia.com (single CF Container)
├── /login            → eSolia auth
├── /[tenant]/        → dashboard
├── /[tenant]/posts   → content list (GitHub API)
└── /[tenant]/posts/[slug]/edit → Tiptap editor
```

Tenant config stored in D1/R2. One container serves all tenants.

- **Pros**: Full control, bilingual UI, sellable differentiator, one container for all tenants.
- **Cons**: A product to build (months of effort), editor edge cases, ongoing maintenance.

#### Option D: Sveltia with Dynamic Config

SvelteKit app authenticates, generates Sveltia `config.yml`, serves the client-side Sveltia bundle per tenant.

- **Pros**: One container. No Sveltia fork. Sveltia handles the editor.
- **Cons**: Loses Keystatic UX. Depends on Sveltia's roadmap (branch workflow still pending).

### Recommendation

Small number of clients → Option A (per-container Keystatic). At scale → evaluate Option C or D based on client volume and willingness to invest in a custom product.

---

## Proposal Builder Architecture

### Vision

An interactive authoring tool: multiple markdown sections → independent Tiptap editors → assemble → Typst PDF. Think of it as a "document kitchen" — pre-prepped ingredients (boilerplate), fresh items (custom sections), and a recipe (template) that tells the system how to plate the final dish.

### Workflow

```
1. Define proposal type (template config)
2. Claude Code generates section drafts (client-tailored)
3. Author opens builder UI
4. Multiple Tiptap editors (one per section)
5. Author refines, reorders, adds sections
6. Generate → assemble markdown → Typst → compile
7. Branded PDF in seconds
```

### Content Library Structure

```
content-library/
├── boilerplate/              (shared, rarely edited)
│   ├── company-overview.md
│   ├── team-bios.md
│   └── certifications.md
├── per-client/               (custom per engagement)
│   └── acme-corp/
│       ├── exec-summary.md   (Claude-drafted)
│       ├── services.md
│       └── pricing.md
└── templates/
    ├── capability-statement.typ
    └── proposal.typ
```

### Template Configuration

```yaml
name: Capability Statement
sections:
  - key: executive_summary
    label: Executive Summary
    source: sections/exec-summary.md
    required: true
  - key: services
    source: sections/services-{{focus}}.md
    required: true
  - key: company_overview
    source: boilerplate/company-overview.md
    required: true
    editable: false
  - key: certifications
    source: boilerplate/certifications.md
    required: false
```

### UI Design

Each section renders as an independent Tiptap editor instance. Boilerplate sections appear collapsed and read-only by default (expandable for review). Custom sections are full editors. A sidebar provides section reordering, metadata fields, and the generate button.

```svelte
{#each sections as section}
  <SectionEditor
    label={section.label}
    content={section.markdown}
    editable={section.editable !== false}
    onUpdate={(md) => section.markdown = md}
  />
{/each}

<button onclick={assembleAndGenerate}>Generate PDF</button>
```

### Markdown → Typst Pipeline

Assembly uses a lightweight AST transformation rather than markdown → HTML → Typst. MarkedJS parses the markdown AST; a custom walker emits Typst source. This is simpler and cleaner than going through HTML.

The pipeline connects directly to the existing Typst container infrastructure already built for capability statement generation.

### AI Integration

Claude Code generates first drafts from the project database and bilingual content. Authors refine in the Tiptap editors. The combination reduces proposal creation time from roughly half a day to approximately 20 minutes.

---

## Recommended Implementation Path

### Phase 1: Blog Migration

1. Start with Keystatic Cloud (free tier) connected to the blog repo
2. Migrate content to SvelteKit with mdsvex or markdoc for rendering
3. Deploy the blog on Cloudflare Pages; CMS admin via Keystatic Cloud
4. Branch-based editing with Cloudflare Pages branch preview deploys

### Phase 2: Multi-Tenant CMS (if demand warrants)

1. Evaluate client demand for managed content editing
2. Small number of clients → Option A (per-container Keystatic)
3. Growing demand → prototype Option C with one pilot client
4. Start with a single collection, one tenant, one real author

### Phase 3: Proposal Builder

1. Build section library in git (boilerplate + per-client)
2. Prototype multi-editor UI with Tiptap + `@tiptap/markdown`
3. Wire assembly output to existing Typst container pipeline
4. Integrate Claude Code for section draft generation
5. Pilot with capability statement workflow

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Rich text editor | Tiptap over Lexical | Official Svelte support, first-party markdown extension, mature ecosystem |
| Blog CMS | Keystatic (Cloud or VPS-hosted) | Best SvelteKit integration, branch workflows, Prosemirror editor |
| CMS admin hosting | Keystatic Cloud initially, CF Container later | Lowest friction start, clean migration path |
| Multi-tenant CMS | Deferred | Pending client volume assessment |
| Proposal builder | Validated as feasible | Extends existing Typst container work, clear ROI |

---

## References

- Tiptap: https://tiptap.dev/
- Tiptap Markdown: https://tiptap.dev/docs/editor/markdown
- Lexical: https://lexical.dev/
- svelte-lexical: https://github.com/umaranis/svelte-lexical
- Cloudflare Containers: https://developers.cloudflare.com/containers/
- Typst: https://typst.app/

---

## Contact
**eSolia Inc.**
Shiodome City Center 5F (Work Styling)
1-5-2 Higashi-Shimbashi, Minato-ku, Tokyo, Japan 105-7105
**Tel (Main):** +813-4577-3380
**Web:** https://esolia.co.jp/en
**Preparer:** rick.cogley@esolia.co.jp

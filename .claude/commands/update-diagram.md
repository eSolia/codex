---
allowed-tools: Bash(npx wrangler d1 execute:*), Bash(npx tsx scripts/export-diagram-yaml.ts:*), Read
description: Update a Hanawa Mermaid diagram fragment
---

## Hanawa Diagram Update Workflow

This command updates Mermaid diagram fragments in the Hanawa CMS.

### Reference Docs

- Workflow doc: `packages/hanawa-cms/docs/diagram-workflow.md`
- Compact reference: `docs/shared/guides/mermaid-compact-reference.md`

### Database Info

- Database: `hanawa-db`
- Table: `fragments`
- Columns: `content_en`, `content_ja` (HTML with `data-source` attribute containing Mermaid)

### Update Process

1. **Get current content** (if needed):
```bash
npx wrangler d1 execute hanawa-db --remote --command "SELECT content_en, content_ja FROM fragments WHERE id = '{fragment-id}'"
```

2. **Update D1** with new Mermaid content:
```bash
npx wrangler d1 execute hanawa-db --remote --command "UPDATE fragments SET
  content_en = '<div data-type=\"mermaidBlock\" data-source=\"{MERMAID_EN_ESCAPED}\" data-svg-path=\"diagrams/{id}-en.svg\" class=\"mermaid-block\">...</div>',
  content_ja = '<div data-type=\"mermaidBlock\" data-source=\"{MERMAID_JA_ESCAPED}\" data-svg-path=\"diagrams/{id}-ja.svg\" class=\"mermaid-block\">...</div>',
  updated_at = datetime('now')
WHERE id = '{fragment-id}'"
```

3. **User clicks Export** in Hanawa UI to regenerate SVGs

4. **Backup to YAML**:
```bash
npx tsx scripts/export-diagram-yaml.ts {fragment-id}
```

### HTML Escaping Rules

In SQL/data-source attribute:
- `'` → `''` (SQL)
- `"` → `&quot;`
- `<` → `&lt;`
- `>` → `&gt;`
- `&` → `&amp;`

### Mermaid Best Practices

**Compact config:**
```
%%{init: {'flowchart': {'nodeSpacing': 20, 'rankSpacing': 30, 'padding': 4}}}%%
```

**Avoid subgraph title overlap:**
- For single-node subgraphs: combine title into node text
- For multi-node subgraphs: use short titles, low padding

**Horizontal layout in subgraphs:**
- Connect nodes with `---`: `P1 --- P2 --- P3`
- Use `P2 ~~~ P4` for invisible vertical alignment

### Your Task

User will specify:
1. Fragment ID (e.g., `password-vault-master-password`)
2. Requested changes (text, layout, etc.)

Steps:
1. Read current content if needed
2. Generate updated Mermaid for EN and JA
3. Update D1 with proper escaping
4. Remind user to click Export in UI
5. Run backup script

# Hanawa Editor

Rich text editor for Hanawa CMS, built on Tiptap/ProseMirror.

Named after **Hanawa Hokiichi** (塙保己一, 1746–1821), the blind Japanese scholar who spent 41 years compiling the Gunsho Ruijū — a 670-volume collection of 1,273 classical texts.

## Features

- **Callout blocks** — Info, warning, danger, success alerts
- **Status badges** — Inline compliance status markers
- **Evidence links** — Links to R2-stored documents
- **Privacy masks** — Redactable content for external sharing
- **Table of contents** — Auto-generated navigation
- **Slash commands** — Type `/` for quick block insertion
- **Markdown sync** — Bidirectional markdown conversion

## Installation

```bash
npm install
```

## Usage

```svelte
<script>
  import HanawaEditor from './HanawaEditor.svelte';
  import './styles.css';

  let content = '';
  let privacyMode = false;
</script>

<HanawaEditor
  bind:content
  format="markdown"
  {privacyMode}
  on:change={(e) => console.log(e.detail.markdown)}
/>
```

## Markdown Syntax

```markdown
:::info{title="Note"}
Callout content
:::

{status:compliant id="SOC2-CC6.1"}

[Audit Report]{evidence id="ev_123" type="pdf"}

{mask type="pii"}Sensitive data{/mask}

[[toc]]
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+B` | Bold |
| `Ctrl+I` | Italic |
| `Ctrl+U` | Underline |
| `Ctrl+Shift+C` | Toggle callout |
| `Ctrl+Shift+P` | Toggle privacy mask |
| `Ctrl+Shift+S` | Cycle status badge |
| `/` | Slash command menu |

## License

MIT

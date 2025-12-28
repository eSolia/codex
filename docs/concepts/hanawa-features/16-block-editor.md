# Hanawa: Block Editor Architecture

Multi-block content editing with slash commands, Mermaid diagrams, and fragment references.

## Overview

Transform Hanawa from a rich-text editor into a true block-based editor like Notion, enabling mixed content types in a single document.

```
┌─────────────────────────────────────────────────────────────────┐
│  BLOCK EDITOR ARCHITECTURE                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  BLOCK TYPES                          INTERACTIONS              │
│  ───────────                          ────────────              │
│  • Paragraph (text)                   • Slash commands (/)      │
│  • Heading (h1-h3)                    • Drag to reorder        │
│  • Mermaid diagram                    • Block menu (⋮)         │
│  • Code block                         • Convert block type     │
│  • Image                              • Duplicate/delete       │
│  • Table                              • Copy as markdown       │
│  • Blockquote                                                   │
│  • Callout (info/warning/danger)                               │
│  • Fragment reference                                           │
│  • Horizontal rule                                              │
│                                                                  │
│  STORAGE                              RENDERING                 │
│  ───────                              ─────────                 │
│  JSON block array                     View: Rendered output     │
│  Each block: type + data              Edit: Block-specific UI   │
│  Bilingual: EN/JA per block           PDF: HTML → pdf-worker    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Data Model

### Block Schema

```typescript
// Block types
type BlockType =
  | 'paragraph'
  | 'heading'
  | 'mermaid'
  | 'code'
  | 'image'
  | 'table'
  | 'blockquote'
  | 'callout'
  | 'fragment'
  | 'hr';

// Base block structure
interface Block {
  id: string;           // Unique within document
  type: BlockType;
  data: BlockData;      // Type-specific data
  meta?: {
    collapsed?: boolean;
    language?: 'en' | 'ja' | 'both';
  };
}

// Type-specific data
interface ParagraphData {
  content: string;      // HTML from Tiptap
  content_ja?: string;  // Japanese version (if bilingual)
}

interface HeadingData {
  level: 1 | 2 | 3;
  content: string;
  content_ja?: string;
}

interface MermaidData {
  source: string;       // Mermaid code
  caption?: string;     // EN caption
  caption_ja?: string;  // JA caption
}

interface CodeData {
  language: string;
  code: string;
}

interface ImageData {
  assetId: string;      // Reference to media_assets
  alt: string;
  alt_ja?: string;
  caption?: string;
  caption_ja?: string;
}

interface CalloutData {
  type: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
  title_ja?: string;
  content: string;
  content_ja?: string;
}

interface FragmentData {
  fragmentId: string;   // Reference to fragments table
  overrides?: {         // Optional field overrides
    [key: string]: string;
  };
}

// Full document structure
interface BlockDocument {
  version: 1;
  blocks: Block[];
  locale: 'en' | 'ja' | 'both';
}
```

### Database Changes

```sql
-- Update fragments table to store block content
ALTER TABLE fragments ADD COLUMN block_content TEXT;  -- JSON BlockDocument
ALTER TABLE fragments ADD COLUMN content_format TEXT DEFAULT 'html';
-- content_format: 'html' (legacy) | 'blocks' (new)

-- Update content table similarly
ALTER TABLE content ADD COLUMN block_content TEXT;
ALTER TABLE content ADD COLUMN content_format TEXT DEFAULT 'html';
```

### Migration Strategy

Existing HTML content migrates to single-block documents:

```typescript
function migrateHtmlToBlocks(html: string, html_ja?: string): BlockDocument {
  return {
    version: 1,
    locale: html_ja ? 'both' : 'en',
    blocks: [{
      id: crypto.randomUUID(),
      type: 'paragraph',
      data: {
        content: html,
        content_ja: html_ja,
      }
    }]
  };
}
```

## Tiptap Extensions

### MermaidBlock Extension

```typescript
// lib/editor/extensions/mermaid-block.ts
import { Node, mergeAttributes } from '@tiptap/core';
import { SvelteNodeViewRenderer } from 'svelte-tiptap';
import MermaidBlockView from './MermaidBlockView.svelte';

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  atom: true,  // Not editable inline

  addAttributes() {
    return {
      source: { default: 'flowchart TB\n  A --> B' },
      caption: { default: '' },
      caption_ja: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-type="mermaid"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'mermaid' })];
  },

  addNodeView() {
    return SvelteNodeViewRenderer(MermaidBlockView);
  },

  addCommands() {
    return {
      insertMermaid: () => ({ commands }) => {
        return commands.insertContent({
          type: this.name,
          attrs: {
            source: 'flowchart TB\n  A[Start] --> B[End]',
          },
        });
      },
    };
  },
});
```

### MermaidBlockView Component

```svelte
<!-- lib/editor/extensions/MermaidBlockView.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';
  import { NodeViewWrapper } from 'svelte-tiptap';
  import mermaid from 'mermaid';

  let { node, updateAttributes, selected, editor } = $props();

  let isEditing = $state(false);
  let source = $state(node.attrs.source);
  let caption = $state(node.attrs.caption);
  let captionJa = $state(node.attrs.caption_ja);
  let svgOutput = $state('');
  let error = $state('');

  // Render Mermaid
  async function renderDiagram() {
    try {
      const { svg } = await mermaid.render(`mermaid-${crypto.randomUUID()}`, source);
      svgOutput = svg;
      error = '';
    } catch (e) {
      error = e instanceof Error ? e.message : 'Render error';
    }
  }

  // Debounced render on source change
  $effect(() => {
    const timeout = setTimeout(renderDiagram, 300);
    return () => clearTimeout(timeout);
  });

  function saveChanges() {
    updateAttributes({ source, caption, caption_ja: captionJa });
    isEditing = false;
  }

  onMount(() => {
    mermaid.initialize({ startOnLoad: false, theme: 'neutral' });
    renderDiagram();
  });
</script>

<NodeViewWrapper class="mermaid-block" data-selected={selected}>
  <div class="block-header">
    <span class="block-type">Mermaid Diagram</span>
    <div class="block-actions">
      <button onclick={() => isEditing = !isEditing}>
        {isEditing ? 'Preview' : 'Edit'}
      </button>
    </div>
  </div>

  {#if isEditing}
    <div class="mermaid-editor">
      <div class="editor-pane">
        <label>Diagram Code</label>
        <textarea
          bind:value={source}
          rows="10"
          class="font-mono text-sm"
          spellcheck="false"
        />
      </div>
      <div class="preview-pane">
        <label>Preview</label>
        {#if error}
          <div class="error">{error}</div>
        {:else}
          <div class="svg-preview">{@html svgOutput}</div>
        {/if}
      </div>
    </div>

    <div class="caption-fields">
      <div>
        <label>Caption (EN)</label>
        <input type="text" bind:value={caption} />
      </div>
      <div>
        <label>Caption (JA)</label>
        <input type="text" bind:value={captionJa} />
      </div>
    </div>

    <button onclick={saveChanges} class="save-btn">Save</button>
  {:else}
    <div class="mermaid-display">
      {#if error}
        <div class="error">{error}</div>
      {:else}
        <div class="svg-output">{@html svgOutput}</div>
      {/if}
      {#if caption}
        <p class="caption">{caption}</p>
      {/if}
    </div>
  {/if}
</NodeViewWrapper>

<style>
  .mermaid-block {
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    margin: 1rem 0;
    overflow: hidden;
  }

  .mermaid-block[data-selected="true"] {
    border-color: #2D2F63;
    box-shadow: 0 0 0 2px rgba(45, 47, 99, 0.1);
  }

  .block-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.5rem 1rem;
    background: #f9fafb;
    border-bottom: 1px solid #e5e7eb;
  }

  .block-type {
    font-size: 0.75rem;
    font-weight: 500;
    color: #6b7280;
    text-transform: uppercase;
  }

  .mermaid-editor {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    padding: 1rem;
  }

  .mermaid-display {
    padding: 1rem;
    text-align: center;
  }

  .caption {
    margin-top: 0.5rem;
    font-size: 0.875rem;
    color: #6b7280;
    font-style: italic;
  }

  .error {
    color: #dc2626;
    padding: 1rem;
    background: #fef2f2;
    border-radius: 4px;
  }
</style>
```

## Slash Commands

### SlashCommands Extension

```typescript
// lib/editor/extensions/slash-commands.ts
import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { SvelteRenderer } from 'svelte-tiptap';
import SlashMenu from './SlashMenu.svelte';

export interface SlashCommandItem {
  title: string;
  description: string;
  icon: string;
  command: ({ editor, range }) => void;
}

const commands: SlashCommandItem[] = [
  {
    title: 'Paragraph',
    description: 'Plain text block',
    icon: 'Type',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setParagraph().run();
    },
  },
  {
    title: 'Heading 1',
    description: 'Large section heading',
    icon: 'Heading1',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 1 }).run();
    },
  },
  {
    title: 'Heading 2',
    description: 'Medium section heading',
    icon: 'Heading2',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHeading({ level: 2 }).run();
    },
  },
  {
    title: 'Mermaid Diagram',
    description: 'Insert a flowchart or diagram',
    icon: 'GitBranch',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertMermaid().run();
    },
  },
  {
    title: 'Code Block',
    description: 'Syntax-highlighted code',
    icon: 'Code',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setCodeBlock().run();
    },
  },
  {
    title: 'Image',
    description: 'Upload or select an image',
    icon: 'Image',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // Open media picker
      editor.commands.openMediaPicker();
    },
  },
  {
    title: 'Callout',
    description: 'Highlighted information box',
    icon: 'AlertCircle',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).insertCallout({ type: 'info' }).run();
    },
  },
  {
    title: 'Fragment',
    description: 'Insert reusable content block',
    icon: 'Puzzle',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).run();
      // Open fragment picker
      editor.commands.openFragmentPicker();
    },
  },
  {
    title: 'Table',
    description: 'Insert a table',
    icon: 'Table',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range)
        .insertTable({ rows: 3, cols: 3 }).run();
    },
  },
  {
    title: 'Divider',
    description: 'Horizontal line separator',
    icon: 'Minus',
    command: ({ editor, range }) => {
      editor.chain().focus().deleteRange(range).setHorizontalRule().run();
    },
  },
];

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        items: ({ query }) => {
          return commands.filter(item =>
            item.title.toLowerCase().includes(query.toLowerCase())
          );
        },
        render: () => {
          let component;
          let popup;

          return {
            onStart: (props) => {
              component = new SvelteRenderer(SlashMenu, {
                props,
                editor: props.editor,
              });

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },
            onUpdate(props) {
              component.updateProps(props);
              popup[0].setProps({ getReferenceClientRect: props.clientRect });
            },
            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup[0].hide();
                return true;
              }
              return component.ref?.onKeyDown(props);
            },
            onExit() {
              popup[0].destroy();
              component.destroy();
            },
          };
        },
      }),
    ];
  },
});
```

### SlashMenu Component

```svelte
<!-- lib/editor/extensions/SlashMenu.svelte -->
<script lang="ts">
  import * as Icons from 'lucide-svelte';

  let { items, command } = $props();
  let selectedIndex = $state(0);

  export function onKeyDown({ event }) {
    if (event.key === 'ArrowUp') {
      selectedIndex = (selectedIndex - 1 + items.length) % items.length;
      return true;
    }
    if (event.key === 'ArrowDown') {
      selectedIndex = (selectedIndex + 1) % items.length;
      return true;
    }
    if (event.key === 'Enter') {
      selectItem(selectedIndex);
      return true;
    }
    return false;
  }

  function selectItem(index: number) {
    const item = items[index];
    if (item) command(item);
  }
</script>

<div class="slash-menu">
  {#each items as item, index}
    <button
      class="slash-item"
      class:selected={index === selectedIndex}
      onclick={() => selectItem(index)}
    >
      <svelte:component this={Icons[item.icon]} class="w-4 h-4" />
      <div class="item-content">
        <span class="item-title">{item.title}</span>
        <span class="item-description">{item.description}</span>
      </div>
    </button>
  {/each}
</div>

<style>
  .slash-menu {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    padding: 0.5rem;
    min-width: 280px;
  }

  .slash-item {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    text-align: left;
  }

  .slash-item:hover,
  .slash-item.selected {
    background: #f3f4f6;
  }

  .item-title {
    display: block;
    font-weight: 500;
  }

  .item-description {
    display: block;
    font-size: 0.75rem;
    color: #6b7280;
  }
</style>
```

## Fragment Reference Block

When a fragment is inserted, it stores a reference and renders the fragment's blocks inline:

```typescript
// lib/editor/extensions/fragment-block.ts
export const FragmentBlock = Node.create({
  name: 'fragmentBlock',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      fragmentId: { default: null },
      fragmentName: { default: '' },  // For display before hydration
    };
  },

  // Renders as placeholder until hydrated with actual content
  addNodeView() {
    return SvelteNodeViewRenderer(FragmentBlockView);
  },
});
```

```svelte
<!-- FragmentBlockView.svelte -->
<script lang="ts">
  import { NodeViewWrapper } from 'svelte-tiptap';

  let { node, editor } = $props();
  let fragment = $state(null);
  let loading = $state(true);

  // Load fragment content
  $effect(() => {
    if (node.attrs.fragmentId) {
      loadFragment(node.attrs.fragmentId);
    }
  });

  async function loadFragment(id: string) {
    loading = true;
    const res = await fetch(`/api/fragments/${id}`);
    fragment = await res.json();
    loading = false;
  }
</script>

<NodeViewWrapper class="fragment-block">
  <div class="fragment-header">
    <span class="fragment-icon">📦</span>
    <span class="fragment-name">{fragment?.name || node.attrs.fragmentName}</span>
    <button onclick={() => editor.commands.openFragmentPicker()}>Change</button>
  </div>

  {#if loading}
    <div class="loading">Loading fragment...</div>
  {:else if fragment}
    <div class="fragment-content">
      <!-- Render fragment's blocks -->
      {#each fragment.blocks as block}
        <BlockRenderer {block} readonly />
      {/each}
    </div>
  {/if}
</NodeViewWrapper>
```

## Implementation Plan

### Phase 1: Core Block Infrastructure (2-3 days)
1. Create `MermaidBlock` Tiptap extension
2. Create `MermaidBlockView` Svelte component
3. Install mermaid npm package
4. Test diagram rendering

### Phase 2: Slash Commands (1-2 days)
1. Add `@tiptap/suggestion` extension
2. Create `SlashCommands` extension
3. Create `SlashMenu` component
4. Wire up existing block types

### Phase 3: Fragment Blocks (1-2 days)
1. Create `FragmentBlock` extension
2. Create `FragmentBlockView` with inline rendering
3. Build fragment picker modal
4. API endpoint for fragment content

### Phase 4: Storage Migration (1 day)
1. Add `block_content` column to fragments/content
2. Write migration script for existing HTML content
3. Update save/load logic to handle both formats

### Phase 5: Bilingual Block Editing (1-2 days)
1. Add locale switcher per block
2. Side-by-side editing mode
3. Translation status indicators

## Dependencies

```bash
npm install mermaid @tiptap/suggestion tippy.js svelte-tiptap
```

## Related Documents

- [12-editor-productivity.md](./12-editor-productivity.md) — Command palette, shortcuts
- [10-media-library.md](./10-media-library.md) — Image block integration
- [07-localization.md](./07-localization.md) — Bilingual content handling

---

*Document version: 1.0*
*Created: December 2025*

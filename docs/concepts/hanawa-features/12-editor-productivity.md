# Hanawa: Editor Productivity Specification

Power-user features for faster content creation.

## Implementation Status

| Feature | Status | Location |
|---------|--------|----------|
| Command Palette (⌘K) | ✅ Implemented | `lib/components/CommandPalette.svelte` |
| Keyboard Shortcuts Modal | ✅ Implemented | `lib/components/KeyboardShortcuts.svelte` |
| Autosave with Indicator | ✅ Implemented | `lib/components/editor/SaveIndicator.svelte` |
| Reading Time Estimate | ✅ Implemented | `lib/components/editor/HanawaEditor.svelte` |
| Focus Mode | ⏳ Planned | - |
| Recent Documents | ⏳ Planned | - |
| Favorites | ⏳ Planned | - |
| Bulk Operations | ⏳ Planned | - |
| Saved Views | ⏳ Planned | - |

## Overview

Productivity features reduce friction and make the CMS feel fast.

```
┌─────────────────────────────────────────────────────────────────┐
│  PRODUCTIVITY FEATURES                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  NAVIGATION                        EDITING                      │
│  • Command palette (⌘K)           • Autosave with indicator    │
│  • Global search                   • Undo/redo history         │
│  • Recent documents                • Focus mode                 │
│  • Favorites/bookmarks             • Split view editing         │
│  • Keyboard shortcuts              • Markdown shortcuts         │
│                                                                 │
│  ORGANIZATION                      QUALITY OF LIFE              │
│  • Custom saved filters            • Drag to reorder           │
│  • Bulk operations                 • Quick duplicate           │
│  • Batch status changes            • Templates                 │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Command Palette

Universal entry point—search anything, do anything.

### Implementation

```typescript
// lib/command-palette.ts

interface Command {
  id: string;
  label: string;
  description?: string;
  icon: ComponentType;
  category: 'navigation' | 'action' | 'document' | 'recent';
  keywords?: string[];
  shortcut?: string;
  action: () => void | Promise<void>;
}

const commands: Command[] = [
  // Navigation
  { id: 'go-dashboard', label: 'Go to Dashboard', shortcut: 'G D', action: () => goto('/admin') },
  { id: 'go-documents', label: 'Go to Documents', shortcut: 'G O', action: () => goto('/admin/documents') },
  { id: 'go-media', label: 'Go to Media', shortcut: 'G M', action: () => goto('/admin/media') },
  { id: 'go-settings', label: 'Go to Settings', shortcut: 'G S', action: () => goto('/admin/settings') },
  
  // Actions
  { id: 'new-doc', label: 'Create New Document', shortcut: 'C', action: createDocument },
  { id: 'save', label: 'Save Document', shortcut: '⌘S', action: saveDocument },
  { id: 'publish', label: 'Publish Document', shortcut: '⌘⇧P', action: publishDocument },
  { id: 'search', label: 'Search Documents', shortcut: '/', action: openSearch },
];
```

### Component

```svelte
<!-- lib/components/CommandPalette.svelte -->
<script lang="ts">
  let open = $state(false);
  let query = $state('');
  let selectedIndex = $state(0);
  
  // Filter commands
  let filtered = $derived(
    query 
      ? commands.filter(c => c.label.toLowerCase().includes(query.toLowerCase()))
      : commands.filter(c => c.category === 'recent').concat(commands.filter(c => c.category === 'action'))
  );
  
  function handleKeydown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      open = !open;
    }
    
    if (!open) return;
    
    if (e.key === 'ArrowDown') selectedIndex = Math.min(selectedIndex + 1, filtered.length - 1);
    if (e.key === 'ArrowUp') selectedIndex = Math.max(selectedIndex - 1, 0);
    if (e.key === 'Enter') executeCommand(filtered[selectedIndex]);
    if (e.key === 'Escape') open = false;
  }
</script>

{#if open}
  <div class="command-palette-overlay">
    <div class="command-palette">
      <input bind:value={query} placeholder="Type a command..." />
      
      <div class="command-list">
        {#each filtered as cmd, i}
          <button 
            class:selected={i === selectedIndex}
            onclick={() => executeCommand(cmd)}
          >
            <span>{cmd.label}</span>
            {#if cmd.shortcut}<kbd>{cmd.shortcut}</kbd>{/if}
          </button>
        {/each}
      </div>
    </div>
  </div>
{/if}
```

---

## Keyboard Shortcuts

### Global Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Command palette |
| `/` | Focus search |
| `G D` | Go to dashboard |
| `G O` | Go to documents |
| `G M` | Go to media |
| `C` | Create document |

### Editor Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘S` | Save |
| `⌘⇧P` | Publish |
| `⌘Z` | Undo |
| `⌘⇧Z` | Redo |
| `ESC` | Exit focus mode |

### List Shortcuts

| Shortcut | Action |
|----------|--------|
| `J` | Next item |
| `K` | Previous item |
| `Enter` | Open selected |
| `X` | Toggle select |

---

## Autosave System

```typescript
// lib/autosave.ts

type Status = 'saved' | 'saving' | 'unsaved' | 'error';

export function createAutosave(config: {
  debounceMs: number;
  onSave: (content: unknown) => Promise<void>;
  onStatusChange: (status: Status) => void;
}) {
  let timeout: ReturnType<typeof setTimeout>;
  let lastSaved: string;
  
  return {
    contentChanged(content: unknown) {
      const serialized = JSON.stringify(content);
      if (serialized === lastSaved) return;
      
      config.onStatusChange('unsaved');
      clearTimeout(timeout);
      timeout = setTimeout(() => this.save(content), config.debounceMs);
    },
    
    async save(content: unknown) {
      config.onStatusChange('saving');
      try {
        await config.onSave(content);
        lastSaved = JSON.stringify(content);
        config.onStatusChange('saved');
      } catch {
        config.onStatusChange('error');
      }
    },
    
    hasUnsavedChanges() {
      return JSON.stringify(content) !== lastSaved;
    },
  };
}
```

### Autosave Indicator

```svelte
<!-- lib/components/AutosaveIndicator.svelte -->
<script lang="ts">
  import { Check, Loader2, AlertCircle, Circle } from 'lucide-svelte';
  
  let { status, lastSavedAt }: { status: string; lastSavedAt?: number } = $props();
</script>

<div class="autosave">
  {#if status === 'saved'}
    <Check class="w-4 h-4" /> Saved
  {:else if status === 'saving'}
    <Loader2 class="w-4 h-4 animate-spin" /> Saving...
  {:else if status === 'unsaved'}
    <Circle class="w-4 h-4" /> Unsaved
  {:else}
    <AlertCircle class="w-4 h-4" /> Error
  {/if}
</div>
```

---

## Focus Mode

Distraction-free editing:

```svelte
<!-- lib/components/FocusMode.svelte -->
<script lang="ts">
  let { active, onExit, children }: Props = $props();
  let showControls = $state(true);
  
  function handleMouseMove() {
    showControls = true;
    setTimeout(() => showControls = false, 2000);
  }
</script>

{#if active}
  <div class="focus-mode" onmousemove={handleMouseMove}>
    {#if showControls}
      <button onclick={onExit}>Exit (ESC)</button>
    {/if}
    <main class="focus-content">
      {@render children()}
    </main>
  </div>
{/if}

<style>
  .focus-mode {
    position: fixed;
    inset: 0;
    background: white;
    z-index: 9999;
  }
  
  .focus-content {
    max-width: 700px;
    margin: 0 auto;
    padding: 4rem 2rem;
  }
</style>
```

---

## Recent Documents

```typescript
// lib/server/recent.ts

export function createRecentService(db: D1Database) {
  return {
    async recordAccess(userId: string, documentId: string) {
      await db.prepare(`
        INSERT INTO user_recent_documents (user_id, document_id, accessed_at)
        VALUES (?, ?, ?)
        ON CONFLICT DO UPDATE SET accessed_at = excluded.accessed_at
      `).bind(userId, documentId, Date.now()).run();
    },
    
    async getRecent(userId: string, limit = 10) {
      const { results } = await db.prepare(`
        SELECT d.id, d.title, d.collection
        FROM user_recent_documents r
        JOIN documents d ON r.document_id = d.id
        WHERE r.user_id = ?
        ORDER BY r.accessed_at DESC
        LIMIT ?
      `).bind(userId, limit).all();
      
      return results;
    },
  };
}
```

---

## Favorites

```sql
CREATE TABLE user_favorites (
  user_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_id, document_id)
);
```

```svelte
<button onclick={toggleFavorite}>
  <Star fill={isFavorite ? 'currentColor' : 'none'} />
</button>
```

---

## Bulk Operations

```svelte
<!-- lib/components/BulkActions.svelte -->
<script lang="ts">
  let { selectedIds, onAction }: Props = $props();
</script>

{#if selectedIds.length > 0}
  <div class="bulk-actions">
    <span>{selectedIds.length} selected</span>
    <button onclick={() => onAction('publish')}>Publish</button>
    <button onclick={() => onAction('unpublish')}>Unpublish</button>
    <button onclick={() => onAction('archive')}>Archive</button>
    <button onclick={() => onAction('delete')}>Delete</button>
  </div>
{/if}
```

---

## Saved Views

Custom filters that persist:

```sql
CREATE TABLE saved_views (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  filters TEXT NOT NULL,           -- JSON
  sort_by TEXT,
  columns TEXT,                    -- JSON
  is_default BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL
);
```

---

## Related Documents

- [hanawa-cms.md](../hanawa-cms.md) — Editor integration
- [08-ai-assistant.md](./08-ai-assistant.md) — AI shortcuts

---

## Implementation Notes

### Command Palette (Implemented Dec 2025)

The command palette opens with ⌘K and provides:
- Navigation commands (Dashboard, Content, Fragments, Sites, Assets)
- Create commands (new document, new fragment)
- Action commands (toggle theme, keyboard shortcuts)
- Keyboard navigation (↑↓ to navigate, Enter to select, Esc to close)
- Fuzzy search across command titles and keywords
- Grouped display by category

### Autosave System (Implemented Dec 2025)

Integrated into HanawaEditor with:
- Configurable delay (`autosaveDelay` prop, default 2000ms)
- Status indicator showing: idle, saving, saved (with timestamp), unsaved, error
- Manual save with ⌘S that uses the same save mechanism
- Reading time estimate in footer (based on 200 words/minute)

### Keyboard Shortcuts Modal (Implemented Dec 2025)

- Opens with `?` key from anywhere (except input fields)
- Displays shortcuts grouped by: Global, Navigation, Text Formatting, Blocks, Editor
- Two-column responsive layout
- Closes with Esc or clicking backdrop

---

*Document version: 1.1*
*Last updated: December 2025*

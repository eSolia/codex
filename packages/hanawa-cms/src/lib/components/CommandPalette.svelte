<script lang="ts">
  /**
   * Command Palette Component
   * Global ⌘K search and navigation
   *
   * InfoSec: No external data sources, navigation validated
   */
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  // Props
  let { open = $bindable(false) }: { open?: boolean } = $props();

  // State
  let query = $state('');
  let selectedIndex = $state(0);
  let inputElement = $state<HTMLInputElement | null>(null);

  // Command definitions
  interface Command {
    id: string;
    title: string;
    description?: string;
    icon: string;
    category: 'navigation' | 'action' | 'create';
    keywords: string[];
    action: () => void | Promise<void>;
    shortcut?: string;
  }

  const commands: Command[] = [
    // Navigation
    {
      id: 'go-dashboard',
      title: 'Go to Dashboard',
      icon: '🏠',
      category: 'navigation',
      keywords: ['home', 'dashboard', 'main'],
      action: () => goto('/'),
      shortcut: 'G D',
    },
    {
      id: 'go-content',
      title: 'Go to Content',
      icon: '📄',
      category: 'navigation',
      keywords: ['content', 'documents', 'pages'],
      action: () => goto('/content'),
      shortcut: 'G C',
    },
    {
      id: 'go-fragments',
      title: 'Go to Fragments',
      icon: '🧩',
      category: 'navigation',
      keywords: ['fragments', 'blocks', 'reusable'],
      action: () => goto('/fragments'),
      shortcut: 'G F',
    },
    {
      id: 'go-sites',
      title: 'Go to Sites',
      icon: '🌐',
      category: 'navigation',
      keywords: ['sites', 'websites'],
      action: () => goto('/sites'),
      shortcut: 'G S',
    },
    {
      id: 'go-assets',
      title: 'Go to Assets',
      icon: '🖼️',
      category: 'navigation',
      keywords: ['assets', 'media', 'images', 'files'],
      action: () => goto('/assets'),
      shortcut: 'G A',
    },

    // Create actions
    {
      id: 'create-content',
      title: 'Create New Content',
      description: 'Create a new document',
      icon: '➕',
      category: 'create',
      keywords: ['new', 'create', 'add', 'document'],
      action: () => goto('/content/new'),
      shortcut: 'C',
    },
    {
      id: 'create-fragment',
      title: 'Create New Fragment',
      description: 'Create a reusable content block',
      icon: '➕',
      category: 'create',
      keywords: ['new', 'create', 'fragment', 'block'],
      action: () => goto('/fragments/new'),
    },

    // Actions
    {
      id: 'toggle-theme',
      title: 'Toggle Dark Mode',
      description: 'Switch between light and dark theme',
      icon: '🌙',
      category: 'action',
      keywords: ['theme', 'dark', 'light', 'mode'],
      action: () => {
        document.documentElement.classList.toggle('dark');
      },
    },
    {
      id: 'keyboard-shortcuts',
      title: 'Keyboard Shortcuts',
      description: 'View all keyboard shortcuts',
      icon: '⌨️',
      category: 'action',
      keywords: ['keyboard', 'shortcuts', 'help', 'keys'],
      action: () => {
        // Will be implemented with shortcuts modal
        alert(
          'Keyboard shortcuts:\n\n⌘K - Command Palette\n⌘S - Save\n/ - Slash commands in editor'
        );
      },
      shortcut: '?',
    },
  ];

  // Filtered commands based on query
  let filteredCommands = $derived.by(() => {
    if (!query.trim()) {
      return commands;
    }
    const search = query.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.title.toLowerCase().includes(search) ||
        cmd.description?.toLowerCase().includes(search) ||
        cmd.keywords.some((k) => k.includes(search))
    );
  });

  // Reset selection when query changes
  $effect(() => {
    const _query = query; // Track query for dependency
    void _query; // Consume to avoid unused warning
    selectedIndex = 0;
  });

  // Focus input when opened
  $effect(() => {
    if (open && inputElement) {
      requestAnimationFrame(() => {
        inputElement?.focus();
      });
    }
  });

  // Handle keyboard navigation
  function handleKeydown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        selectedIndex = Math.min(selectedIndex + 1, filteredCommands.length - 1);
        break;
      case 'ArrowUp':
        event.preventDefault();
        selectedIndex = Math.max(selectedIndex - 1, 0);
        break;
      case 'Enter':
        event.preventDefault();
        executeCommand(selectedIndex);
        break;
      case 'Escape':
        event.preventDefault();
        close();
        break;
    }
  }

  function executeCommand(index: number) {
    const command = filteredCommands[index];
    if (command) {
      close();
      command.action();
    }
  }

  function close() {
    open = false;
    query = '';
    selectedIndex = 0;
  }

  // Global keyboard listener
  onMount(() => {
    function handleGlobalKeydown(event: KeyboardEvent) {
      // ⌘K or Ctrl+K to open
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        open = !open;
        if (!open) {
          query = '';
          selectedIndex = 0;
        }
      }
    }

    document.addEventListener('keydown', handleGlobalKeydown);
    return () => document.removeEventListener('keydown', handleGlobalKeydown);
  });

  // Category labels
  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    action: 'Actions',
    create: 'Create',
  };

  // Group commands by category
  let groupedCommands = $derived.by(() => {
    const groups: Record<string, Command[]> = {};
    for (const cmd of filteredCommands) {
      if (!groups[cmd.category]) {
        groups[cmd.category] = [];
      }
      groups[cmd.category]!.push(cmd);
    }
    return groups;
  });

  // Flat index for keyboard navigation
  function getFlatIndex(category: string, indexInCategory: number): number {
    let index = 0;
    for (const cat of ['navigation', 'create', 'action']) {
      if (cat === category) {
        return index + indexInCategory;
      }
      index += groupedCommands[cat]?.length || 0;
    }
    return index;
  }
</script>

{#if open}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 bg-black/50 z-50"
    onclick={close}
    onkeydown={(e) => e.key === 'Escape' && close()}
    role="button"
    tabindex="-1"
  ></div>

  <!-- Palette -->
  <div
    class="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-xl bg-white rounded-xl shadow-2xl z-50 overflow-hidden"
    role="dialog"
    aria-modal="true"
    aria-label="Command palette"
  >
    <!-- Search Input -->
    <div class="flex items-center gap-3 px-4 py-3 border-b border-gray-200">
      <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        bind:this={inputElement}
        bind:value={query}
        type="text"
        class="flex-1 text-lg outline-none placeholder-gray-400"
        placeholder="Type a command or search..."
        onkeydown={handleKeydown}
      />
      <kbd class="px-2 py-1 text-xs text-gray-500 bg-gray-100 rounded">esc</kbd>
    </div>

    <!-- Command List -->
    <div class="max-h-80 overflow-y-auto">
      {#if filteredCommands.length === 0}
        <div class="px-4 py-8 text-center text-gray-500">
          No commands found for "{query}"
        </div>
      {:else}
        {#each ['navigation', 'create', 'action'] as category}
          {#if groupedCommands[category]?.length}
            <div class="px-2 pt-2">
              <div class="px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                {categoryLabels[category]}
              </div>
              {#each groupedCommands[category] as command, indexInCategory}
                {@const flatIndex = getFlatIndex(category, indexInCategory)}
                <button
                  type="button"
                  class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors
                    {flatIndex === selectedIndex
                    ? 'bg-esolia-navy text-white'
                    : 'hover:bg-gray-100'}"
                  onclick={() => executeCommand(flatIndex)}
                  onmouseenter={() => (selectedIndex = flatIndex)}
                >
                  <span class="text-lg w-6 text-center">{command.icon}</span>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium truncate">{command.title}</div>
                    {#if command.description}
                      <div
                        class="text-sm truncate {flatIndex === selectedIndex
                          ? 'text-white/70'
                          : 'text-gray-500'}"
                      >
                        {command.description}
                      </div>
                    {/if}
                  </div>
                  {#if command.shortcut}
                    <kbd
                      class="px-2 py-0.5 text-xs rounded {flatIndex === selectedIndex
                        ? 'bg-white/20 text-white'
                        : 'bg-gray-100 text-gray-500'}"
                    >
                      {command.shortcut}
                    </kbd>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        {/each}
      {/if}
    </div>

    <!-- Footer -->
    <div
      class="px-4 py-2 border-t border-gray-200 flex items-center justify-between text-xs text-gray-500"
    >
      <div class="flex items-center gap-4">
        <span><kbd class="px-1 bg-gray-100 rounded">↑↓</kbd> navigate</span>
        <span><kbd class="px-1 bg-gray-100 rounded">↵</kbd> select</span>
        <span><kbd class="px-1 bg-gray-100 rounded">esc</kbd> close</span>
      </div>
      <div>
        <kbd class="px-1 bg-gray-100 rounded">⌘K</kbd> to open anytime
      </div>
    </div>
  </div>
{/if}

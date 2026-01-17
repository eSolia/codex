<script lang="ts">
  /**
   * Keyboard Shortcuts Modal
   * Displays all available keyboard shortcuts
   */
  import { onMount } from 'svelte';

  let { open = $bindable(false) }: { open?: boolean } = $props();

  interface Shortcut {
    keys: string[];
    description: string;
  }

  interface ShortcutGroup {
    title: string;
    shortcuts: Shortcut[];
  }

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Global',
      shortcuts: [
        { keys: ['⌘', 'K'], description: 'Open command palette' },
        { keys: ['⌘', 'S'], description: 'Save document' },
        { keys: ['?'], description: 'Show keyboard shortcuts' },
      ],
    },
    {
      title: 'Navigation',
      shortcuts: [
        { keys: ['G', 'D'], description: 'Go to Dashboard' },
        { keys: ['G', 'C'], description: 'Go to Content' },
        { keys: ['G', 'F'], description: 'Go to Fragments' },
        { keys: ['G', 'S'], description: 'Go to Sites' },
        { keys: ['G', 'A'], description: 'Go to Assets' },
      ],
    },
    {
      title: 'Text Formatting',
      shortcuts: [
        { keys: ['⌘', 'B'], description: 'Bold' },
        { keys: ['⌘', 'I'], description: 'Italic' },
        { keys: ['⌘', 'U'], description: 'Underline' },
        { keys: ['⌘', '⇧', 'X'], description: 'Strikethrough' },
        { keys: ['⌘', 'E'], description: 'Inline code' },
      ],
    },
    {
      title: 'Blocks',
      shortcuts: [
        { keys: ['/'], description: 'Open slash commands menu' },
        { keys: ['⌘', '⇧', 'M'], description: 'Insert Mermaid diagram' },
        { keys: ['⌘', '⌥', '1'], description: 'Heading 1' },
        { keys: ['⌘', '⌥', '2'], description: 'Heading 2' },
        { keys: ['⌘', '⌥', '3'], description: 'Heading 3' },
        { keys: ['⌘', '⇧', '7'], description: 'Ordered list' },
        { keys: ['⌘', '⇧', '8'], description: 'Bullet list' },
        { keys: ['⌘', '⇧', '9'], description: 'Task list' },
      ],
    },
    {
      title: 'Editor',
      shortcuts: [
        { keys: ['⌘', 'Z'], description: 'Undo' },
        { keys: ['⌘', '⇧', 'Z'], description: 'Redo' },
        { keys: ['⌘', 'A'], description: 'Select all' },
        { keys: ['Esc'], description: 'Clear selection / Close menu' },
      ],
    },
  ];

  function close() {
    open = false;
  }

  // Listen for ? key globally
  onMount(() => {
    function handleKeydown(event: KeyboardEvent) {
      if (
        event.key === '?' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !(event.target instanceof HTMLInputElement) &&
        !(event.target instanceof HTMLTextAreaElement)
      ) {
        event.preventDefault();
        open = !open;
      }
      if (event.key === 'Escape' && open) {
        close();
      }
    }

    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  });
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

  <!-- Modal -->
  <div
    class="fixed top-[10%] left-1/2 -translate-x-1/2 w-full max-w-2xl bg-white rounded-xl shadow-2xl z-50 overflow-hidden"
    role="dialog"
    aria-modal="true"
    aria-label="Keyboard shortcuts"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-6 py-4 border-b border-gray-200">
      <h2 class="text-lg font-semibold text-gray-900">Keyboard Shortcuts</h2>
      <button
        type="button"
        class="p-1 text-gray-400 hover:text-gray-600 rounded"
        onclick={close}
        aria-label="Close keyboard shortcuts"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>

    <!-- Content -->
    <div class="px-6 py-4 max-h-[70vh] overflow-y-auto">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each shortcutGroups as group}
          <div>
            <h3 class="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">
              {group.title}
            </h3>
            <div class="space-y-2">
              {#each group.shortcuts as shortcut}
                <div class="flex items-center justify-between">
                  <span class="text-sm text-gray-700">{shortcut.description}</span>
                  <div class="flex items-center gap-1">
                    {#each shortcut.keys as key}
                      <kbd
                        class="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded"
                      >
                        {key}
                      </kbd>
                    {/each}
                  </div>
                </div>
              {/each}
            </div>
          </div>
        {/each}
      </div>
    </div>

    <!-- Footer -->
    <div class="px-6 py-3 bg-gray-50 border-t border-gray-200 text-center">
      <span class="text-xs text-gray-500">
        Press <kbd class="px-1 bg-gray-200 rounded">?</kbd> to toggle this dialog
      </span>
    </div>
  </div>
{/if}

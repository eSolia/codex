<script lang="ts">
  import '../app.css';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
  import RocketLaunch from 'phosphor-svelte/lib/RocketLaunch';

  let { children } = $props();

  let commandPaletteOpen = $state(false);
  let shortcutsOpen = $state(false);
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Top Navigation -->
  <nav class="bg-rose-600 text-white shadow-lg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo with Rocket Icon -->
        <div class="flex items-center">
          <a href="/" class="flex items-center gap-3">
            <span class="flex items-center justify-center w-9 h-9 bg-white/90 rounded-lg">
              <RocketLaunch size={24} weight="duotone" class="text-rose-600" />
            </span>
            <span class="text-xl font-semibold">Hanawa</span>
          </a>
        </div>

        <!-- Main Nav -->
        <div class="hidden md:flex items-center gap-6">
          <a
            href="/"
            class="px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Dashboard
          </a>
          <a
            href="/sites"
            class="px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Sites
          </a>
          <a
            href="/content"
            class="px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Content
          </a>
          <a
            href="/fragments"
            class="px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Fragments
          </a>
          <a
            href="/assets"
            class="px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Assets
          </a>
        </div>

        <!-- Search & User Menu -->
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-300 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            onclick={() => (commandPaletteOpen = true)}
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <span class="hidden sm:inline">Search</span>
            <kbd class="hidden sm:inline px-1.5 py-0.5 text-xs bg-white/10 rounded">⌘K</kbd>
          </button>
          <span class="text-sm text-gray-300">eSolia Admin</span>
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {@render children()}
  </main>
</div>

<!-- Command Palette (Global) -->
<CommandPalette bind:open={commandPaletteOpen} />

<!-- Keyboard Shortcuts Modal -->
<KeyboardShortcuts bind:open={shortcutsOpen} />

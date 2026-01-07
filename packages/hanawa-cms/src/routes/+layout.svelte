<script lang="ts">
  import '../app.css';
  import CommandPalette from '$lib/components/CommandPalette.svelte';
  import KeyboardShortcuts from '$lib/components/KeyboardShortcuts.svelte';
  import RocketLaunch from 'phosphor-svelte/lib/RocketLaunch';
  import ShieldCheck from 'phosphor-svelte/lib/ShieldCheck';
  import Lock from 'phosphor-svelte/lib/Lock';
  import SignOut from 'phosphor-svelte/lib/SignOut';
  import User from 'phosphor-svelte/lib/User';

  let { children, data } = $props();

  let commandPaletteOpen = $state(false);
  let shortcutsOpen = $state(false);

  const currentYear = new Date().getFullYear();
</script>

<div class="min-h-screen bg-gray-50 flex flex-col">
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
            href="/documents"
            class="px-3 py-2 rounded-md text-sm font-medium hover:bg-white/10 transition-colors"
          >
            Documents
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

          {#if data.user}
            <div class="flex items-center gap-3">
              <span class="hidden sm:flex items-center gap-1.5 text-sm text-gray-200">
                <User size={16} weight="duotone" />
                {data.user.name}
              </span>
              <a
                href="/auth/logout"
                class="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-300 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                title="Sign out"
              >
                <SignOut size={16} weight="duotone" />
                <span class="hidden sm:inline">Sign Out</span>
              </a>
            </div>
          {:else}
            <span class="text-sm text-gray-300">eSolia Admin</span>
          {/if}
        </div>
      </div>
    </div>
  </nav>

  <!-- Main Content -->
  <main class="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 w-full">
    {@render children()}
  </main>

  <!-- Footer -->
  <footer class="bg-zinc-800 text-zinc-300 mt-auto">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-8">
        <!-- eSolia Brand -->
        <div>
          <div class="flex items-center gap-2 mb-3">
            <img
              src="/esolia-logo-white.svg"
              alt="eSolia Inc."
              class="h-12 w-auto"
            />
          </div>
          <p class="text-sm text-zinc-400">
            Enterprise content management for compliance documentation and knowledge sharing.
          </p>
          <p class="text-xs text-zinc-500 mt-2">
            &copy; {currentYear} eSolia Inc. All rights reserved.
          </p>
        </div>

        <!-- Security & Compliance -->
        <div>
          <h3 class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <ShieldCheck size={18} weight="duotone" />
            Security & Compliance
          </h3>
          <ul class="space-y-2 text-sm text-zinc-400">
            <li class="flex items-center gap-2">
              <Lock size={14} class="text-zinc-500" />
              Cloudflare Access protected
            </li>
            <li class="flex items-center gap-2">
              <Lock size={14} class="text-zinc-500" />
              All data encrypted at rest
            </li>
            <li class="flex items-center gap-2">
              <Lock size={14} class="text-zinc-500" />
              Full audit trail logging
            </li>
            <li class="flex items-center gap-2">
              <Lock size={14} class="text-zinc-500" />
              ISO 27001 aligned controls
            </li>
          </ul>
          <div class="mt-3">
            <a
              href="/security"
              class="text-xs text-zinc-400 hover:text-rose-400 transition-colors"
            >
              Security
            </a>
          </div>
        </div>

        <!-- Product Info -->
        <div>
          <h3 class="text-sm font-semibold text-white mb-3 flex items-center gap-2">
            <RocketLaunch size={18} weight="duotone" />
            Hanawa CMS
          </h3>
          <p class="text-sm text-zinc-400 mb-2">
            Part of the eSolia Codex knowledge platform.
          </p>
          <p class="text-xs text-zinc-500">
            Named after Hanawa Hokiichi (塙保己一), the blind scholar who compiled 1,273 classical texts.
          </p>
          <div class="mt-3 flex items-center gap-3">
            <a
              href="https://esolia.co.jp/en"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              English
            </a>
            <span class="text-zinc-600">•</span>
            <a
              href="https://esolia.co.jp"
              target="_blank"
              rel="noopener noreferrer"
              class="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              日本語
            </a>
          </div>
        </div>
      </div>
    </div>
  </footer>
</div>

<!-- Command Palette (Global) -->
<CommandPalette bind:open={commandPaletteOpen} />

<!-- Keyboard Shortcuts Modal -->
<KeyboardShortcuts bind:open={shortcutsOpen} />

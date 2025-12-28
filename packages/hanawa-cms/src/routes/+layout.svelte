<script lang="ts">
  import "../app.css";

  let { children } = $props();
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Top Navigation -->
  <nav class="bg-esolia-navy text-white shadow-lg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex items-center justify-between h-16">
        <!-- Logo -->
        <div class="flex items-center">
          <a href="/" class="flex items-center gap-3">
            <span class="text-2xl font-bold text-esolia-orange">塙</span>
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

        <!-- User Menu -->
        <div class="flex items-center gap-4">
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

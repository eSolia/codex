<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  interface FragmentRow {
    id: string;
    category: string;
    title_en: string | null;
    title_ja: string | null;
    type: string | null;
    version: string | null;
    status: string;
    tags: string | null;
    has_en: number;
    has_ja: number;
    sensitivity: string | null;
    author: string | null;
    updated_at: string | null;
  }

  // Group fragments by category
  function groupByCategory(fragments: FragmentRow[]): Record<string, FragmentRow[]> {
    return fragments.reduce(
      (acc, fragment) => {
        const cat = fragment.category || 'uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(fragment);
        return acc;
      },
      {} as Record<string, FragmentRow[]>
    );
  }

  // Parse tags from JSON string
  function parseTags(tags: string | null): string[] {
    if (!tags) return [];
    try {
      const parsed = JSON.parse(tags);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Get tag style based on type
  function getTagStyle(tag: string): string {
    if (tag === 'initial-client') return 'bg-blue-100 text-blue-800';
    if (tag === 'repeat-client') return 'bg-green-100 text-green-800';
    if (tag === 'all-clients') return 'bg-purple-100 text-purple-800';
    return 'bg-gray-100 text-gray-600';
  }

  // Get status badge style
  function getStatusStyle(status: string): string {
    switch (status) {
      case 'production':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'deprecated':
        return 'bg-red-100 text-red-800';
      case 'archived':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }

  // Display title with fallback
  function displayTitle(frag: FragmentRow): string {
    return frag.title_en || frag.title_ja || frag.id;
  }

  let groupedFragments = $derived(groupByCategory((data.fragments ?? []) as FragmentRow[]));
</script>

<svelte:head>
  <title>Fragments | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-esolia-navy">Fragments</h1>
      <p class="mt-1 text-gray-600">Reusable content blocks for proposals and documents</p>
    </div>
    <a
      href="/fragments/new"
      class="inline-flex items-center px-4 py-2 bg-esolia-orange text-esolia-navy rounded-lg hover:bg-esolia-orange/90 transition-colors font-medium"
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      New Fragment
    </a>
  </div>

  <!-- Search and Filters -->
  <div class="bg-white rounded-lg shadow p-4">
    <form method="get" class="flex flex-wrap gap-4">
      <input
        type="search"
        name="q"
        value={data.currentSearch ?? ''}
        placeholder="Search fragments..."
        class="flex-1 min-w-[200px] rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      />
      <select
        name="category"
        class="rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      >
        <option value="">All Categories</option>
        {#each data.categories as category}
          <option value={category} selected={data.currentCategory === category}>{category}</option>
        {/each}
      </select>
      <select
        name="tag"
        class="rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      >
        <option value="">All Tags</option>
        {#each data.tags ?? [] as tag}
          <option value={tag} selected={data.currentTag === tag}>{tag}</option>
        {/each}
      </select>
      <button
        type="submit"
        class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
      >
        Filter
      </button>
      {#if data.currentCategory || data.currentTag || data.currentSearch}
        <a href="/fragments" class="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors">
          Clear
        </a>
      {/if}
    </form>
  </div>

  <!-- Active Filters -->
  {#if data.currentCategory || data.currentTag}
    <div class="flex items-center gap-2 text-sm">
      <span class="text-gray-500">Filtering:</span>
      {#if data.currentCategory}
        <span class="inline-flex items-center px-2 py-1 rounded bg-esolia-navy/10 text-esolia-navy">
          Category: {data.currentCategory}
        </span>
      {/if}
      {#if data.currentTag}
        <span class="inline-flex items-center px-2 py-1 rounded {getTagStyle(data.currentTag)}">
          Tag: {data.currentTag}
        </span>
      {/if}
    </div>
  {/if}

  <!-- Fragments by Category -->
  {#if data.fragments && data.fragments.length > 0}
    <div class="space-y-8">
      {#each Object.entries(groupedFragments) as [category, fragments]}
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span class="w-2 h-2 bg-esolia-orange rounded-full mr-2" aria-hidden="true"></span>
            {category}
            <span class="ml-2 text-sm font-normal text-gray-500">
              ({fragments.length})
            </span>
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each fragments as fragment}
              {@const tags = parseTags(fragment.tags)}
              <a
                href="/fragments/{fragment.id}"
                class="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 border-l-4 border-esolia-orange"
              >
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-medium text-gray-900">{displayTitle(fragment)}</h3>
                  <div class="flex items-center gap-1 flex-shrink-0">
                    {#if fragment.has_en && fragment.has_ja}
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        EN/JA
                      </span>
                    {:else if fragment.has_en}
                      <span
                        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                      >
                        EN
                      </span>
                    {:else if fragment.has_ja}
                      <span
                        class="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                      >
                        JA
                      </span>
                    {/if}
                  </div>
                </div>
                <p class="text-sm text-gray-500 mt-1 font-mono">{fragment.id}</p>
                <div class="flex items-center gap-2 mt-2">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getStatusStyle(
                      fragment.status
                    )}"
                  >
                    {fragment.status}
                  </span>
                  {#if fragment.type}
                    <span class="text-xs text-gray-400">{fragment.type}</span>
                  {/if}
                </div>
                {#if tags.length > 0}
                  <div class="mt-2 flex flex-wrap gap-1">
                    {#each tags.slice(0, 3) as tag}
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getTagStyle(
                          tag
                        )}"
                      >
                        {tag}
                      </span>
                    {/each}
                    {#if tags.length > 3}
                      <span class="text-xs text-gray-400">+{tags.length - 3}</span>
                    {/if}
                  </div>
                {/if}
              </a>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow p-12 text-center">
      <svg
        class="mx-auto h-12 w-12 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
        />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No fragments found</h3>
      <p class="mt-2 text-gray-500">
        {#if data.currentCategory || data.currentTag || data.currentSearch}
          Try adjusting your filters or search query.
        {:else}
          Create reusable content blocks for proposals and documents.
        {/if}
      </p>
      <a
        href="/fragments/new"
        class="mt-4 inline-flex items-center px-4 py-2 bg-esolia-orange text-esolia-navy rounded-lg hover:bg-esolia-orange/90 transition-colors font-medium"
      >
        Create Fragment
      </a>
    </div>
  {/if}
</div>

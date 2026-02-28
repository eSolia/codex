<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  interface StandardRow {
    slug: string;
    title: string;
    category: string | null;
    tags: string | null;
    summary: string | null;
    status: string;
    author: string | null;
    updated_at: string | null;
  }

  // Group standards by category
  function groupByCategory(standards: StandardRow[]): Record<string, StandardRow[]> {
    return standards.reduce(
      (acc, standard) => {
        const cat = standard.category || 'uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(standard);
        return acc;
      },
      {} as Record<string, StandardRow[]>
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

  let groupedStandards = $derived(groupByCategory((data.standards ?? []) as StandardRow[]));
</script>

<svelte:head>
  <title>Standards | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-esolia-navy">Standards</h1>
      <p class="mt-1 text-gray-600">Coding and workflow standards for eSolia projects</p>
    </div>
    <a
      href="/standards/new"
      class="inline-flex items-center px-4 py-2 bg-esolia-orange text-esolia-navy rounded-lg hover:bg-esolia-orange/90 transition-colors font-medium"
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      New Standard
    </a>
  </div>

  <!-- Search and Filters -->
  <div class="bg-white rounded-lg shadow p-4">
    <form method="get" class="flex flex-wrap gap-4">
      <input
        type="search"
        name="q"
        value={data.currentSearch ?? ''}
        placeholder="Search standards..."
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
        <a href="/standards" class="px-4 py-2 text-gray-500 hover:text-gray-700 transition-colors">
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
        <span class="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-gray-600">
          Tag: {data.currentTag}
        </span>
      {/if}
    </div>
  {/if}

  <!-- Standards by Category -->
  {#if data.standards && data.standards.length > 0}
    <div class="space-y-8">
      {#each Object.entries(groupedStandards) as [category, standards]}
        <div>
          <h2 class="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <span class="w-2 h-2 bg-teal-500 rounded-full mr-2" aria-hidden="true"></span>
            {category}
            <span class="ml-2 text-sm font-normal text-gray-500">
              ({standards.length})
            </span>
          </h2>
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {#each standards as standard}
              {@const tags = parseTags(standard.tags)}
              <a
                href="/standards/{standard.slug}"
                class="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 border-l-4 border-teal-500"
              >
                <div class="flex items-start justify-between gap-2">
                  <h3 class="font-medium text-gray-900">{standard.title}</h3>
                </div>
                <p class="text-sm text-gray-500 mt-1 font-mono">{standard.slug}</p>
                {#if standard.summary}
                  <p class="text-sm text-gray-600 mt-2 line-clamp-2">{standard.summary}</p>
                {/if}
                <div class="flex items-center gap-2 mt-2">
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getStatusStyle(
                      standard.status
                    )}"
                  >
                    {standard.status}
                  </span>
                </div>
                {#if tags.length > 0}
                  <div class="mt-2 flex flex-wrap gap-1">
                    {#each tags.slice(0, 4) as tag}
                      <span
                        class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600"
                      >
                        {tag}
                      </span>
                    {/each}
                    {#if tags.length > 4}
                      <span class="text-xs text-gray-400">+{tags.length - 4}</span>
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No standards found</h3>
      <p class="mt-2 text-gray-500">
        {#if data.currentCategory || data.currentTag || data.currentSearch}
          Try adjusting your filters or search query.
        {:else}
          Create coding and workflow standards for eSolia projects.
        {/if}
      </p>
      <a
        href="/standards/new"
        class="mt-4 inline-flex items-center px-4 py-2 bg-esolia-orange text-esolia-navy rounded-lg hover:bg-esolia-orange/90 transition-colors font-medium"
      >
        Create Standard
      </a>
    </div>
  {/if}
</div>

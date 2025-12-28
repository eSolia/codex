<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Group fragments by category
  function groupByCategory(
    fragments: Array<{ category: string; [key: string]: unknown }>
  ): Record<string, Array<{ category: string; [key: string]: unknown }>> {
    return fragments.reduce(
      (acc, fragment) => {
        const cat = fragment.category || 'Uncategorized';
        if (!acc[cat]) acc[cat] = [];
        acc[cat].push(fragment);
        return acc;
      },
      {} as Record<string, Array<{ category: string; [key: string]: unknown }>>
    );
  }

  let groupedFragments = $derived(
    groupByCategory((data.fragments ?? []) as Array<{ category: string; [key: string]: unknown }>)
  );
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
        placeholder="Search fragments..."
        class="flex-1 min-w-[200px] rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      />
      <select
        name="category"
        class="rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      >
        <option value="">All Categories</option>
        {#each data.categories as category}
          <option value={category}>{category}</option>
        {/each}
      </select>
      <button
        type="submit"
        class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
      >
        Search
      </button>
    </form>
  </div>

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
              <a
                href="/fragments/{fragment.id}"
                class="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-4 border-l-4 border-esolia-orange"
              >
                <div class="flex items-start justify-between">
                  <h3 class="font-medium text-gray-900">{fragment.name}</h3>
                  {#if fragment.is_bilingual}
                    <span
                      class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800"
                    >
                      EN/JA
                    </span>
                  {/if}
                </div>
                <p class="text-sm text-gray-500 mt-1">{fragment.slug}</p>
                {#if fragment.description}
                  <p class="text-sm text-gray-600 mt-2 line-clamp-2">
                    {fragment.description}
                  </p>
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
      <h3 class="mt-4 text-lg font-medium text-gray-900">No fragments yet</h3>
      <p class="mt-2 text-gray-500">Create reusable content blocks for proposals and documents.</p>
      <a
        href="/fragments/new"
        class="mt-4 inline-flex items-center px-4 py-2 bg-esolia-orange text-esolia-navy rounded-lg hover:bg-esolia-orange/90 transition-colors font-medium"
      >
        Create Fragment
      </a>
    </div>
  {/if}
</div>

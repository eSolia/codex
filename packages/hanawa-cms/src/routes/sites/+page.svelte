<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Sites | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-esolia-navy">Sites</h1>
      <p class="mt-1 text-gray-600">Manage websites and their configurations</p>
    </div>
    <a
      href="/sites/new"
      class="inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      Add Site
    </a>
  </div>

  <!-- Sites Grid -->
  {#if data.sites && data.sites.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each data.sites as site}
        <a
          href="/sites/{site.id}"
          class="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
        >
          <div class="flex items-start justify-between">
            <div>
              <h3 class="text-lg font-semibold text-gray-900">{site.name}</h3>
              <p class="text-sm text-gray-500 mt-1">{site.slug}</p>
            </div>
          </div>
          {#if site.domain}
            <p class="mt-3 text-sm text-esolia-navy">
              <svg
                class="inline w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                />
              </svg>
              {site.domain}
            </p>
          {/if}
          {#if site.description}
            <p class="mt-2 text-sm text-gray-600 line-clamp-2">
              {site.description}
            </p>
          {/if}
        </a>
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
          d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
        />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No sites yet</h3>
      <p class="mt-2 text-gray-500">Get started by adding your first site.</p>
      <a
        href="/sites/new"
        class="mt-4 inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
      >
        Add Site
      </a>
    </div>
  {/if}
</div>

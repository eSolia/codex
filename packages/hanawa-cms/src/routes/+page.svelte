<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>Dashboard | Hanawa CMS</title>
</svelte:head>

<div class="space-y-8">
  <!-- Header -->
  <div>
    <h1 class="text-3xl font-bold text-esolia-navy">Dashboard</h1>
    <p class="mt-2 text-gray-600">
      Welcome to Hanawa CMS — eSolia's centralized content management system.
    </p>
  </div>

  <!-- Quick Stats -->
  <div class="grid grid-cols-1 md:grid-cols-4 gap-6">
    <div class="bg-white rounded-lg shadow p-6">
      <div class="text-sm font-medium text-gray-500">Sites</div>
      <div class="mt-2 text-3xl font-bold text-esolia-navy">
        {data.stats?.sites ?? 0}
      </div>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <div class="text-sm font-medium text-gray-500">Content Items</div>
      <div class="mt-2 text-3xl font-bold text-esolia-navy">
        {data.stats?.content ?? 0}
      </div>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <div class="text-sm font-medium text-gray-500">Fragments</div>
      <div class="mt-2 text-3xl font-bold text-esolia-navy">
        {data.stats?.fragments ?? 0}
      </div>
    </div>
    <div class="bg-white rounded-lg shadow p-6">
      <div class="text-sm font-medium text-gray-500">Assets</div>
      <div class="mt-2 text-3xl font-bold text-esolia-navy">
        {data.stats?.assets ?? 0}
      </div>
    </div>
  </div>

  <!-- Recent Activity -->
  <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
    <!-- Recent Content -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Recent Content</h2>
      </div>
      <div class="divide-y divide-gray-200">
        {#if data.recentContent && data.recentContent.length > 0}
          {#each data.recentContent as item}
            <a
              href="/content/{item.id}"
              class="block px-6 py-4 hover:bg-gray-50 transition-colors"
            >
              <div class="flex items-center justify-between">
                <div>
                  <div class="font-medium text-gray-900">{item.title}</div>
                  <div class="text-sm text-gray-500">{item.slug}</div>
                </div>
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                    {item.status === 'published'
                    ? 'bg-green-100 text-green-800'
                    : item.status === 'draft'
                      ? 'bg-gray-100 text-gray-800'
                      : 'bg-yellow-100 text-yellow-800'}"
                >
                  {item.status}
                </span>
              </div>
            </a>
          {/each}
        {:else}
          <div class="px-6 py-8 text-center text-gray-500">
            No content yet.
            <a href="/content/new" class="text-esolia-navy hover:underline"
              >Create your first content</a
            >
          </div>
        {/if}
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white rounded-lg shadow">
      <div class="px-6 py-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Quick Actions</h2>
      </div>
      <div class="p-6 space-y-4">
        <a
          href="/content/new"
          class="block w-full px-4 py-3 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors text-center font-medium"
        >
          Create New Content
        </a>
        <a
          href="/fragments/new"
          class="block w-full px-4 py-3 bg-esolia-orange text-esolia-navy rounded-lg hover:bg-esolia-orange/90 transition-colors text-center font-medium"
        >
          Create New Fragment
        </a>
        <a
          href="/sites/new"
          class="block w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-center font-medium"
        >
          Add New Site
        </a>
      </div>
    </div>
  </div>
</div>

<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function getStatusClass(status: string): string {
    switch (status) {
      case "published":
        return "bg-green-100 text-green-800";
      case "draft":
        return "bg-gray-100 text-gray-800";
      case "review":
        return "bg-yellow-100 text-yellow-800";
      case "archived":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  }
</script>

<svelte:head>
  <title>Content | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-esolia-navy">Content</h1>
      <p class="mt-1 text-gray-600">Manage pages, posts, and documents</p>
    </div>
    <a
      href="/content/new"
      class="inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
    >
      <svg
        class="w-5 h-5 mr-2"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 4v16m8-8H4"
        />
      </svg>
      Create Content
    </a>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4">
    <form method="get" class="flex flex-wrap gap-4">
      <select
        name="site"
        class="rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      >
        <option value="">All Sites</option>
        {#each data.sites as site}
          <option value={site.slug}>{site.name}</option>
        {/each}
      </select>
      <select
        name="status"
        class="rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="review">Review</option>
        <option value="published">Published</option>
        <option value="archived">Archived</option>
      </select>
      <select
        name="type"
        class="rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      >
        <option value="">All Types</option>
        {#each data.contentTypes as type}
          <option value={type.slug}>{type.name}</option>
        {/each}
      </select>
      <button
        type="submit"
        class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
      >
        Filter
      </button>
    </form>
  </div>

  <!-- Content List -->
  {#if data.content && data.content.length > 0}
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Title
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Site
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Type
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Status
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Updated
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each data.content as item}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4">
                <a
                  href="/content/{item.id}"
                  class="text-esolia-navy hover:underline font-medium"
                >
                  {item.title}
                </a>
                <div class="text-sm text-gray-500">{item.slug}</div>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                {item.site_name ?? "—"}
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                {item.content_type_name ?? "—"}
              </td>
              <td class="px-6 py-4">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusClass(
                    item.status
                  )}"
                >
                  {item.status}
                </span>
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                {new Date(item.updated_at).toLocaleDateString()}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
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
      <h3 class="mt-4 text-lg font-medium text-gray-900">No content yet</h3>
      <p class="mt-2 text-gray-500">
        Start creating content for your sites.
      </p>
      <a
        href="/content/new"
        class="mt-4 inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
      >
        Create Content
      </a>
    </div>
  {/if}
</div>

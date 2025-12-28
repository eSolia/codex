<script lang="ts">
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  function formatFileSize(bytes: number): string {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  }

  function getFileIcon(mimeType: string): string {
    if (mimeType.startsWith("image/")) return "🖼️";
    if (mimeType.startsWith("video/")) return "🎬";
    if (mimeType.startsWith("audio/")) return "🎵";
    if (mimeType === "application/pdf") return "📄";
    return "📁";
  }
</script>

<svelte:head>
  <title>Assets | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-esolia-navy">Assets</h1>
      <p class="mt-1 text-gray-600">Images, documents, and media files</p>
    </div>
    <button
      type="button"
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
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
        />
      </svg>
      Upload
    </button>
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
        name="type"
        class="rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      >
        <option value="">All Types</option>
        <option value="image">Images</option>
        <option value="video">Videos</option>
        <option value="audio">Audio</option>
        <option value="application">Documents</option>
      </select>
      <button
        type="submit"
        class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
      >
        Filter
      </button>
    </form>
  </div>

  <!-- Assets Grid -->
  {#if data.assets && data.assets.length > 0}
    <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
      {#each data.assets as asset}
        <div
          class="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden group"
        >
          <div
            class="aspect-square bg-gray-100 flex items-center justify-center"
          >
            {#if asset.mime_type.startsWith("image/")}
              <div
                class="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400"
              >
                <svg
                  class="w-12 h-12"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
              </div>
            {:else}
              <span class="text-4xl">{getFileIcon(asset.mime_type)}</span>
            {/if}
          </div>
          <div class="p-3">
            <p
              class="text-sm font-medium text-gray-900 truncate"
              title={asset.filename}
            >
              {asset.filename}
            </p>
            <div class="flex items-center justify-between mt-1">
              <span class="text-xs text-gray-500">
                {formatFileSize(asset.size)}
              </span>
              {#if asset.site_name}
                <span class="text-xs text-gray-400">{asset.site_name}</span>
              {/if}
            </div>
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
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <h3 class="mt-4 text-lg font-medium text-gray-900">No assets yet</h3>
      <p class="mt-2 text-gray-500">Upload images and files for your content.</p>
      <button
        type="button"
        class="mt-4 inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
      >
        Upload Files
      </button>
    </div>
  {/if}
</div>

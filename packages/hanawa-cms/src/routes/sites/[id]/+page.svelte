<script lang="ts">
  import type { PageData } from './$types';
  import Globe from 'phosphor-svelte/lib/Globe';
  import Folder from 'phosphor-svelte/lib/Folder';
  import Article from 'phosphor-svelte/lib/Article';
  import Clock from 'phosphor-svelte/lib/Clock';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import Translate from 'phosphor-svelte/lib/Translate';

  let { data }: { data: PageData } = $props();
</script>

<svelte:head>
  <title>{data.site.name} | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Back Link & Header -->
  <div>
    <a
      href="/sites"
      class="inline-flex items-center text-sm text-gray-500 hover:text-gray-700 mb-4"
    >
      <ArrowLeft size={16} class="mr-1" />
      Back to Sites
    </a>

    <div class="flex items-start justify-between">
      <div>
        <h1 class="text-3xl font-bold text-esolia-navy">{data.site.name}</h1>
        <p class="mt-1 text-gray-500">{data.site.slug}</p>
      </div>
    </div>
  </div>

  <!-- Site Info Card -->
  <div class="bg-white rounded-lg shadow p-6">
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      {#if data.site.domain}
        <div class="flex items-center gap-3">
          <div
            class="flex-shrink-0 w-10 h-10 bg-esolia-navy/10 rounded-lg flex items-center justify-center"
          >
            <Globe size={20} class="text-esolia-navy" />
          </div>
          <div>
            <p class="text-sm text-gray-500">Domain</p>
            <a
              href="https://{data.site.domain}"
              target="_blank"
              rel="noopener noreferrer"
              class="text-esolia-navy hover:underline"
            >
              {data.site.domain}
            </a>
          </div>
        </div>
      {/if}

      <div class="flex items-center gap-3">
        <div
          class="flex-shrink-0 w-10 h-10 bg-esolia-navy/10 rounded-lg flex items-center justify-center"
        >
          <Folder size={20} class="text-esolia-navy" />
        </div>
        <div>
          <p class="text-sm text-gray-500">Content Types</p>
          <p class="font-medium">{data.contentTypes.length}</p>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <div
          class="flex-shrink-0 w-10 h-10 bg-esolia-navy/10 rounded-lg flex items-center justify-center"
        >
          <Translate size={20} class="text-esolia-navy" />
        </div>
        <div>
          <p class="text-sm text-gray-500">Default Language</p>
          <p class="font-medium">{data.site.default_language?.toUpperCase() ?? 'JA'}</p>
        </div>
      </div>
    </div>

    {#if data.site.description}
      <div class="mt-6 pt-6 border-t">
        <p class="text-gray-600">{data.site.description}</p>
      </div>
    {/if}
  </div>

  <!-- Content Types -->
  <div class="bg-white rounded-lg shadow">
    <div class="px-6 py-4 border-b flex items-center justify-between">
      <h2 class="text-lg font-semibold text-gray-900">Content Types</h2>
      <a
        href="/sites/{data.site.id}/content-types/new"
        class="text-sm text-esolia-navy hover:underline"
      >
        Add Content Type
      </a>
    </div>

    {#if data.contentTypes.length > 0}
      <div class="divide-y">
        {#each data.contentTypes as contentType}
          <a
            href="/content-types/{contentType.id}"
            class="block px-6 py-4 hover:bg-gray-50 transition-colors"
          >
            <div class="flex items-center gap-3">
              <Folder size={20} class="text-gray-400" />
              <div>
                <p class="font-medium text-gray-900">{contentType.name}</p>
                {#if contentType.description}
                  <p class="text-sm text-gray-500">{contentType.description}</p>
                {/if}
              </div>
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <div class="px-6 py-8 text-center text-gray-500">
        <Folder size={32} class="mx-auto mb-2 text-gray-300" />
        <p>No content types yet</p>
      </div>
    {/if}
  </div>

  <!-- Recent Content -->
  <div class="bg-white rounded-lg shadow">
    <div class="px-6 py-4 border-b">
      <h2 class="text-lg font-semibold text-gray-900">Recent Content</h2>
    </div>

    {#if data.recentContent.length > 0}
      <div class="divide-y">
        {#each data.recentContent as doc}
          <a href="/content/{doc.id}" class="block px-6 py-4 hover:bg-gray-50 transition-colors">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <Article size={20} class="text-gray-400" />
                <div>
                  <p class="font-medium text-gray-900">{doc.title}</p>
                  <p class="text-sm text-gray-500">{doc.content_type_name}</p>
                </div>
              </div>
              <div class="flex items-center gap-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium
                    {doc.status === 'published'
                    ? 'bg-green-100 text-green-800'
                    : doc.status === 'draft'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'}"
                >
                  {doc.status}
                </span>
                <span class="flex items-center text-xs text-gray-400">
                  <Clock size={14} class="mr-1" />
                  {new Date(doc.updated_at).toLocaleDateString()}
                </span>
              </div>
            </div>
          </a>
        {/each}
      </div>
    {:else}
      <div class="px-6 py-8 text-center text-gray-500">
        <Article size={32} class="mx-auto mb-2 text-gray-300" />
        <p>No content yet</p>
      </div>
    {/if}
  </div>
</div>

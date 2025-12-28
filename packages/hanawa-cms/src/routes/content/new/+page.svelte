<script lang="ts">
  /**
   * New Content Page
   * Create new content with initial settings
   */
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let title = $state('');
  let slug = $state('');
  let siteId = $state('');
  let contentTypeId = $state('');
  let sensitivity = $state('normal');
  let language = $state('en');
  let isSubmitting = $state(false);

  // Filter content types by selected site
  let filteredContentTypes = $derived(
    siteId ? data.contentTypes.filter((ct) => ct.site_id === siteId) : data.contentTypes
  );

  // Auto-generate slug from title
  function generateSlug() {
    slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
</script>

<svelte:head>
  <title>New Content | Hanawa CMS</title>
</svelte:head>

<div class="max-w-2xl mx-auto">
  <div class="flex items-center gap-4 mb-6">
    <a href="/content" class="text-gray-500 hover:text-gray-700"> ← Back to Content </a>
  </div>

  <div class="bg-white rounded-lg shadow p-6">
    <h1 class="text-2xl font-bold text-esolia-navy mb-6">Create New Content</h1>

    {#if form?.message}
      <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
        {form.message}
      </div>
    {/if}

    <form
      method="POST"
      action="?/create"
      use:enhance={() => {
        isSubmitting = true;
        return async ({ update }) => {
          isSubmitting = false;
          await update();
        };
      }}
    >
      <div class="space-y-6">
        <!-- Title -->
        <div>
          <label for="title" class="block text-sm font-medium text-gray-700">
            Title <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            bind:value={title}
            onblur={() => !slug && generateSlug()}
            required
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
            placeholder="Enter content title..."
          />
        </div>

        <!-- Slug -->
        <div>
          <label for="slug" class="block text-sm font-medium text-gray-700">
            Slug <span class="text-red-500">*</span>
          </label>
          <div class="mt-1 flex rounded-md shadow-sm">
            <span
              class="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm"
            >
              /
            </span>
            <input
              type="text"
              id="slug"
              name="slug"
              bind:value={slug}
              required
              pattern="[a-z0-9\-]+"
              class="flex-1 block w-full rounded-none rounded-r-md border-gray-300 focus:border-esolia-navy focus:ring-esolia-navy"
              placeholder="url-friendly-slug"
            />
          </div>
          <p class="mt-1 text-xs text-gray-500">Only lowercase letters, numbers, and hyphens</p>
        </div>

        <!-- Site -->
        <div>
          <label for="site_id" class="block text-sm font-medium text-gray-700">
            Site <span class="text-red-500">*</span>
          </label>
          <select
            id="site_id"
            name="site_id"
            bind:value={siteId}
            required
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          >
            <option value="">Select a site...</option>
            {#each data.sites as site}
              <option value={site.id}>{site.name}</option>
            {/each}
          </select>
        </div>

        <!-- Content Type -->
        <div>
          <label for="content_type_id" class="block text-sm font-medium text-gray-700">
            Content Type <span class="text-red-500">*</span>
          </label>
          <select
            id="content_type_id"
            name="content_type_id"
            bind:value={contentTypeId}
            required
            disabled={!siteId}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy disabled:bg-gray-100"
          >
            <option value="">
              {siteId ? 'Select content type...' : 'Select a site first'}
            </option>
            {#each filteredContentTypes as type}
              <option value={type.id}>{type.name}</option>
            {/each}
          </select>
        </div>

        <!-- Language -->
        <div>
          <label for="language" class="block text-sm font-medium text-gray-700">
            Primary Language
          </label>
          <select
            id="language"
            name="language"
            bind:value={language}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          >
            <option value="en">English</option>
            <option value="ja">日本語</option>
          </select>
        </div>

        <!-- Sensitivity -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2"> Sensitivity Level </label>
          <div class="space-y-2">
            <label
              class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                type="radio"
                name="sensitivity"
                value="normal"
                bind:group={sensitivity}
                class="mt-1"
              />
              <div>
                <div class="font-medium text-gray-900">Normal</div>
                <div class="text-sm text-gray-500">
                  Standard content, preview available immediately
                </div>
              </div>
            </label>
            <label
              class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                type="radio"
                name="sensitivity"
                value="confidential"
                bind:group={sensitivity}
                class="mt-1"
              />
              <div>
                <div class="font-medium text-yellow-800">Confidential</div>
                <div class="text-sm text-gray-500">
                  Preview requires approval, content is watermarked
                </div>
              </div>
            </label>
            <label
              class="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-gray-50"
            >
              <input
                type="radio"
                name="sensitivity"
                value="embargoed"
                bind:group={sensitivity}
                class="mt-1"
              />
              <div>
                <div class="font-medium text-red-800">Embargoed</div>
                <div class="text-sm text-gray-500">
                  No preview until embargo lifts, maximum security measures
                </div>
              </div>
            </label>
          </div>
        </div>

        <!-- Actions -->
        <div class="flex gap-3 pt-4 border-t">
          <button
            type="submit"
            disabled={isSubmitting}
            class="flex-1 px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium disabled:opacity-50"
          >
            {isSubmitting ? 'Creating...' : 'Create Content'}
          </button>
          <a href="/content" class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">
            Cancel
          </a>
        </div>
      </div>
    </form>
  </div>
</div>

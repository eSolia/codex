<script lang="ts">
  import { enhance } from '$app/forms';

  let activeTab = $state<'en' | 'ja'>('en');
  let name = $state('');
  let category = $state('');
  let description = $state('');
  let contentEn = $state('');
  let contentJa = $state('');
  let tagsInput = $state('');
  let isSubmitting = $state(false);
</script>

<svelte:head>
  <title>New Fragment | Hanawa CMS</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-6">
  <!-- Breadcrumb -->
  <nav class="flex items-center space-x-2 text-sm text-gray-500">
    <a href="/fragments" class="hover:text-esolia-navy">Fragments</a>
    <span>/</span>
    <span class="text-gray-900">New</span>
  </nav>

  <!-- Header -->
  <div>
    <h1 class="text-3xl font-bold text-esolia-navy">Create New Fragment</h1>
    <p class="mt-1 text-gray-600">Reusable content block for proposals and documents</p>
  </div>

  <form
    method="POST"
    use:enhance={() => {
      isSubmitting = true;
      return async ({ update }) => {
        await update();
        isSubmitting = false;
      };
    }}
  >
    <!-- Basic Info -->
    <div class="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 class="text-lg font-semibold text-gray-900">Basic Information</h2>

      <div>
        <label for="name" class="block text-sm font-medium text-gray-700">
          Name <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="name"
          name="name"
          bind:value={name}
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          placeholder="e.g., Microsoft 365 Business Premium Overview"
        />
        <p class="mt-1 text-sm text-gray-500">
          Slug will be generated: <code class="bg-gray-100 px-1 rounded"
            >{name
              .toLowerCase()
              .trim()
              .replace(/[^\w\s-]/g, '')
              .replace(/[\s_-]+/g, '-') || 'fragment-slug'}</code
          >
        </p>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="category" class="block text-sm font-medium text-gray-700">Category</label>
          <input
            type="text"
            id="category"
            name="category"
            bind:value={category}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
            placeholder="e.g., products, services, proposals"
          />
        </div>
        <div>
          <label for="tags" class="block text-sm font-medium text-gray-700"
            >Tags (comma-separated)</label
          >
          <input
            type="text"
            id="tags"
            name="tags"
            bind:value={tagsInput}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
            placeholder="e.g., m365, security, compliance"
          />
        </div>
      </div>

      <div>
        <label for="description" class="block text-sm font-medium text-gray-700">Description</label>
        <textarea
          id="description"
          name="description"
          bind:value={description}
          rows="2"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          placeholder="Brief description of this fragment..."
        ></textarea>
      </div>
    </div>

    <!-- Content Tabs -->
    <div class="bg-white rounded-lg shadow mt-6">
      <div class="border-b border-gray-200">
        <nav class="flex -mb-px">
          <button
            type="button"
            class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
            class:border-esolia-navy={activeTab === 'en'}
            class:text-esolia-navy={activeTab === 'en'}
            class:border-transparent={activeTab !== 'en'}
            class:text-gray-500={activeTab !== 'en'}
            class:hover:text-gray-700={activeTab !== 'en'}
            onclick={() => (activeTab = 'en')}
          >
            English
            {#if contentEn}
              <span class="ml-1 text-xs text-green-600">(has content)</span>
            {/if}
          </button>
          <button
            type="button"
            class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
            class:border-esolia-navy={activeTab === 'ja'}
            class:text-esolia-navy={activeTab === 'ja'}
            class:border-transparent={activeTab !== 'ja'}
            class:text-gray-500={activeTab !== 'ja'}
            class:hover:text-gray-700={activeTab !== 'ja'}
            onclick={() => (activeTab = 'ja')}
          >
            Japanese
            {#if contentJa}
              <span class="ml-1 text-xs text-green-600">(has content)</span>
            {/if}
          </button>
        </nav>
      </div>

      <div class="p-6">
        {#if activeTab === 'en'}
          <textarea
            name="content_en"
            bind:value={contentEn}
            rows="15"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
            placeholder="English content (Markdown supported)..."
          ></textarea>
        {:else}
          <textarea
            name="content_ja"
            bind:value={contentJa}
            rows="15"
            class="w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
            placeholder="Japanese content (Markdown supported)..."
          ></textarea>
        {/if}
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-between items-center mt-6">
      <a href="/fragments" class="text-gray-600 hover:text-gray-800"> Cancel </a>
      <button
        type="submit"
        disabled={!name.trim() || isSubmitting}
        class="inline-flex items-center px-6 py-2 bg-esolia-orange text-esolia-navy rounded-lg hover:bg-esolia-orange/90 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {#if isSubmitting}
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
            ></circle>
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Creating...
        {:else}
          Create Fragment
        {/if}
      </button>
    </div>
  </form>
</div>

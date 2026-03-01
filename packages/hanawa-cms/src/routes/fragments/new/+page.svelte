<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();

  let titleEn = $state('');
  let titleJa = $state('');
  let id = $state('');
  let category = $state('');
  let type = $state('');
  let tagsInput = $state('');
  let isSubmitting = $state(false);
  let idManuallySet = $state(false);

  // Auto-generate ID from English title
  let autoId = $derived(
    titleEn
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 80)
  );

  // Use auto-generated ID unless manually overridden
  let effectiveId = $derived(idManuallySet ? id : autoId);
</script>

<svelte:head>
  <title>New Fragment | Hanawa CMS</title>
</svelte:head>

<div class="max-w-3xl mx-auto space-y-6">
  <!-- Breadcrumb -->
  <nav class="flex items-center space-x-2 text-sm text-gray-500">
    <a href="/fragments" class="hover:text-esolia-navy">Fragments</a>
    <span>/</span>
    <span class="text-gray-900">New</span>
  </nav>

  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-esolia-navy">Create New Fragment</h1>
    <p class="mt-1 text-gray-600">Reusable content block for proposals and documents</p>
  </div>

  {#if form?.form?.message}
    <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
      Error: {form.form.message}
    </div>
  {/if}

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
    <div class="bg-white rounded-lg shadow p-6 space-y-4">
      <!-- Title EN (required) -->
      <div>
        <label for="title_en" class="block text-sm font-medium text-gray-700">
          English Title <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title_en"
          name="title_en"
          bind:value={titleEn}
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          placeholder="e.g., Microsoft 365 Business Premium Overview"
        />
      </div>

      <!-- Title JA (optional) -->
      <div>
        <label for="title_ja" class="block text-sm font-medium text-gray-700">Japanese Title</label>
        <input
          type="text"
          id="title_ja"
          name="title_ja"
          bind:value={titleJa}
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          placeholder="日本語タイトル（任意）"
        />
      </div>

      <!-- ID -->
      <div>
        <label for="id" class="block text-sm font-medium text-gray-700">
          Fragment ID <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="id"
          name="id"
          value={effectiveId}
          oninput={(e) => {
            id = (e.target as HTMLInputElement).value;
            idManuallySet = true;
          }}
          required
          pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
          placeholder="auto-generated-from-title"
        />
        <p class="mt-1 text-xs text-gray-500">
          {#if !idManuallySet}
            Auto-generated from title. Click to override.
          {:else}
            Custom ID.
            <button
              type="button"
              class="text-esolia-navy underline"
              onclick={() => (idManuallySet = false)}
            >
              Reset to auto
            </button>
          {/if}
        </p>
      </div>

      <!-- Category + Type -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="category" class="block text-sm font-medium text-gray-700">Category</label>
          <input
            type="text"
            id="category"
            name="category"
            bind:value={category}
            list="category-suggestions"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
            placeholder="e.g., products, services"
          />
          <datalist id="category-suggestions">
            <option value="capabilities"></option>
            <option value="closing"></option>
            <option value="company"></option>
            <option value="comparisons"></option>
            <option value="diagrams"></option>
            <option value="products"></option>
            <option value="proposals"></option>
            <option value="services"></option>
            <option value="terms"></option>
          </datalist>
        </div>
        <div>
          <label for="type" class="block text-sm font-medium text-gray-700">Type</label>
          <input
            type="text"
            id="type"
            name="type"
            bind:value={type}
            list="type-suggestions"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
            placeholder="e.g., content, diagram"
          />
          <datalist id="type-suggestions">
            <option value="capability-description"></option>
            <option value="content"></option>
            <option value="diagram"></option>
            <option value="product-overview"></option>
            <option value="proposal-section"></option>
            <option value="service-description"></option>
          </datalist>
        </div>
      </div>

      <!-- Tags -->
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

    <!-- Actions -->
    <div class="flex justify-between items-center mt-6">
      <a href="/fragments" class="text-gray-600 hover:text-gray-800"> Cancel </a>
      <button
        type="submit"
        disabled={!titleEn.trim() || !effectiveId || isSubmitting}
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

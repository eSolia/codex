<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();

  let title = $state('');
  let slug = $state('');
  let category = $state('');
  let tagsInput = $state('');
  let summary = $state('');
  let isSubmitting = $state(false);
  let slugManuallySet = $state(false);

  // Auto-generate slug from title
  let autoSlug = $derived(
    title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 120)
  );

  // Use auto-generated slug unless manually overridden
  let effectiveSlug = $derived(slugManuallySet ? slug : autoSlug);
</script>

<svelte:head>
  <title>New Standard | Hanawa CMS</title>
</svelte:head>

<div class="max-w-3xl mx-auto space-y-6">
  <!-- Breadcrumb -->
  <nav class="flex items-center space-x-2 text-sm text-gray-500">
    <a href="/standards" class="hover:text-esolia-navy">Standards</a>
    <span>/</span>
    <span class="text-gray-900">New</span>
  </nav>

  <!-- Header -->
  <div>
    <h1 class="text-2xl font-bold text-esolia-navy">Create New Standard</h1>
    <p class="mt-1 text-gray-600">Coding or workflow standard for eSolia projects</p>
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
      <!-- Title (required) -->
      <div>
        <label for="title" class="block text-sm font-medium text-gray-700">
          Title <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="title"
          name="title"
          bind:value={title}
          required
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          placeholder="e.g., SvelteKit Development Guide"
        />
      </div>

      <!-- Slug -->
      <div>
        <label for="slug" class="block text-sm font-medium text-gray-700">
          Slug <span class="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="slug"
          name="slug"
          value={effectiveSlug}
          oninput={(e) => {
            slug = (e.target as HTMLInputElement).value;
            slugManuallySet = true;
          }}
          required
          pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
          placeholder="auto-generated-from-title"
        />
        <p class="mt-1 text-xs text-gray-500">
          {#if !slugManuallySet}
            Auto-generated from title. Click to override.
          {:else}
            Custom slug.
            <button
              type="button"
              class="text-esolia-navy underline"
              onclick={() => (slugManuallySet = false)}
            >
              Reset to auto
            </button>
          {/if}
        </p>
      </div>

      <!-- Category -->
      <div>
        <label for="category" class="block text-sm font-medium text-gray-700">Category</label>
        <input
          type="text"
          id="category"
          name="category"
          bind:value={category}
          list="category-suggestions"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          placeholder="e.g., guides, reference"
        />
        <datalist id="category-suggestions">
          <option value="guides"></option>
          <option value="reference"></option>
          <option value="prompts"></option>
          <option value="seo"></option>
          <option value="security"></option>
          <option value="workflow"></option>
        </datalist>
      </div>

      <!-- Summary -->
      <div>
        <label for="summary" class="block text-sm font-medium text-gray-700">Summary</label>
        <textarea
          id="summary"
          name="summary"
          bind:value={summary}
          rows="2"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
          placeholder="Brief description of what this standard covers"
        ></textarea>
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
          placeholder="e.g., sveltekit, typescript, security"
        />
      </div>
    </div>

    <!-- Actions -->
    <div class="flex justify-between items-center mt-6">
      <a href="/standards" class="text-gray-600 hover:text-gray-800"> Cancel </a>
      <button
        type="submit"
        disabled={!title.trim() || !effectiveSlug || isSubmitting}
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
          Create Standard
        {/if}
      </button>
    </div>
  </form>
</div>

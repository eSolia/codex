<script lang="ts">
  /**
   * Standard Edit Page
   * Two-column layout: metadata panel + markdown editor (single language)
   */
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import HanawaEditor from '$lib/components/editor/HanawaEditor.svelte';
  import { browser } from '$app/environment';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Form state — initialized from data
  let title = $state('');
  let category = $state('');
  let status = $state('production');
  let tagsInput = $state('');
  let summary = $state('');
  let author = $state('');
  let content = $state('');

  // UI state
  let showDeleteConfirm = $state(false);
  let showRenameModal = $state(false);
  let newSlug = $state('');
  let isSaving = $state(false);
  let metadataCollapsed = $state(false);

  // Initialize form state from data
  $effect(() => {
    title = data.standard.title || '';
    category = data.standard.category || '';
    status = data.standard.status || 'production';
    tagsInput = (data.standard.tags || []).join(', ');
    summary = data.standard.summary || '';
    author = data.standard.author || '';
    content = data.standard.content || '';
  });

  function formatTags(): string {
    const tags = tagsInput
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
    return JSON.stringify(tags);
  }

  // Status options
  const statusOptions = ['production', 'draft', 'deprecated', 'archived'];

  // Get status badge style
  function getStatusStyle(s: string): string {
    switch (s) {
      case 'production':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'deprecated':
        return 'bg-red-100 text-red-800';
      case 'archived':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }
</script>

<svelte:head>
  <title>{data.standard.title || data.standard.slug} | Standards | Hanawa CMS</title>
</svelte:head>

<div class="space-y-4">
  <!-- Breadcrumb -->
  <nav class="flex items-center space-x-2 text-sm text-gray-500">
    <a href="/standards" class="hover:text-esolia-navy">Standards</a>
    <span>/</span>
    <span class="text-gray-900">{data.standard.title || data.standard.slug}</span>
  </nav>

  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-2xl font-bold text-esolia-navy">
        {data.standard.title || data.standard.slug}
      </h1>
      <div class="flex items-center gap-2 mt-1">
        <code class="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600"
          >{data.standard.slug}</code
        >
        {#if data.standard.category}
          <span class="text-xs text-gray-400">in</span>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-teal-100 text-teal-800"
          >
            {data.standard.category}
          </span>
        {/if}
        <span
          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getStatusStyle(
            data.standard.status
          )}"
        >
          {data.standard.status}
        </span>
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={() => {
          newSlug = data.standard.slug;
          showRenameModal = true;
        }}
        class="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
      >
        Rename
      </button>
      <button
        type="button"
        onclick={() => (showDeleteConfirm = true)}
        class="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-sm"
      >
        Delete
      </button>
    </div>
  </div>

  <!-- Feedback messages -->
  {#if form?.success}
    <div class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
      Standard saved successfully.
    </div>
  {:else if form?.saveForm?.message}
    <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
      Error: {form.saveForm.message}
    </div>
  {:else if form?.renameForm?.message}
    <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
      Rename error: {form.renameForm.message}
    </div>
  {/if}

  <!-- Main form -->
  <form
    method="POST"
    action="?/save"
    use:enhance={() => {
      isSaving = true;
      return async ({ update }) => {
        await update();
        isSaving = false;
      };
    }}
  >
    <!-- Two-column layout -->
    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <!-- Left column: Metadata Panel -->
      <div class="space-y-4">
        <div class="bg-white rounded-lg shadow">
          <button
            type="button"
            class="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-100"
            onclick={() => (metadataCollapsed = !metadataCollapsed)}
          >
            Metadata
            <svg
              class="w-4 h-4 transition-transform {metadataCollapsed ? '' : 'rotate-180'}"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {#if !metadataCollapsed}
            <div class="p-4 space-y-3">
              <!-- Title -->
              <div>
                <label
                  for="title"
                  class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >Title</label
                >
                <input
                  type="text"
                  id="title"
                  name="title"
                  bind:value={title}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  placeholder="Standard title"
                />
              </div>

              <!-- Category -->
              <div>
                <label
                  for="category"
                  class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >Category</label
                >
                <input
                  type="text"
                  id="category"
                  name="category"
                  bind:value={category}
                  list="category-suggestions"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
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
                <label
                  for="summary"
                  class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >Summary</label
                >
                <textarea
                  id="summary"
                  name="summary"
                  bind:value={summary}
                  rows="2"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  placeholder="Brief description"
                ></textarea>
              </div>

              <!-- Status -->
              <div>
                <label
                  for="status"
                  class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >Status</label
                >
                <select
                  id="status"
                  name="status"
                  bind:value={status}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                >
                  {#each statusOptions as opt}
                    <option value={opt}>{opt}</option>
                  {/each}
                </select>
              </div>

              <!-- Tags -->
              <div>
                <label
                  for="tags"
                  class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >Tags (comma-separated)</label
                >
                <input
                  type="text"
                  id="tags"
                  bind:value={tagsInput}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  placeholder="sveltekit, typescript, security"
                />
                <input type="hidden" name="tags" value={formatTags()} />
              </div>

              <!-- Author -->
              <div>
                <label
                  for="author"
                  class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >Author</label
                >
                <input
                  type="text"
                  id="author"
                  name="author"
                  bind:value={author}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                />
              </div>

              <!-- Timestamps -->
              {#if data.standard.created_at || data.standard.updated_at}
                <div class="pt-2 border-t border-gray-100 text-xs text-gray-400">
                  {#if data.standard.created_at}
                    <p>Created: {data.standard.created_at}</p>
                  {/if}
                  {#if data.standard.updated_at}
                    <p>Updated: {data.standard.updated_at}</p>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Save & Actions -->
        <div class="flex flex-col gap-2">
          <button
            type="submit"
            disabled={isSaving}
            class="w-full px-4 py-2 bg-esolia-orange text-esolia-navy rounded-lg hover:bg-esolia-orange/90 transition-colors font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Standard'}
          </button>
        </div>
      </div>

      <!-- Right column: Content Editor -->
      <div class="bg-white rounded-lg shadow">
        <!-- Header bar -->
        <div class="border-b border-gray-200 px-6 py-3">
          <h3 class="text-sm font-medium text-gray-900">Content (Markdown)</h3>
        </div>

        <!-- Editor area -->
        <div class="p-4">
          <!-- Hidden input for form submission -->
          <input type="hidden" name="content" value={content} />

          <div class="min-h-[500px]">
            {#if browser}
              <HanawaEditor
                bind:content
                contentType="markdown"
                placeholder="Start writing the standard content..."
              />
            {:else}
              <textarea
                bind:value={content}
                rows="25"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
                placeholder="Standard content (Markdown)..."
              ></textarea>
            {/if}
          </div>
        </div>
      </div>
    </div>
  </form>
</div>

<!-- Rename Modal -->
{#if showRenameModal}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full">
      <h3 class="text-lg font-semibold text-gray-900">Rename Standard</h3>

      <form method="POST" action="?/rename" use:enhance>
        <div class="mt-4 space-y-3">
          <div>
            <label for="new_slug" class="block text-sm font-medium text-gray-700">New Slug</label>
            <input
              type="text"
              id="new_slug"
              name="new_slug"
              bind:value={newSlug}
              pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
              placeholder="new-standard-slug"
            />
            <p class="mt-1 text-xs text-gray-500">Lowercase letters, numbers, hyphens only</p>
          </div>

          <!-- Preview -->
          <div class="bg-gray-50 rounded-lg p-3 text-sm">
            <p class="text-gray-500">R2 key change:</p>
            <p class="font-mono text-xs mt-1">
              <span class="text-red-500 line-through">standards/{data.standard.slug}.md</span>
            </p>
            <p class="font-mono text-xs">
              <span class="text-green-600">standards/{newSlug}.md</span>
            </p>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onclick={() => (showRenameModal = false)}
            class="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!newSlug || newSlug === data.standard.slug}
            class="px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors disabled:opacity-50"
          >
            Rename
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
      <h3 class="text-lg font-semibold text-gray-900">Delete Standard</h3>
      <p class="mt-2 text-gray-600">
        Are you sure you want to delete "{data.standard.title || data.standard.slug}"? This will
        remove the standard from R2 and the index. This action cannot be undone.
      </p>
      <div class="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onclick={() => (showDeleteConfirm = false)}
          class="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
        <form method="POST" action="?/delete" use:enhance>
          <input type="hidden" name="confirm" value="delete" />
          <button
            type="submit"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

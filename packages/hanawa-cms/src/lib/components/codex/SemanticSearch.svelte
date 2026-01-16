<script lang="ts">
  /**
   * Semantic Search Component
   * InfoSec: AI-powered content search using vector embeddings, XSS prevention
   */

  import { highlightSearchMatch } from '$lib/sanitize';

  interface SearchResult {
    documentId: string;
    chunkId: string;
    content: string;
    score: number;
    metadata: {
      collection: string;
      title: string;
      headingPath?: string;
      locale: string;
    };
  }

  interface Props {
    placeholder?: string;
    collection?: string;
    locale?: string;
    onSelect?: (result: SearchResult) => void;
  }

  let { placeholder = 'Search knowledge base...', collection, locale, onSelect }: Props = $props();

  let query = $state('');
  let results = $state<SearchResult[]>([]);
  let searching = $state(false);
  let error = $state<string | null>(null);
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  function debounce(fn: () => void, delay: number) {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(fn, delay);
  }

  async function search() {
    if (query.length < 3) {
      results = [];
      return;
    }

    searching = true;
    error = null;

    try {
      const params = new URLSearchParams({ q: query });
      if (collection) params.set('collection', collection);
      if (locale) params.set('locale', locale);

      const response = await fetch(`/api/codex/search?${params}`);

      if (!response.ok) {
        throw new Error('Search failed');
      }

      results = await response.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
      results = [];
    } finally {
      searching = false;
    }
  }

  function handleInput() {
    debounce(search, 300);
  }

  function handleSelect(result: SearchResult) {
    if (onSelect) {
      onSelect(result);
    }
  }

  function getScoreLabel(score: number): string {
    if (score >= 0.9) return 'Excellent';
    if (score >= 0.8) return 'Very Good';
    if (score >= 0.7) return 'Good';
    return 'Partial';
  }

  function getScoreColor(score: number): string {
    if (score >= 0.9) return 'bg-green-100 text-green-700';
    if (score >= 0.8) return 'bg-emerald-100 text-emerald-700';
    if (score >= 0.7) return 'bg-blue-100 text-blue-700';
    return 'bg-gray-100 text-gray-600';
  }
</script>

<div class="semantic-search">
  <!-- Search input -->
  <div class="relative">
    <div class="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
      {#if searching}
        <svg class="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle
            class="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            stroke-width="4"
          />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      {:else}
        <svg class="h-4 w-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      {/if}
    </div>
    <input
      type="text"
      bind:value={query}
      oninput={handleInput}
      {placeholder}
      class="block w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg
             text-sm placeholder-gray-400
             focus:ring-2 focus:ring-esolia-navy focus:border-transparent"
    />
  </div>

  <!-- Error -->
  {#if error}
    <div class="mt-2 px-3 py-2 text-sm text-red-600 bg-red-50 rounded-lg">
      {error}
    </div>
  {/if}

  <!-- Results -->
  {#if results.length > 0}
    <div class="mt-3 border border-gray-200 rounded-lg overflow-hidden">
      {#each results as result, index}
        <button
          type="button"
          onclick={() => handleSelect(result)}
          class="w-full text-left p-3 hover:bg-gray-50 transition-colors
                 {index > 0 ? 'border-t border-gray-100' : ''}"
        >
          <!-- Header -->
          <div class="flex items-center gap-2 mb-1">
            <svg
              class="w-4 h-4 text-gray-400 flex-shrink-0"
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
            <span class="font-medium text-sm text-gray-900 truncate flex-1">
              {result.metadata.title}
            </span>
            <span
              class="text-[10px] font-medium px-1.5 py-0.5 rounded {getScoreColor(result.score)}"
            >
              {getScoreLabel(result.score)}
            </span>
          </div>

          <!-- Excerpt -->
          <p class="text-sm text-gray-600 line-clamp-2">
            {@html highlightSearchMatch(result.content.slice(0, 200), query)}...
          </p>

          <!-- Meta -->
          <div class="flex items-center gap-2 mt-1.5">
            {#if result.metadata.headingPath}
              <span class="text-xs text-gray-400">
                {result.metadata.headingPath}
              </span>
            {/if}
            <span class="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 uppercase">
              {result.metadata.collection}
            </span>
          </div>
        </button>
      {/each}
    </div>
  {:else if query.length >= 3 && !searching && !error}
    <div class="mt-4 text-center py-6">
      <svg
        class="w-8 h-8 mx-auto text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p class="mt-2 text-sm text-gray-500">No matching content found</p>
      <p class="text-xs text-gray-400">Try different keywords or phrases</p>
    </div>
  {/if}
</div>

<style>
  :global(.semantic-search mark) {
    background-color: #fef08a;
    padding: 0 2px;
    border-radius: 2px;
  }
</style>

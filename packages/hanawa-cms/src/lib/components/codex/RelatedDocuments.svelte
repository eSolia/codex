<script lang="ts">
  /**
   * Related Documents Component
   * InfoSec: Displays semantically similar content from Codex
   */

  import { onMount } from 'svelte';

  interface RelatedDoc {
    documentId: string;
    title: string;
    score: number;
  }

  interface Props {
    documentId: string;
    maxItems?: number;
    onSelect?: (documentId: string) => void;
  }

  let { documentId, maxItems = 5, onSelect }: Props = $props();

  let related = $state<RelatedDoc[]>([]);
  let loading = $state(true);
  let error = $state<string | null>(null);

  onMount(async () => {
    await loadRelated();
  });

  async function loadRelated() {
    loading = true;
    error = null;

    try {
      const response = await fetch(`/api/codex/related/${documentId}?limit=${maxItems}`);

      if (!response.ok) {
        throw new Error('Failed to load related documents');
      }

      related = await response.json();
    } catch (e) {
      error = e instanceof Error ? e.message : 'Unknown error';
    } finally {
      loading = false;
    }
  }

  function getScoreColor(score: number): string {
    if (score >= 0.9) return 'text-green-600';
    if (score >= 0.8) return 'text-emerald-600';
    if (score >= 0.7) return 'text-blue-600';
    return 'text-gray-500';
  }
</script>

<div class="related-documents">
  <div class="flex items-center gap-2 mb-3">
    <svg class="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        stroke-linecap="round"
        stroke-linejoin="round"
        stroke-width="2"
        d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
      />
    </svg>
    <h4 class="text-sm font-medium text-gray-900">Related Documents</h4>
  </div>

  {#if loading}
    <div class="flex items-center justify-center py-6">
      <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span class="ml-2 text-sm text-gray-500">Finding related content...</span>
    </div>
  {:else if error}
    <div class="text-center py-4 text-sm text-red-600">
      {error}
    </div>
  {:else if related.length === 0}
    <div class="text-center py-6">
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <p class="mt-2 text-sm text-gray-500">No related documents found</p>
    </div>
  {:else}
    <ul class="space-y-1">
      {#each related as doc}
        <li>
          {#if onSelect}
            <button
              type="button"
              onclick={() => onSelect(doc.documentId)}
              class="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-md
                     hover:bg-gray-50 transition-colors group"
            >
              <svg
                class="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0"
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
              <span class="flex-1 text-sm text-gray-700 truncate group-hover:text-gray-900">
                {doc.title}
              </span>
              <span class="text-xs font-medium {getScoreColor(doc.score)}">
                {Math.round(doc.score * 100)}%
              </span>
            </button>
          {:else}
            <a
              href="/content/{doc.documentId}"
              class="flex items-center gap-2 px-2 py-1.5 rounded-md
                     hover:bg-gray-50 transition-colors group"
            >
              <svg
                class="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0"
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
              <span class="flex-1 text-sm text-gray-700 truncate group-hover:text-gray-900">
                {doc.title}
              </span>
              <span class="text-xs font-medium {getScoreColor(doc.score)}">
                {Math.round(doc.score * 100)}%
              </span>
            </a>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

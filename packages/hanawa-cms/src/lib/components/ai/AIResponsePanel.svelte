<script lang="ts">
  /**
   * AI Response Panel Component
   * InfoSec: Displays AI-generated content with accept/reject options
   */

  interface Props {
    visible: boolean;
    loading?: boolean;
    content?: string;
    error?: string;
    originalText?: string;
    onAccept: () => void;
    onReject: () => void;
    onRetry: () => void;
    onCopy: () => void;
  }

  let {
    visible,
    loading = false,
    content = '',
    error,
    originalText,
    onAccept,
    onReject,
    onRetry,
    onCopy,
  }: Props = $props();

  let showDiff = $state(false);
  let copied = $state(false);

  function handleCopy() {
    navigator.clipboard.writeText(content);
    copied = true;
    setTimeout(() => (copied = false), 2000);
    onCopy();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!visible) return;

    if (event.key === 'Escape') {
      onReject();
      return;
    }

    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      onAccept();
      return;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
    <div
      class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] flex flex-col"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-response-title"
    >
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <div class="flex items-center gap-2">
          <svg
            class="w-5 h-5 text-esolia-navy"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <h2 id="ai-response-title" class="text-lg font-semibold text-gray-900">AI Suggestion</h2>
        </div>

        <button
          type="button"
          onclick={onReject}
          class="p-1 text-gray-400 hover:text-gray-600 rounded"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <!-- Content -->
      <div class="flex-1 overflow-y-auto p-4">
        {#if loading}
          <div class="flex items-center justify-center py-12">
            <svg class="animate-spin h-8 w-8 text-esolia-navy" fill="none" viewBox="0 0 24 24">
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
            <span class="ml-3 text-gray-600">Generating...</span>
          </div>
        {:else if error}
          <div class="p-4 bg-red-50 border border-red-200 rounded-lg">
            <div class="flex items-center gap-2 text-red-700">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span class="font-medium">Generation failed</span>
            </div>
            <p class="mt-1 text-sm text-red-600">{error}</p>
          </div>
        {:else}
          {#if originalText && showDiff}
            <div class="mb-4">
              <div class="text-xs font-medium text-gray-500 mb-1">Original</div>
              <div
                class="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-gray-700 line-through"
              >
                {originalText}
              </div>
            </div>
          {/if}

          <div class="prose prose-sm max-w-none">
            <div class="p-4 bg-gray-50 border border-gray-200 rounded-lg whitespace-pre-wrap">
              {content}
            </div>
          </div>
        {/if}
      </div>

      <!-- Footer -->
      <div class="flex items-center justify-between p-4 border-t border-gray-200 bg-gray-50">
        <div class="flex items-center gap-2">
          {#if originalText}
            <button
              type="button"
              onclick={() => (showDiff = !showDiff)}
              class="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900
                     border border-gray-200 rounded hover:bg-white"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 5l7 7-7 7"
                />
              </svg>
              {showDiff ? 'Hide' : 'Show'} original
            </button>
          {/if}

          <button
            type="button"
            onclick={handleCopy}
            disabled={loading || !!error}
            class="flex items-center gap-1 px-2 py-1 text-xs text-gray-600 hover:text-gray-900
                   border border-gray-200 rounded hover:bg-white disabled:opacity-50"
          >
            {#if copied}
              <svg
                class="w-3.5 h-3.5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M5 13l4 4L19 7"
                />
              </svg>
              Copied
            {:else}
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
              Copy
            {/if}
          </button>
        </div>

        <div class="flex items-center gap-2">
          <button
            type="button"
            onclick={onRetry}
            disabled={loading}
            class="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900
                   border border-gray-200 rounded-md hover:bg-white disabled:opacity-50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Retry
          </button>

          <button
            type="button"
            onclick={onReject}
            class="px-3 py-1.5 text-sm text-gray-700 hover:text-gray-900
                   border border-gray-200 rounded-md hover:bg-white"
          >
            Discard
          </button>

          <button
            type="button"
            onclick={onAccept}
            disabled={loading || !!error || !content}
            class="flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white
                   bg-esolia-navy rounded-md hover:bg-esolia-navy/90 disabled:opacity-50"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            </svg>
            Accept
            <kbd class="ml-1 px-1 py-0.5 text-[10px] bg-white/20 rounded">
              {navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+↵
            </kbd>
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

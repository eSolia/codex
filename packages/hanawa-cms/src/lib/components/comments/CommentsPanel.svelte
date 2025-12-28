<script lang="ts">
  /**
   * Comments Panel Component
   * InfoSec: Sidebar panel for document comments with filtering
   */

  import CommentEditor from './CommentEditor.svelte';
  import CommentThreadComponent from './CommentThread.svelte';

  interface CommentAuthor {
    id: string;
    email: string;
    name?: string;
  }

  interface Comment {
    id: string;
    content: string;
    contentHtml?: string;
    type: 'inline' | 'document' | 'suggestion';
    status: 'open' | 'resolved' | 'rejected';
    suggestionText?: string;
    author: CommentAuthor;
    createdAt: number;
    updatedAt: number;
    reactions?: Record<string, string[]>;
  }

  interface CommentThread {
    id: string;
    rootComment: Comment;
    replies: Comment[];
    status: 'open' | 'resolved' | 'rejected';
    participantCount: number;
    lastActivity: number;
  }

  interface CommentCounts {
    total: number;
    open: number;
    resolved: number;
  }

  interface Props {
    threads: CommentThread[];
    counts: CommentCounts;
    currentUserEmail: string;
    loading?: boolean;
    mentionSuggestions?: { email: string; name?: string }[];
    onCreate?: (content: string, type?: 'document' | 'suggestion') => void | Promise<void>;
    onReply?: (threadId: string, content: string) => void | Promise<void>;
    onEdit?: (commentId: string, content: string) => void | Promise<void>;
    onDelete?: (commentId: string) => void | Promise<void>;
    onResolve?: (commentId: string, note?: string) => void | Promise<void>;
    onReopen?: (commentId: string) => void | Promise<void>;
    onAcceptSuggestion?: (commentId: string) => void | Promise<void>;
    onReaction?: (commentId: string, reaction: string) => void | Promise<void>;
  }

  let {
    threads,
    counts,
    currentUserEmail,
    loading = false,
    mentionSuggestions = [],
    onCreate,
    onReply,
    onEdit,
    onDelete,
    onResolve,
    onReopen,
    onAcceptSuggestion,
    onReaction,
  }: Props = $props();

  type FilterType = 'all' | 'open' | 'resolved' | 'mine';
  let filter = $state<FilterType>('open');
  let showNewCommentBox = $state(false);

  let filterTabs = $derived([
    { key: 'open' as FilterType, label: 'Open', count: counts.open },
    { key: 'resolved' as FilterType, label: 'Resolved', count: counts.resolved },
    { key: 'all' as FilterType, label: 'All', count: counts.total },
    { key: 'mine' as FilterType, label: 'Mine', count: null as number | null },
  ]);

  let filteredThreads = $derived(() => {
    let filtered = threads;

    if (filter === 'open') {
      filtered = threads.filter((t) => t.status === 'open');
    } else if (filter === 'resolved') {
      filtered = threads.filter((t) => t.status === 'resolved');
    } else if (filter === 'mine') {
      filtered = threads.filter(
        (t) =>
          t.rootComment.author.email === currentUserEmail ||
          t.replies.some((r) => r.author.email === currentUserEmail)
      );
    }

    return filtered;
  });

  async function handleCreate(content: string) {
    await onCreate?.(content, 'document');
    showNewCommentBox = false;
  }
</script>

<div class="comments-panel h-full flex flex-col border-l border-gray-200 bg-white">
  <!-- Header -->
  <div class="flex-shrink-0 p-3 border-b border-gray-200">
    <div class="flex items-center justify-between">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-gray-900">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        Comments
        {#if counts.open > 0}
          <span
            class="text-xs font-normal px-1.5 py-0.5 bg-esolia-orange/20 text-esolia-navy rounded"
          >
            {counts.open} open
          </span>
        {/if}
      </h3>

      {#if onCreate}
        <button
          type="button"
          onclick={() => (showNewCommentBox = !showNewCommentBox)}
          class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
          title="Add comment"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 4v16m8-8H4"
            />
          </svg>
        </button>
      {/if}
    </div>

    <!-- Filters -->
    <div class="mt-3 flex gap-1">
      {#each filterTabs as tab (tab.key)}
        <button
          type="button"
          onclick={() => (filter = tab.key)}
          class="px-2 py-1 text-xs rounded transition-colors"
          class:bg-esolia-navy={filter === tab.key}
          class:text-white={filter === tab.key}
          class:text-gray-600={filter !== tab.key}
          class:hover:bg-gray-100={filter !== tab.key}
        >
          {tab.label}
          {#if tab.count !== null && tab.count > 0}
            <span class="ml-1 opacity-75">({tab.count})</span>
          {/if}
        </button>
      {/each}
    </div>
  </div>

  <!-- New comment box -->
  {#if showNewCommentBox && onCreate}
    <div class="flex-shrink-0 p-3 border-b border-gray-200 bg-gray-50">
      <CommentEditor
        placeholder="Start a new discussion..."
        submitLabel="Post"
        showCancel={true}
        autoFocus={true}
        {mentionSuggestions}
        onSubmit={handleCreate}
        onCancel={() => (showNewCommentBox = false)}
      />
    </div>
  {/if}

  <!-- Thread list -->
  <div class="flex-1 overflow-y-auto">
    {#if loading}
      <div class="flex justify-center py-8">
        <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
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
      </div>
    {:else if filteredThreads().length === 0}
      <div class="flex flex-col items-center justify-center py-12 px-4 text-center">
        <svg
          class="w-12 h-12 text-gray-300 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.5"
            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
          />
        </svg>
        <p class="text-sm text-gray-500">
          {#if filter === 'open'}
            No open comments
          {:else if filter === 'resolved'}
            No resolved comments
          {:else if filter === 'mine'}
            You haven't commented yet
          {:else}
            No comments yet
          {/if}
        </p>
        {#if filter !== 'all' && threads.length > 0}
          <button
            type="button"
            onclick={() => (filter = 'all')}
            class="mt-2 text-sm text-esolia-navy hover:underline"
          >
            View all comments
          </button>
        {/if}
      </div>
    {:else}
      <div class="p-3 space-y-3">
        {#each filteredThreads() as thread (thread.id)}
          <CommentThreadComponent
            {thread}
            {currentUserEmail}
            {mentionSuggestions}
            {onReply}
            {onEdit}
            {onDelete}
            {onResolve}
            {onReopen}
            {onAcceptSuggestion}
            {onReaction}
          />
        {/each}
      </div>
    {/if}
  </div>

  <!-- Footer stats -->
  <div class="flex-shrink-0 px-3 py-2 border-t border-gray-200 bg-gray-50">
    <div class="flex items-center justify-between text-xs text-gray-500">
      <span>
        {counts.total} total · {counts.open} open · {counts.resolved} resolved
      </span>
      {#if filteredThreads().length !== threads.length}
        <span class="text-gray-400">
          Showing {filteredThreads().length} of {threads.length}
        </span>
      {/if}
    </div>
  </div>
</div>

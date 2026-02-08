<script lang="ts">
  /**
   * Comment Thread Component
   * InfoSec: Displays threaded comments with moderation controls, XSS prevention
   */

  import CommentEditor from './CommentEditor.svelte';
  import { sanitizeComment } from '$lib/sanitize';
  import type { CommentAuthor, CommentData, CommentThread } from '$lib/types';

  interface Props {
    thread: CommentThread;
    currentUserEmail: string;
    mentionSuggestions?: { email: string; name?: string }[];
    onReply?: (threadId: string, content: string) => void | Promise<void>;
    onEdit?: (commentId: string, content: string) => void | Promise<void>;
    onDelete?: (commentId: string) => void | Promise<void>;
    onResolve?: (commentId: string, note?: string) => void | Promise<void>;
    onReopen?: (commentId: string) => void | Promise<void>;
    onAcceptSuggestion?: (commentId: string) => void | Promise<void>;
    onReaction?: (commentId: string, reaction: string) => void | Promise<void>;
  }

  let {
    thread,
    currentUserEmail,
    mentionSuggestions = [],
    onReply,
    onEdit,
    onDelete,
    onResolve,
    onReopen,
    onAcceptSuggestion,
    onReaction,
  }: Props = $props();

  let showReplyBox = $state(false);
  let editingCommentId = $state<string | null>(null);
  let showReplies = $state(true);

  const availableReactions = ['👍', '👎', '❤️', '🎉', '👀'];

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function getAuthorInitials(author: CommentAuthor): string {
    if (author.name) {
      return author.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2);
    }
    return author.email.charAt(0).toUpperCase();
  }

  function isOwnComment(comment: CommentData): boolean {
    return comment.author.email === currentUserEmail;
  }

  async function handleReply(content: string) {
    await onReply?.(thread.id, content);
    showReplyBox = false;
  }
</script>

<div
  class="comment-thread border rounded-lg bg-white"
  class:border-green-200={thread.status === 'resolved'}
  class:border-gray-200={thread.status !== 'resolved'}
>
  <!-- Root comment -->
  <div class="p-3">
    <div class="flex gap-3">
      <!-- Avatar -->
      <div
        class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium
               {thread.status === 'resolved'
          ? 'bg-green-100 text-green-700'
          : 'bg-esolia-navy text-white'}"
      >
        {getAuthorInitials(thread.rootComment.author)}
      </div>

      <!-- Content -->
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <span class="font-medium text-sm text-gray-900">
            {thread.rootComment.author.name || thread.rootComment.author.email}
          </span>
          <span class="text-xs text-gray-400">
            {formatTime(thread.rootComment.createdAt)}
          </span>
          {#if thread.rootComment.type === 'suggestion'}
            <span
              class="text-[10px] font-medium px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded"
            >
              Suggestion
            </span>
          {/if}
          {#if thread.status === 'resolved'}
            <span class="text-[10px] font-medium px-1.5 py-0.5 bg-green-100 text-green-700 rounded">
              Resolved
            </span>
          {/if}
        </div>

        <!-- Comment content -->
        {#if editingCommentId === thread.rootComment.id}
          <div class="mt-2">
            <CommentEditor
              initialContent={thread.rootComment.content}
              submitLabel="Save"
              showCancel={true}
              autoFocus={true}
              {mentionSuggestions}
              onSubmit={(content) => {
                onEdit?.(thread.rootComment.id, content);
                editingCommentId = null;
              }}
              onCancel={() => (editingCommentId = null)}
            />
          </div>
        {:else}
          <div class="mt-1 text-sm text-gray-700 prose prose-sm max-w-none">
            {#if thread.rootComment.contentHtml}
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized via sanitizeComment (InfoSec: XSS prevention) -->
              {@html sanitizeComment(thread.rootComment.contentHtml)}
            {:else}
              {thread.rootComment.content}
            {/if}
          </div>

          <!-- Suggestion preview -->
          {#if thread.rootComment.type === 'suggestion' && thread.rootComment.suggestionText}
            <div class="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
              <div class="text-xs text-green-600 font-medium mb-1">Suggested change:</div>
              <div class="text-green-800 font-mono text-xs whitespace-pre-wrap">
                {thread.rootComment.suggestionText}
              </div>
              {#if thread.status === 'open' && onAcceptSuggestion}
                <button
                  type="button"
                  onclick={() => onAcceptSuggestion(thread.rootComment.id)}
                  class="mt-2 text-xs text-green-700 hover:text-green-900 font-medium"
                >
                  Accept Suggestion
                </button>
              {/if}
            </div>
          {/if}
        {/if}

        <!-- Reactions -->
        {#if thread.rootComment.reactions && Object.keys(thread.rootComment.reactions).length > 0}
          <div class="mt-2 flex flex-wrap gap-1">
            {#each Object.entries(thread.rootComment.reactions) as [reaction, users]}
              <button
                type="button"
                onclick={() => onReaction?.(thread.rootComment.id, reaction)}
                class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs rounded-full border
                       {users.includes(currentUserEmail)
                  ? 'bg-blue-50 border-blue-200 text-blue-700'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}"
              >
                <span>{reaction}</span>
                <span>{users.length}</span>
              </button>
            {/each}
          </div>
        {/if}

        <!-- Actions -->
        <div class="mt-2 flex items-center gap-3 text-xs">
          {#if thread.status === 'open' && onReply}
            <button
              type="button"
              onclick={() => (showReplyBox = !showReplyBox)}
              class="text-gray-500 hover:text-gray-700"
            >
              Reply
            </button>
          {/if}

          {#if onReaction}
            <div class="relative group">
              <button type="button" class="text-gray-500 hover:text-gray-700"> React </button>
              <div
                class="absolute left-0 bottom-full mb-1 hidden group-hover:flex gap-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1"
              >
                {#each availableReactions as reaction}
                  <button
                    type="button"
                    onclick={() => onReaction(thread.rootComment.id, reaction)}
                    class="hover:bg-gray-100 rounded p-1"
                  >
                    {reaction}
                  </button>
                {/each}
              </div>
            </div>
          {/if}

          {#if isOwnComment(thread.rootComment) && thread.status === 'open'}
            {#if onEdit}
              <button
                type="button"
                onclick={() => (editingCommentId = thread.rootComment.id)}
                class="text-gray-500 hover:text-gray-700"
              >
                Edit
              </button>
            {/if}
            {#if onDelete}
              <button
                type="button"
                onclick={() => onDelete(thread.rootComment.id)}
                class="text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            {/if}
          {/if}

          {#if thread.status === 'open' && onResolve}
            <button
              type="button"
              onclick={() => onResolve(thread.rootComment.id)}
              class="text-green-600 hover:text-green-700"
            >
              Resolve
            </button>
          {/if}

          {#if thread.status === 'resolved' && onReopen}
            <button
              type="button"
              onclick={() => onReopen(thread.rootComment.id)}
              class="text-amber-600 hover:text-amber-700"
            >
              Reopen
            </button>
          {/if}
        </div>
      </div>
    </div>
  </div>

  <!-- Replies -->
  {#if thread.replies.length > 0}
    <div class="border-t border-gray-100">
      {#if thread.replies.length > 2 && !showReplies}
        <button
          type="button"
          onclick={() => (showReplies = true)}
          class="w-full px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 text-left"
        >
          Show {thread.replies.length} replies...
        </button>
      {:else}
        {#each thread.replies as reply (reply.id)}
          <div class="px-3 py-2 border-t border-gray-50">
            <div class="flex gap-3 ml-8">
              <div
                class="flex-shrink-0 w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center text-[10px] font-medium text-gray-600"
              >
                {getAuthorInitials(reply.author)}
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-xs text-gray-900">
                    {reply.author.name || reply.author.email}
                  </span>
                  <span class="text-[10px] text-gray-400">
                    {formatTime(reply.createdAt)}
                  </span>
                </div>

                <div class="mt-0.5 text-sm text-gray-700">
                  {#if reply.contentHtml}
                    <!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized via sanitizeComment (InfoSec: XSS prevention) -->
                    {@html sanitizeComment(reply.contentHtml)}
                  {:else}
                    {reply.content}
                  {/if}
                </div>

                {#if isOwnComment(reply) && thread.status === 'open'}
                  <div class="mt-1 flex gap-2 text-[10px]">
                    {#if onEdit}
                      <button
                        type="button"
                        onclick={() => (editingCommentId = reply.id)}
                        class="text-gray-400 hover:text-gray-600"
                      >
                        Edit
                      </button>
                    {/if}
                    {#if onDelete}
                      <button
                        type="button"
                        onclick={() => onDelete(reply.id)}
                        class="text-red-400 hover:text-red-600"
                      >
                        Delete
                      </button>
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          </div>
        {/each}

        {#if showReplies && thread.replies.length > 2}
          <button
            type="button"
            onclick={() => (showReplies = false)}
            class="w-full px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 text-left border-t border-gray-50"
          >
            Hide replies
          </button>
        {/if}
      {/if}
    </div>
  {/if}

  <!-- Reply box -->
  {#if showReplyBox && thread.status === 'open'}
    <div class="px-3 py-2 border-t border-gray-100 bg-gray-50">
      <div class="ml-8">
        <CommentEditor
          placeholder="Write a reply..."
          submitLabel="Reply"
          showCancel={true}
          autoFocus={true}
          {mentionSuggestions}
          onSubmit={handleReply}
          onCancel={() => (showReplyBox = false)}
        />
      </div>
    </div>
  {/if}
</div>

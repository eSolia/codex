<script lang="ts">
  /**
   * Audit Timeline Component
   * Displays chronological list of audit events for a resource
   */

  interface AuditEntry {
    id: string;
    timestamp: number;
    actor_email: string;
    actor_name: string | null;
    action: string;
    action_category: string;
    resource_title: string | null;
    change_summary: string | null;
    field_path: string | null;
  }

  interface Props {
    entries: AuditEntry[];
    loading?: boolean;
    hasMore?: boolean;
    onLoadMore?: () => void;
  }

  let { entries, loading = false, hasMore = false, onLoadMore }: Props = $props();

  const actionLabels: Record<string, string> = {
    create: 'created',
    update: 'updated',
    update_field: 'changed',
    delete: 'deleted',
    restore: 'restored',
    view: 'viewed',
    approve: 'approved',
    reject: 'rejected',
    publish: 'published',
    unpublish: 'unpublished',
    submit_review: 'submitted for review',
    schedule: 'scheduled',
    comment_create: 'commented on',
    download: 'downloaded',
    export: 'exported',
    share_preview: 'shared preview of',
  };

  const actionColors: Record<string, string> = {
    create: 'bg-green-100 text-green-700',
    update: 'bg-blue-100 text-blue-700',
    approve: 'bg-green-100 text-green-700',
    reject: 'bg-red-100 text-red-700',
    publish: 'bg-purple-100 text-purple-700',
    delete: 'bg-red-100 text-red-700',
    view: 'bg-gray-100 text-gray-700',
    restore: 'bg-amber-100 text-amber-700',
  };

  function getActionLabel(action: string): string {
    return actionLabels[action] || action;
  }

  function getActionColor(action: string): string {
    return actionColors[action] || 'bg-gray-100 text-gray-700';
  }

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
</script>

<div class="audit-timeline space-y-3">
  {#if entries.length === 0 && !loading}
    <div class="text-center py-8 text-gray-500">
      <svg class="mx-auto h-8 w-8 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <p>No activity recorded yet</p>
    </div>
  {:else}
    {#each entries as entry (entry.id)}
      <div class="flex gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
        <!-- Icon -->
        <div
          class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center {getActionColor(
            entry.action
          )}"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {#if entry.action === 'create'}
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 4v16m8-8H4"
              />
            {:else if entry.action === 'update' || entry.action === 'update_field'}
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            {:else if entry.action === 'delete'}
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            {:else if entry.action === 'view'}
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
              />
            {:else if entry.action === 'approve' || entry.action === 'publish'}
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M5 13l4 4L19 7"
              />
            {:else if entry.action === 'reject'}
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M6 18L18 6M6 6l12 12"
              />
            {:else}
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            {/if}
          </svg>
        </div>

        <!-- Content -->
        <div class="flex-1 min-w-0">
          <div class="flex flex-wrap items-center gap-1 text-sm">
            <span class="font-medium text-gray-900">
              {entry.actor_name || entry.actor_email}
            </span>
            <span class="text-gray-600">{getActionLabel(entry.action)}</span>
            {#if entry.resource_title}
              <span class="text-esolia-navy font-medium truncate">
                "{entry.resource_title}"
              </span>
            {/if}
          </div>

          {#if entry.change_summary}
            <p class="text-sm text-gray-600 mt-0.5">{entry.change_summary}</p>
          {/if}

          {#if entry.field_path}
            <p class="text-xs text-gray-500 mt-0.5">
              Field: <code class="bg-gray-100 px-1 rounded">{entry.field_path}</code>
            </p>
          {/if}

          <time class="text-xs text-gray-400 mt-1 block">
            {formatTime(entry.timestamp)}
          </time>
        </div>
      </div>
    {/each}
  {/if}

  {#if loading}
    <div class="flex justify-center py-4">
      <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  {:else if hasMore && onLoadMore}
    <button
      type="button"
      onclick={onLoadMore}
      class="w-full py-2 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-50 rounded-lg transition-colors"
    >
      Load more
    </button>
  {/if}
</div>

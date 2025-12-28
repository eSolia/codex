<script lang="ts">
  /**
   * Scheduled Jobs List Component
   * InfoSec: Displays upcoming and recent scheduled publications
   */

  interface ScheduledJob {
    id: string;
    documentId: string;
    documentTitle: string;
    action: "publish" | "unpublish" | "archive";
    scheduledAt: number;
    timezone: string;
    status: "pending" | "processing" | "completed" | "failed" | "cancelled";
    processedAt?: number;
    errorMessage?: string;
    isEmbargo: boolean;
    createdBy: string;
  }

  interface Props {
    jobs: ScheduledJob[];
    loading?: boolean;
    showStatus?: boolean;
    onCancel?: (jobId: string) => void | Promise<void>;
    onRetry?: (jobId: string) => void | Promise<void>;
    onViewDocument?: (documentId: string) => void;
  }

  let {
    jobs,
    loading = false,
    showStatus = true,
    onCancel,
    onRetry,
    onViewDocument,
  }: Props = $props();

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = timestamp - now.getTime();
    const absDiff = Math.abs(diff);

    // Future times
    if (diff > 0) {
      const hours = Math.floor(absDiff / 3600000);
      const days = Math.floor(hours / 24);

      if (hours < 1) {
        const minutes = Math.floor(absDiff / 60000);
        return `in ${minutes}m`;
      }
      if (hours < 24) return `in ${hours}h`;
      if (days < 7) return `in ${days}d`;
    }

    // Past times or exact date
    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  function getStatusColor(status: ScheduledJob["status"]) {
    const colors = {
      pending: { bg: "bg-blue-100", text: "text-blue-700" },
      processing: { bg: "bg-amber-100", text: "text-amber-700" },
      completed: { bg: "bg-green-100", text: "text-green-700" },
      failed: { bg: "bg-red-100", text: "text-red-700" },
      cancelled: { bg: "bg-gray-100", text: "text-gray-500" },
    };
    return colors[status];
  }

  function getActionIcon(action: ScheduledJob["action"]) {
    const icons = {
      publish: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
      unpublish: "M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636",
      archive: "M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4",
    };
    return icons[action];
  }
</script>

<div class="scheduled-jobs-list">
  {#if loading}
    <div class="flex justify-center py-8">
      <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
    </div>
  {:else if jobs.length === 0}
    <div class="text-center py-8 text-sm text-gray-500">
      <svg class="w-10 h-10 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      No scheduled publications
    </div>
  {:else}
    <ul class="divide-y divide-gray-100">
      {#each jobs as job (job.id)}
        {@const statusColor = getStatusColor(job.status)}
        {@const actionIcon = getActionIcon(job.action)}
        {@const isPast = job.scheduledAt < Date.now()}

        <li class="py-3 hover:bg-gray-50 transition-colors">
          <div class="flex items-start gap-3">
            <!-- Action icon -->
            <div
              class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center"
              class:bg-green-100={job.action === "publish"}
              class:text-green-600={job.action === "publish"}
              class:bg-amber-100={job.action === "unpublish"}
              class:text-amber-600={job.action === "unpublish"}
              class:bg-gray-100={job.action === "archive"}
              class:text-gray-600={job.action === "archive"}
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={actionIcon} />
              </svg>
            </div>

            <!-- Content -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                {#if onViewDocument}
                  <button
                    type="button"
                    onclick={() => onViewDocument(job.documentId)}
                    class="text-sm font-medium text-gray-900 hover:text-esolia-navy truncate"
                  >
                    {job.documentTitle}
                  </button>
                {:else}
                  <span class="text-sm font-medium text-gray-900 truncate">
                    {job.documentTitle}
                  </span>
                {/if}

                {#if job.isEmbargo}
                  <span class="text-[10px] font-medium px-1.5 py-0.5 bg-red-100 text-red-700 rounded">
                    EMBARGO
                  </span>
                {/if}
              </div>

              <div class="mt-0.5 flex items-center gap-2 text-xs text-gray-500">
                <span class="capitalize">{job.action}</span>
                <span>·</span>
                <span class:text-esolia-navy={!isPast} class:font-medium={!isPast}>
                  {formatTime(job.scheduledAt)}
                </span>
                {#if job.timezone !== "UTC"}
                  <span class="text-gray-400">({job.timezone})</span>
                {/if}
              </div>

              {#if job.errorMessage}
                <p class="mt-1 text-xs text-red-600">{job.errorMessage}</p>
              {/if}
            </div>

            <!-- Status & Actions -->
            <div class="flex-shrink-0 flex items-center gap-2">
              {#if showStatus}
                <span class="text-[10px] font-medium px-2 py-0.5 rounded {statusColor.bg} {statusColor.text}">
                  {job.status}
                </span>
              {/if}

              {#if job.status === "pending" && onCancel}
                <button
                  type="button"
                  onclick={() => onCancel(job.id)}
                  title="Cancel"
                  class="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              {/if}

              {#if job.status === "failed" && onRetry}
                <button
                  type="button"
                  onclick={() => onRetry(job.id)}
                  title="Retry"
                  class="p-1 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
              {/if}
            </div>
          </div>
        </li>
      {/each}
    </ul>
  {/if}
</div>

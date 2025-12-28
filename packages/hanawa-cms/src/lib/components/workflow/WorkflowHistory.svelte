<script lang="ts">
  /**
   * Workflow History Component
   * InfoSec: Displays complete audit trail of workflow transitions
   */

  interface HistoryEntry {
    id: string;
    timestamp: number;
    fromStageName?: string;
    toStageName: string;
    transitionType: "advance" | "reject" | "skip" | "initialize";
    actorEmail: string;
    actorName?: string;
    comment?: string;
  }

  interface Props {
    history: HistoryEntry[];
    loading?: boolean;
    limit?: number;
    showViewAll?: boolean;
    onViewAll?: () => void;
  }

  let { history, loading = false, limit, showViewAll = true, onViewAll }: Props = $props();

  let displayHistory = $derived(limit ? history.slice(0, limit) : history);
  let hasMore = $derived(limit && history.length > limit);

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "just now";
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function getTransitionColors(type: HistoryEntry["transitionType"]) {
    const colors = {
      initialize: { bg: "bg-gray-100", text: "text-gray-600", icon: "text-gray-500" },
      advance: { bg: "bg-green-100", text: "text-green-700", icon: "text-green-500" },
      reject: { bg: "bg-red-100", text: "text-red-700", icon: "text-red-500" },
      skip: { bg: "bg-amber-100", text: "text-amber-700", icon: "text-amber-500" },
    };
    return colors[type];
  }

  function getTransitionIcon(type: HistoryEntry["transitionType"]) {
    const icons = {
      initialize: "M12 6v6m0 0v6m0-6h6m-6 0H6",
      advance: "M9 5l7 7-7 7",
      reject: "M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6",
      skip: "M13 5l7 7-7 7M5 5l7 7-7 7",
    };
    return icons[type];
  }

  function getTransitionLabel(entry: HistoryEntry): string {
    if (entry.transitionType === "initialize") {
      return `Started workflow at ${entry.toStageName}`;
    }
    if (entry.transitionType === "reject") {
      return `Requested changes → ${entry.fromStageName || "Draft"}`;
    }
    if (entry.transitionType === "skip") {
      return `Skipped to ${entry.toStageName}`;
    }
    return entry.fromStageName
      ? `${entry.fromStageName} → ${entry.toStageName}`
      : `Advanced to ${entry.toStageName}`;
  }
</script>

<div class="workflow-history">
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
  {:else if displayHistory.length === 0}
    <div class="text-center py-4 text-sm text-gray-500">
      No workflow history yet
    </div>
  {:else}
    <ul class="space-y-3">
      {#each displayHistory as entry (entry.id)}
        {@const colors = getTransitionColors(entry.transitionType)}
        {@const icon = getTransitionIcon(entry.transitionType)}

        <li class="flex gap-3">
          <!-- Icon -->
          <div
            class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center {colors.bg}"
          >
            <svg class="w-4 h-4 {colors.icon}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icon} />
            </svg>
          </div>

          <!-- Content -->
          <div class="flex-1 min-w-0">
            <p class="text-sm {colors.text}">
              {getTransitionLabel(entry)}
            </p>
            <p class="text-xs text-gray-500 mt-0.5">
              {entry.actorName || entry.actorEmail} · {formatTime(entry.timestamp)}
            </p>
            {#if entry.comment}
              <div class="mt-1.5 p-2 bg-gray-50 rounded text-xs text-gray-600 italic">
                "{entry.comment}"
              </div>
            {/if}
          </div>
        </li>
      {/each}
    </ul>

    {#if hasMore && showViewAll && onViewAll}
      <div class="mt-4 text-center">
        <button
          type="button"
          onclick={onViewAll}
          class="text-sm text-esolia-navy hover:text-esolia-navy/80"
        >
          View all {history.length} entries →
        </button>
      </div>
    {/if}
  {/if}
</div>

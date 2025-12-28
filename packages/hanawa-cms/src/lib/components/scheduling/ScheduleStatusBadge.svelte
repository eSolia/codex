<script lang="ts">
  /**
   * Schedule Status Badge Component
   * InfoSec: Compact indicator for scheduled publication status
   */

  interface Props {
    scheduledAt?: number;
    action?: "publish" | "unpublish" | "archive";
    isEmbargo?: boolean;
    onClick?: () => void;
  }

  let { scheduledAt, action = "publish", isEmbargo = false, onClick }: Props = $props();

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = timestamp - now.getTime();

    if (diff < 0) return "Overdue";

    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);

    if (hours < 1) {
      const minutes = Math.floor(diff / 60000);
      return `${minutes}m`;
    }
    if (hours < 24) return `${hours}h`;
    if (days < 7) return `${days}d`;

    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  let timeUntil = $derived(scheduledAt ? formatTime(scheduledAt) : null);
  let isOverdue = $derived(scheduledAt ? scheduledAt < Date.now() : false);
</script>

{#if scheduledAt}
  <button
    type="button"
    onclick={onClick}
    class="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full transition-colors"
    class:bg-green-100={action === "publish" && !isOverdue}
    class:text-green-700={action === "publish" && !isOverdue}
    class:hover:bg-green-200={action === "publish" && !isOverdue}
    class:bg-amber-100={action === "unpublish" && !isOverdue}
    class:text-amber-700={action === "unpublish" && !isOverdue}
    class:hover:bg-amber-200={action === "unpublish" && !isOverdue}
    class:bg-red-100={isOverdue}
    class:text-red-700={isOverdue}
    class:hover:bg-red-200={isOverdue}
    title="Scheduled to {action} at {new Date(scheduledAt).toLocaleString()}"
  >
    <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
    <span>{timeUntil}</span>
    {#if isEmbargo}
      <svg class="w-3 h-3 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    {/if}
  </button>
{/if}

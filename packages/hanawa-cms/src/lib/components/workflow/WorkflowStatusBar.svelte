<script lang="ts">
  /**
   * Workflow Status Bar Component
   * InfoSec: Shows current workflow stage with role-based actions
   */

  interface WorkflowStage {
    id: string;
    name: string;
    stageType: "draft" | "review" | "approval" | "published";
    approvalType: "any" | "all" | "sequential";
    minApprovals: number;
  }

  interface Approval {
    email: string;
    name?: string;
    at: number;
    comment?: string;
  }

  interface Transition {
    id: string;
    transitionType: "advance" | "reject" | "skip";
    toStageId: string;
    toStageName: string;
    requiresComment: boolean;
  }

  interface Props {
    documentId: string;
    currentStage: WorkflowStage;
    approvals?: Approval[];
    transitions?: Transition[];
    enteredStageAt?: number;
    deadline?: number;
    loading?: boolean;
    onSubmit?: () => void;
    onApprove?: (comment?: string) => void;
    onReject?: (comment: string) => void;
    onTransition?: (transitionId: string, comment?: string) => void;
  }

  let {
    documentId,
    currentStage,
    approvals = [],
    transitions = [],
    enteredStageAt,
    deadline,
    loading = false,
    onSubmit,
    onApprove,
    onReject,
    onTransition,
  }: Props = $props();

  let showRejectDialog = $state(false);
  let rejectComment = $state("");
  let showApproveDialog = $state(false);
  let approveComment = $state("");

  let approvalProgress = $derived(
    currentStage.minApprovals > 0
      ? `${approvals.length}/${currentStage.minApprovals}`
      : null
  );

  let isOverdue = $derived(deadline && Date.now() > deadline);

  let timeInStage = $derived(() => {
    if (!enteredStageAt) return "";
    const diff = Date.now() - enteredStageAt;
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);
    if (days > 0) return `${days}d in stage`;
    if (hours > 0) return `${hours}h in stage`;
    return "Just entered";
  });

  function getStageColor(type: WorkflowStage["stageType"]) {
    const colors = {
      draft: { bg: "bg-gray-100", text: "text-gray-700", border: "border-gray-300" },
      review: { bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-300" },
      approval: { bg: "bg-blue-100", text: "text-blue-700", border: "border-blue-300" },
      published: { bg: "bg-green-100", text: "text-green-700", border: "border-green-300" },
    };
    return colors[type];
  }

  function getStageIcon(type: WorkflowStage["stageType"]) {
    const icons = {
      draft: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z",
      review: "M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z",
      approval: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
      published: "M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z",
    };
    return icons[type];
  }

  function handleApprove() {
    if (currentStage.stageType === "approval" || currentStage.stageType === "review") {
      showApproveDialog = true;
    } else if (onApprove) {
      onApprove();
    }
  }

  function confirmApprove() {
    onApprove?.(approveComment || undefined);
    showApproveDialog = false;
    approveComment = "";
  }

  function handleReject() {
    showRejectDialog = true;
  }

  function confirmReject() {
    if (rejectComment.trim()) {
      onReject?.(rejectComment);
      showRejectDialog = false;
      rejectComment = "";
    }
  }

  const colors = $derived(getStageColor(currentStage.stageType));
  const icon = $derived(getStageIcon(currentStage.stageType));
</script>

<div class="workflow-status-bar border-b border-gray-200 bg-white px-4 py-3">
  <div class="flex items-center justify-between gap-4 flex-wrap">
    <!-- Current Stage -->
    <div class="flex items-center gap-3">
      <div
        class="flex items-center gap-2 px-3 py-1.5 rounded-full border {colors.bg} {colors.text} {colors.border}"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d={icon} />
        </svg>
        <span class="font-medium text-sm">{currentStage.name}</span>
      </div>

      {#if approvalProgress}
        <div class="flex items-center gap-1.5 text-sm text-gray-600">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>{approvalProgress} approvals</span>
        </div>
      {/if}

      {#if timeInStage}
        <span class="text-xs text-gray-400">{timeInStage()}</span>
      {/if}

      {#if isOverdue}
        <span class="flex items-center gap-1 text-xs text-red-600 font-medium">
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Overdue
        </span>
      {/if}
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      {#if loading}
        <svg class="animate-spin h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path
            class="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          />
        </svg>
      {:else}
        {#if currentStage.stageType === "draft" && onSubmit}
          <button
            type="button"
            onclick={onSubmit}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-esolia-navy rounded-md hover:bg-esolia-navy/90 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
              />
            </svg>
            Submit for Review
          </button>
        {/if}

        {#if (currentStage.stageType === "review" || currentStage.stageType === "approval") && onApprove}
          <button
            type="button"
            onclick={handleApprove}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            Approve
          </button>
        {/if}

        {#if (currentStage.stageType === "review" || currentStage.stageType === "approval") && onReject}
          <button
            type="button"
            onclick={handleReject}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
            Request Changes
          </button>
        {/if}

        <!-- Additional transitions -->
        {#each transitions.filter((t) => t.transitionType === "skip") as transition}
          <button
            type="button"
            onclick={() => onTransition?.(transition.id)}
            class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M13 5l7 7-7 7M5 5l7 7-7 7"
              />
            </svg>
            Skip to {transition.toStageName}
          </button>
        {/each}
      {/if}
    </div>
  </div>

  <!-- Approvers list (if any) -->
  {#if approvals.length > 0}
    <div class="mt-2 flex items-center gap-2 flex-wrap">
      <span class="text-xs text-gray-500">Approved by:</span>
      {#each approvals as approval}
        <div
          class="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-700 rounded text-xs"
        >
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {approval.name || approval.email}
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Approve Dialog -->
{#if showApproveDialog}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">Approve Content</h3>
      </div>
      <div class="p-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Add a comment (optional)
        </label>
        <textarea
          bind:value={approveComment}
          rows="3"
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-esolia-navy focus:border-transparent"
          placeholder="Any notes about your approval..."
        ></textarea>
      </div>
      <div class="p-4 border-t border-gray-200 flex justify-end gap-2">
        <button
          type="button"
          onclick={() => (showApproveDialog = false)}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={confirmApprove}
          class="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
        >
          Confirm Approval
        </button>
      </div>
    </div>
  </div>
{/if}

<!-- Reject Dialog -->
{#if showRejectDialog}
  <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" role="dialog" aria-modal="true">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold text-gray-900">Request Changes</h3>
      </div>
      <div class="p-4">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Please explain what needs to be changed <span class="text-red-500">*</span>
        </label>
        <textarea
          bind:value={rejectComment}
          rows="4"
          required
          class="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-esolia-navy focus:border-transparent"
          placeholder="Describe the changes needed..."
        ></textarea>
      </div>
      <div class="p-4 border-t border-gray-200 flex justify-end gap-2">
        <button
          type="button"
          onclick={() => (showRejectDialog = false)}
          class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
        >
          Cancel
        </button>
        <button
          type="button"
          onclick={confirmReject}
          disabled={!rejectComment.trim()}
          class="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Submit Feedback
        </button>
      </div>
    </div>
  </div>
{/if}

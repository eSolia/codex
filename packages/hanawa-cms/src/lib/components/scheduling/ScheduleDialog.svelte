<script lang="ts">
  /**
   * Schedule Dialog Component
   * InfoSec: Time-based publication scheduling with embargo support
   */

  interface ScheduledJob {
    id: string;
    action: "publish" | "unpublish" | "archive";
    scheduledAt: number;
    timezone: string;
    status: string;
    isEmbargo: boolean;
  }

  interface ScheduleRequest {
    documentId: string;
    action: "publish" | "unpublish";
    scheduledAt: string;
    timezone: string;
    isEmbargo: boolean;
    notes?: string;
  }

  interface Props {
    documentId: string;
    documentTitle: string;
    currentStatus: string;
    embargoUntil?: number;
    existingSchedule?: ScheduledJob | null;
    onSchedule: (request: ScheduleRequest) => void | Promise<void>;
    onCancel: (jobId: string) => void | Promise<void>;
    onClose: () => void;
  }

  let {
    documentId,
    documentTitle,
    currentStatus,
    embargoUntil,
    existingSchedule,
    onSchedule,
    onCancel,
    onClose,
  }: Props = $props();

  // Default to next hour
  function getDefaultTime(): string {
    const date = new Date();
    date.setHours(date.getHours() + 1, 0, 0, 0);
    return formatDateTimeLocal(date);
  }

  function formatDateTimeLocal(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function formatDisplayTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  }

  let scheduledDate = $state(getDefaultTime());
  let timezone = $state(Intl.DateTimeFormat().resolvedOptions().timeZone);
  let action = $state<"publish" | "unpublish">("publish");
  let isEmbargo = $state(false);
  let notes = $state("");
  let submitting = $state(false);

  // Quick select options
  function setQuickTime(hoursFromNow: number, targetHour?: number) {
    const date = new Date();
    if (targetHour !== undefined) {
      date.setDate(date.getDate() + Math.ceil(hoursFromNow / 24));
      date.setHours(targetHour, 0, 0, 0);
    } else {
      date.setTime(date.getTime() + hoursFromNow * 60 * 60 * 1000);
      date.setMinutes(0, 0, 0);
    }
    scheduledDate = formatDateTimeLocal(date);
  }

  let scheduledTime = $derived(new Date(scheduledDate).getTime());
  let isValidTime = $derived(scheduledTime > Date.now());
  let isBeforeEmbargo = $derived(
    embargoUntil ? scheduledTime < embargoUntil : false
  );
  let canSubmit = $derived(isValidTime && !isBeforeEmbargo && !submitting);

  async function handleSubmit() {
    if (!canSubmit) return;

    submitting = true;
    try {
      await onSchedule({
        documentId,
        action,
        scheduledAt: scheduledDate,
        timezone,
        isEmbargo,
        notes: notes || undefined,
      });
      onClose();
    } finally {
      submitting = false;
    }
  }

  async function handleCancelExisting() {
    if (!existingSchedule) return;
    await onCancel(existingSchedule.id);
  }

  const timezones = [
    { value: "Asia/Tokyo", label: "Asia/Tokyo (JST)" },
    { value: "America/New_York", label: "America/New_York (ET)" },
    { value: "America/Los_Angeles", label: "America/Los_Angeles (PT)" },
    { value: "Europe/London", label: "Europe/London (GMT/BST)" },
    { value: "UTC", label: "UTC" },
  ];
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onclick={onClose}>
  <div
    class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4"
    onclick={(e) => e.stopPropagation()}
    role="dialog"
    aria-modal="true"
    aria-labelledby="schedule-title"
  >
    <!-- Header -->
    <div class="p-4 border-b border-gray-200">
      <h2 id="schedule-title" class="text-lg font-semibold text-gray-900">Schedule Publication</h2>
      <p class="text-sm text-gray-500 mt-0.5 truncate">{documentTitle}</p>
    </div>

    <div class="p-4 space-y-4">
      <!-- Existing schedule warning -->
      {#if existingSchedule}
        <div class="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <svg class="w-4 h-4 text-amber-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <div class="flex-1">
            <span class="text-amber-800">
              Currently scheduled to {existingSchedule.action} on {formatDisplayTime(existingSchedule.scheduledAt)}
            </span>
          </div>
          <button
            type="button"
            onclick={handleCancelExisting}
            class="text-amber-700 hover:text-amber-900 text-xs font-medium"
          >
            Cancel
          </button>
        </div>
      {/if}

      <!-- Action selection -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Action</label>
        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            onclick={() => (action = "publish")}
            class="px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors {action === 'publish' ? 'border-esolia-navy bg-esolia-navy/5 text-esolia-navy' : 'border-gray-200 text-gray-700 hover:border-gray-300'}"
          >
            <svg class="w-4 h-4 inline-block mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            Publish
          </button>
          <button
            type="button"
            onclick={() => (action = "unpublish")}
            disabled={currentStatus !== "published"}
            class="px-4 py-2.5 rounded-lg border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed {action === 'unpublish' ? 'border-esolia-navy bg-esolia-navy/5 text-esolia-navy' : 'border-gray-200 text-gray-700'}"
          >
            <svg class="w-4 h-4 inline-block mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
            </svg>
            Unpublish
          </button>
        </div>
      </div>

      <!-- Quick select -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">Quick Select</label>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            onclick={() => setQuickTime(1)}
            class="px-3 py-1.5 text-xs rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          >
            In 1 hour
          </button>
          <button
            type="button"
            onclick={() => setQuickTime(24, 9)}
            class="px-3 py-1.5 text-xs rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          >
            Tomorrow 9am
          </button>
          <button
            type="button"
            onclick={() => {
              const date = new Date();
              const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
              date.setDate(date.getDate() + daysUntilMonday);
              date.setHours(9, 0, 0, 0);
              scheduledDate = formatDateTimeLocal(date);
            }}
            class="px-3 py-1.5 text-xs rounded border border-gray-200 hover:border-gray-300 hover:bg-gray-50"
          >
            Next Monday 9am
          </button>
        </div>
      </div>

      <!-- Date/time picker -->
      <div>
        <label for="schedule-datetime" class="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Date & Time
        </label>
        <input
          id="schedule-datetime"
          type="datetime-local"
          bind:value={scheduledDate}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-esolia-navy focus:border-transparent"
        />
        {#if !isValidTime}
          <p class="mt-1 text-xs text-red-600">Scheduled time must be in the future</p>
        {/if}
        {#if isBeforeEmbargo && embargoUntil}
          <p class="mt-1 text-xs text-red-600">
            Cannot schedule before embargo lifts ({formatDisplayTime(embargoUntil)})
          </p>
        {/if}
      </div>

      <!-- Timezone -->
      <div>
        <label for="schedule-timezone" class="block text-sm font-medium text-gray-700 mb-2">Timezone</label>
        <select
          id="schedule-timezone"
          bind:value={timezone}
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-esolia-navy focus:border-transparent"
        >
          {#each timezones as tz}
            <option value={tz.value}>{tz.label}</option>
          {/each}
        </select>
      </div>

      <!-- Embargo checkbox (only for publish) -->
      {#if action === "publish"}
        <label class="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            bind:checked={isEmbargo}
            class="mt-0.5 w-4 h-4 rounded border-gray-300 text-esolia-navy focus:ring-esolia-navy"
          />
          <div>
            <span class="text-sm font-medium text-gray-900">Embargo</span>
            <p class="text-xs text-gray-500">Content cannot be published before this time</p>
          </div>
        </label>
      {/if}

      <!-- Notes -->
      <div>
        <label for="schedule-notes" class="block text-sm font-medium text-gray-700 mb-2">
          Notes <span class="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          id="schedule-notes"
          bind:value={notes}
          rows="2"
          placeholder="e.g., Coordinated with press release"
          class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-esolia-navy focus:border-transparent resize-none"
        ></textarea>
      </div>
    </div>

    <!-- Footer -->
    <div class="p-4 border-t border-gray-200 flex justify-end gap-2">
      <button
        type="button"
        onclick={onClose}
        class="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
      >
        Cancel
      </button>
      <button
        type="button"
        onclick={handleSubmit}
        disabled={!canSubmit}
        class="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-esolia-navy rounded-lg hover:bg-esolia-navy/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {#if submitting}
          <svg class="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        {:else}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        {/if}
        Schedule {action === "publish" ? "Publish" : "Unpublish"}
      </button>
    </div>
  </div>
</div>

<script lang="ts">
  /**
   * Translation Queue Component
   * InfoSec: Dashboard showing documents pending translation
   */
  import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';

  type Locale = 'en' | 'ja';
  type TranslationStatus = 'pending' | 'in_progress' | 'review' | 'complete';
  type DocumentType = 'content' | 'fragment';

  interface TranslationItem {
    id: string;
    documentId: string;
    documentTitle: string;
    documentType: DocumentType;
    locale: Locale;
    status: TranslationStatus;
    progressPercent: number;
    assignedTo?: string;
    lastUpdated: number;
  }

  interface Props {
    items: TranslationItem[];
    loading?: boolean;
    currentUserEmail?: string;
    onOpen?: (documentId: string, documentType: DocumentType) => void;
    onAssign?: (documentId: string, locale: Locale) => void;
    onMarkComplete?: (documentId: string, locale: Locale) => void;
  }

  let {
    items,
    loading = false,
    currentUserEmail,
    onOpen,
    onAssign,
    onMarkComplete,
  }: Props = $props();

  type FilterStatus = 'all' | TranslationStatus;
  let filterStatus = $state<FilterStatus>('all');
  let filterAssigned = $state<'all' | 'mine' | 'unassigned'>('all');

  let filteredItems = $derived(() => {
    let filtered = items;

    if (filterStatus !== 'all') {
      filtered = filtered.filter((item) => item.status === filterStatus);
    }

    if (filterAssigned === 'mine' && currentUserEmail) {
      filtered = filtered.filter((item) => item.assignedTo === currentUserEmail);
    } else if (filterAssigned === 'unassigned') {
      filtered = filtered.filter((item) => !item.assignedTo);
    }

    return filtered;
  });

  function formatTime(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'just now';
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  function getStatusColor(status: TranslationStatus) {
    const colors = {
      pending: { bg: 'bg-gray-100', text: 'text-gray-600' },
      in_progress: { bg: 'bg-amber-100', text: 'text-amber-700' },
      review: { bg: 'bg-blue-100', text: 'text-blue-700' },
      complete: { bg: 'bg-green-100', text: 'text-green-700' },
    };
    return colors[status];
  }

  function getLocaleFlag(locale: Locale): string {
    return locale === 'en' ? '🇺🇸' : '🇯🇵';
  }
</script>

<div class="translation-queue">
  <!-- Filters -->
  <div class="flex items-center justify-between gap-4 mb-4 flex-wrap">
    <div class="flex gap-2">
      <!-- Status filter -->
      <select
        bind:value={filterStatus}
        class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-esolia-navy focus:border-transparent"
      >
        <option value="all">All Statuses</option>
        <option value="pending">Pending</option>
        <option value="in_progress">In Progress</option>
        <option value="review">In Review</option>
        <option value="complete">Complete</option>
      </select>

      <!-- Assignment filter -->
      <select
        bind:value={filterAssigned}
        class="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-esolia-navy focus:border-transparent"
      >
        <option value="all">All Assignments</option>
        {#if currentUserEmail}
          <option value="mine">Assigned to Me</option>
        {/if}
        <option value="unassigned">Unassigned</option>
      </select>
    </div>

    <div class="text-sm text-gray-500">
      {filteredItems().length} item{filteredItems().length !== 1 ? 's' : ''}
    </div>
  </div>

  <!-- Queue list -->
  {#if loading}
    <div class="flex justify-center py-8">
      <LoadingSpinner class="text-gray-400" />
    </div>
  {:else if filteredItems().length === 0}
    <div class="text-center py-12 text-gray-500">
      <svg
        class="w-12 h-12 mx-auto mb-3 text-gray-300"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
        />
      </svg>
      <p class="text-sm">No translations in queue</p>
    </div>
  {:else}
    <div class="border border-gray-200 rounded-lg overflow-hidden">
      <table class="w-full">
        <thead class="bg-gray-50 border-b border-gray-200">
          <tr>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Document</th
            >
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Locale</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Progress</th
            >
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Assigned</th
            >
            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Updated</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-100">
          {#each filteredItems() as item (item.id)}
            {@const statusColor = getStatusColor(item.status)}

            <tr class="hover:bg-gray-50">
              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <span
                    class="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 uppercase"
                  >
                    {item.documentType}
                  </span>
                  {#if onOpen}
                    <button
                      type="button"
                      onclick={() => onOpen(item.documentId, item.documentType)}
                      class="text-sm font-medium text-gray-900 hover:text-esolia-navy truncate max-w-[200px]"
                    >
                      {item.documentTitle}
                    </button>
                  {:else}
                    <span class="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                      {item.documentTitle}
                    </span>
                  {/if}
                </div>
              </td>

              <td class="px-4 py-3">
                <span class="text-base" title={item.locale === 'en' ? 'English' : 'Japanese'}>
                  {getLocaleFlag(item.locale)}
                </span>
              </td>

              <td class="px-4 py-3">
                <span
                  class="text-xs font-medium px-2 py-0.5 rounded {statusColor.bg} {statusColor.text}"
                >
                  {item.status.replace('_', ' ')}
                </span>
              </td>

              <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                  <div class="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      class="h-full bg-esolia-navy rounded-full transition-all"
                      style="width: {item.progressPercent}%"
                    ></div>
                  </div>
                  <span class="text-xs text-gray-500">{item.progressPercent}%</span>
                </div>
              </td>

              <td class="px-4 py-3 text-sm text-gray-600">
                {#if item.assignedTo}
                  {item.assignedTo.split('@')[0] ?? item.assignedTo}
                {:else}
                  <span class="text-gray-400">—</span>
                {/if}
              </td>

              <td class="px-4 py-3 text-xs text-gray-500">
                {formatTime(item.lastUpdated)}
              </td>

              <td class="px-4 py-3">
                <div class="flex items-center gap-1">
                  {#if !item.assignedTo && onAssign}
                    <button
                      type="button"
                      onclick={() => onAssign(item.documentId, item.locale)}
                      class="p-1 text-gray-400 hover:text-esolia-navy rounded"
                      title="Assign to me"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                        />
                      </svg>
                    </button>
                  {/if}

                  {#if item.status !== 'complete' && onMarkComplete}
                    <button
                      type="button"
                      onclick={() => onMarkComplete(item.documentId, item.locale)}
                      class="p-1 text-gray-400 hover:text-green-600 rounded"
                      title="Mark complete"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          stroke-width="2"
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </button>
                  {/if}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

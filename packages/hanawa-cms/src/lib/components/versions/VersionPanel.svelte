<script lang="ts">
  /**
   * Version Panel Component
   * Displays version history with preview, compare, and restore actions
   */

  interface VersionItem {
    id: string;
    versionNumber: number;
    createdAt: number;
    createdByEmail: string;
    createdByName: string | null;
    title: string | null;
    versionType: string;
    versionLabel: string | null;
    contentSize: number;
  }

  interface Props {
    versions: VersionItem[];
    currentVersionId?: string;
    loading?: boolean;
    onPreview?: (versionId: string) => void;
    onRestore?: (versionId: string) => void;
    onCompare?: (versionIdA: string, versionIdB: string) => void;
    onLabel?: (versionId: string) => void;
  }

  let {
    versions,
    currentVersionId,
    loading = false,
    onPreview,
    onRestore,
    onCompare,
    onLabel,
  }: Props = $props();

  let selectedForCompare = $state<string | null>(null);
  let showLabeledOnly = $state(false);

  let filteredVersions = $derived(
    showLabeledOnly ? versions.filter((v) => v.versionLabel) : versions
  );

  function handleCompareClick(versionId: string) {
    if (!onCompare) return;

    if (selectedForCompare === null) {
      selectedForCompare = versionId;
    } else if (selectedForCompare === versionId) {
      selectedForCompare = null;
    } else {
      onCompare(selectedForCompare, versionId);
      selectedForCompare = null;
    }
  }

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

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getVersionTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      auto: "",
      manual: "Saved",
      publish: "Published",
      restore: "Restored",
    };
    return labels[type] || type;
  }
</script>

<div class="version-panel h-full flex flex-col border-l border-gray-200 bg-white">
  <!-- Header -->
  <div class="flex items-center justify-between p-3 border-b border-gray-200">
    <h3 class="flex items-center gap-2 text-sm font-semibold text-gray-900">
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      Version History
    </h3>

    <label class="flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
      <input
        type="checkbox"
        bind:checked={showLabeledOnly}
        class="w-3.5 h-3.5 rounded border-gray-300 text-esolia-navy focus:ring-esolia-navy"
      />
      <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
        />
      </svg>
      Labeled only
    </label>
  </div>

  <!-- Version List -->
  <div class="flex-1 overflow-y-auto">
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
    {:else if filteredVersions.length === 0}
      <div class="text-center py-8 text-gray-500 text-sm">
        {showLabeledOnly ? "No labeled versions" : "No versions yet"}
      </div>
    {:else}
      <ul class="divide-y divide-gray-100">
        {#each filteredVersions as version (version.id)}
          {@const isSelected = selectedForCompare === version.id}
          {@const isCurrent = currentVersionId === version.id}

          <li
            class="p-3 hover:bg-gray-50 transition-colors"
            class:bg-blue-50={isSelected}
            class:border-l-2={isSelected || isCurrent}
            class:border-l-esolia-navy={isSelected}
            class:border-l-green-500={isCurrent && !isSelected}
          >
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2">
                <span class="font-semibold text-sm text-gray-900">
                  v{version.versionNumber}
                </span>
                {#if version.versionLabel}
                  <span
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-esolia-orange/20 text-esolia-navy rounded"
                  >
                    <svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        stroke-width="2"
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    {version.versionLabel}
                  </span>
                {/if}
                {#if isCurrent}
                  <span
                    class="text-[10px] font-semibold uppercase px-1.5 py-0.5 bg-green-100 text-green-700 rounded"
                  >
                    Current
                  </span>
                {/if}
              </div>

              <span class="text-xs text-gray-400">{formatSize(version.contentSize)}</span>
            </div>

            <div class="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <span>{version.createdByName || version.createdByEmail}</span>
              <span>·</span>
              <time>{formatTime(version.createdAt)}</time>
            </div>

            {#if version.versionType !== "auto"}
              <div class="mt-1 text-xs text-gray-400 italic">
                {getVersionTypeLabel(version.versionType)}
              </div>
            {/if}

            <!-- Actions -->
            <div class="mt-2 flex items-center gap-1">
              {#if onPreview}
                <button
                  type="button"
                  onclick={() => onPreview(version.id)}
                  title="Preview"
                  class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                  </svg>
                </button>
              {/if}

              {#if onCompare}
                <button
                  type="button"
                  onclick={() => handleCompareClick(version.id)}
                  title={isSelected ? "Cancel comparison" : "Compare"}
                  class="p-1.5 rounded transition-colors"
                  class:text-white={isSelected}
                  class:bg-esolia-navy={isSelected}
                  class:text-gray-400={!isSelected}
                  class:hover:text-gray-600={!isSelected}
                  class:hover:bg-gray-100={!isSelected}
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </button>
              {/if}

              {#if onLabel && !version.versionLabel}
                <button
                  type="button"
                  onclick={() => onLabel(version.id)}
                  title="Add label"
                  class="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                    />
                  </svg>
                </button>
              {/if}

              {#if onRestore && !isCurrent}
                <button
                  type="button"
                  onclick={() => onRestore(version.id)}
                  title="Restore"
                  class="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                    />
                  </svg>
                </button>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </div>

  <!-- Compare prompt -->
  {#if selectedForCompare}
    <div
      class="p-3 bg-amber-50 border-t border-amber-100 flex items-center justify-between text-sm"
    >
      <span class="text-amber-800">Select another version to compare</span>
      <button
        type="button"
        onclick={() => (selectedForCompare = null)}
        class="text-amber-600 hover:text-amber-800"
      >
        Cancel
      </button>
    </div>
  {/if}
</div>

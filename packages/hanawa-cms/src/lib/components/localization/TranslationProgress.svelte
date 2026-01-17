<script lang="ts">
  /**
   * Translation Progress Component
   * InfoSec: Shows translation completion status for a document
   */

  type Locale = 'en' | 'ja';
  type TranslationStatus = 'pending' | 'in_progress' | 'review' | 'complete';

  interface LocaleProgress {
    locale: Locale;
    status: TranslationStatus;
    progressPercent: number;
    translatedFields: string[];
    pendingFields: string[];
  }

  interface Props {
    locales: LocaleProgress[];
    compact?: boolean;
    onClick?: (locale: Locale) => void;
  }

  let { locales, compact = false, onClick }: Props = $props();

  function getStatusColor(status: TranslationStatus) {
    const colors = {
      pending: 'text-gray-400',
      in_progress: 'text-amber-500',
      review: 'text-blue-500',
      complete: 'text-green-500',
    };
    return colors[status];
  }

  function getProgressColor(status: TranslationStatus) {
    const colors = {
      pending: 'bg-gray-300',
      in_progress: 'bg-amber-400',
      review: 'bg-blue-400',
      complete: 'bg-green-500',
    };
    return colors[status];
  }

  function getLocaleLabel(locale: Locale): string {
    return locale === 'en' ? 'English' : '日本語';
  }

  function getLocaleFlag(locale: Locale): string {
    return locale === 'en' ? '🇺🇸' : '🇯🇵';
  }
</script>

{#snippet progressContent(lp: LocaleProgress)}
  <div class="flex items-center justify-between mb-2">
    <div class="flex items-center gap-2">
      <span class="text-lg">{getLocaleFlag(lp.locale)}</span>
      <span class="font-medium text-sm text-gray-900">{getLocaleLabel(lp.locale)}</span>
    </div>

    <div class="flex items-center gap-2">
      <span class="text-xs {getStatusColor(lp.status)} font-medium">
        {lp.status.replace('_', ' ')}
      </span>
      <span class="text-xs text-gray-500">{lp.progressPercent}%</span>
    </div>
  </div>

  <!-- Progress bar -->
  <div class="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
    <div
      class="h-full rounded-full transition-all duration-300 {getProgressColor(lp.status)}"
      style="width: {lp.progressPercent}%"
    ></div>
  </div>

  <!-- Field counts -->
  <div class="mt-2 flex items-center gap-3 text-xs text-gray-500">
    <span class="flex items-center gap-1">
      <svg class="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      {lp.translatedFields.length} translated
    </span>
    {#if lp.pendingFields.length > 0}
      <span class="flex items-center gap-1">
        <svg class="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        {lp.pendingFields.length} pending
      </span>
    {/if}
  </div>
{/snippet}

{#if compact}
  <!-- Compact inline display -->
  <div class="flex items-center gap-2">
    {#each locales as lp}
      <button
        type="button"
        onclick={() => onClick?.(lp.locale)}
        disabled={!onClick}
        class="flex items-center gap-1 text-xs disabled:cursor-default"
        title="{getLocaleLabel(lp.locale)}: {lp.progressPercent}% ({lp.status})"
      >
        <span>{getLocaleFlag(lp.locale)}</span>
        <div class="w-8 h-1 bg-gray-200 rounded-full overflow-hidden">
          <div
            class="h-full rounded-full {getProgressColor(lp.status)}"
            style="width: {lp.progressPercent}%"
          ></div>
        </div>
      </button>
    {/each}
  </div>
{:else}
  <!-- Full progress display -->
  <div class="space-y-3">
    {#each locales as lp}
      {#if onClick}
        <button
          type="button"
          class="w-full text-left p-3 border border-gray-200 rounded-lg hover:border-gray-300 transition-colors cursor-pointer"
          onclick={() => onClick?.(lp.locale)}
        >
          {@render progressContent(lp)}
        </button>
      {:else}
        <div class="p-3 border border-gray-200 rounded-lg">
          {@render progressContent(lp)}
        </div>
      {/if}
    {/each}
  </div>
{/if}

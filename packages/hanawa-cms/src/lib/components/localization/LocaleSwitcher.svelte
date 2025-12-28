<script lang="ts">
  /**
   * Locale Switcher Component
   * InfoSec: Toggle between EN/JA with translation status indicator
   */

  type Locale = "en" | "ja";
  type TranslationStatus = "pending" | "in_progress" | "review" | "complete";

  interface Props {
    currentLocale: Locale;
    availableLocales?: Locale[];
    defaultLocale?: Locale;
    translationStatus?: Partial<Record<Locale, TranslationStatus>>;
    disabled?: boolean;
    compact?: boolean;
    onChange: (locale: Locale) => void;
  }

  let {
    currentLocale,
    availableLocales = ["en", "ja"],
    defaultLocale = "en",
    translationStatus = {},
    disabled = false,
    compact = false,
    onChange,
  }: Props = $props();

  const localeLabels: Record<Locale, { short: string; full: string; native: string }> = {
    en: { short: "EN", full: "English", native: "English" },
    ja: { short: "JA", full: "Japanese", native: "日本語" },
  };

  function getStatusColor(status?: TranslationStatus) {
    if (!status) return "";
    const colors = {
      pending: "bg-gray-300",
      in_progress: "bg-amber-400",
      review: "bg-blue-400",
      complete: "bg-green-400",
    };
    return colors[status];
  }

  function getStatusLabel(status?: TranslationStatus) {
    if (!status) return "";
    const labels = {
      pending: "Pending",
      in_progress: "In Progress",
      review: "In Review",
      complete: "Complete",
    };
    return labels[status];
  }
</script>

{#if compact}
  <!-- Compact toggle buttons -->
  <div class="inline-flex rounded-lg border border-gray-200 p-0.5 bg-gray-50">
    {#each availableLocales as locale}
      {@const isActive = currentLocale === locale}
      {@const isDefault = defaultLocale === locale}
      {@const status = translationStatus[locale]}

      <button
        type="button"
        onclick={() => onChange(locale)}
        {disabled}
        class="relative px-3 py-1 text-xs font-medium rounded-md transition-colors disabled:opacity-50"
        class:bg-white={isActive}
        class:shadow-sm={isActive}
        class:text-esolia-navy={isActive}
        class:text-gray-500={!isActive}
        class:hover:text-gray-700={!isActive && !disabled}
        title="{localeLabels[locale].full}{isDefault ? ' (default)' : ''}"
      >
        {localeLabels[locale].short}
        {#if isDefault}
          <span class="sr-only">(default)</span>
        {/if}
        {#if status && status !== "complete"}
          <span
            class="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full {getStatusColor(status)}"
            title={getStatusLabel(status)}
          ></span>
        {/if}
      </button>
    {/each}
  </div>
{:else}
  <!-- Full locale selector with dropdown -->
  <div class="relative inline-block">
    <div class="flex items-center gap-2">
      {#each availableLocales as locale}
        {@const isActive = currentLocale === locale}
        {@const isDefault = defaultLocale === locale}
        {@const status = translationStatus[locale]}

        <button
          type="button"
          onclick={() => onChange(locale)}
          {disabled}
          class="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors disabled:opacity-50 {isActive
            ? 'border-esolia-navy bg-esolia-navy/5'
            : 'border-gray-200'} {!isActive && !disabled ? 'hover:border-gray-300' : ''}"
        >
          <!-- Flag indicator -->
          <span class="text-base" role="img" aria-label={localeLabels[locale].full}>
            {locale === "en" ? "🇺🇸" : "🇯🇵"}
          </span>

          <div class="text-left">
            <div class="text-sm font-medium" class:text-esolia-navy={isActive} class:text-gray-900={!isActive}>
              {localeLabels[locale].native}
              {#if isDefault}
                <span class="text-[10px] text-gray-400 ml-1">(default)</span>
              {/if}
            </div>
            {#if status}
              <div class="flex items-center gap-1 text-[10px] text-gray-500">
                <span class="w-1.5 h-1.5 rounded-full {getStatusColor(status)}"></span>
                {getStatusLabel(status)}
              </div>
            {/if}
          </div>

          {#if isActive}
            <svg class="w-4 h-4 text-esolia-navy" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          {/if}
        </button>
      {/each}
    </div>
  </div>
{/if}

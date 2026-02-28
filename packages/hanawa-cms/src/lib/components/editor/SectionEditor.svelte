<!--
  SectionEditor Component
  Per-section wrapper for assembled documents: editor + controls

  Usage:
  <SectionEditor
    {section}
    {contentEn}
    {contentJa}
    {languageMode}
    {index}
    oncontentchange={handleContentChange}
    onremove={handleRemove}
    onrefresh={handleRefresh}
  />
-->
<script lang="ts">
  import DotsSixVertical from 'phosphor-svelte/lib/DotsSixVertical';
  import Lock from 'phosphor-svelte/lib/Lock';
  import LockOpen from 'phosphor-svelte/lib/LockOpen';
  import ArrowsClockwise from 'phosphor-svelte/lib/ArrowsClockwise';
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
  import Trash from 'phosphor-svelte/lib/Trash';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';
  import CaretRight from 'phosphor-svelte/lib/CaretRight';
  import Translate from 'phosphor-svelte/lib/Translate';
  import { deserialize } from '$app/forms';
  import HanawaEditor from './HanawaEditor.svelte';

  import type { ManifestSection } from '$lib/server/manifest';

  interface Props {
    section: ManifestSection;
    contentEn: string;
    contentJa: string;
    languageMode: string;
    index: number;
    collapsed?: boolean;
    ontogglecollapse?: (index: number) => void;
    disabled?: boolean;
    oncontentchange?: (index: number, lang: 'en' | 'ja', content: string) => void;
    onremove?: (index: number) => void;
    onrefresh?: (index: number) => void;
    ondragstart?: (e: DragEvent, index: number) => void;
    ondragover?: (e: DragEvent, index: number) => void;
    ondragend?: () => void;
  }

  let {
    section,
    contentEn,
    contentJa,
    languageMode,
    index,
    collapsed = false,
    ontogglecollapse,
    disabled = false,
    oncontentchange,
    onremove,
    onrefresh,
    ondragstart,
    ondragover,
    ondragend,
  }: Props = $props();
  let confirmRemove = $state(false);
  let isTranslating = $state(false);

  // Local editor content — $effect syncs from parent when props change (e.g., after refresh)
  let localEn = $state('');
  let localJa = $state('');

  $effect(() => {
    localEn = contentEn;
  });
  $effect(() => {
    localJa = contentJa;
  });

  const showEnglish = $derived(languageMode === 'en' || languageMode.startsWith('both_'));
  const showJapanese = $derived(languageMode === 'ja' || languageMode.startsWith('both_'));
  const showBoth = $derived(showEnglish && showJapanese);
  const defaultTab = $derived<'en' | 'ja'>(languageMode === 'both_ja_first' ? 'ja' : 'en');
  let activeTab = $state<'en' | 'ja'>('en');

  // Reset active tab when language mode changes
  $effect(() => {
    activeTab = defaultTab;
  });

  // Fragment source info
  const hasSource = $derived(section.source !== null && section.source !== '');
  const fragmentEditUrl = $derived(
    hasSource ? `/fragments/${section.source?.split('/').pop()}` : null
  );

  function handleEnChange(content: string) {
    localEn = content;
    oncontentchange?.(index, 'en', content);
  }

  function handleJaChange(content: string) {
    localJa = content;
    oncontentchange?.(index, 'ja', content);
  }

  function handleRemoveClick() {
    if (confirmRemove) {
      onremove?.(index);
      confirmRemove = false;
    } else {
      confirmRemove = true;
      // Auto-reset confirmation after 3s
      setTimeout(() => (confirmRemove = false), 3000);
    }
  }

  async function handleTranslate() {
    if (isTranslating || disabled) return;
    const sourceLang = activeTab;
    const sourceContent = sourceLang === 'en' ? localEn : localJa;
    if (!sourceContent) return;

    isTranslating = true;
    try {
      const formData = new FormData();
      formData.set('text', sourceContent);
      formData.set('source_locale', sourceLang);

      const response = await fetch('?/aiTranslate', { method: 'POST', body: formData });
      const result = deserialize(await response.text());

      if (result.type === 'success') {
        const resultData = result.data as { translated?: string };
        if (resultData?.translated) {
          const targetLang = sourceLang === 'en' ? 'ja' : 'en';
          if (targetLang === 'ja') {
            localJa = resultData.translated;
            oncontentchange?.(index, 'ja', resultData.translated);
          } else {
            localEn = resultData.translated;
            oncontentchange?.(index, 'en', resultData.translated);
          }
          activeTab = targetLang;
        }
      }
    } catch (err) {
      console.error('Section translation failed:', err);
    } finally {
      isTranslating = false;
    }
  }
</script>

<div
  role="listitem"
  draggable={!disabled}
  ondragstart={(e) => ondragstart?.(e, index)}
  ondragover={(e) => ondragover?.(e, index)}
  ondragend={() => ondragend?.()}
  class="bg-white rounded-lg shadow border border-gray-200 transition-shadow hover:shadow-md"
  data-section-index={index}
>
  <!-- Section Header -->
  <div class="flex items-center gap-2 px-4 py-3 border-b border-gray-100 bg-gray-50 rounded-t-lg">
    <!-- Drag Handle -->
    {#if !disabled}
      <button
        type="button"
        class="cursor-move text-gray-400 hover:text-gray-600"
        aria-label="Drag to reorder"
      >
        <DotsSixVertical size={18} />
      </button>
    {/if}

    <!-- Order Badge -->
    <span
      class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium bg-esolia-navy text-white"
    >
      {index + 1}
    </span>

    <!-- Collapse Toggle -->
    <button
      type="button"
      onclick={() => ontogglecollapse?.(index)}
      class="text-gray-500 hover:text-gray-700"
      aria-label={collapsed ? 'Expand section' : 'Collapse section'}
    >
      {#if collapsed}
        <CaretRight size={16} weight="bold" />
      {:else}
        <CaretDown size={16} weight="bold" />
      {/if}
    </button>

    <!-- Section Label -->
    <div class="flex-1 min-w-0">
      <span class="text-sm font-medium text-gray-900 truncate block">
        {section.label}
      </span>
      {#if section.label_ja}
        <span class="text-xs text-gray-500 truncate block">{section.label_ja}</span>
      {/if}
    </div>

    <!-- Source Badge -->
    {#if hasSource}
      <span class="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full whitespace-nowrap">
        {section.source}
      </span>
    {/if}

    <!-- Lock Indicator -->
    {#if section.locked}
      <span class="text-amber-600" title="Locked (read-only)">
        <Lock size={16} weight="duotone" />
      </span>
    {:else}
      <span class="text-gray-300" title="Editable">
        <LockOpen size={16} />
      </span>
    {/if}

    <!-- Action Buttons -->
    <div class="flex items-center gap-1 ml-2">
      {#if hasSource}
        <button
          type="button"
          onclick={() => onrefresh?.(index)}
          class="p-1.5 rounded text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
          title="Refresh from source fragment"
        >
          <ArrowsClockwise size={14} />
        </button>
        {#if fragmentEditUrl}
          <a
            href={fragmentEditUrl}
            target="_blank"
            rel="noopener noreferrer"
            class="p-1.5 rounded text-gray-500 hover:text-esolia-navy hover:bg-gray-100 transition-colors"
            title="Edit original fragment"
          >
            <PencilSimple size={14} />
          </a>
        {/if}
      {/if}
      <button
        type="button"
        onclick={handleRemoveClick}
        class="p-1.5 rounded transition-colors
               {confirmRemove
          ? 'text-red-600 bg-red-50 hover:bg-red-100'
          : 'text-gray-400 hover:text-red-600 hover:bg-red-50'}"
        title={confirmRemove ? 'Click again to confirm removal' : 'Remove section'}
      >
        <Trash size={14} />
      </button>
    </div>
  </div>

  <!-- Section Body -->
  {#if !collapsed}
    <div class="p-4 space-y-4">
      {#if section.locked}
        <!-- Locked preview -->
        <div class="text-sm text-gray-500 italic bg-gray-50 rounded p-3 border border-gray-100">
          This section is locked. Content is read-only.
        </div>
        {#if showEnglish && localEn}
          <div class="prose prose-sm max-w-none opacity-75">
            <div class="text-xs font-medium text-gray-400 mb-1">EN</div>
            <pre
              class="whitespace-pre-wrap text-sm text-gray-600 bg-gray-50 p-3 rounded">{localEn}</pre>
          </div>
        {/if}
        {#if showJapanese && localJa}
          <div class="prose prose-sm max-w-none opacity-75">
            <div class="text-xs font-medium text-gray-400 mb-1">JA</div>
            <pre
              class="whitespace-pre-wrap text-sm text-gray-600 bg-gray-50 p-3 rounded">{localJa}</pre>
          </div>
        {/if}
      {:else}
        <!-- Editable editors -->
        {#if showBoth}
          <!-- Language tabs for bilingual sections -->
          <div class="flex border-b border-gray-200">
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium {activeTab === 'en'
                ? 'border-b-2 border-esolia-navy text-esolia-navy'
                : 'text-gray-500 hover:text-gray-700'}"
              onclick={() => (activeTab = 'en')}>English</button
            >
            <button
              type="button"
              class="px-4 py-2 text-sm font-medium {activeTab === 'ja'
                ? 'border-b-2 border-esolia-navy text-esolia-navy'
                : 'text-gray-500 hover:text-gray-700'}"
              onclick={() => (activeTab = 'ja')}>日本語</button
            >
            <button
              type="button"
              onclick={handleTranslate}
              disabled={disabled || isTranslating || !(activeTab === 'en' ? localEn : localJa)}
              class="ml-auto flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Translate size={14} />
              {#if isTranslating}
                Translating...
              {:else}
                {activeTab === 'en' ? 'EN → JA' : 'JA → EN'}
              {/if}
            </button>
          </div>
          {#if activeTab === 'en'}
            <HanawaEditor
              content={localEn}
              contentType="markdown"
              editable={!disabled}
              placeholder="Write section content (English)..."
              onchange={handleEnChange}
            />
          {:else}
            <HanawaEditor
              content={localJa}
              contentType="markdown"
              editable={!disabled}
              placeholder="セクションの内容を入力（日本語）..."
              onchange={handleJaChange}
            />
          {/if}
        {:else if showEnglish}
          <HanawaEditor
            content={localEn}
            contentType="markdown"
            editable={!disabled}
            placeholder="Write section content (English)..."
            onchange={handleEnChange}
          />
        {:else if showJapanese}
          <HanawaEditor
            content={localJa}
            contentType="markdown"
            editable={!disabled}
            placeholder="セクションの内容を入力（日本語）..."
            onchange={handleJaChange}
          />
        {/if}
      {/if}
    </div>
  {/if}
</div>

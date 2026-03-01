<script lang="ts">
  /**
   * Fragment Edit Page
   * Two-column layout: metadata panel + markdown editors (EN/JA/Side-by-side)
   */
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import HanawaEditor from '$lib/components/editor/HanawaEditor.svelte';
  import WritingTips from '$lib/components/editor/WritingTips.svelte';
  import QCResultPanel from '$lib/components/editor/QCResultPanel.svelte';
  import { browser } from '$app/environment';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // AI translate state
  let isTranslating = $state<string | null>(null); // tracks which field is translating

  // Tab state
  let activeTab = $state<'en' | 'ja' | 'side-by-side'>('en');

  // Form state — initialized from data
  let titleEn = $state('');
  let titleJa = $state('');
  let category = $state('');
  let type = $state('');
  let status = $state('production');
  let sensitivity = $state('normal');
  let tagsInput = $state('');
  let author = $state('');
  let version = $state('');
  let contentEn = $state('');
  let contentJa = $state('');

  // UI state
  let showDeleteConfirm = $state(false);
  let showRenameModal = $state(false);
  let newId = $state('');
  let newCategory = $state('');
  let isSaving = $state(false);
  let metadataCollapsed = $state(false);
  let isRunningQC = $state(false);

  // QC state — initialized from data in $effect below
  interface QCIssueUI {
    severity: 'error' | 'warning' | 'info';
    rule: string;
    message: string;
    suggestion?: string;
    location?: string;
  }
  let qcScore = $state<number | null>(null);
  let qcIssues = $state<QCIssueUI[]>([]);
  let qcCheckedAt = $state<string | null>(null);

  /** Translate text via fetch to avoid nested form issues */
  async function aiTranslate(text: string, sourceLocale: 'en' | 'ja', field: 'title' | 'content') {
    const targetField =
      field === 'title'
        ? sourceLocale === 'en'
          ? 'title_ja'
          : 'title_en'
        : sourceLocale === 'en'
          ? 'content_ja'
          : 'content_en';
    isTranslating = targetField;

    try {
      const formData = new FormData();
      formData.set('text', text);
      formData.set('source_locale', sourceLocale);
      formData.set('field', field);

      const response = await fetch('?/aiTranslate', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();
      // SvelteKit returns { type, data } for form action responses
      const resultData = (result as { data?: string })?.data;
      const parsed =
        typeof resultData === 'string' ? (JSON.parse(resultData) as Record<string, unknown>) : {};

      if (parsed?.translated) {
        const translated = parsed.translated as string;
        const targetLocale = sourceLocale === 'en' ? 'ja' : 'en';
        if (field === 'title' && targetLocale === 'ja') titleJa = translated;
        else if (field === 'title' && targetLocale === 'en') titleEn = translated;
        else if (field === 'content' && targetLocale === 'ja') contentJa = translated;
        else if (field === 'content' && targetLocale === 'en') contentEn = translated;
      }
    } catch (err) {
      console.error('Translation request failed:', err);
    } finally {
      isTranslating = null;
    }
  }

  /** Generate today's version string (YYYYMMDDA, B, C...) */
  function bumpVersion(current: string): string {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    if (current && current.startsWith(today) && current.length === 9) {
      const next = String.fromCharCode(current.charCodeAt(8) + 1);
      return today + next;
    }
    return today + 'A';
  }

  // Initialize form state from data
  $effect(() => {
    titleEn = data.fragment.title_en || '';
    titleJa = data.fragment.title_ja || '';
    category = data.fragment.category || '';
    type = data.fragment.type || '';
    status = data.fragment.status || 'production';
    sensitivity = data.fragment.sensitivity || 'normal';
    tagsInput = (data.fragment.tags || []).join(', ');
    author = data.fragment.author || '';
    version = bumpVersion(data.fragment.version || '');
    contentEn = data.fragment.content_en || '';
    contentJa = data.fragment.content_ja || '';
    qcScore = data.fragment.qc_score ?? null;
    qcIssues = (data.fragment.qc_issues as QCIssueUI[]) || [];
    qcCheckedAt = data.fragment.last_qc_at || null;
  });

  function formatTags(): string {
    const tags = tagsInput
      .split(',')
      .map((t: string) => t.trim())
      .filter(Boolean);
    return JSON.stringify(tags);
  }

  // Handle QC result from form action
  $effect(() => {
    if (form && 'qcResult' in form) {
      const r = form.qcResult as { score: number; issues: QCIssueUI[]; checkedAt: string };
      qcScore = r.score;
      qcIssues = r.issues;
      qcCheckedAt = r.checkedAt;
    }
  });

  // QC nudge: show if never checked or last check > 7 days ago
  const showQCNudge = $derived(() => {
    if (!qcCheckedAt) return true;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return new Date(qcCheckedAt).getTime() < weekAgo;
  });

  function getQCBadgeStyle(s: number): string {
    if (s >= 90) return 'bg-green-100 text-green-800';
    if (s >= 70) return 'bg-yellow-100 text-yellow-800';
    if (s >= 50) return 'bg-orange-100 text-orange-800';
    return 'bg-red-100 text-red-800';
  }

  // Status options
  const statusOptions = ['production', 'draft', 'deprecated', 'archived'];
  const sensitivityOptions = ['normal', 'confidential', 'embargoed'];

  // Get status badge style
  function getStatusStyle(s: string): string {
    switch (s) {
      case 'production':
        return 'bg-green-100 text-green-800';
      case 'draft':
        return 'bg-yellow-100 text-yellow-800';
      case 'deprecated':
        return 'bg-red-100 text-red-800';
      case 'archived':
        return 'bg-gray-100 text-gray-600';
      default:
        return 'bg-gray-100 text-gray-600';
    }
  }
</script>

<svelte:head>
  <title>{data.fragment.title_en || data.fragment.id} | Fragments | Hanawa CMS</title>
</svelte:head>

<div class="space-y-4">
  <!-- Breadcrumb -->
  <nav class="flex items-center space-x-2 text-sm text-gray-500">
    <a href="/fragments" class="hover:text-esolia-navy">Fragments</a>
    <span>/</span>
    <span class="text-gray-900">{data.fragment.title_en || data.fragment.id}</span>
  </nav>

  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      <h1 class="text-2xl font-bold text-esolia-navy">
        {data.fragment.title_en || data.fragment.id}
      </h1>
      <div class="flex items-center gap-2 mt-1">
        <code class="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600">{data.fragment.id}</code
        >
        {#if data.fragment.category}
          <span class="text-xs text-gray-400">in</span>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-esolia-orange/20 text-esolia-navy"
          >
            {data.fragment.category}
          </span>
        {/if}
        <span
          class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getStatusStyle(
            data.fragment.status
          )}"
        >
          {data.fragment.status}
        </span>
        {#if qcScore !== null}
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium {getQCBadgeStyle(
              qcScore
            )}"
            title="QC Score"
          >
            QC: {qcScore}
          </span>
        {/if}
      </div>
    </div>
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={() => {
          newId = data.fragment.id;
          newCategory = data.fragment.category || '';
          showRenameModal = true;
        }}
        class="px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors text-sm"
      >
        Rename
      </button>
      <button
        type="button"
        onclick={() => (showDeleteConfirm = true)}
        class="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors text-sm"
      >
        Delete
      </button>
    </div>
  </div>

  <!-- Feedback messages -->
  {#if form?.success}
    <div class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
      Fragment saved successfully.
    </div>
  {:else if form?.saveForm?.message}
    <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
      Error: {form.saveForm.message}
    </div>
  {:else if form?.renameForm?.message}
    <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
      Rename error: {form.renameForm.message}
    </div>
  {/if}

  {#if form && 'qcError' in form}
    <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
      QC check error: {form.qcError}
    </div>
  {/if}

  <!-- Main form -->
  <form
    method="POST"
    action="?/save"
    use:enhance={() => {
      isSaving = true;
      return async ({ update }) => {
        await update();
        isSaving = false;
      };
    }}
  >
    <!-- Two-column layout -->
    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
      <!-- Left column: Metadata Panel -->
      <div class="space-y-4">
        <div class="bg-white rounded-lg shadow">
          <button
            type="button"
            class="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-900 border-b border-gray-100"
            onclick={() => (metadataCollapsed = !metadataCollapsed)}
          >
            Metadata
            <svg
              class="w-4 h-4 transition-transform {metadataCollapsed ? '' : 'rotate-180'}"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {#if !metadataCollapsed}
            <div class="p-4 space-y-3">
              <!-- Titles -->
              <div>
                <div class="flex items-center justify-between">
                  <label
                    for="title_en"
                    class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Title (EN)</label
                  >
                  {#if titleEn}
                    <button
                      type="button"
                      disabled={isTranslating === 'title_ja'}
                      class="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      title="Translate to Japanese"
                      onclick={() => aiTranslate(titleEn, 'en', 'title')}
                    >
                      {isTranslating === 'title_ja' ? 'Translating...' : '→ JA'}
                    </button>
                  {/if}
                </div>
                <input
                  type="text"
                  id="title_en"
                  name="title_en"
                  bind:value={titleEn}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  placeholder="English title"
                />
              </div>
              <div>
                <div class="flex items-center justify-between">
                  <label
                    for="title_ja"
                    class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Title (JA)</label
                  >
                  {#if titleJa}
                    <button
                      type="button"
                      disabled={isTranslating === 'title_en'}
                      class="text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50"
                      title="Translate to English"
                      onclick={() => aiTranslate(titleJa, 'ja', 'title')}
                    >
                      {isTranslating === 'title_en' ? 'Translating...' : '→ EN'}
                    </button>
                  {/if}
                </div>
                <input
                  type="text"
                  id="title_ja"
                  name="title_ja"
                  bind:value={titleJa}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  placeholder="日本語タイトル"
                />
              </div>

              <!-- Category -->
              <div>
                <label
                  for="category"
                  class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >Category</label
                >
                <input
                  type="text"
                  id="category"
                  name="category"
                  bind:value={category}
                  list="category-suggestions"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  placeholder="e.g., products, services"
                />
                <datalist id="category-suggestions">
                  <option value="capabilities"></option>
                  <option value="closing"></option>
                  <option value="company"></option>
                  <option value="comparisons"></option>
                  <option value="diagrams"></option>
                  <option value="products"></option>
                  <option value="proposals"></option>
                  <option value="services"></option>
                  <option value="terms"></option>
                </datalist>
              </div>

              <!-- Type -->
              <div>
                <label
                  for="type"
                  class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >Type</label
                >
                <input
                  type="text"
                  id="type"
                  name="type"
                  bind:value={type}
                  list="type-suggestions"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  placeholder="e.g., content, diagram"
                />
                <datalist id="type-suggestions">
                  <option value="capability-description"></option>
                  <option value="closing"></option>
                  <option value="company-info"></option>
                  <option value="content"></option>
                  <option value="diagram"></option>
                  <option value="legal"></option>
                  <option value="pricing"></option>
                  <option value="product-overview"></option>
                  <option value="proposal-section"></option>
                  <option value="service-description"></option>
                </datalist>
              </div>

              <!-- Status + Sensitivity -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label
                    for="status"
                    class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Status</label
                  >
                  <select
                    id="status"
                    name="status"
                    bind:value={status}
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  >
                    {#each statusOptions as opt}
                      <option value={opt}>{opt}</option>
                    {/each}
                  </select>
                </div>
                <div>
                  <label
                    for="sensitivity"
                    class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Sensitivity</label
                  >
                  <select
                    id="sensitivity"
                    name="sensitivity"
                    bind:value={sensitivity}
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  >
                    {#each sensitivityOptions as opt}
                      <option value={opt}>{opt}</option>
                    {/each}
                  </select>
                </div>
              </div>

              <!-- Tags -->
              <div>
                <label
                  for="tags"
                  class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >Tags (comma-separated)</label
                >
                <input
                  type="text"
                  id="tags"
                  bind:value={tagsInput}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  placeholder="security, m365, compliance"
                />
                <input type="hidden" name="tags" value={formatTags()} />
              </div>

              <!-- Author + Version -->
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label
                    for="author"
                    class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Author</label
                  >
                  <input
                    type="text"
                    id="author"
                    name="author"
                    bind:value={author}
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  />
                </div>
                <div>
                  <label
                    for="version"
                    class="block text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >Version</label
                  >
                  <input
                    type="text"
                    id="version"
                    name="version"
                    bind:value={version}
                    placeholder="auto"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  />
                  <p class="mt-0.5 text-xs text-gray-400">YYYYMMDDA — auto-bumps</p>
                </div>
              </div>

              <!-- Timestamps -->
              {#if data.fragment.created_at || data.fragment.updated_at}
                <div class="pt-2 border-t border-gray-100 text-xs text-gray-400">
                  {#if data.fragment.created_at}
                    <p>Created: {data.fragment.created_at}</p>
                  {/if}
                  {#if data.fragment.updated_at}
                    <p>Updated: {data.fragment.updated_at}</p>
                  {/if}
                </div>
              {/if}
            </div>
          {/if}
        </div>

        <!-- Save & Actions -->
        <div class="flex flex-col gap-2">
          <button
            type="submit"
            disabled={isSaving}
            class="w-full px-4 py-2 bg-esolia-orange text-esolia-navy rounded-lg hover:bg-esolia-orange/90 transition-colors font-medium disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save Fragment'}
          </button>
        </div>

        <!-- Run QC Button (uses fetch to avoid nested form) -->
        <button
          type="button"
          disabled={isRunningQC || (!contentEn && !contentJa)}
          onclick={async () => {
            isRunningQC = true;
            try {
              const formData = new FormData();
              formData.set('qc_content_en', contentEn);
              formData.set('qc_content_ja', contentJa);
              formData.set('qc_user_email', data.fragment.author || '');
              const response = await fetch('?/qcCheck', { method: 'POST', body: formData });
              const result = await response.json();
              const resultData = (result as { data?: string })?.data;
              const parsed =
                typeof resultData === 'string'
                  ? (JSON.parse(resultData) as Record<string, unknown>)
                  : {};
              if (parsed?.qcResult) {
                const r = parsed.qcResult as {
                  score: number;
                  issues: QCIssueUI[];
                  checkedAt: string;
                };
                qcScore = r.score;
                qcIssues = r.issues;
                qcCheckedAt = r.checkedAt;
              } else if (parsed?.qcError) {
                console.error('QC error:', parsed.qcError);
              }
            } catch (err) {
              console.error('QC check request failed:', err);
            } finally {
              isRunningQC = false;
            }
          }}
          class="w-full px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm disabled:opacity-50"
        >
          {#if isRunningQC}
            <span class="inline-flex items-center gap-1.5">
              <svg class="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
                <circle
                  class="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  stroke-width="4"
                ></circle>
                <path
                  class="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              Running QC...
            </span>
          {:else}
            Run QC Check
          {/if}
        </button>

        <!-- QC Nudge -->
        {#if showQCNudge() && !isRunningQC && (contentEn || contentJa)}
          <div
            class="bg-amber-50 border border-amber-200 text-amber-800 px-3 py-2 rounded-lg text-xs"
          >
            {#if !qcCheckedAt}
              Content hasn't been QC-checked yet.
            {:else}
              QC check is over 7 days old.
            {/if}
          </div>
        {/if}

        <!-- Writing Tips -->
        <WritingTips lang={activeTab === 'ja' ? 'ja' : 'en'} />
      </div>

      <!-- Right column: Content Editors -->
      <div class="bg-white rounded-lg shadow">
        <!-- Tab bar -->
        <div class="border-b border-gray-200">
          <nav class="flex items-center -mb-px">
            <button
              type="button"
              class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
              class:border-esolia-navy={activeTab === 'en'}
              class:text-esolia-navy={activeTab === 'en'}
              class:border-transparent={activeTab !== 'en'}
              class:text-gray-500={activeTab !== 'en'}
              onclick={() => (activeTab = 'en')}
            >
              English
              {#if !contentEn}
                <span class="ml-1 text-xs text-gray-400">(empty)</span>
              {/if}
            </button>
            {#if contentEn}
              <button
                type="button"
                disabled={isTranslating === 'content_ja'}
                class="self-center px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                title="Translate English content to Japanese"
                onclick={() => aiTranslate(contentEn, 'en', 'content')}
              >
                {isTranslating === 'content_ja' ? 'Translating...' : '→ JA'}
              </button>
            {/if}
            <button
              type="button"
              class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
              class:border-esolia-navy={activeTab === 'ja'}
              class:text-esolia-navy={activeTab === 'ja'}
              class:border-transparent={activeTab !== 'ja'}
              class:text-gray-500={activeTab !== 'ja'}
              onclick={() => (activeTab = 'ja')}
            >
              Japanese
              {#if !contentJa}
                <span class="ml-1 text-xs text-gray-400">(empty)</span>
              {/if}
            </button>
            {#if contentJa}
              <button
                type="button"
                disabled={isTranslating === 'content_en'}
                class="self-center px-2 py-1 text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                title="Translate Japanese content to English"
                onclick={() => aiTranslate(contentJa, 'ja', 'content')}
              >
                {isTranslating === 'content_en' ? 'Translating...' : '→ EN'}
              </button>
            {/if}
            <button
              type="button"
              class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
              class:border-esolia-navy={activeTab === 'side-by-side'}
              class:text-esolia-navy={activeTab === 'side-by-side'}
              class:border-transparent={activeTab !== 'side-by-side'}
              class:text-gray-500={activeTab !== 'side-by-side'}
              onclick={() => (activeTab = 'side-by-side')}
            >
              Side by Side
            </button>
          </nav>
        </div>

        <!-- Editor area -->
        <div class="p-4">
          <!-- Hidden inputs for form submission -->
          <input type="hidden" name="content_en" value={contentEn} />
          <input type="hidden" name="content_ja" value={contentJa} />

          {#if activeTab === 'en'}
            <div class="min-h-[400px]">
              {#if browser}
                <HanawaEditor
                  bind:content={contentEn}
                  contentType="markdown"
                  placeholder="Start writing English content..."
                />
              {:else}
                <textarea
                  bind:value={contentEn}
                  rows="20"
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
                  placeholder="English content (Markdown)..."
                ></textarea>
              {/if}
            </div>
          {:else if activeTab === 'ja'}
            <div class="min-h-[400px]">
              {#if browser}
                <HanawaEditor
                  bind:content={contentJa}
                  contentType="markdown"
                  placeholder="日本語のコンテンツを入力..."
                />
              {:else}
                <textarea
                  bind:value={contentJa}
                  rows="20"
                  class="w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
                  placeholder="Japanese content (Markdown)..."
                ></textarea>
              {/if}
            </div>
          {:else}
            <!-- Side by side -->
            <div class="grid grid-cols-2 gap-4 min-h-[400px]">
              <div>
                <h3 class="text-xs font-medium text-gray-500 uppercase mb-2">English</h3>
                {#if browser}
                  <HanawaEditor
                    bind:content={contentEn}
                    contentType="markdown"
                    placeholder="English content..."
                  />
                {:else}
                  <textarea
                    bind:value={contentEn}
                    rows="20"
                    class="w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
                  ></textarea>
                {/if}
              </div>
              <div>
                <h3 class="text-xs font-medium text-gray-500 uppercase mb-2">Japanese</h3>
                {#if browser}
                  <HanawaEditor
                    bind:content={contentJa}
                    contentType="markdown"
                    placeholder="日本語のコンテンツ..."
                  />
                {:else}
                  <textarea
                    bind:value={contentJa}
                    rows="20"
                    class="w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
                  ></textarea>
                {/if}
              </div>
            </div>
          {/if}
        </div>
      </div>
    </div>
  </form>

  <!-- QC Results Panel -->
  {#if qcScore !== null}
    <QCResultPanel score={qcScore} issues={qcIssues} checkedAt={qcCheckedAt} />
  {/if}
</div>

<!-- Rename Modal -->
{#if showRenameModal}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 w-full">
      <h3 class="text-lg font-semibold text-gray-900">Rename Fragment</h3>

      <form method="POST" action="?/rename" use:enhance>
        <div class="mt-4 space-y-3">
          <div>
            <label for="new_id" class="block text-sm font-medium text-gray-700">New ID</label>
            <input
              type="text"
              id="new_id"
              name="new_id"
              bind:value={newId}
              pattern="[a-z0-9][a-z0-9-]*[a-z0-9]"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
              placeholder="new-fragment-id"
            />
            <p class="mt-1 text-xs text-gray-500">Lowercase letters, numbers, hyphens only</p>
          </div>

          <div>
            <label for="new_category" class="block text-sm font-medium text-gray-700"
              >Category (optional)</label
            >
            <input
              type="text"
              id="new_category"
              name="new_category"
              bind:value={newCategory}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
              placeholder="Keep current: {data.fragment.category}"
            />
          </div>

          <!-- Preview -->
          <div class="bg-gray-50 rounded-lg p-3 text-sm">
            <p class="text-gray-500">Preview:</p>
            <p class="font-mono text-xs mt-1">
              <span class="text-red-500 line-through"
                >fragments/{data.fragment.category}/{data.fragment.id}</span
              >
            </p>
            <p class="font-mono text-xs">
              <span class="text-green-600"
                >fragments/{newCategory || data.fragment.category}/{newId}</span
              >
            </p>
          </div>
        </div>

        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onclick={() => (showRenameModal = false)}
            class="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!newId || newId === data.fragment.id}
            class="px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors disabled:opacity-50"
          >
            Rename
          </button>
        </div>
      </form>
    </div>
  </div>
{/if}

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4">
      <h3 class="text-lg font-semibold text-gray-900">Delete Fragment</h3>
      <p class="mt-2 text-gray-600">
        Are you sure you want to delete "{data.fragment.title_en || data.fragment.id}"? This will
        remove the fragment from R2 and the index. This action cannot be undone.
      </p>
      <div class="mt-6 flex justify-end gap-3">
        <button
          type="button"
          onclick={() => (showDeleteConfirm = false)}
          class="px-4 py-2 text-gray-700 hover:text-gray-900 transition-colors"
        >
          Cancel
        </button>
        <form method="POST" action="?/delete" use:enhance>
          <input type="hidden" name="confirm" value="delete" />
          <button
            type="submit"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

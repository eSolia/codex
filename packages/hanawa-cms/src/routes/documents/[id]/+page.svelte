<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance, deserialize } from '$app/forms';
  import { goto } from '$app/navigation';
  import FileText from 'phosphor-svelte/lib/FileText';
  import FilePdf from 'phosphor-svelte/lib/FilePdf';
  import Share from 'phosphor-svelte/lib/Share';
  import Check from 'phosphor-svelte/lib/Check';
  import X from 'phosphor-svelte/lib/X';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import Eye from 'phosphor-svelte/lib/Eye';
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';
  import Trash from 'phosphor-svelte/lib/Trash';
  import DotsSixVertical from 'phosphor-svelte/lib/DotsSixVertical';
  import Copy from 'phosphor-svelte/lib/Copy';
  import Clock from 'phosphor-svelte/lib/Clock';
  import Plus from 'phosphor-svelte/lib/Plus';
  import Translate from 'phosphor-svelte/lib/Translate';
  import CoverLetterEditor from '$lib/components/editor/CoverLetterEditor.svelte';

  interface Fragment {
    id: string;
    order: number;
    enabled: boolean;
  }

  interface FragmentContent {
    id: string;
    name: string;
    slug: string;
    category: string;
    content_en: string | null;
    content_ja: string | null;
  }

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // State
  let editMode = $state(false);
  let showPreview = $state(false);
  let showShareModal = $state(false);
  let fragments = $state<Fragment[]>(data.fragments as Fragment[]);
  let draggedIndex = $state<number | null>(null);
  let isGeneratingPdf = $state(false);
  let isSharing = $state(false);
  let showAddFragment = $state(false);

  // Cover letter state
  let coverLetterEn = $state(data.proposal.cover_letter_en || '');
  let coverLetterJa = $state(data.proposal.cover_letter_ja || '');

  // Format date to JST - use Intl.DateTimeFormat for consistent server/client formatting
  // SQLite datetime('now') stores UTC but without timezone indicator, so we append 'Z'
  function formatJstDate(dateStr: string | null): string {
    if (!dateStr) return '';
    try {
      // SQLite stores UTC without 'Z' suffix - add it to parse correctly
      const utcDateStr = dateStr.endsWith('Z') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
      const date = new Date(utcDateStr);
      // Use Intl.DateTimeFormat for consistent formatting across environments
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Tokyo',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      return formatter.format(date).replace(',', '') + ' JST';
    } catch {
      return dateStr;
    }
  }
  let languageMode = $state(data.proposal.language_mode || 'en');

  // Scope state (for translation)
  let scopeEn = $state(data.proposal.scope || '');
  let scopeJa = $state(data.proposal.scope_ja || '');
  let isTranslatingScopeEn = $state(false);
  let isTranslatingScopeJa = $state(false);

  // Translate scope text
  async function translateScope(sourceLocale: 'en' | 'ja') {
    const isEn = sourceLocale === 'en';
    if (isEn) {
      isTranslatingScopeEn = true;
    } else {
      isTranslatingScopeJa = true;
    }

    const text = isEn ? scopeEn : scopeJa;
    const formData = new FormData();
    formData.set('text', text);
    formData.set('source_locale', sourceLocale);

    try {
      const response = await fetch('?/aiTranslate', {
        method: 'POST',
        body: formData,
      });

      const result = deserialize(await response.text());

      if (result.type === 'success') {
        const resultData = result.data as { translated?: string; error?: string };
        if (resultData?.translated) {
          if (isEn) {
            scopeJa = resultData.translated;
          } else {
            scopeEn = resultData.translated;
          }
        } else if (resultData?.error) {
          alert(resultData.error);
        }
      } else if (result.type === 'failure') {
        const resultData = result.data as { error?: string };
        alert(resultData?.error || 'Translation failed');
      }
    } catch (err) {
      console.error('Scope translation error:', err);
      alert('Translation failed');
    } finally {
      if (isEn) {
        isTranslatingScopeEn = false;
      } else {
        isTranslatingScopeJa = false;
      }
    }
  }

  // Derived
  const fragmentsJson = $derived(JSON.stringify(fragments));
  const proposal = $derived(data.proposal);
  const fragmentContents = $derived(data.fragmentContents as FragmentContent[]);
  const availableFragments = $derived((data.availableFragments as FragmentContent[]) || []);
  const boilerplates = $derived((data.boilerplates as FragmentContent[]) || []);

  // Language mode helpers
  const showEnglish = $derived(languageMode === 'en' || languageMode.startsWith('both_'));
  const showJapanese = $derived(languageMode === 'ja' || languageMode.startsWith('both_'));
  const isBilingual = $derived(languageMode.startsWith('both_'));

  // Fragments not yet in the proposal
  const unusedFragments = $derived(
    availableFragments.filter((af) => !fragments.some((f) => f.id === af.id))
  );

  // Content map for preview (use all available fragments for display)
  const contentMap = $derived(new Map(availableFragments.map((f: FragmentContent) => [f.id, f])));

  // Add fragment function
  function addFragment(fragmentId: string) {
    const maxOrder = Math.max(0, ...fragments.map((f) => f.order));
    fragments = [
      ...fragments,
      { id: fragmentId, order: maxOrder + 1, enabled: true },
    ];
    showAddFragment = false;
  }

  // Remove fragment function
  function removeFragment(index: number) {
    fragments = fragments.filter((_, i) => i !== index);
    // Reorder remaining fragments
    fragments = fragments.map((f, i) => ({ ...f, order: i + 1 }));
  }

  // Status colors
  function getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      draft: 'bg-gray-100 text-gray-700',
      review: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      shared: 'bg-blue-100 text-blue-800',
      archived: 'bg-gray-200 text-gray-600',
    };
    return colors[status] || colors.draft;
  }

  function getFragmentTitle(id: string): string {
    const titles: Record<string, string> = {
      'esolia-introduction': 'Introduction & Mission',
      'esolia-profile': 'Company Profile',
      'esolia-background': 'Virtual IT Background',
      'esolia-project-types': 'Project Experience',
      'esolia-support-types': 'Support Options',
      'esolia-service-mechanics': 'Service Mechanics',
      'esolia-agreement-characteristics': 'Agreement Terms',
      'esolia-closing': 'Next Steps & Closing',
    };
    return titles[id] || id;
  }

  function toggleFragment(index: number) {
    fragments[index].enabled = !fragments[index].enabled;
  }

  function handleDragStart(e: DragEvent, index: number) {
    draggedIndex = index;
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
    }
  }

  function handleDragOver(e: DragEvent, index: number) {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newFragments = [...fragments];
    const [removed] = newFragments.splice(draggedIndex, 1);
    newFragments.splice(index, 0, removed);
    newFragments.forEach((f, i) => (f.order = i + 1));

    fragments = newFragments;
    draggedIndex = index;
  }

  function handleDragEnd() {
    draggedIndex = null;
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
  }

  // Handle form results
  $effect(() => {
    if (form?.success && form?.redirect) {
      goto(form.redirect);
    }
  });

  // Close dropdown when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (showAddFragment && !target.closest('.add-fragment-dropdown')) {
      showAddFragment = false;
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<svelte:head>
  <title>{proposal.title} | Proposals | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-start justify-between">
    <div class="flex items-center gap-4">
      <a
        href="/documents"
        class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <ArrowLeft size={20} />
      </a>
      <div>
        <div class="flex items-center gap-3">
          <h1 class="text-2xl font-bold text-esolia-navy">{proposal.title}</h1>
          <span
            class="px-2 py-1 text-xs font-medium rounded-full {getStatusColor(proposal.status)}"
          >
            {proposal.status}
          </span>
        </div>
        <p class="mt-1 text-gray-600">
          {proposal.client_name || proposal.client_code}
          {#if proposal.client_name_ja}
            <span class="text-gray-400">({proposal.client_name_ja})</span>
          {/if}
        </p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <button
        type="button"
        onclick={() => (showPreview = !showPreview)}
        class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Eye size={16} />
        {showPreview ? 'Hide Preview' : 'Preview'}
      </button>

      <button
        type="button"
        onclick={() => (editMode = !editMode)}
        class="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
      >
        <PencilSimple size={16} />
        {editMode ? 'View Mode' : 'Edit'}
      </button>
    </div>
  </div>

  <!-- Alerts -->
  {#if form?.error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
      {form.error}
    </div>
  {/if}

  {#if form?.success && form?.message}
    <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
      {form.message}
    </div>
  {/if}

  <!-- Share success with PIN -->
  {#if form?.success && form?.shareUrl}
    <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
      <p class="text-blue-800 font-medium">Share link created!</p>
      <div class="flex items-center gap-2">
        <code class="flex-1 px-3 py-2 bg-white rounded border text-sm">{form.shareUrl}</code>
        <button
          type="button"
          onclick={() => copyToClipboard(form?.shareUrl || '')}
          class="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
        >
          <Copy size={16} />
        </button>
      </div>
      <div class="flex items-center gap-4 text-sm">
        <span class="text-blue-800">
          <strong>PIN:</strong>
          <code class="ml-1 px-2 py-1 bg-white rounded">{form.pin}</code>
        </span>
        <span class="text-blue-600">
          <Clock size={14} class="inline" />
          Expires: {new Date(form.expiresAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  {/if}

  <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
    <!-- Left Column: Details & Fragments -->
    <div class="lg:col-span-2 space-y-6">
      <!-- Proposal Details -->
      {#if editMode}
        <form
          method="POST"
          action="?/update"
          use:enhance={() => {
            return async ({ result, update }) => {
              // Invalidate and update to refresh data from server
              await update({ reset: false, invalidateAll: true });
              // Switch back to view mode on successful save
              if (result.type === 'success') {
                editMode = false;
              }
            };
          }}
          class="bg-white rounded-lg shadow p-6 space-y-4"
        >
          <input type="hidden" name="fragments" value={fragmentsJson} />

          <h2 class="text-lg font-semibold text-gray-900">Proposal Details</h2>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="client_code" class="block text-sm font-medium text-gray-700">
                Client Code
              </label>
              <input
                type="text"
                id="client_code"
                name="client_code"
                value={proposal.client_code}
                required
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
              />
            </div>
            <div>
              <label for="language_mode" class="block text-sm font-medium text-gray-700">Language Mode</label>
              <select
                id="language_mode"
                name="language_mode"
                bind:value={languageMode}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
              >
                <option value="en">English only</option>
                <option value="ja">Japanese only</option>
                <option value="both_en_first">Bilingual (English first)</option>
                <option value="both_ja_first">Bilingual (Japanese first)</option>
              </select>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="client_name" class="block text-sm font-medium text-gray-700">
                Client Name (EN)
              </label>
              <input
                type="text"
                id="client_name"
                name="client_name"
                value={proposal.client_name || ''}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
              />
            </div>
            <div>
              <label for="client_name_ja" class="block text-sm font-medium text-gray-700">
                Client Name (JA)
              </label>
              <input
                type="text"
                id="client_name_ja"
                name="client_name_ja"
                value={proposal.client_name_ja || ''}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
              />
            </div>
          </div>

          <!-- Contact Name fields (conditional on language mode) -->
          <div class="grid grid-cols-2 gap-4">
            {#if showEnglish}
              <div>
                <label for="contact_name" class="block text-sm font-medium text-gray-700">
                  Contact Name (EN)
                </label>
                <p class="text-xs text-gray-500 mb-1">Recipient's name for "Prepared for:"</p>
                <input
                  type="text"
                  id="contact_name"
                  name="contact_name"
                  value={proposal.contact_name || ''}
                  placeholder="Taro Tanaka"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                />
              </div>
            {/if}
            {#if showJapanese}
              <div>
                <label for="contact_name_ja" class="block text-sm font-medium text-gray-700">
                  Contact Name (JA)
                </label>
                <p class="text-xs text-gray-500 mb-1">「宛先」のお名前</p>
                <input
                  type="text"
                  id="contact_name_ja"
                  name="contact_name_ja"
                  value={proposal.contact_name_ja || ''}
                  placeholder="田中太郎 様"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                />
              </div>
            {/if}
          </div>

          <div>
            <label for="title" class="block text-sm font-medium text-gray-700">Title</label>
            <input
              type="text"
              id="title"
              name="title"
              value={proposal.title}
              required
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
            />
          </div>

          <div>
            <label for="title_ja" class="block text-sm font-medium text-gray-700">Title (JA)</label>
            <input
              type="text"
              id="title_ja"
              name="title_ja"
              value={proposal.title_ja || ''}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
            />
          </div>

          <!-- Scope fields (conditional on language mode) -->
          <div class="grid grid-cols-1 gap-4" class:md:grid-cols-2={isBilingual}>
            {#if showEnglish}
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label for="scope" class="block text-sm font-medium text-gray-700">
                    Scope {isBilingual ? '(EN)' : ''}
                  </label>
                  {#if isBilingual}
                    <button
                      type="button"
                      onclick={() => translateScope('en')}
                      disabled={isTranslatingScopeEn || !scopeEn}
                      class="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Translate size={14} />
                      {isTranslatingScopeEn ? '...' : '→ JA'}
                    </button>
                  {/if}
                </div>
                <textarea
                  id="scope"
                  name="scope"
                  rows="3"
                  bind:value={scopeEn}
                  placeholder="Brief description of project scope..."
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                ></textarea>
              </div>
            {/if}
            {#if showJapanese}
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label for="scope_ja" class="block text-sm font-medium text-gray-700">
                    Scope {isBilingual ? '(JA)' : ''}
                  </label>
                  {#if isBilingual}
                    <button
                      type="button"
                      onclick={() => translateScope('ja')}
                      disabled={isTranslatingScopeJa || !scopeJa}
                      class="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Translate size={14} />
                      {isTranslatingScopeJa ? '...' : '→ EN'}
                    </button>
                  {/if}
                </div>
                <textarea
                  id="scope_ja"
                  name="scope_ja"
                  rows="3"
                  bind:value={scopeJa}
                  placeholder="プロジェクトスコープの概要..."
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                ></textarea>
              </div>
            {/if}
          </div>

          <!-- Cover Letter Editors (conditional on language mode) -->
          <!-- Hidden inputs for form submission -->
          <input type="hidden" name="cover_letter_en" value={coverLetterEn} />
          <input type="hidden" name="cover_letter_ja" value={coverLetterJa} />

          {#if showEnglish}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Cover Letter (English)
              </label>
              <p class="text-xs text-gray-500 mb-2">
                Client-specific introduction that appears before the standard fragments
              </p>
              <CoverLetterEditor
                bind:content={coverLetterEn}
                language="en"
                placeholder="Dear [Client Name], Thank you for the opportunity to discuss your IT requirements..."
                {boilerplates}
                onTranslate={(translated) => {
                  coverLetterJa = translated;
                }}
              />
            </div>
          {/if}

          {#if showJapanese}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-2">
                Cover Letter (Japanese)
              </label>
              <p class="text-xs text-gray-500 mb-2">
                標準フラグメントの前に表示されるクライアント固有の紹介文
              </p>
              <CoverLetterEditor
                bind:content={coverLetterJa}
                language="ja"
                placeholder="[会社名] 御中、この度はIT要件についてご相談いただきありがとうございます..."
                {boilerplates}
                onTranslate={(translated) => {
                  coverLetterEn = translated;
                }}
              />
            </div>
          {/if}

          <div class="flex justify-end">
            <button
              type="submit"
              class="px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors"
            >
              Save Changes
            </button>
          </div>
        </form>
      {:else}
        <div class="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Proposal Details</h2>

          <dl class="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt class="text-gray-500">Client Code</dt>
              <dd class="font-medium">{proposal.client_code}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Language Mode</dt>
              <dd class="font-medium">
                {#if proposal.language_mode === 'en'}English only
                {:else if proposal.language_mode === 'ja'}Japanese only
                {:else if proposal.language_mode === 'both_en_first'}Bilingual (EN first)
                {:else if proposal.language_mode === 'both_ja_first'}Bilingual (JA first)
                {:else}English only
                {/if}
              </dd>
            </div>
            <div>
              <dt class="text-gray-500">Created</dt>
              <dd class="font-medium">{new Date(proposal.created_at).toLocaleDateString()}</dd>
            </div>
            <div>
              <dt class="text-gray-500">Updated</dt>
              <dd class="font-medium">{new Date(proposal.updated_at).toLocaleDateString()}</dd>
            </div>
          </dl>

          {#if proposal.scope}
            <div>
              <h3 class="text-sm font-medium text-gray-500">Scope (EN)</h3>
              <p class="mt-1 text-gray-900">{proposal.scope}</p>
            </div>
          {/if}

          {#if proposal.scope_ja}
            <div>
              <h3 class="text-sm font-medium text-gray-500">Scope (JA)</h3>
              <p class="mt-1 text-gray-900">{proposal.scope_ja}</p>
            </div>
          {/if}

          {#if proposal.cover_letter_en}
            <div>
              <h3 class="text-sm font-medium text-gray-500">Cover Letter (EN)</h3>
              <div class="mt-1 text-sm bg-gray-50 p-3 rounded prose prose-sm max-w-none">
                {@html proposal.cover_letter_en}
              </div>
            </div>
          {/if}

          {#if proposal.cover_letter_ja}
            <div>
              <h3 class="text-sm font-medium text-gray-500">Cover Letter (JA)</h3>
              <div class="mt-1 text-sm bg-gray-50 p-3 rounded prose prose-sm max-w-none">
                {@html proposal.cover_letter_ja}
              </div>
            </div>
          {/if}
        </div>
      {/if}

      <!-- Fragments -->
      <div class="bg-white rounded-lg shadow p-6 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Fragments</h2>
          <div class="flex items-center gap-3">
            <span class="text-sm text-gray-500">
              {fragments.filter((f) => f.enabled).length} of {fragments.length} enabled
            </span>
            {#if editMode && unusedFragments.length > 0}
              <div class="relative add-fragment-dropdown">
                <button
                  type="button"
                  onclick={() => (showAddFragment = !showAddFragment)}
                  class="flex items-center gap-1 px-2 py-1 text-xs font-medium text-esolia-navy bg-esolia-orange/20 rounded hover:bg-esolia-orange/30 transition-colors"
                >
                  <Plus size={14} weight="bold" />
                  Add
                </button>

                {#if showAddFragment}
                  <div class="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border z-10 max-h-64 overflow-y-auto">
                    {#each unusedFragments as frag (frag.id)}
                      <button
                        type="button"
                        onclick={() => addFragment(frag.id)}
                        class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0"
                      >
                        <span class="font-medium text-gray-900">{getFragmentTitle(frag.id)}</span>
                        <span class="block text-xs text-gray-500">{frag.category}</span>
                      </button>
                    {/each}
                  </div>
                {/if}
              </div>
            {/if}
          </div>
        </div>

        <div class="space-y-2">
          {#each fragments as fragment, index (fragment.id)}
            <div
              draggable={editMode}
              ondragstart={(e) => editMode && handleDragStart(e, index)}
              ondragover={(e) => editMode && handleDragOver(e, index)}
              ondragend={() => editMode && handleDragEnd()}
              class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border transition-all
                     {fragment.enabled ? 'border-gray-200' : 'border-gray-100 opacity-50'}
                     {editMode ? 'cursor-move' : ''}
                     {draggedIndex === index ? 'ring-2 ring-esolia-navy ring-offset-2' : ''}"
            >
              {#if editMode}
                <DotsSixVertical size={20} class="text-gray-400 flex-shrink-0" />
              {/if}

              <span
                class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium
                       {fragment.enabled
                  ? 'bg-esolia-navy text-white'
                  : 'bg-gray-200 text-gray-500'}"
              >
                {fragment.order}
              </span>

              <span class="flex-1 text-sm {fragment.enabled ? 'text-gray-900' : 'text-gray-400'}">
                {getFragmentTitle(fragment.id)}
              </span>

              {#if editMode}
                <div class="flex items-center gap-1">
                  <!-- Edit fragment link -->
                  <a
                    href="/fragments/{fragment.id}"
                    target="_blank"
                    title="Edit fragment (opens in new tab)"
                    class="p-1.5 rounded-md text-gray-500 hover:bg-gray-200 hover:text-esolia-navy transition-colors"
                  >
                    <PencilSimple size={16} />
                  </a>
                  <button
                    type="button"
                    onclick={() => toggleFragment(index)}
                    title={fragment.enabled ? 'Disable fragment' : 'Enable fragment'}
                    class="p-1.5 rounded-md transition-colors
                           {fragment.enabled
                      ? 'bg-green-100 text-green-700 hover:bg-green-200'
                      : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}"
                  >
                    {#if fragment.enabled}
                      <Check size={16} weight="bold" />
                    {:else}
                      <X size={16} weight="bold" />
                    {/if}
                  </button>
                  <button
                    type="button"
                    onclick={() => removeFragment(index)}
                    title="Remove fragment from proposal"
                    class="p-1.5 rounded-md text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash size={16} />
                  </button>
                </div>
              {/if}
            </div>
          {/each}
        </div>

        {#if editMode && fragments.length === 0}
          <p class="text-sm text-gray-500 italic py-4 text-center">
            No fragments added. Click "Add" to include content fragments.
          </p>
        {/if}
      </div>

      <!-- Preview -->
      {#if showPreview}
        <div class="bg-white rounded-lg shadow p-6 space-y-4">
          <h2 class="text-lg font-semibold text-gray-900">Preview</h2>

          <div class="prose max-w-none">
            <h1>
              {proposal.language === 'ja' && proposal.title_ja ? proposal.title_ja : proposal.title}
            </h1>

            {#if proposal.scope}
              <h2>Scope</h2>
              <p>{proposal.scope}</p>
            {/if}

            {#each fragments.filter((f) => f.enabled).sort((a, b) => a.order - b.order) as fragment}
              {@const content = contentMap.get(fragment.id)}
              {#if content}
                <section class="border-t pt-4 mt-4">
                  <h3 class="text-sm font-medium text-gray-500 mb-2">{content.name}</h3>
                  <div class="text-gray-600 text-sm">
                    {#if proposal.language === 'ja' && content.content_ja}
                      {content.content_ja.substring(0, 200)}...
                    {:else if content.content_en}
                      {content.content_en.substring(0, 200)}...
                    {:else}
                      <em class="text-gray-400">No content available</em>
                    {/if}
                  </div>
                </section>
              {/if}
            {/each}

          </div>
        </div>
      {/if}
    </div>

    <!-- Right Column: Actions & Status -->
    <div class="space-y-6">
      <!-- Workflow Status -->
      <div class="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Workflow</h2>

        <div class="space-y-2">
          <form method="POST" action="?/updateStatus" use:enhance class="space-y-3">
            <input type="hidden" name="status" value="review" />
            <button
              type="submit"
              disabled={proposal.status === 'review'}
              class="w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors
                     {proposal.status === 'review'
                ? 'bg-yellow-100 text-yellow-800 cursor-default'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >
              Send for Review
            </button>
          </form>

          <form method="POST" action="?/updateStatus" use:enhance class="space-y-3">
            <input type="hidden" name="status" value="approved" />
            <button
              type="submit"
              disabled={proposal.status === 'approved' || proposal.status === 'shared'}
              class="w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors
                     {proposal.status === 'approved' || proposal.status === 'shared'
                ? 'bg-green-100 text-green-800 cursor-default'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
            >
              Approve
            </button>
          </form>
        </div>

        {#if proposal.reviewed_at}
          <div class="text-xs text-gray-500 pt-2 border-t">
            Reviewed: {new Date(proposal.reviewed_at).toLocaleString()}
            {#if proposal.review_notes}
              <p class="mt-1">{proposal.review_notes}</p>
            {/if}
          </div>
        {/if}
      </div>

      <!-- PDF Generation -->
      <div class="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FilePdf size={20} weight="duotone" class="text-red-600" />
          PDF Generation
        </h2>

        <form
          method="POST"
          action="?/generatePdf"
          use:enhance={() => {
            isGeneratingPdf = true;
            return async ({ update }) => {
              await update();
              isGeneratingPdf = false;
            };
          }}
        >
          <button
            type="submit"
            disabled={isGeneratingPdf}
            class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
          >
            {isGeneratingPdf ? 'Generating...' : 'Generate PDF'}
          </button>
        </form>

        {#if proposal.pdf_generated_at && proposal.pdf_r2_key}
          <div class="space-y-2">
            <div class="text-xs text-gray-500">
              Last generated: {formatJstDate(proposal.pdf_generated_at)}
            </div>

            <!-- PDF Download Links -->
            <div class="flex flex-wrap gap-2">
              {#if proposal.pdf_r2_key_en && proposal.pdf_r2_key_ja}
                <!-- Bilingual: Show all 3 PDFs -->
                <a
                  href="/api/documents/{proposal.id}/pdf?v={new Date(proposal.pdf_generated_at).getTime()}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-esolia-navy text-white rounded-lg hover:bg-opacity-90 transition-colors"
                  title="Combined PDF with Table of Contents"
                >
                  <Eye size={16} />
                  Combined
                </a>
                <a
                  href="/api/documents/{proposal.id}/pdf?lang=en&v={new Date(proposal.pdf_generated_at).getTime()}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="English only"
                >
                  <Eye size={16} />
                  English
                </a>
                <a
                  href="/api/documents/{proposal.id}/pdf?lang=ja&v={new Date(proposal.pdf_generated_at).getTime()}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                  title="Japanese only"
                >
                  <Eye size={16} />
                  日本語
                </a>
              {:else}
                <!-- Single language: Just one PDF -->
                <a
                  href="/api/documents/{proposal.id}/pdf?v={new Date(proposal.pdf_generated_at).getTime()}"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-2 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  <Eye size={16} />
                  View PDF
                </a>
              {/if}
            </div>
          </div>
        {:else if proposal.pdf_generated_at}
          <div class="text-xs text-gray-500">
            Last generated: {formatJstDate(proposal.pdf_generated_at)}
          </div>
        {/if}
      </div>

      <!-- Share via Courier -->
      <div class="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Share size={20} weight="duotone" class="text-blue-600" />
          Share via Courier
        </h2>

        {#if !proposal.pdf_r2_key}
          <p class="text-sm text-gray-500">Generate a PDF before sharing.</p>
        {:else}
          <form
            method="POST"
            action="?/share"
            use:enhance={() => {
              isSharing = true;
              return async ({ update }) => {
                await update();
                isSharing = false;
              };
            }}
            class="space-y-3"
          >
            <div>
              <label for="recipient_email" class="block text-sm font-medium text-gray-700">
                Recipient Email
              </label>
              <input
                type="email"
                id="recipient_email"
                name="recipient_email"
                required
                placeholder="client@example.com"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
              />
            </div>

            <div>
              <label for="recipient_name" class="block text-sm font-medium text-gray-700">
                Recipient Name
              </label>
              <input
                type="text"
                id="recipient_name"
                name="recipient_name"
                placeholder="John Smith"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
              />
            </div>

            <div>
              <label for="expires_in_days" class="block text-sm font-medium text-gray-700">
                Expires In
              </label>
              <select
                id="expires_in_days"
                name="expires_in_days"
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
              >
                <option value="7">7 days</option>
                <option value="14">14 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSharing}
              class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isSharing ? 'Creating Share...' : 'Create Share Link'}
            </button>
          </form>
        {/if}

        {#if proposal.share_url}
          <div class="pt-3 border-t space-y-2">
            <div class="text-xs text-gray-500">Active share:</div>
            <code class="block text-xs bg-gray-50 p-2 rounded break-all">{proposal.share_url}</code>
            <div class="flex items-center gap-4 text-xs">
              <span>PIN: <code>{proposal.share_pin}</code></span>
              {#if proposal.share_expires_at}
                <span class="text-gray-500">
                  Expires: {new Date(proposal.share_expires_at).toLocaleDateString()}
                </span>
              {/if}
            </div>
          </div>
        {/if}
      </div>

      <!-- Danger Zone -->
      <div class="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 class="text-lg font-semibold text-red-600">Danger Zone</h2>

        <form
          method="POST"
          action="?/delete"
          use:enhance={({ cancel }) => {
            const confirmed = confirm('Are you sure you want to delete this proposal?');
            if (!confirmed) {
              cancel();
              return;
            }
            return async ({ result }) => {
              if (result.type === 'success') {
                goto('/documents');
              }
            };
          }}
        >
          <button
            type="submit"
            class="w-full px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
          >
            <Trash size={16} />
            Delete Proposal
          </button>
        </form>
      </div>
    </div>
  </div>
</div>

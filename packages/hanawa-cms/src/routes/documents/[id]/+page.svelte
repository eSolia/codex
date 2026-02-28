<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
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
  import ArrowsIn from 'phosphor-svelte/lib/ArrowsIn';
  import ArrowsOut from 'phosphor-svelte/lib/ArrowsOut';
  import CoverLetterEditor from '$lib/components/editor/CoverLetterEditor.svelte';
  import SectionEditor from '$lib/components/editor/SectionEditor.svelte';
  import FragmentPicker from '$lib/components/FragmentPicker.svelte';
  import { sanitizeHtml } from '$lib/sanitize';

  import type { ManifestSection } from '$lib/server/manifest';

  interface Fragment {
    id: string;
    order: number;
    enabled: boolean;
    pageBreakBefore?: boolean;
  }

  interface FragmentContent {
    id: string;
    name: string;
    slug: string;
    category: string;
    content_en: string | null;
    content_ja: string | null;
  }

  interface SectionContentData {
    file: string;
    content_en: string;
    content_ja: string;
  }

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // InfoSec: UI-level RBAC (defense in depth, server guards are primary) (OWASP A01)
  const isReadOnly = $derived(data.user?.role === 'viewer');
  const isAdmin = $derived(data.user?.role === 'admin');

  // Manifest-based detection
  const isManifestBased = $derived(Boolean(data.isManifestBased));
  const manifest = $derived(
    data.manifest as { sections: ManifestSection[]; language_mode: string } | null
  );
  /* eslint-disable svelte/valid-compile -- Form fields intentionally capture initial values */
  let sectionContents = $state<SectionContentData[]>(
    (data.sectionContents as SectionContentData[]) || []
  );
  /* eslint-enable svelte/valid-compile */

  // Section collapse state — initialized from manifest (intentionally captures initial value)
  /* eslint-disable svelte/valid-compile -- Collapse state intentionally captures initial values */
  let sectionCollapsed = $state<boolean[]>(
    (data.manifest as { sections: ManifestSection[] } | null)?.sections.map((s) => s.locked) ?? []
  );
  /* eslint-enable svelte/valid-compile */

  const allCollapsed = $derived(sectionCollapsed.length > 0 && sectionCollapsed.every(Boolean));

  function collapseAll() {
    sectionCollapsed = sectionCollapsed.map(() => true);
  }

  function expandAll() {
    sectionCollapsed = sectionCollapsed.map(() => false);
  }

  // Derived values from data (reactive to page data changes)
  const initialFragments = $derived(data.fragments as Fragment[]);

  // State
  let editMode = $state(false);
  let showPreview = $state(false);
  /* eslint-disable svelte/valid-compile -- Form fields intentionally capture initial values */
  let fragments = $state<Fragment[]>(initialFragments);
  /* eslint-enable svelte/valid-compile */
  let draggedIndex = $state<number | null>(null);
  let isGeneratingPdf = $state(false);
  let isSharing = $state(false);
  let showAddFragment = $state(false);
  let fragmentPickerOpen = $state(false);
  let showAddCustomSection = $state(false);
  let customSectionLabel = $state('');
  let customSectionLabelJa = $state('');
  let isSaving = $state(false);

  // Cover letter state
  /* eslint-disable svelte/valid-compile -- Form fields intentionally capture initial values */
  let coverLetterEn = $state(data.proposal.cover_letter_en || '');
  let coverLetterJa = $state(data.proposal.cover_letter_ja || '');
  /* eslint-enable svelte/valid-compile */

  // Client document toggle - true if this is a client-specific document
  /* eslint-disable svelte/valid-compile -- Form fields intentionally capture initial values */
  let isClientDocument = $state(Boolean(data.proposal.client_code));
  /* eslint-enable svelte/valid-compile */

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
  /* eslint-disable svelte/valid-compile -- Form fields intentionally capture initial values */
  let languageMode = $state(data.proposal.language_mode || 'en');
  /* eslint-enable svelte/valid-compile */

  // Derived
  const fragmentsJson = $derived(JSON.stringify(fragments));
  const proposal = $derived(data.proposal);
  const availableFragments = $derived((data.availableFragments as FragmentContent[]) || []);
  const boilerplates = $derived((data.boilerplates as FragmentContent[]) || []);

  // Language mode helpers
  const showEnglish = $derived(languageMode === 'en' || languageMode.startsWith('both_'));
  const showJapanese = $derived(languageMode === 'ja' || languageMode.startsWith('both_'));

  // Fragments not yet in the proposal
  const unusedFragments = $derived(
    availableFragments.filter((af) => !fragments.some((f) => f.id === af.id))
  );

  // Content map for preview (use all available fragments for display)
  const contentMap = $derived(new Map(availableFragments.map((f: FragmentContent) => [f.id, f])));

  // Add fragment function
  function addFragment(fragmentId: string) {
    const maxOrder = Math.max(0, ...fragments.map((f) => f.order));
    fragments = [...fragments, { id: fragmentId, order: maxOrder + 1, enabled: true }];
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
    return colors[status] ?? 'bg-gray-100 text-gray-700';
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
    const frag = fragments[index];
    if (!frag) return;
    frag.enabled = !frag.enabled;
  }

  function togglePageBreak(index: number) {
    const frag = fragments[index];
    if (!frag) return;
    frag.pageBreakBefore = !frag.pageBreakBefore;
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
    const removed = newFragments.splice(draggedIndex, 1)[0];
    if (!removed) return;
    newFragments.splice(index, 0, removed);
    newFragments.forEach((f, i) => (f.order = i + 1));

    fragments = newFragments;
    draggedIndex = index;
  }

  function handleDragEnd() {
    draggedIndex = null;
  }

  // Manifest section content change handler
  function handleSectionContentChange(index: number, lang: 'en' | 'ja', content: string) {
    const section = sectionContents[index];
    if (!section) return;
    if (lang === 'en') {
      section.content_en = content;
    } else {
      section.content_ja = content;
    }
  }

  function handleInsertFragment(fragmentId: string) {
    fragmentPickerOpen = false;
    // Submit via form action
    const formEl = document.createElement('form');
    formEl.method = 'POST';
    formEl.action = '?/insertFragment';
    const input = document.createElement('input');
    input.name = 'fragment_id';
    input.value = fragmentId;
    formEl.appendChild(input);
    document.body.appendChild(formEl);
    formEl.submit();
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
          {#if proposal.client_name || proposal.client_code}
            {proposal.client_name || proposal.client_code}
            {#if proposal.client_name_ja}
              <span class="text-gray-400">({proposal.client_name_ja})</span>
            {/if}
          {:else}
            <span class="text-gray-400 italic">General Document</span>
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

  {#if form?.success}
    <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
      Document saved successfully
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

  <!-- ============================================================ -->
  <!-- MANIFEST-BASED DOCUMENT (Phase 4) -->
  <!-- ============================================================ -->
  {#if isManifestBased && manifest}
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Left Column: Metadata + Sections -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Document metadata form (save via manifest action) -->
        <form
          method="POST"
          action="?/saveManifest"
          use:enhance={() => {
            isSaving = true;
            return async ({ update }) => {
              await update({ reset: false, invalidateAll: true });
              isSaving = false;
            };
          }}
        >
          <!-- Metadata panel -->
          <div class="bg-white rounded-lg shadow p-6 space-y-4 mb-6">
            <h2 class="text-lg font-semibold text-gray-900">Document Details</h2>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="m_title" class="block text-sm font-medium text-gray-700">Title</label>
                <input
                  type="text"
                  id="m_title"
                  name="title"
                  value={proposal.title}
                  required
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                />
              </div>
              <div>
                <label for="m_title_ja" class="block text-sm font-medium text-gray-700"
                  >Title (JA)</label
                >
                <input
                  type="text"
                  id="m_title_ja"
                  name="title_ja"
                  value={proposal.title_ja || ''}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label for="m_client_code" class="block text-sm font-medium text-gray-700"
                  >Client Code</label
                >
                <input
                  type="text"
                  id="m_client_code"
                  name="client_code"
                  value={proposal.client_code || ''}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                />
              </div>
              <div>
                <label for="m_client_name" class="block text-sm font-medium text-gray-700"
                  >Client Name</label
                >
                <input
                  type="text"
                  id="m_client_name"
                  name="client_name"
                  value={proposal.client_name || ''}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                />
              </div>
              <div>
                <label for="m_client_name_ja" class="block text-sm font-medium text-gray-700"
                  >Client (JA)</label
                >
                <input
                  type="text"
                  id="m_client_name_ja"
                  name="client_name_ja"
                  value={proposal.client_name_ja || ''}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-4">
              <div>
                <label for="m_contact_name" class="block text-sm font-medium text-gray-700"
                  >Contact Name</label
                >
                <input
                  type="text"
                  id="m_contact_name"
                  name="contact_name"
                  value={proposal.contact_name || ''}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                />
              </div>
              <div>
                <label for="m_contact_name_ja" class="block text-sm font-medium text-gray-700"
                  >Contact (JA)</label
                >
                <input
                  type="text"
                  id="m_contact_name_ja"
                  name="contact_name_ja"
                  value={proposal.contact_name_ja || ''}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                />
              </div>
              <div>
                <label for="m_language_mode" class="block text-sm font-medium text-gray-700"
                  >Language Mode</label
                >
                <select
                  id="m_language_mode"
                  name="language_mode"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                >
                  <option value="en" selected={manifest.language_mode === 'en'}>English only</option
                  >
                  <option value="ja" selected={manifest.language_mode === 'ja'}
                    >Japanese only</option
                  >
                  <option
                    value="both_en_first"
                    selected={manifest.language_mode === 'both_en_first'}
                    >Bilingual (EN first)</option
                  >
                  <option
                    value="both_ja_first"
                    selected={manifest.language_mode === 'both_ja_first'}
                    >Bilingual (JA first)</option
                  >
                </select>
              </div>
            </div>
          </div>

          <!-- Section Editors -->
          <div class="space-y-4">
            <!-- Collapse/Expand All + Save -->
            <div class="flex items-center justify-between">
              <button
                type="submit"
                disabled={isSaving || isReadOnly}
                class="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-white bg-esolia-navy rounded-md hover:bg-esolia-navy/90 transition-colors disabled:opacity-50"
              >
                <Check size={14} />
                {isSaving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                onclick={() => (allCollapsed ? expandAll() : collapseAll())}
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              >
                {#if allCollapsed}
                  <ArrowsOut size={14} />
                  Expand All
                {:else}
                  <ArrowsIn size={14} />
                  Collapse All
                {/if}
              </button>
            </div>

            {#each manifest.sections as section, index (section.file)}
              {@const content = sectionContents[index]}
              <!-- Hidden inputs for section content -->
              <input type="hidden" name="section_{index}_en" value={content?.content_en ?? ''} />
              <input type="hidden" name="section_{index}_ja" value={content?.content_ja ?? ''} />

              <SectionEditor
                {section}
                contentEn={content?.content_en ?? ''}
                contentJa={content?.content_ja ?? ''}
                languageMode={manifest.language_mode}
                {index}
                disabled={isReadOnly}
                collapsed={sectionCollapsed[index] ?? false}
                ontogglecollapse={(idx) => {
                  sectionCollapsed[idx] = !sectionCollapsed[idx];
                }}
                oncontentchange={handleSectionContentChange}
                onremove={(idx) => {
                  // Submit removeSection form action
                  const f = document.createElement('form');
                  f.method = 'POST';
                  f.action = '?/removeSection';
                  const input = document.createElement('input');
                  input.name = 'section_index';
                  input.value = String(idx);
                  f.appendChild(input);
                  document.body.appendChild(f);
                  f.submit();
                }}
                onrefresh={(idx) => {
                  const f = document.createElement('form');
                  f.method = 'POST';
                  f.action = '?/refreshSection';
                  const input = document.createElement('input');
                  input.name = 'section_index';
                  input.value = String(idx);
                  f.appendChild(input);
                  document.body.appendChild(f);
                  f.submit();
                }}
              />
            {/each}
          </div>

          <!-- Add Section Controls -->
          <div class="flex items-center gap-3 mt-4">
            <button
              type="button"
              disabled={isReadOnly}
              onclick={() => (fragmentPickerOpen = true)}
              class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-esolia-navy bg-esolia-orange/20 rounded-lg hover:bg-esolia-orange/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} weight="bold" />
              Insert Fragment
            </button>
            <button
              type="button"
              disabled={isReadOnly}
              onclick={() => (showAddCustomSection = !showAddCustomSection)}
              class="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus size={16} />
              Add Custom Section
            </button>
          </div>

          {#if showAddCustomSection}
            <div class="mt-3 bg-gray-50 rounded-lg p-4 space-y-3">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label for="custom_label" class="block text-xs font-medium text-gray-600"
                    >Section Label</label
                  >
                  <input
                    type="text"
                    id="custom_label"
                    bind:value={customSectionLabel}
                    placeholder="e.g., Service Overview"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  />
                </div>
                <div>
                  <label for="custom_label_ja" class="block text-xs font-medium text-gray-600"
                    >Label (JA)</label
                  >
                  <input
                    type="text"
                    id="custom_label_ja"
                    bind:value={customSectionLabelJa}
                    placeholder="サービス概要"
                    class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm"
                  />
                </div>
              </div>
              <button
                type="button"
                disabled={!customSectionLabel.trim()}
                onclick={() => {
                  const f = document.createElement('form');
                  f.method = 'POST';
                  f.action = '?/addCustomSection';
                  const l = document.createElement('input');
                  l.name = 'label';
                  l.value = customSectionLabel;
                  f.appendChild(l);
                  const lj = document.createElement('input');
                  lj.name = 'label_ja';
                  lj.value = customSectionLabelJa;
                  f.appendChild(lj);
                  document.body.appendChild(f);
                  f.submit();
                }}
                class="px-4 py-2 text-sm font-medium text-white bg-esolia-navy rounded-lg hover:bg-esolia-navy/90 transition-colors disabled:opacity-50"
              >
                Add Section
              </button>
            </div>
          {/if}

          <!-- Save Button -->
          <div class="flex justify-end mt-6">
            <button
              type="submit"
              disabled={isSaving || isReadOnly}
              class="px-6 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
          </div>
        </form>
      </div>

      <!-- Right Column: Actions (reused from legacy) -->
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
                disabled={!isAdmin ||
                  proposal.status === 'approved' ||
                  proposal.status === 'shared'}
                class="w-full px-4 py-2 text-sm font-medium rounded-lg transition-colors
                       {proposal.status === 'approved' || proposal.status === 'shared'
                  ? 'bg-green-100 text-green-800 cursor-default'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}"
              >
                Approve
              </button>
            </form>
          </div>
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
            <input type="hidden" name="enabled_fragment_ids" value="[]" />
            <button
              type="submit"
              disabled={isGeneratingPdf || isReadOnly}
              class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isGeneratingPdf ? 'Generating...' : 'Generate PDF'}
            </button>
          </form>
          {#if proposal.pdf_generated_at && proposal.pdf_r2_key}
            <div class="text-xs text-gray-500">
              Last generated: {formatJstDate(proposal.pdf_generated_at)}
            </div>
            <div class="flex flex-wrap gap-2">
              <a
                href="/api/documents/{proposal.id}/pdf?v={new Date(
                  proposal.pdf_generated_at
                ).getTime()}"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-esolia-navy text-white rounded-lg hover:bg-opacity-90 transition-colors"
              >
                <Eye size={16} /> View PDF
              </a>
            </div>
          {/if}
        </div>

        <!-- Danger Zone -->
        {#if isAdmin}
          <div class="bg-white rounded-lg shadow p-6 space-y-4">
            <h2 class="text-lg font-semibold text-red-600">Danger Zone</h2>
            <form
              method="POST"
              action="?/delete"
              use:enhance={({ cancel }) => {
                const confirmed = confirm('Are you sure you want to delete this document?');
                if (!confirmed) {
                  cancel();
                  return;
                }
                return async ({ result }) => {
                  if (result.type === 'success') goto('/documents');
                };
              }}
            >
              <button
                type="submit"
                class="w-full px-4 py-2 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
              >
                <Trash size={16} /> Delete Document
              </button>
            </form>
          </div>
        {/if}
      </div>
    </div>

    <!-- Fragment Picker Modal -->
    <FragmentPicker
      bind:open={fragmentPickerOpen}
      mode="insert"
      onselect={(fragmentId) => handleInsertFragment(fragmentId)}
      onclose={() => (fragmentPickerOpen = false)}
    />
  {:else}
    <!-- ============================================================ -->
    <!-- LEGACY JSON-BASED DOCUMENT -->
    <!-- ============================================================ -->
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
            <!-- Hidden fields for general documents (cover letters cleared when not client-specific) -->
            {#if !isClientDocument}
              <input type="hidden" name="client_code" value="" />
              <input type="hidden" name="cover_letter_en" value="" />
              <input type="hidden" name="cover_letter_ja" value="" />
            {/if}

            <h2 class="text-lg font-semibold text-gray-900">Document Details</h2>

            <!-- Document Type Toggle -->
            <div class="flex items-center gap-6 p-3 bg-gray-50 rounded-lg">
              <span class="text-sm font-medium text-gray-700">Document Type:</span>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="doc_type"
                  checked={!isClientDocument}
                  onchange={() => (isClientDocument = false)}
                  class="text-esolia-navy focus:ring-esolia-navy"
                />
                <span class="text-sm text-gray-700">General</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="doc_type"
                  checked={isClientDocument}
                  onchange={() => (isClientDocument = true)}
                  class="text-esolia-navy focus:ring-esolia-navy"
                />
                <span class="text-sm text-gray-700">Client-specific</span>
              </label>
            </div>

            <div class="grid grid-cols-2 gap-4">
              <div>
                <label for="language_mode" class="block text-sm font-medium text-gray-700"
                  >Language Mode</label
                >
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

            <!-- Client Fields (shown only for client-specific documents) -->
            {#if isClientDocument}
              <div class="border-l-4 border-esolia-orange pl-4 space-y-4">
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
                      placeholder="e.g., ACME"
                      class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
                    />
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
              </div>
            {/if}

            <!-- Contact Name & Personalization fields (only for client-specific documents) -->
            {#if isClientDocument}
              <div class="border-l-4 border-esolia-orange pl-4 space-y-4">
                <!-- Contact Name -->
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

                <!-- Cover Letter Personalization -->
                <div class="pt-3 border-t border-esolia-orange/30">
                  <h4 class="text-sm font-medium text-gray-700 mb-3">
                    Personalization <span class="text-gray-400 font-normal">(optional)</span>
                  </h4>

                  <!-- Hidden inputs for form submission -->
                  <input type="hidden" name="cover_letter_en" value={coverLetterEn} />
                  <input type="hidden" name="cover_letter_ja" value={coverLetterJa} />

                  {#if showEnglish}
                    <div class="mb-4">
                      <span class="block text-sm font-medium text-gray-700 mb-2">
                        Cover Letter (English)
                      </span>
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
                      <span class="block text-sm font-medium text-gray-700 mb-2">
                        Cover Letter (Japanese)
                      </span>
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
                </div>
              </div>
            {/if}

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
              <label for="title_ja" class="block text-sm font-medium text-gray-700"
                >Title (JA)</label
              >
              <input
                type="text"
                id="title_ja"
                name="title_ja"
                value={proposal.title_ja || ''}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
              />
            </div>

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
                <dd class="font-medium">
                  {#if proposal.client_code}
                    {proposal.client_code}
                  {:else}
                    <span class="text-gray-400 italic">General</span>
                  {/if}
                </dd>
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

            {#if proposal.cover_letter_en}
              <div>
                <h3 class="text-sm font-medium text-gray-500">Cover Letter (EN)</h3>
                <div class="mt-1 text-sm bg-gray-50 p-3 rounded prose prose-sm max-w-none">
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized via sanitizeHtml() -->
                  {@html sanitizeHtml(proposal.cover_letter_en)}
                </div>
              </div>
            {/if}

            {#if proposal.cover_letter_ja}
              <div>
                <h3 class="text-sm font-medium text-gray-500">Cover Letter (JA)</h3>
                <div class="mt-1 text-sm bg-gray-50 p-3 rounded prose prose-sm max-w-none">
                  <!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized via sanitizeHtml() -->
                  {@html sanitizeHtml(proposal.cover_letter_ja)}
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
                    <div
                      class="absolute right-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border z-10 max-h-64 overflow-y-auto"
                    >
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

          <div class="space-y-2" role="list" aria-label="Proposal fragments">
            {#each fragments as fragment, index (fragment.id)}
              <div
                draggable={editMode}
                ondragstart={(e) => editMode && handleDragStart(e, index)}
                ondragover={(e) => editMode && handleDragOver(e, index)}
                ondragend={() => editMode && handleDragEnd()}
                role="listitem"
                aria-label="Fragment: {getFragmentTitle(fragment.id)}"
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
                    <!-- Page break toggle (not for first fragment) -->
                    {#if index > 0}
                      <button
                        type="button"
                        onclick={() => togglePageBreak(index)}
                        title={fragment.pageBreakBefore
                          ? 'Remove page break before'
                          : 'Add page break before'}
                        class="p-1.5 rounded-md transition-colors text-xs font-medium
                             {fragment.pageBreakBefore
                          ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                          : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}"
                      >
                        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M4 4h16v5H4zm0 11h16v5H4z" opacity="0.3" />
                          <path d="M2 10h20v2H2z" />
                        </svg>
                      </button>
                    {/if}
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
                {proposal.language === 'ja' && proposal.title_ja
                  ? proposal.title_ja
                  : proposal.title}
              </h1>

              {#each fragments
                .filter((f) => f.enabled)
                .sort((a, b) => a.order - b.order) as fragment}
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
                disabled={!isAdmin ||
                  proposal.status === 'approved' ||
                  proposal.status === 'shared'}
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
            <!-- Pass enabled fragment IDs to avoid re-parsing on server -->
            <input
              type="hidden"
              name="enabled_fragment_ids"
              value={JSON.stringify(
                fragments
                  .filter((f) => f.enabled)
                  .sort((a, b) => a.order - b.order)
                  .map((f) => ({ id: f.id, pageBreakBefore: f.pageBreakBefore }))
              )}
            />
            <button
              type="submit"
              disabled={isGeneratingPdf || isReadOnly}
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
                    href="/api/documents/{proposal.id}/pdf?v={new Date(
                      proposal.pdf_generated_at
                    ).getTime()}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-esolia-navy text-white rounded-lg hover:bg-opacity-90 transition-colors"
                    title="Combined PDF with Table of Contents"
                  >
                    <Eye size={16} />
                    Combined
                  </a>
                  <a
                    href="/api/documents/{proposal.id}/pdf?lang=en&v={new Date(
                      proposal.pdf_generated_at
                    ).getTime()}"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                    title="English only"
                  >
                    <Eye size={16} />
                    English
                  </a>
                  <a
                    href="/api/documents/{proposal.id}/pdf?lang=ja&v={new Date(
                      proposal.pdf_generated_at
                    ).getTime()}"
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
                    href="/api/documents/{proposal.id}/pdf?v={new Date(
                      proposal.pdf_generated_at
                    ).getTime()}"
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
              class="space-y-4"
            >
              <!-- PDF Selection -->
              <div>
                <span id="pdf-selection-label" class="block text-sm font-medium text-gray-700 mb-2">
                  Select PDFs to Share
                </span>
                <div class="space-y-2" role="group" aria-labelledby="pdf-selection-label">
                  {#if proposal.pdf_r2_key_en && proposal.pdf_r2_key_ja}
                    <!-- Bilingual mode: show all 3 options -->
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="share_pdfs"
                        value="combined"
                        checked
                        class="rounded border-gray-300 text-esolia-navy focus:ring-esolia-navy"
                      />
                      <span>Combined (with TOC)</span>
                    </label>
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="share_pdfs"
                        value="english"
                        class="rounded border-gray-300 text-esolia-navy focus:ring-esolia-navy"
                      />
                      <span>English only</span>
                    </label>
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="share_pdfs"
                        value="japanese"
                        class="rounded border-gray-300 text-esolia-navy focus:ring-esolia-navy"
                      />
                      <span>Japanese only / 日本語のみ</span>
                    </label>
                  {:else}
                    <!-- Single language mode: just one PDF -->
                    <label class="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="share_pdfs"
                        value="combined"
                        checked
                        class="rounded border-gray-300 text-esolia-navy focus:ring-esolia-navy"
                      />
                      <span>PDF Document</span>
                    </label>
                  {/if}
                </div>
              </div>

              <!-- Recipients -->
              <div>
                <label for="recipient_emails" class="block text-sm font-medium text-gray-700">
                  Recipient Email(s)
                </label>
                <p class="text-xs text-gray-500 mb-1">One email per line, or comma-separated</p>
                <textarea
                  id="recipient_emails"
                  name="recipient_emails"
                  required
                  rows="3"
                  placeholder="client1@example.com&#10;client2@example.com"
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-sm font-mono"
                ></textarea>
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
            {@const recipients = (() => {
              try {
                const parsed = JSON.parse(proposal.shared_to_email || '[]');
                return Array.isArray(parsed) ? parsed : [proposal.shared_to_email];
              } catch {
                return [proposal.shared_to_email].filter(Boolean);
              }
            })()}
            {@const sharedPdfs = (() => {
              try {
                const parsed = JSON.parse(proposal.shared_to_name || '[]');
                return Array.isArray(parsed) ? parsed : [];
              } catch {
                return [];
              }
            })()}
            <div class="pt-3 border-t space-y-2">
              <div class="text-xs text-gray-500">Active share:</div>
              <code class="block text-xs bg-gray-50 p-2 rounded break-all"
                >{proposal.share_url}</code
              >
              <div class="space-y-1 text-xs">
                <div class="flex items-center gap-4">
                  <span
                    >PIN: <code class="bg-gray-100 px-1 rounded">{proposal.share_pin}</code></span
                  >
                  {#if proposal.share_expires_at}
                    <span class="text-gray-500">
                      Expires: {new Date(proposal.share_expires_at).toLocaleDateString()}
                    </span>
                  {/if}
                </div>
                {#if recipients.length > 0}
                  <div class="text-gray-600">
                    <span class="font-medium">Recipients:</span>
                    {recipients.join(', ')}
                  </div>
                {/if}
                {#if sharedPdfs.length > 0}
                  <div class="text-gray-600">
                    <span class="font-medium">PDFs:</span>
                    {sharedPdfs.join(', ')}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        </div>

        <!-- Danger Zone -->
        {#if isAdmin}
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
        {/if}
      </div>
    </div>
  {/if}
</div>

<script lang="ts">
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import FileText from 'phosphor-svelte/lib/FileText';
  import DotsSixVertical from 'phosphor-svelte/lib/DotsSixVertical';
  import Check from 'phosphor-svelte/lib/Check';
  import X from 'phosphor-svelte/lib/X';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';

  interface Fragment {
    id: string;
    order: number;
    enabled: boolean;
  }

  interface FormResult {
    error?: string;
    clientCode?: string;
    title?: string;
  }

  let { data, form }: { data: PageData; form: FormResult | null } = $props();

  // Initialize fragments from defaults
  let fragments = $state<Fragment[]>(
    (data.defaultFragments as Fragment[]) || [
      { id: 'esolia-introduction', order: 1, enabled: true },
      { id: 'esolia-profile', order: 2, enabled: true },
      { id: 'esolia-background', order: 3, enabled: true },
      { id: 'esolia-project-types', order: 4, enabled: true },
      { id: 'esolia-support-types', order: 5, enabled: true },
      { id: 'esolia-service-mechanics', order: 6, enabled: true },
      { id: 'esolia-agreement-characteristics', order: 7, enabled: true },
      { id: 'esolia-closing', order: 8, enabled: true },
    ]
  );

  let language = $state('en');
  let draggedIndex = $state<number | null>(null);

  const fragmentsJson = $derived(JSON.stringify(fragments));

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

    // Reorder fragments
    const newFragments = [...fragments];
    const [removed] = newFragments.splice(draggedIndex, 1);
    newFragments.splice(index, 0, removed);

    // Update order numbers
    newFragments.forEach((f, i) => (f.order = i + 1));

    fragments = newFragments;
    draggedIndex = index;
  }

  function handleDragEnd() {
    draggedIndex = null;
  }
</script>

<svelte:head>
  <title>New Proposal | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href="/proposals"
      class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <ArrowLeft size={20} />
    </a>
    <div>
      <h1 class="text-3xl font-bold text-esolia-navy">New Proposal</h1>
      <p class="mt-1 text-gray-600">Create a proposal from the standard template</p>
    </div>
  </div>

  <!-- Error display -->
  {#if form?.error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
      {form.error}
    </div>
  {/if}

  <form method="POST" use:enhance class="space-y-6">
    <!-- Hidden fragments JSON -->
    <input type="hidden" name="fragments" value={fragmentsJson} />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left Column: Proposal Details -->
      <div class="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText size={20} weight="duotone" class="text-esolia-navy" />
          Proposal Details
        </h2>

        <!-- Client Code -->
        <div>
          <label for="client_code" class="block text-sm font-medium text-gray-700">
            Client Code <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="client_code"
            name="client_code"
            required
            placeholder="e.g., ACME"
            value={form?.clientCode ?? ''}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          />
          <p class="mt-1 text-xs text-gray-500">Short identifier for the client</p>
        </div>

        <!-- Client Names -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label for="client_name" class="block text-sm font-medium text-gray-700">
              Client Name (EN)
            </label>
            <input
              type="text"
              id="client_name"
              name="client_name"
              placeholder="Acme Corporation"
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
              placeholder="アクメ株式会社"
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
            />
          </div>
        </div>

        <!-- Proposal Titles -->
        <div>
          <label for="title" class="block text-sm font-medium text-gray-700">
            Proposal Title <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="title"
            name="title"
            required
            placeholder="IT Support Services Proposal"
            value={form?.title ?? ''}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          />
        </div>

        <div>
          <label for="title_ja" class="block text-sm font-medium text-gray-700">
            Proposal Title (JA)
          </label>
          <input
            type="text"
            id="title_ja"
            name="title_ja"
            placeholder="ITサポートサービス提案書"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          />
        </div>

        <!-- Scope -->
        <div>
          <label for="scope" class="block text-sm font-medium text-gray-700"> Scope Summary </label>
          <textarea
            id="scope"
            name="scope"
            rows="3"
            placeholder="Brief description of services being proposed..."
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          ></textarea>
        </div>

        <!-- Language -->
        <div>
          <label for="language" class="block text-sm font-medium text-gray-700">
            Primary Language
          </label>
          <select
            id="language"
            name="language"
            bind:value={language}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          >
            <option value="en">English</option>
            <option value="ja">Japanese (日本語)</option>
          </select>
        </div>
      </div>

      <!-- Right Column: Fragment Selection -->
      <div class="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Fragment Selection</h2>
        <p class="text-sm text-gray-600">
          Drag to reorder. Click the checkmark to include/exclude sections.
        </p>

        <div class="space-y-2">
          {#each fragments as fragment, index (fragment.id)}
            <div
              draggable="true"
              ondragstart={(e) => handleDragStart(e, index)}
              ondragover={(e) => handleDragOver(e, index)}
              ondragend={handleDragEnd}
              class="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border cursor-move transition-all
                     {fragment.enabled ? 'border-gray-200' : 'border-gray-100 opacity-50'}
                     {draggedIndex === index ? 'ring-2 ring-esolia-navy ring-offset-2' : ''}"
            >
              <!-- Drag Handle -->
              <DotsSixVertical size={20} class="text-gray-400 flex-shrink-0" />

              <!-- Order Number -->
              <span
                class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium
                       {fragment.enabled
                  ? 'bg-esolia-navy text-white'
                  : 'bg-gray-200 text-gray-500'}"
              >
                {fragment.order}
              </span>

              <!-- Fragment Title -->
              <span class="flex-1 text-sm {fragment.enabled ? 'text-gray-900' : 'text-gray-400'}">
                {getFragmentTitle(fragment.id)}
              </span>

              <!-- Toggle Button -->
              <button
                type="button"
                onclick={() => toggleFragment(index)}
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
            </div>
          {/each}
        </div>

        <p class="text-xs text-gray-500 pt-2">
          Custom sections can be added after creation in the proposal editor.
        </p>
      </div>
    </div>

    <!-- Submit -->
    <div class="flex justify-end gap-4">
      <a
        href="/proposals"
        class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Cancel
      </a>
      <button
        type="submit"
        class="px-6 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
      >
        Create Proposal
      </button>
    </div>
  </form>
</div>

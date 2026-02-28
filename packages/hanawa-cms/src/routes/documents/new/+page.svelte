<script lang="ts">
  import type { PageData } from './$types';
  import { enhance } from '$app/forms';
  import FileText from 'phosphor-svelte/lib/FileText';
  import DotsSixVertical from 'phosphor-svelte/lib/DotsSixVertical';
  import Check from 'phosphor-svelte/lib/Check';
  import X from 'phosphor-svelte/lib/X';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import Star from 'phosphor-svelte/lib/Star';
  import Files from 'phosphor-svelte/lib/Files';
  import LoadingSpinner from '$lib/components/ui/LoadingSpinner.svelte';

  interface Template {
    id: string;
    name: string;
    name_ja: string | null;
    description: string | null;
    description_ja: string | null;
    document_type: string;
    default_fragments: string;
    is_default: boolean;
  }

  interface FragmentConfig {
    id: string;
    order: number;
    enabled: boolean;
    required?: boolean;
  }

  interface AvailableFragment {
    id: string;
    name: string;
    slug: string;
    category: string;
  }

  interface FormResult {
    error?: string;
    clientCode?: string;
    title?: string;
  }

  let { data, form }: { data: PageData; form: FormResult | null } = $props();

  // Template data
  const templates = $derived((data.templates as Template[]) || []);
  const availableFragments = $derived((data.availableFragments as AvailableFragment[]) || []);

  // Document type filter
  let typeFilter = $state<string>('');

  const documentTypes = [
    { value: '', label: 'All Types' },
    { value: 'proposal', label: 'Proposals' },
    { value: 'report', label: 'Reports' },
    { value: 'quote', label: 'Quotes' },
    { value: 'sow', label: 'Statements of Work' },
    { value: 'assessment', label: 'Assessments' },
  ];

  // Filter templates by type
  const filteredTemplates = $derived(
    typeFilter ? templates.filter((t) => t.document_type === typeFilter) : templates
  );
  /* eslint-disable svelte/valid-compile -- Form fields intentionally capture initial values */
  let selectedTemplateId = $state<string | null>(
    (data.selectedTemplate as Template | null)?.id || null
  );
  /* eslint-enable svelte/valid-compile */

  // Initialize fragments from selected template or defaults
  const defaultFragmentConfig: FragmentConfig[] = [
    { id: 'esolia-introduction', order: 1, enabled: true, required: true },
    { id: 'esolia-background', order: 2, enabled: true, required: false },
    { id: 'esolia-closing', order: 3, enabled: true, required: true },
  ];

  /* eslint-disable svelte/valid-compile -- Form fields intentionally capture initial values */
  let fragments = $state<FragmentConfig[]>(
    (data.defaultFragments as FragmentConfig[]) || defaultFragmentConfig
  );
  /* eslint-enable svelte/valid-compile */

  let language = $state('en');
  let selectedDocType = $state('proposal');
  let draggedIndex = $state<number | null>(null);
  let isClientDocument = $state(false); // Default to general document for new documents
  let submitting = $state(false);

  const fragmentsJson = $derived(JSON.stringify(fragments));

  // Get selected template object
  const selectedTemplate = $derived(templates.find((t) => t.id === selectedTemplateId) || null);

  // Build fragment lookup map from available fragments
  const fragmentMap = $derived(new Map(availableFragments.map((f) => [f.id, f])));

  function selectTemplate(templateId: string) {
    selectedTemplateId = templateId;
    const template = templates.find((t) => t.id === templateId);
    if (template) {
      try {
        const templateFragments = JSON.parse(template.default_fragments) as FragmentConfig[];
        fragments = templateFragments;
      } catch {
        fragments = [...defaultFragmentConfig];
      }
    }
  }

  function getFragmentTitle(id: string): string {
    // Check if we have it in available fragments
    const frag = fragmentMap.get(id);
    if (frag) {
      return frag.name;
    }

    // Fallback titles for core fragments
    const titles: Record<string, string> = {
      'esolia-introduction': 'Introduction & Mission',
      'esolia-profile': 'Company Profile',
      'esolia-background': 'Virtual IT Background',
      'esolia-project-types': 'Project Experience',
      'esolia-support-types': 'Support Options',
      'esolia-service-mechanics': 'Service Mechanics',
      'esolia-agreement-characteristics': 'Agreement Terms',
      'esolia-closing': 'Next Steps & Closing',
      'secure-hosting': 'Secure Hosting',
      'modern-web-development': 'Modern Web Development',
      'continuous-monitoring': 'Continuous Monitoring',
      'infrastructure-management': 'Infrastructure Management',
      'dns-email-reliability': 'DNS & Email Reliability',
      'ongoing-support': 'Ongoing Support',
      'website-development': 'Website Development',
    };
    return titles[id] || id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function getFragmentCategory(id: string): string | null {
    const frag = fragmentMap.get(id);
    return frag?.category || null;
  }

  function toggleFragment(index: number) {
    const frag = fragments[index];
    if (!frag || frag.required) return;
    frag.enabled = !frag.enabled;
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
    const removed = newFragments.splice(draggedIndex, 1)[0];
    if (!removed) return;
    newFragments.splice(index, 0, removed);

    // Update order numbers
    newFragments.forEach((f, i) => (f.order = i + 1));

    fragments = newFragments;
    draggedIndex = index;
  }

  function handleDragEnd() {
    draggedIndex = null;
  }

  // Add a fragment from available list
  function addFragment(fragmentId: string) {
    if (fragments.some((f) => f.id === fragmentId)) return; // Already added
    fragments = [
      ...fragments,
      {
        id: fragmentId,
        order: fragments.length + 1,
        enabled: true,
        required: false,
      },
    ];
  }

  // Remove a fragment (only non-required)
  function removeFragment(index: number) {
    if (fragments[index]?.required) return;
    const newFragments = fragments.filter((_, i) => i !== index);
    newFragments.forEach((f, i) => (f.order = i + 1));
    fragments = newFragments;
  }

  // Group available fragments by category (reserved for future fragment picker UI)
  const _fragmentsByCategory = $derived(() => {
    const grouped = new Map<string, AvailableFragment[]>();
    for (const frag of availableFragments) {
      const existing = grouped.get(frag.category) || [];
      existing.push(frag);
      grouped.set(frag.category, existing);
    }
    return grouped;
  });

  // Fragments not yet added
  const unusedFragments = $derived(
    availableFragments.filter((af) => !fragments.some((f) => f.id === af.id))
  );
</script>

<svelte:head>
  <title>New Document | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center gap-4">
    <a
      href="/documents"
      class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
    >
      <ArrowLeft size={20} />
    </a>
    <div>
      <h1 class="text-3xl font-bold text-esolia-navy">New Document</h1>
      <p class="mt-1 text-gray-600">Select a template and customize for your client</p>
    </div>
  </div>

  <!-- Error display -->
  {#if form?.error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
      {form.error}
    </div>
  {/if}

  <!-- Template Selection -->
  {#if templates.length > 0}
    <div class="bg-white rounded-lg shadow p-6">
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Files size={20} weight="duotone" class="text-esolia-navy" />
          Choose a Template
        </h2>
        <span class="text-sm text-gray-500">
          {filteredTemplates.length} of {templates.length} templates
        </span>
      </div>

      <!-- Type Filter -->
      <div class="flex flex-wrap gap-2 mb-4">
        {#each documentTypes as dt (dt.value)}
          <button
            type="button"
            onclick={() => (typeFilter = dt.value)}
            class="px-3 py-1.5 text-sm rounded-full transition-colors
                   {typeFilter === dt.value
              ? 'bg-esolia-navy text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}"
          >
            {dt.label}
          </button>
        {/each}
      </div>

      {#if filteredTemplates.length > 0}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {#each filteredTemplates as template (template.id)}
            <button
              type="button"
              onclick={() => selectTemplate(template.id)}
              class="relative text-left p-4 rounded-lg border-2 transition-all hover:shadow-md
                     {selectedTemplateId === template.id
                ? 'border-esolia-navy bg-esolia-navy/5 ring-2 ring-esolia-navy ring-offset-2'
                : 'border-gray-200 hover:border-gray-300'}"
            >
              {#if template.is_default}
                <Star size={16} weight="fill" class="absolute top-2 right-2 text-yellow-500" />
              {/if}
              <div class="flex items-center gap-2 mb-2">
                <FileText
                  size={20}
                  weight="duotone"
                  class={selectedTemplateId === template.id ? 'text-esolia-navy' : 'text-gray-400'}
                />
                <span class="font-medium text-sm text-gray-900 line-clamp-1">{template.name}</span>
              </div>
              {#if template.description}
                <p class="text-xs text-gray-500 line-clamp-2">{template.description}</p>
              {/if}
            </button>
          {/each}
        </div>
      {:else}
        <p class="text-center text-gray-500 py-8">
          No templates found for this type.
          <button
            type="button"
            onclick={() => (typeFilter = '')}
            class="text-esolia-navy hover:underline"
          >
            Show all templates
          </button>
        </p>
      {/if}
    </div>
  {/if}

  <form
    method="POST"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        await update();
        submitting = false;
      };
    }}
    class="space-y-6"
  >
    <!-- Hidden fields -->
    <input type="hidden" name="fragments" value={fragmentsJson} />
    <input type="hidden" name="template_id" value={selectedTemplateId || ''} />
    <input type="hidden" name="document_type" value={selectedDocType} />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left Column: Document Details -->
      <div class="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText size={20} weight="duotone" class="text-esolia-navy" />
          Document Details
        </h2>

        <!-- Hidden field to pass empty client_code when unchecked -->
        {#if !isClientDocument}
          <input type="hidden" name="client_code" value="" />
        {/if}

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

        <!-- Client Fields (shown only for client-specific documents) -->
        {#if isClientDocument}
          <div class="border-l-4 border-esolia-orange pl-4 space-y-4">
            <div>
              <label for="client_code" class="block text-sm font-medium text-gray-700">
                Client Code
              </label>
              <input
                type="text"
                id="client_code"
                name="client_code"
                placeholder="e.g., ACME"
                value={form?.clientCode ?? ''}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
              />
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
          </div>
        {/if}

        <!-- Document Titles -->
        <div>
          <label for="title" class="block text-sm font-medium text-gray-700">
            Document Title <span class="text-red-500">*</span>
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
            Document Title (JA)
          </label>
          <input
            type="text"
            id="title_ja"
            name="title_ja"
            placeholder="ITサポートサービス提案書"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          />
        </div>

        <!-- Document Type -->
        <div>
          <label for="doc_type_select" class="block text-sm font-medium text-gray-700">
            Document Type
          </label>
          <select
            id="doc_type_select"
            bind:value={selectedDocType}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          >
            <option value="proposal">Proposal</option>
            <option value="report">Report</option>
            <option value="quote">Quote</option>
            <option value="sow">Statement of Work</option>
            <option value="assessment">Assessment</option>
          </select>
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
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900">Fragment Selection</h2>
          {#if selectedTemplate}
            <span class="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {selectedTemplate.name}
            </span>
          {/if}
        </div>
        <p class="text-sm text-gray-600">
          Drag to reorder. Click the checkmark to include/exclude sections. Required sections cannot
          be disabled.
        </p>

        <div class="space-y-2" role="list" aria-label="Document fragments">
          {#each fragments as fragment, index (fragment.id + '-' + index)}
            <div
              draggable="true"
              ondragstart={(e) => handleDragStart(e, index)}
              ondragover={(e) => handleDragOver(e, index)}
              ondragend={handleDragEnd}
              role="listitem"
              aria-label="Fragment: {getFragmentTitle(fragment.id)}"
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

              <!-- Fragment Info -->
              <div class="flex-1 min-w-0">
                <span class="text-sm {fragment.enabled ? 'text-gray-900' : 'text-gray-400'}">
                  {getFragmentTitle(fragment.id)}
                </span>
                {#if fragment.required}
                  <span class="ml-2 text-xs text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    Required
                  </span>
                {/if}
                {#if getFragmentCategory(fragment.id)}
                  <span class="ml-1 text-xs text-gray-400">
                    ({getFragmentCategory(fragment.id)})
                  </span>
                {/if}
              </div>

              <!-- Toggle/Remove Buttons -->
              <button
                type="button"
                onclick={() => toggleFragment(index)}
                disabled={fragment.required}
                class="p-1.5 rounded-md transition-colors
                       {fragment.required
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : fragment.enabled
                    ? 'bg-green-100 text-green-700 hover:bg-green-200'
                    : 'bg-gray-200 text-gray-500 hover:bg-gray-300'}"
              >
                {#if fragment.enabled}
                  <Check size={16} weight="bold" />
                {:else}
                  <X size={16} weight="bold" />
                {/if}
              </button>

              {#if !fragment.required}
                <button
                  type="button"
                  onclick={() => removeFragment(index)}
                  class="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                  title="Remove fragment"
                >
                  <X size={16} />
                </button>
              {/if}
            </div>
          {/each}
        </div>

        <!-- Add More Fragments -->
        {#if unusedFragments.length > 0}
          <div class="pt-4 border-t border-gray-100">
            <p class="text-sm font-medium text-gray-700 mb-2">Add more fragments:</p>
            <div class="flex flex-wrap gap-2">
              {#each unusedFragments.slice(0, 10) as frag (frag.id)}
                <button
                  type="button"
                  onclick={() => addFragment(frag.id)}
                  class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-esolia-navy/10 hover:text-esolia-navy transition-colors"
                >
                  + {frag.name}
                </button>
              {/each}
              {#if unusedFragments.length > 10}
                <span class="text-xs text-gray-400 py-1">
                  +{unusedFragments.length - 10} more
                </span>
              {/if}
            </div>
          </div>
        {/if}

        <p class="text-xs text-gray-500 pt-2">
          Custom sections can be added after creation in the document editor.
        </p>
      </div>
    </div>

    <!-- Submit -->
    <div class="flex justify-end gap-4">
      <a
        href="/documents"
        class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors
               {submitting ? 'pointer-events-none opacity-50' : ''}"
      >
        Cancel
      </a>
      <button
        type="submit"
        disabled={submitting}
        class="px-6 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium
               inline-flex items-center gap-2
               {submitting ? 'opacity-75 cursor-not-allowed' : ''}"
      >
        {#if submitting}
          <LoadingSpinner size="h-4 w-4" />
          Creating...
        {:else}
          Create Document
        {/if}
      </button>
    </div>
  </form>
</div>

<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import FileText from 'phosphor-svelte/lib/FileText';
  import DotsSixVertical from 'phosphor-svelte/lib/DotsSixVertical';
  import Check from 'phosphor-svelte/lib/Check';
  import X from 'phosphor-svelte/lib/X';
  import ArrowLeft from 'phosphor-svelte/lib/ArrowLeft';
  import Star from 'phosphor-svelte/lib/Star';
  import Plus from 'phosphor-svelte/lib/Plus';
  import Copy from 'phosphor-svelte/lib/Copy';
  import Trash from 'phosphor-svelte/lib/Trash';

  interface Template {
    id: string;
    name: string;
    name_ja: string | null;
    description: string | null;
    description_ja: string | null;
    document_type: string;
    default_fragments: string;
    is_default: boolean;
    is_active: boolean;
    created_at: string;
    updated_at: string;
  }

  interface FragmentConfig {
    id: string;
    order: number;
    enabled: boolean;
    required: boolean;
  }

  interface AvailableFragment {
    id: string;
    name: string;
    slug: string;
    category: string;
  }

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Use $derived for reactivity to data changes
  const template = $derived(data.template as Template);
  const availableFragments = $derived((data.availableFragments as AvailableFragment[]) || []);

  // Template form state - initialized from data, then independently editable
  // eslint-disable-next-line svelte/valid-compile -- Form fields intentionally capture initial values
  let name = $state(template.name);
  // eslint-disable-next-line svelte/valid-compile
  let nameJa = $state(template.name_ja || '');
  // eslint-disable-next-line svelte/valid-compile
  let description = $state(template.description || '');
  // eslint-disable-next-line svelte/valid-compile
  let descriptionJa = $state(template.description_ja || '');
  // eslint-disable-next-line svelte/valid-compile
  let documentType = $state(template.document_type);
  // eslint-disable-next-line svelte/valid-compile
  let isDefault = $state(template.is_default);

  // Parse fragments from template
  function parseFragments(): FragmentConfig[] {
    try {
      return JSON.parse(template.default_fragments);
    } catch {
      return [
        { id: 'esolia-introduction', order: 1, enabled: true, required: true },
        { id: 'esolia-closing', order: 2, enabled: true, required: true },
      ];
    }
  }

  let fragments = $state<FragmentConfig[]>(parseFragments());
  let draggedIndex = $state<number | null>(null);
  let showDeleteConfirm = $state(false);
  let saveMessage = $state<string | null>(null);

  const fragmentsJson = $derived(JSON.stringify(fragments));

  // Build fragment lookup map
  const fragmentMap = $derived(new Map(availableFragments.map((f) => [f.id, f])));

  // Unused fragments
  const unusedFragments = $derived(
    availableFragments.filter((af) => !fragments.some((f) => f.id === af.id))
  );

  function getFragmentTitle(id: string): string {
    const frag = fragmentMap.get(id);
    if (frag) {
      return frag.name;
    }
    return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function getFragmentCategory(id: string): string | null {
    const frag = fragmentMap.get(id);
    return frag?.category || null;
  }

  function toggleFragment(index: number) {
    fragments[index].enabled = !fragments[index].enabled;
  }

  function toggleRequired(index: number) {
    fragments[index].required = !fragments[index].required;
  }

  function addFragment(fragmentId: string) {
    if (fragments.some((f) => f.id === fragmentId)) return;
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

  function removeFragment(index: number) {
    const newFragments = fragments.filter((_, i) => i !== index);
    newFragments.forEach((f, i) => (f.order = i + 1));
    fragments = newFragments;
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

  const documentTypes = [
    { value: 'proposal', label: 'Proposal' },
    { value: 'report', label: 'Report' },
    { value: 'quote', label: 'Quote' },
    { value: 'sow', label: 'Statement of Work' },
    { value: 'assessment', label: 'Assessment' },
  ];

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  }
</script>

<svelte:head>
  <title>Edit {template.name} | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div class="flex items-center gap-4">
      <a
        href="/templates"
        class="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <ArrowLeft size={20} />
      </a>
      <div>
        <h1 class="text-3xl font-bold text-esolia-navy flex items-center gap-2">
          {template.name}
          {#if template.is_default}
            <Star size={24} weight="fill" class="text-yellow-500" />
          {/if}
        </h1>
        <p class="mt-1 text-gray-600">
          {documentTypes.find((t) => t.value === template.document_type)?.label ||
            template.document_type}
          template
        </p>
      </div>
    </div>

    <!-- Actions -->
    <div class="flex items-center gap-2">
      <form method="POST" action="?/duplicate" use:enhance>
        <button
          type="submit"
          class="flex items-center gap-2 px-3 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Copy size={16} />
          Duplicate
        </button>
      </form>
      <button
        type="button"
        onclick={() => (showDeleteConfirm = true)}
        class="flex items-center gap-2 px-3 py-2 text-red-600 bg-white border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
      >
        <Trash size={16} />
        Delete
      </button>
    </div>
  </div>

  <!-- Success message -->
  {#if saveMessage}
    <div class="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
      {saveMessage}
    </div>
  {/if}

  <!-- Error display -->
  {#if form?.error}
    <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
      {form.error}
    </div>
  {/if}

  <form
    method="POST"
    action="?/update"
    use:enhance={() => {
      return async ({ result, update }) => {
        if (result.type === 'success') {
          // Show success message without resetting form state
          saveMessage = (result.data?.message as string) || 'Template updated';
          setTimeout(() => {
            saveMessage = null;
          }, 3000);
          // Don't call update() - preserve current form values
        } else {
          // For errors, use default behavior
          await update();
        }
      };
    }}
    class="space-y-6"
  >
    <!-- Hidden fields -->
    <input type="hidden" name="fragments" value={fragmentsJson} />
    <input type="hidden" name="is_default" value={isDefault.toString()} />

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left Column: Template Details -->
      <div class="bg-white rounded-lg shadow p-6 space-y-6">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <FileText size={20} weight="duotone" class="text-esolia-navy" />
          Template Details
        </h2>

        <!-- Template Name -->
        <div>
          <label for="name" class="block text-sm font-medium text-gray-700">
            Template Name <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            bind:value={name}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          />
        </div>

        <div>
          <label for="name_ja" class="block text-sm font-medium text-gray-700">
            Template Name (JA)
          </label>
          <input
            type="text"
            id="name_ja"
            name="name_ja"
            bind:value={nameJa}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          />
        </div>

        <!-- Description -->
        <div>
          <label for="description" class="block text-sm font-medium text-gray-700">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows="2"
            bind:value={description}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          ></textarea>
        </div>

        <div>
          <label for="description_ja" class="block text-sm font-medium text-gray-700">
            Description (JA)
          </label>
          <textarea
            id="description_ja"
            name="description_ja"
            rows="2"
            bind:value={descriptionJa}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          ></textarea>
        </div>

        <!-- Document Type -->
        <div>
          <label for="document_type" class="block text-sm font-medium text-gray-700">
            Document Type
          </label>
          <select
            id="document_type"
            name="document_type"
            bind:value={documentType}
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          >
            {#each documentTypes as type (type.value)}
              <option value={type.value}>{type.label}</option>
            {/each}
          </select>
        </div>

        <!-- Default Flag -->
        <div class="flex items-center gap-3">
          <button
            type="button"
            onclick={() => (isDefault = !isDefault)}
            aria-label={isDefault ? 'Unset as default template' : 'Set as default template'}
            aria-pressed={isDefault}
            class="relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                   {isDefault ? 'bg-esolia-navy' : 'bg-gray-200'}"
          >
            <span
              class="inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                     {isDefault ? 'translate-x-6' : 'translate-x-1'}"
            ></span>
          </button>
          <label class="text-sm font-medium text-gray-700 flex items-center gap-2">
            <Star size={16} weight={isDefault ? 'fill' : 'regular'} class="text-yellow-500" />
            Default template for {documentTypes.find((t) => t.value === documentType)?.label ||
              'this type'}
          </label>
        </div>

        <!-- Metadata -->
        <div class="pt-4 border-t border-gray-100 text-xs text-gray-500 space-y-1">
          <p>ID: {template.id}</p>
          <p>Created: {formatDate(template.created_at)}</p>
          <p>Updated: {formatDate(template.updated_at)}</p>
        </div>
      </div>

      <!-- Right Column: Fragment Selection -->
      <div class="bg-white rounded-lg shadow p-6 space-y-4">
        <h2 class="text-lg font-semibold text-gray-900">Default Fragments</h2>
        <p class="text-sm text-gray-600">
          Configure which fragments are included by default. Mark fragments as required to prevent
          removal.
        </p>

        <div class="space-y-2" role="list" aria-label="Template fragments">
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
              <DotsSixVertical size={20} class="text-gray-400 flex-shrink-0" />

              <span
                class="w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium
                       {fragment.enabled
                  ? 'bg-esolia-navy text-white'
                  : 'bg-gray-200 text-gray-500'}"
              >
                {fragment.order}
              </span>

              <div class="flex-1 min-w-0">
                <span class="text-sm {fragment.enabled ? 'text-gray-900' : 'text-gray-400'}">
                  {getFragmentTitle(fragment.id)}
                </span>
                {#if getFragmentCategory(fragment.id)}
                  <span class="ml-1 text-xs text-gray-400">
                    ({getFragmentCategory(fragment.id)})
                  </span>
                {/if}
              </div>

              <!-- Required toggle -->
              <button
                type="button"
                onclick={() => toggleRequired(index)}
                class="px-2 py-1 text-xs rounded transition-colors
                       {fragment.required
                  ? 'bg-amber-100 text-amber-700'
                  : 'bg-gray-100 text-gray-500 hover:bg-amber-50'}"
                title={fragment.required ? 'Click to make optional' : 'Click to make required'}
              >
                {fragment.required ? 'Required' : 'Optional'}
              </button>

              <!-- Enable/Disable -->
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

              <!-- Remove -->
              <button
                type="button"
                onclick={() => removeFragment(index)}
                class="p-1.5 rounded-md text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                title="Remove fragment"
              >
                <X size={16} />
              </button>
            </div>
          {/each}
        </div>

        <!-- Add More Fragments -->
        {#if unusedFragments.length > 0}
          <div class="pt-4 border-t border-gray-100">
            <p class="text-sm font-medium text-gray-700 mb-2">Add fragments:</p>
            <div class="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {#each unusedFragments as frag (frag.id)}
                <button
                  type="button"
                  onclick={() => addFragment(frag.id)}
                  class="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded hover:bg-esolia-navy/10 hover:text-esolia-navy transition-colors flex items-center gap-1"
                >
                  <Plus size={12} />
                  {frag.name}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    </div>

    <!-- Submit -->
    <div class="flex justify-end gap-4">
      <a
        href="/templates"
        class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        Cancel
      </a>
      <button
        type="submit"
        class="px-6 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
      >
        Save Changes
      </button>
    </div>
  </form>
</div>

<!-- Delete Confirmation Modal -->
{#if showDeleteConfirm}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    onclick={() => (showDeleteConfirm = false)}
    onkeydown={(e) => e.key === 'Escape' && (showDeleteConfirm = false)}
    role="dialog"
    aria-modal="true"
    tabindex="-1"
  >
    <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
    <div
      class="bg-white rounded-lg shadow-xl p-6 max-w-md mx-4"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="document"
    >
      <h3 class="text-lg font-semibold text-gray-900 mb-2">Delete Template</h3>
      <p class="text-gray-600 mb-4">
        Are you sure you want to delete "{template.name}"? This action cannot be undone.
      </p>
      <div class="flex justify-end gap-3">
        <button
          type="button"
          onclick={() => (showDeleteConfirm = false)}
          class="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <form method="POST" action="?/delete" use:enhance>
          <button
            type="submit"
            class="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete Template
          </button>
        </form>
      </div>
    </div>
  </div>
{/if}

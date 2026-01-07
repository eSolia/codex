<script lang="ts">
  import type { PageData } from './$types';
  import FileText from 'phosphor-svelte/lib/FileText';
  import Star from 'phosphor-svelte/lib/Star';
  import PencilSimple from 'phosphor-svelte/lib/PencilSimple';

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

  let { data }: { data: PageData } = $props();

  const templates = $derived((data.templates as Template[]) || []);

  function getFragmentCount(fragmentsJson: string): number {
    try {
      const fragments = JSON.parse(fragmentsJson);
      return fragments.filter((f: { enabled: boolean }) => f.enabled).length;
    } catch {
      return 0;
    }
  }

  function getTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      proposal: 'Proposal',
      report: 'Report',
      quote: 'Quote',
      sow: 'Statement of Work',
      assessment: 'Assessment',
    };
    return labels[type] || type;
  }

  function getTypeClass(type: string): string {
    const classes: Record<string, string> = {
      proposal: 'bg-blue-100 text-blue-800',
      report: 'bg-green-100 text-green-800',
      quote: 'bg-yellow-100 text-yellow-800',
      sow: 'bg-purple-100 text-purple-800',
      assessment: 'bg-orange-100 text-orange-800',
    };
    return classes[type] || 'bg-gray-100 text-gray-800';
  }
</script>

<svelte:head>
  <title>Templates | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-esolia-navy">Templates</h1>
      <p class="mt-1 text-gray-600">Manage document templates and their default fragments</p>
    </div>
    <a
      href="/templates/new"
      class="inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      New Template
    </a>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4">
    <form method="get" class="flex flex-wrap gap-4">
      <select
        name="type"
        class="rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      >
        <option value="">All Types</option>
        <option value="proposal">Proposals</option>
        <option value="report">Reports</option>
        <option value="quote">Quotes</option>
        <option value="sow">Statements of Work</option>
        <option value="assessment">Assessments</option>
      </select>
      <button
        type="submit"
        class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
      >
        Filter
      </button>
    </form>
  </div>

  <!-- Templates Grid -->
  {#if templates.length > 0}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {#each templates as template}
        <div class="bg-white rounded-lg shadow hover:shadow-md transition-shadow">
          <div class="p-6">
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-2">
                <FileText size={24} weight="duotone" class="text-esolia-navy" />
                {#if template.is_default}
                  <Star size={16} weight="fill" class="text-yellow-500" />
                {/if}
              </div>
              <span
                class="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium {getTypeClass(
                  template.document_type
                )}"
              >
                {getTypeLabel(template.document_type)}
              </span>
            </div>

            <h3 class="text-lg font-semibold text-gray-900 mb-1">{template.name}</h3>
            {#if template.name_ja}
              <p class="text-sm text-gray-500 mb-2">{template.name_ja}</p>
            {/if}

            {#if template.description}
              <p class="text-sm text-gray-600 mb-4">{template.description}</p>
            {/if}

            <div class="flex items-center justify-between pt-4 border-t border-gray-100">
              <span class="text-sm text-gray-500">
                {getFragmentCount(template.default_fragments)} fragments
              </span>
              <a
                href="/templates/{template.id}"
                class="inline-flex items-center gap-1 text-sm text-esolia-navy hover:underline"
              >
                <PencilSimple size={14} />
                Edit
              </a>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow p-12 text-center">
      <FileText size={48} weight="duotone" class="mx-auto text-gray-400" />
      <h3 class="mt-4 text-lg font-medium text-gray-900">No templates yet</h3>
      <p class="mt-2 text-gray-500">Create your first template to get started.</p>
      <a
        href="/templates/new"
        class="mt-4 inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
      >
        New Template
      </a>
    </div>
  {/if}
</div>

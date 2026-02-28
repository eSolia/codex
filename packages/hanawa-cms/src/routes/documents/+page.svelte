<script lang="ts">
  import type { PageData } from './$types';
  import { page } from '$app/stores';
  import FileText from 'phosphor-svelte/lib/FileText';
  import Share from 'phosphor-svelte/lib/Share';

  interface Document {
    id: string;
    client_code: string;
    client_name: string | null;
    title: string;
    language: string;
    status: string;
    document_type: string | null;
    share_id: string | null;
    shared_at: string | null;
    created_at: string;
    updated_at: string;
  }

  let { data }: { data: PageData } = $props();

  const documents = $derived(data.proposals as unknown as Document[]);

  function getStatusClass(status: string): string {
    switch (status) {
      case 'shared':
        return 'bg-green-100 text-green-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'review':
        return 'bg-yellow-100 text-yellow-800';
      case 'draft':
        return 'bg-gray-100 text-gray-800';
      case 'archived':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  const typeLabels: Record<string, string> = {
    proposal: 'Proposal',
    report: 'Report',
    quote: 'Quote',
    sow: 'SOW',
    assessment: 'Assessment',
  };

  const selectedStatus = $derived($page.url.searchParams.get('status') ?? '');
  const selectedType = $derived($page.url.searchParams.get('type') ?? '');
</script>

<svelte:head>
  <title>Documents | Hanawa CMS</title>
</svelte:head>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex items-center justify-between">
    <div>
      <h1 class="text-3xl font-bold text-esolia-navy">Documents</h1>
      <p class="mt-1 text-gray-600">Create and share client documents</p>
    </div>
    <a
      href="/documents/new"
      class="inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
    >
      <svg class="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
      </svg>
      New Document
    </a>
  </div>

  <!-- Filters -->
  <div class="bg-white rounded-lg shadow p-4">
    <form method="get" class="flex flex-wrap gap-4">
      <select
        name="status"
        value={selectedStatus}
        class="rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      >
        <option value="">All Statuses</option>
        <option value="draft">Draft</option>
        <option value="review">In Review</option>
        <option value="approved">Approved</option>
        <option value="shared">Shared</option>
        <option value="archived">Archived</option>
      </select>
      <select
        name="type"
        value={selectedType}
        class="rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
      >
        <option value="">All Types</option>
        <option value="proposal">Proposal</option>
        <option value="report">Report</option>
        <option value="quote">Quote</option>
        <option value="sow">SOW</option>
        <option value="assessment">Assessment</option>
      </select>
      <button
        type="submit"
        class="px-4 py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 transition-colors"
      >
        Filter
      </button>
    </form>
  </div>

  <!-- Documents List -->
  {#if documents && documents.length > 0}
    <div class="bg-white rounded-lg shadow overflow-hidden">
      <table class="min-w-full divide-y divide-gray-200">
        <thead class="bg-gray-50">
          <tr>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Document
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Type
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Client
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Status
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Shared
            </th>
            <th
              class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
            >
              Updated
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          {#each documents as doc}
            <tr class="hover:bg-gray-50">
              <td class="px-6 py-4">
                <a
                  href="/documents/{doc.id}"
                  class="text-esolia-navy hover:underline font-medium flex items-center gap-2"
                >
                  <FileText size={18} weight="duotone" class="text-gray-400" />
                  {doc.title}
                </a>
              </td>
              <td class="px-6 py-4">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700"
                >
                  {typeLabels[doc.document_type ?? 'proposal'] ?? 'Proposal'}
                </span>
              </td>
              <td class="px-6 py-4">
                {#if doc.client_code}
                  <div class="text-sm font-medium text-gray-900">{doc.client_code}</div>
                  {#if doc.client_name}
                    <div class="text-sm text-gray-500">{doc.client_name}</div>
                  {/if}
                {:else}
                  <div class="text-sm text-gray-400 italic">General</div>
                {/if}
              </td>
              <td class="px-6 py-4">
                <span
                  class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium {getStatusClass(
                    doc.status
                  )}"
                >
                  {doc.status}
                </span>
              </td>
              <td class="px-6 py-4">
                {#if doc.share_id}
                  <span class="inline-flex items-center gap-1 text-sm text-green-600">
                    <Share size={14} weight="duotone" />
                    {new Date(doc.shared_at ?? '').toLocaleDateString()}
                  </span>
                {:else}
                  <span class="text-sm text-gray-400">—</span>
                {/if}
              </td>
              <td class="px-6 py-4 text-sm text-gray-500">
                {new Date(doc.updated_at).toLocaleDateString()}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="bg-white rounded-lg shadow p-12 text-center">
      <FileText size={48} weight="duotone" class="mx-auto text-gray-400" />
      <h3 class="mt-4 text-lg font-medium text-gray-900">No documents yet</h3>
      <p class="mt-2 text-gray-500">Create your first document to get started.</p>
      <a
        href="/documents/new"
        class="mt-4 inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium"
      >
        New Document
      </a>
    </div>
  {/if}
</div>

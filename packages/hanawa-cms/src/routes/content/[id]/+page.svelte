<script lang="ts">
  /**
   * Content Editor Page
   * Rich text editing with security-aware controls
   *
   * InfoSec: Sensitivity classification, preview approval workflow
   */
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import HanawaEditor from '$lib/components/editor/HanawaEditor.svelte';

  interface ContentData {
    id: string;
    title: string;
    title_ja: string | null;
    slug: string;
    body: string;
    body_ja: string | null;
    status: string;
    language: string;
    sensitivity: 'normal' | 'confidential' | 'embargoed';
    site_id: string | null;
    content_type_id: string | null;
    excerpt: string | null;
    excerpt_ja: string | null;
    created_at: string;
    updated_at: string;
  }

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // Type the content data for safe access - use $derived for reactivity
  const c = $derived(data.content as unknown as ContentData | null);

  // Form state - initialized from data, then independently editable
  /* eslint-disable svelte/valid-compile -- Form fields intentionally capture initial values */
  let title = $state(c?.title || '');
  let titleJa = $state(c?.title_ja || '');
  let slug = $state(c?.slug || '');
  let body = $state(c?.body || '');
  let bodyJa = $state(c?.body_ja || '');
  let status = $state(c?.status || 'draft');
  let language = $state(c?.language || 'en');
  let sensitivity = $state<'normal' | 'confidential' | 'embargoed'>(c?.sensitivity || 'normal');
  let siteId = $state(c?.site_id || '');
  let contentTypeId = $state(c?.content_type_id || '');
  /* eslint-enable svelte/valid-compile */

  // UI state
  let isSaving = $state(false);
  let isPublishing = $state(false);
  let activeTab = $state<'en' | 'ja'>('en');
  let showSensitivityModal = $state(false);

  // Dirty tracking
  let isDirty = $state(false);

  // Success message state (for preserving form values after save)
  let saveMessage = $state<string | null>(null);

  function markDirty() {
    isDirty = true;
  }

  // Auto-generate slug from title
  function generateSlug() {
    slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  // Status options
  const statusOptions = [
    { value: 'draft', label: 'Draft', color: 'bg-gray-100 text-gray-800' },
    { value: 'review', label: 'In Review', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'published', label: 'Published', color: 'bg-green-100 text-green-800' },
    { value: 'archived', label: 'Archived', color: 'bg-red-100 text-red-800' },
  ];

  // Sensitivity options with descriptions
  const sensitivityOptions = [
    {
      value: 'normal',
      label: 'Normal',
      description: 'Standard content, preview available immediately',
      color: 'bg-gray-100 text-gray-800',
    },
    {
      value: 'confidential',
      label: 'Confidential',
      description: 'Preview requires approval, watermarked',
      color: 'bg-yellow-100 text-yellow-800',
    },
    {
      value: 'embargoed',
      label: 'Embargoed',
      description: 'No preview until embargo lifts, max security',
      color: 'bg-red-100 text-red-800',
    },
  ];

  function handleEditorChange(html: string) {
    if (activeTab === 'en') {
      body = html;
    } else {
      bodyJa = html;
    }
    markDirty();
  }
</script>

<svelte:head>
  <title>{title || 'New Content'} | Hanawa CMS</title>
</svelte:head>

<div class="max-w-6xl mx-auto">
  <!-- Header -->
  <div class="flex items-center justify-between mb-6">
    <div class="flex items-center gap-4">
      <a href="/content" class="text-gray-500 hover:text-gray-700"> ← Back to Content </a>
      {#if isDirty}
        <span class="text-sm text-orange-500">Unsaved changes</span>
      {/if}
    </div>
    <div class="flex items-center gap-2">
      <span
        class="px-2 py-1 text-xs font-medium rounded {sensitivityOptions.find(
          (s) => s.value === sensitivity
        )?.color || 'bg-gray-100'}"
      >
        {sensitivity}
      </span>
      <button
        type="button"
        class="text-sm text-gray-500 hover:text-gray-700"
        onclick={() => (showSensitivityModal = true)}
      >
        Change
      </button>
    </div>
  </div>

  <!-- Form Messages -->
  {#if saveMessage}
    <div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg text-green-800">
      {saveMessage}
    </div>
  {/if}
  {#if form?.message}
    <div class="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">
      {form.message}
    </div>
  {/if}

  <form
    method="POST"
    action="?/save"
    use:enhance={() => {
      isSaving = true;
      return async ({ result, update }) => {
        isSaving = false;
        isDirty = false;
        if (result.type === 'success') {
          // Show success message without resetting form state
          const data = result.data as { published?: boolean } | undefined;
          saveMessage = data?.published
            ? 'Content published successfully!'
            : 'Content saved successfully!';
          setTimeout(() => {
            saveMessage = null;
          }, 3000);
          // Don't call update() - preserve current form values
        } else {
          await update();
        }
      };
    }}
  >
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- Main Editor Column -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Title -->
        <div class="bg-white rounded-lg shadow p-6">
          <div class="space-y-4">
            <!-- Language Tabs -->
            <div class="flex border-b border-gray-200">
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium {activeTab === 'en'
                  ? 'border-b-2 border-esolia-navy text-esolia-navy'
                  : 'text-gray-500 hover:text-gray-700'}"
                onclick={() => (activeTab = 'en')}
              >
                English
              </button>
              <button
                type="button"
                class="px-4 py-2 text-sm font-medium {activeTab === 'ja'
                  ? 'border-b-2 border-esolia-navy text-esolia-navy'
                  : 'text-gray-500 hover:text-gray-700'}"
                onclick={() => (activeTab = 'ja')}
              >
                日本語
              </button>
            </div>

            {#if activeTab === 'en'}
              <div>
                <label for="title" class="block text-sm font-medium text-gray-700"> Title </label>
                <input
                  type="text"
                  id="title"
                  name="title"
                  bind:value={title}
                  oninput={markDirty}
                  onblur={() => !slug && generateSlug()}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-xl"
                  placeholder="Enter title..."
                />
              </div>
            {:else}
              <div>
                <label for="title_ja" class="block text-sm font-medium text-gray-700">
                  タイトル
                </label>
                <input
                  type="text"
                  id="title_ja"
                  name="title_ja"
                  bind:value={titleJa}
                  oninput={markDirty}
                  class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy text-xl"
                  placeholder="タイトルを入力..."
                />
              </div>
            {/if}

            <div>
              <label for="slug" class="block text-sm font-medium text-gray-700"> Slug </label>
              <div class="mt-1 flex rounded-md shadow-sm">
                <span
                  class="inline-flex items-center px-3 rounded-l-md border border-r-0 border-gray-300 bg-gray-50 text-gray-500 text-sm"
                >
                  /
                </span>
                <input
                  type="text"
                  id="slug"
                  name="slug"
                  bind:value={slug}
                  oninput={markDirty}
                  class="flex-1 block w-full rounded-none rounded-r-md border-gray-300 focus:border-esolia-navy focus:ring-esolia-navy"
                  placeholder="url-friendly-slug"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Editor -->
        <div>
          {#if activeTab === 'en'}
            <input type="hidden" name="body" value={body} />
            <HanawaEditor
              content={body}
              {sensitivity}
              onchange={handleEditorChange}
              onsave={() => {
                const form = document.querySelector('form');
                if (form) form.requestSubmit();
              }}
            />
          {:else}
            <input type="hidden" name="body_ja" value={bodyJa} />
            <HanawaEditor
              content={bodyJa}
              {sensitivity}
              onchange={handleEditorChange}
              onsave={() => {
                const form = document.querySelector('form');
                if (form) form.requestSubmit();
              }}
            />
          {/if}
        </div>
      </div>

      <!-- Sidebar -->
      <div class="space-y-6">
        <!-- Status & Actions -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-sm font-medium text-gray-900 mb-4">Status</h3>

          <select
            name="status"
            bind:value={status}
            onchange={markDirty}
            class="block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
          >
            {#each statusOptions as option}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>

          <input type="hidden" name="sensitivity" value={sensitivity} />
          <input type="hidden" name="language" value={language} />

          <div class="mt-4 flex flex-col gap-2">
            <button
              type="submit"
              disabled={isSaving}
              class="w-full px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors font-medium disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>

            {#if status === 'review' || status === 'published'}
              <button
                type="submit"
                formaction="?/publish"
                disabled={isPublishing || sensitivity === 'embargoed'}
                class="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50"
              >
                {isPublishing ? 'Publishing...' : 'Publish to R2'}
              </button>
              {#if sensitivity === 'embargoed'}
                <p class="text-xs text-red-600">Embargoed content cannot be published</p>
              {/if}
            {/if}
          </div>
        </div>

        <!-- Site & Type -->
        <div class="bg-white rounded-lg shadow p-6">
          <h3 class="text-sm font-medium text-gray-900 mb-4">Organization</h3>

          <div class="space-y-4">
            <div>
              <label for="site_id" class="block text-sm text-gray-700"> Site </label>
              <select
                id="site_id"
                name="site_id"
                bind:value={siteId}
                onchange={markDirty}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
              >
                <option value="">No site</option>
                {#each data.sites as site}
                  <option value={site.id}>{site.name}</option>
                {/each}
              </select>
            </div>

            <div>
              <label for="content_type_id" class="block text-sm text-gray-700">
                Content Type
              </label>
              <select
                id="content_type_id"
                name="content_type_id"
                bind:value={contentTypeId}
                onchange={markDirty}
                class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
              >
                <option value="">No type</option>
                {#each data.contentTypes as type}
                  <option value={type.id}>{type.name}</option>
                {/each}
              </select>
            </div>
          </div>
        </div>

        <!-- Security Info -->
        {#if sensitivity !== 'normal'}
          <div
            class="rounded-lg p-4 {sensitivity === 'embargoed'
              ? 'bg-red-50 border border-red-200'
              : 'bg-yellow-50 border border-yellow-200'}"
          >
            <h3
              class="text-sm font-medium {sensitivity === 'embargoed'
                ? 'text-red-800'
                : 'text-yellow-800'}"
            >
              {sensitivity === 'embargoed' ? '🔒 Embargoed Content' : '⚠️ Confidential Content'}
            </h3>
            <ul
              class="mt-2 text-xs space-y-1 {sensitivity === 'embargoed'
                ? 'text-red-700'
                : 'text-yellow-700'}"
            >
              <li>
                • Preview requires {sensitivity === 'embargoed' ? 'embargo lift' : 'approval'}
              </li>
              <li>• Watermarked when viewed</li>
              <li>• All views are logged</li>
              {#if sensitivity === 'embargoed'}
                <li>• Cannot be published until embargo lifts</li>
              {/if}
            </ul>
          </div>
        {/if}
      </div>
    </div>
  </form>
</div>

<!-- Sensitivity Change Modal -->
{#if showSensitivityModal}
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <div class="p-6">
        <h2 class="text-lg font-semibold text-gray-900 mb-4">Change Content Sensitivity</h2>

        <form
          method="POST"
          action="?/changeSensitivity"
          use:enhance={() => {
            return async ({ update }) => {
              showSensitivityModal = false;
              await update();
            };
          }}
        >
          <div class="space-y-3">
            {#each sensitivityOptions as option}
              <label
                class="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-gray-50 {sensitivity ===
                option.value
                  ? 'border-esolia-navy bg-blue-50'
                  : 'border-gray-200'}"
              >
                <input
                  type="radio"
                  name="sensitivity"
                  value={option.value}
                  checked={sensitivity === option.value}
                  onchange={() => (sensitivity = option.value as typeof sensitivity)}
                  class="mt-1"
                />
                <div>
                  <div class="font-medium text-gray-900">{option.label}</div>
                  <div class="text-sm text-gray-500">{option.description}</div>
                </div>
              </label>
            {/each}
          </div>

          {#if sensitivity !== 'normal'}
            <div class="mt-4 p-3 bg-yellow-50 rounded-lg text-sm text-yellow-800">
              <strong>Warning:</strong> Escalating sensitivity will revoke any existing preview tokens.
            </div>
          {/if}

          <div class="mt-6 flex gap-3 justify-end">
            <button
              type="button"
              class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              onclick={() => (showSensitivityModal = false)}
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90"
            >
              Update Sensitivity
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
{/if}

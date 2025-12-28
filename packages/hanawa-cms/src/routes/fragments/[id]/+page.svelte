<script lang="ts">
  import type { PageData, ActionData } from "./$types";
  import { enhance } from "$app/forms";
  import VersionPanel from "$lib/components/versions/VersionPanel.svelte";
  import HanawaEditor from "$lib/components/editor/HanawaEditor.svelte";
  import { browser } from "$app/environment";

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let showVersionPanel = $state(false);
  let useRichEditor = $state(true);

  let isEditing = $state(false);
  let showDeleteConfirm = $state(false);
  let activeTab = $state<"en" | "ja">("en");

  // Form state - initialized from data, updated by effects
  let name = $state("");
  let contentEn = $state("");
  let contentJa = $state("");
  let description = $state("");
  let category = $state("");
  let tagsInput = $state("");

  // Initialize form state from data
  $effect(() => {
    name = data.fragment.name;
    contentEn = data.fragment.content_en || "";
    contentJa = data.fragment.content_ja || "";
    description = data.fragment.description || "";
    category = data.fragment.category || "";
    tagsInput = (data.fragment.tags || []).join(", ");
  });

  function resetForm() {
    name = data.fragment.name;
    contentEn = data.fragment.content_en || "";
    contentJa = data.fragment.content_ja || "";
    description = data.fragment.description || "";
    category = data.fragment.category || "";
    tagsInput = (data.fragment.tags || []).join(", ");
    isEditing = false;
  }

  function formatTags(): string {
    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return JSON.stringify(tags);
  }
</script>

<svelte:head>
  <title>{data.fragment.name} | Fragments | Hanawa CMS</title>
</svelte:head>

<div class="max-w-4xl mx-auto space-y-6">
  <!-- Breadcrumb -->
  <nav class="flex items-center space-x-2 text-sm text-gray-500">
    <a href="/fragments" class="hover:text-esolia-navy">Fragments</a>
    <span>/</span>
    <span class="text-gray-900">{data.fragment.name}</span>
  </nav>

  <!-- Header -->
  <div class="flex items-start justify-between">
    <div>
      {#if isEditing}
        <input
          type="text"
          bind:value={name}
          class="text-3xl font-bold text-esolia-navy border-b-2 border-esolia-orange focus:outline-none focus:border-esolia-navy bg-transparent"
          placeholder="Fragment name"
        />
      {:else}
        <h1 class="text-3xl font-bold text-esolia-navy">{data.fragment.name}</h1>
      {/if}
      <p class="mt-1 text-gray-600">
        <span class="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded"
          >{data.fragment.slug}</span
        >
        {#if data.fragment.category}
          <span class="mx-2">in</span>
          <span
            class="inline-flex items-center px-2 py-0.5 rounded text-sm bg-esolia-orange/20 text-esolia-navy"
          >
            {data.fragment.category}
          </span>
        {/if}
      </p>
    </div>

    <div class="flex items-center gap-2">
      {#if isEditing}
        <button
          type="button"
          onclick={resetForm}
          class="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
        >
          Cancel
        </button>
      {:else}
        <button
          type="button"
          onclick={() => (showVersionPanel = !showVersionPanel)}
          class="inline-flex items-center px-3 py-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          title="Version History"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          {#if data.versions && data.versions.length > 0}
            <span class="ml-1.5 text-xs bg-gray-200 px-1.5 py-0.5 rounded-full">
              {data.versions.length}
            </span>
          {/if}
        </button>
        <button
          type="button"
          onclick={() => (isEditing = true)}
          class="inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors"
        >
          <svg
            class="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Edit
        </button>
        <button
          type="button"
          onclick={() => (showDeleteConfirm = true)}
          class="inline-flex items-center px-4 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
        >
          <svg
            class="w-4 h-4 mr-2"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          Delete
        </button>
      {/if}
    </div>
  </div>

  {#if form?.success}
    <div
      class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg"
    >
      Fragment updated successfully.
    </div>
  {/if}

  <!-- Edit Form or View Mode -->
  <form
    method="POST"
    action="?/update"
    use:enhance={() => {
      return async ({ update }) => {
        await update();
        isEditing = false;
      };
    }}
  >
    <input type="hidden" name="name" value={name} />
    <input type="hidden" name="tags" value={formatTags()} />

    <!-- Metadata -->
    <div class="bg-white rounded-lg shadow p-6 space-y-4">
      <h2 class="text-lg font-semibold text-gray-900">Metadata</h2>

      {#if isEditing}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label for="category" class="block text-sm font-medium text-gray-700"
              >Category</label
            >
            <input
              type="text"
              id="category"
              name="category"
              bind:value={category}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
              placeholder="e.g., products, services, proposals"
            />
          </div>
          <div>
            <label for="tags" class="block text-sm font-medium text-gray-700"
              >Tags (comma-separated)</label
            >
            <input
              type="text"
              id="tags"
              bind:value={tagsInput}
              class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
              placeholder="e.g., m365, security, compliance"
            />
          </div>
        </div>
        <div>
          <label for="description" class="block text-sm font-medium text-gray-700"
            >Description</label
          >
          <textarea
            id="description"
            name="description"
            bind:value={description}
            rows="2"
            class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy"
            placeholder="Brief description of this fragment..."
          ></textarea>
        </div>
      {:else}
        <dl class="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div>
            <dt class="font-medium text-gray-500">Version</dt>
            <dd class="mt-1 text-gray-900">{data.fragment.version}</dd>
          </div>
          <div>
            <dt class="font-medium text-gray-500">Status</dt>
            <dd class="mt-1">
              <span
                class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                class:bg-green-100={data.fragment.status === "active"}
                class:text-green-800={data.fragment.status === "active"}
                class:bg-yellow-100={data.fragment.status === "draft"}
                class:text-yellow-800={data.fragment.status === "draft"}
                class:bg-gray-100={data.fragment.status === "deprecated"}
                class:text-gray-800={data.fragment.status === "deprecated"}
              >
                {data.fragment.status}
              </span>
            </dd>
          </div>
          {#if data.fragment.description}
            <div class="md:col-span-2">
              <dt class="font-medium text-gray-500">Description</dt>
              <dd class="mt-1 text-gray-900">{data.fragment.description}</dd>
            </div>
          {/if}
          {#if data.fragment.tags && data.fragment.tags.length > 0}
            <div class="md:col-span-2">
              <dt class="font-medium text-gray-500">Tags</dt>
              <dd class="mt-1 flex flex-wrap gap-1">
                {#each data.fragment.tags as tag}
                  <span
                    class="inline-flex items-center px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-700"
                  >
                    {tag}
                  </span>
                {/each}
              </dd>
            </div>
          {/if}
        </dl>
      {/if}
    </div>

    <!-- Content Tabs -->
    <div class="bg-white rounded-lg shadow mt-6">
      <div class="border-b border-gray-200">
        <nav class="flex -mb-px">
          <button
            type="button"
            class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
            class:border-esolia-navy={activeTab === "en"}
            class:text-esolia-navy={activeTab === "en"}
            class:border-transparent={activeTab !== "en"}
            class:text-gray-500={activeTab !== "en"}
            class:hover:text-gray-700={activeTab !== "en"}
            onclick={() => (activeTab = "en")}
          >
            English
            {#if !contentEn && !data.fragment.content_en}
              <span class="ml-1 text-xs text-gray-400">(empty)</span>
            {/if}
          </button>
          <button
            type="button"
            class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
            class:border-esolia-navy={activeTab === "ja"}
            class:text-esolia-navy={activeTab === "ja"}
            class:border-transparent={activeTab !== "ja"}
            class:text-gray-500={activeTab !== "ja"}
            class:hover:text-gray-700={activeTab !== "ja"}
            onclick={() => (activeTab = "ja")}
          >
            Japanese
            {#if !contentJa && !data.fragment.content_ja}
              <span class="ml-1 text-xs text-gray-400">(empty)</span>
            {/if}
          </button>
        </nav>
      </div>

      <!-- Editor Mode Toggle -->
      {#if isEditing}
        <div class="px-6 py-2 border-b border-gray-100 flex justify-end">
          <label class="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              bind:checked={useRichEditor}
              class="w-3.5 h-3.5 rounded border-gray-300 text-esolia-navy focus:ring-esolia-navy"
            />
            Rich Editor
          </label>
        </div>
      {/if}

      <div class="p-6">
        <!-- Hidden inputs for form submission -->
        <input type="hidden" name="content_en" value={contentEn} />
        <input type="hidden" name="content_ja" value={contentJa} />

        {#if activeTab === "en"}
          {#if isEditing}
            {#if useRichEditor && browser}
              <div class="min-h-[300px]">
                <HanawaEditor
                  bind:content={contentEn}
                  placeholder="Start writing English content..."
                />
              </div>
            {:else}
              <textarea
                bind:value={contentEn}
                rows="15"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
                placeholder="English content (Markdown supported)..."
              ></textarea>
            {/if}
          {:else if data.fragment.content_en}
            <div
              class="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 prose prose-sm max-w-none"
            >{@html data.fragment.content_en}</div>
          {:else}
            <p class="text-gray-500 italic">No English content yet.</p>
          {/if}
        {:else}
          {#if isEditing}
            {#if useRichEditor && browser}
              <div class="min-h-[300px]">
                <HanawaEditor
                  bind:content={contentJa}
                  placeholder="日本語のコンテンツを入力..."
                />
              </div>
            {:else}
              <textarea
                bind:value={contentJa}
                rows="15"
                class="w-full rounded-md border-gray-300 shadow-sm focus:border-esolia-navy focus:ring-esolia-navy font-mono text-sm"
                placeholder="Japanese content (Markdown supported)..."
              ></textarea>
            {/if}
          {:else if data.fragment.content_ja}
            <div
              class="bg-gray-50 p-4 rounded-lg overflow-x-auto text-sm text-gray-800 prose prose-sm max-w-none"
            >{@html data.fragment.content_ja}</div>
          {:else}
            <p class="text-gray-500 italic">No Japanese content yet.</p>
          {/if}
        {/if}
      </div>
    </div>

    {#if isEditing}
      <div class="flex justify-end mt-6">
        <button
          type="submit"
          class="inline-flex items-center px-6 py-2 bg-esolia-orange text-esolia-navy rounded-lg hover:bg-esolia-orange/90 transition-colors font-medium"
        >
          Save Changes
        </button>
      </div>
    {/if}
  </form>

  <!-- Updated timestamp -->
  <p class="text-sm text-gray-500">
    Last updated: {new Date(data.fragment.updated_at).toLocaleString()}
  </p>
</div>

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
        Are you sure you want to delete "{data.fragment.name}"? This action
        cannot be undone.
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

<!-- Version History Panel -->
{#if showVersionPanel}
  <div class="fixed inset-y-0 right-0 w-80 z-40 shadow-xl">
    <VersionPanel
      versions={data.versions || []}
      onPreview={(versionId) => {
        // TODO: Implement preview
        console.log("Preview version:", versionId);
      }}
      onRestore={(versionId) => {
        // TODO: Implement restore
        console.log("Restore version:", versionId);
      }}
      onCompare={(versionIdA, versionIdB) => {
        // TODO: Implement compare
        console.log("Compare versions:", versionIdA, versionIdB);
      }}
      onLabel={(versionId) => {
        // TODO: Implement label
        console.log("Label version:", versionId);
      }}
    />
  </div>
  <!-- Backdrop -->
  <button
    type="button"
    class="fixed inset-0 bg-black/20 z-30"
    onclick={() => (showVersionPanel = false)}
    aria-label="Close version panel"
  ></button>
{/if}

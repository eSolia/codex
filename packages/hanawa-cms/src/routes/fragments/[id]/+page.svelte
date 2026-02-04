<script lang="ts">
  import type { PageData, ActionData } from './$types';
  import { enhance } from '$app/forms';
  import VersionPanel from '$lib/components/versions/VersionPanel.svelte';
  import HanawaEditor from '$lib/components/editor/HanawaEditor.svelte';
  import { browser } from '$app/environment';
  import { marked } from 'marked';
  import { onMount, tick } from 'svelte';
  import mermaid from 'mermaid';
  import { sanitizeHtml } from '$lib/sanitize';
  import Image from 'phosphor-svelte/lib/Image';
  import ChartBar from 'phosphor-svelte/lib/ChartBar';
  import Warning from 'phosphor-svelte/lib/Warning';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  // State declarations - must be before they're used
  let showVersionPanel = $state(false);
  let useRichEditor = $state(true);
  let isEditing = $state(false);

  // Diagram preview state
  let diagramSvg = $state<string | null>(null);
  let diagramLoading = $state(false);
  let diagramError = $state<string | null>(null);
  let diagramFetchAttempted = $state(false);

  // R2 export metadata state
  interface DiagramMeta {
    exists: boolean;
    id: string;
    path: string;
    size?: number;
    uploaded?: string;
    uploadedAt?: string;
    source?: string;
  }
  let diagramMetas = $state<Map<string, DiagramMeta>>(new Map());
  let metaLoading = $state(false);

  // Check if this is a diagram fragment (SVG stored in R2)
  const isDiagramFragment = $derived(data.fragment.category === 'diagrams');

  // Check if fragment has Mermaid diagram source
  const hasDiagramSource = $derived(!!data.fragment.diagram_source);

  // Get list of exported diagrams with metadata (for view mode display)
  const exportedDiagrams = $derived(() => {
    const results: Array<{ id: string; meta: DiagramMeta }> = [];
    for (const [id, meta] of diagramMetas) {
      if (meta.exists) {
        results.push({ id, meta });
      }
    }
    return results;
  });

  // Check if fragment content contains inline Mermaid code
  const hasInlineMermaid = $derived(() => {
    // First check for dedicated diagram_source field
    if (data.fragment.diagram_source) return true;

    const contentEn = data.fragment.content_en || '';
    const contentJa = data.fragment.content_ja || '';
    const combined = contentEn + contentJa;
    // Check for markdown mermaid blocks or Tiptap mermaid blocks
    return (
      combined.includes('```mermaid') ||
      combined.includes('data-type="mermaidBlock"') ||
      combined.includes("data-type='mermaidBlock'")
    );
  });

  // Mermaid diagram rendering state
  let mermaidSvg = $state<string | null>(null);
  let mermaidError = $state<string | null>(null);
  let mermaidRendering = $state(false);

  // Render Mermaid from diagram_source
  async function renderDiagramSource() {
    if (!data.fragment.diagram_source || !browser) return;

    mermaidRendering = true;
    mermaidError = null;

    try {
      const id = `diagram-${data.fragment.id}-${Date.now()}`;
      const { svg } = await mermaid.render(id, data.fragment.diagram_source);
      mermaidSvg = svg;
    } catch (err) {
      console.error('[Mermaid] Render error:', err);
      mermaidError = err instanceof Error ? err.message : 'Failed to render diagram';
    } finally {
      mermaidRendering = false;
    }
  }

  // Render diagram source on load
  $effect(() => {
    if (browser && hasDiagramSource && !mermaidSvg && !mermaidRendering) {
      renderDiagramSource();
    }
  });

  // Fetch diagram metadata from R2
  async function fetchDiagramMeta(diagramId: string): Promise<DiagramMeta | null> {
    try {
      const response = await fetch(`/api/diagrams/${diagramId}/meta`);
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (err) {
      console.warn(`[Diagram Meta] Failed to fetch metadata for ${diagramId}:`, err);
      return null;
    }
  }

  // Extract diagram IDs from content (Mermaid data-svg-path attributes)
  function extractDiagramIds(content: string | null): string[] {
    if (!content) return [];
    const ids: string[] = [];
    // Match data-svg-path="diagrams/xxx.svg"
    const regex = /data-svg-path=["']diagrams\/([^"']+)\.svg["']/gi;
    let match;
    while ((match = regex.exec(content)) !== null) {
      ids.push(match[1]);
    }
    return ids;
  }

  // Load metadata for all diagrams in fragment content
  async function loadDiagramMetadata() {
    if (!browser) return;

    metaLoading = true;
    const allIds = new Set<string>();

    // Get diagram IDs from both language contents
    extractDiagramIds(data.fragment.content_en).forEach((id) => allIds.add(id));
    extractDiagramIds(data.fragment.content_ja).forEach((id) => allIds.add(id));

    // Also add fragment ID if it's a diagram fragment
    if (isDiagramFragment) {
      allIds.add(data.fragment.id);
    }

    // Fetch metadata for all diagrams
    const newMetas = new Map<string, DiagramMeta>();
    for (const id of allIds) {
      const meta = await fetchDiagramMeta(id);
      if (meta) {
        newMetas.set(id, meta);
      }
    }

    diagramMetas = newMetas;
    metaLoading = false;
  }

  // Load diagram metadata on mount and when content changes
  $effect(() => {
    // Track content to reload metadata when it changes
    const _contentEn = data.fragment.content_en;
    const _contentJa = data.fragment.content_ja;

    if (browser) {
      loadDiagramMetadata();
    }
  });

  // Load diagram SVG from R2 on mount if this is a diagram fragment
  $effect(() => {
    // Guard: only try once per fragment
    if (browser && isDiagramFragment && !diagramFetchAttempted) {
      diagramFetchAttempted = true;
      loadDiagramSvg();
    }
  });

  async function loadDiagramSvg() {
    diagramLoading = true;
    diagramError = null;
    try {
      // Add timeout to prevent infinite loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`/api/diagrams/${data.fragment.id}`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      console.log(
        `[Diagram] Response status: ${response.status}, type: ${response.headers.get('content-type')}`
      );

      if (response.ok) {
        const contentType = response.headers.get('content-type');
        if (contentType?.includes('svg') || contentType?.includes('xml')) {
          diagramSvg = await response.text();
        } else {
          diagramError = `Not an SVG file (got ${contentType || 'unknown'})`;
        }
      } else if (response.status === 404) {
        diagramError = 'not-in-r2'; // Special marker for no R2 file
      } else if (response.status === 503) {
        diagramError = 'R2 storage service unavailable';
      } else {
        const errorText = await response.text().catch(() => '');
        diagramError = `Failed to load: ${response.status}${errorText ? ` - ${errorText}` : ''}`;
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        diagramError = 'Request timed out - R2 may be unavailable';
      } else {
        diagramError = err instanceof Error ? err.message : 'Failed to load diagram';
      }
    } finally {
      diagramLoading = false;
    }
  }

  // Configure marked for safe rendering
  marked.setOptions({
    gfm: true,
    breaks: true,
  });

  // Initialize mermaid on client
  onMount(() => {
    console.log('[Mermaid] onMount - initializing');
    mermaid.initialize({
      startOnLoad: false,
      theme: 'default',
      securityLevel: 'loose',
      fontFamily: "'Noto Sans JP', sans-serif",
    });
  });

  // Parse markdown to HTML (but don't double-process existing HTML)
  function renderMarkdown(content: string | null | undefined): string {
    if (!content) return '';
    // If content is already HTML (from Tiptap), return as-is
    if (content.trim().startsWith('<')) return content;
    return marked.parse(content) as string;
  }

  // Check if content is HTML (from Tiptap) or markdown
  function isHtmlContent(content: string | null | undefined): boolean {
    if (!content) return false;
    // If it starts with HTML tags, it's from Tiptap
    return content.trim().startsWith('<');
  }

  // Render content - handles both HTML and markdown
  // InfoSec: All content is sanitized to prevent XSS
  function renderContent(content: string | null | undefined): string {
    if (!content) return '';
    if (isHtmlContent(content)) {
      return sanitizeHtml(content); // Sanitize HTML from Tiptap
    }
    return sanitizeHtml(marked.parse(content) as string);
  }

  // Render mermaid diagrams after content is displayed
  async function renderMermaidDiagrams() {
    console.log('[Mermaid] renderMermaidDiagrams called');

    // Find all mermaid blocks - try both Tiptap format and markdown code blocks
    const mermaidBlocks = document.querySelectorAll(
      "[data-type='mermaidBlock'], [data-type='mermaid']"
    );
    console.log('[Mermaid] Found Tiptap blocks:', mermaidBlocks.length);

    for (const block of mermaidBlocks) {
      const source = block.getAttribute('data-source');
      console.log('[Mermaid] Block source:', source?.substring(0, 50));

      // Find or create diagram container
      let diagramContainer = block.querySelector('.mermaid-diagram');
      if (!diagramContainer) {
        console.log('[Mermaid] Creating diagram container');
        diagramContainer = document.createElement('div');
        diagramContainer.className = 'mermaid-diagram';
        block.appendChild(diagramContainer);
      }

      if (source) {
        try {
          const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
          console.log('[Mermaid] Rendering with id:', id);
          const { svg } = await mermaid.render(id, source);
          diagramContainer.innerHTML = svg;
          console.log('[Mermaid] Render success');
        } catch (err) {
          console.error('[Mermaid] Render error:', err);
          diagramContainer.innerHTML = `<div class="text-red-500 text-sm">Diagram error: ${err instanceof Error ? err.message : 'Unknown error'}</div>`;
        }
      }
    }

    // Also handle markdown-style mermaid code blocks (from marked.parse())
    const codeBlocks = document.querySelectorAll('code.language-mermaid');
    console.log('[Mermaid] Found code blocks:', codeBlocks.length);

    for (const codeBlock of codeBlocks) {
      const source = codeBlock.textContent;
      const preElement = codeBlock.parentElement;
      if (!source || !preElement || preElement.tagName !== 'PRE') continue;

      // Skip if already processed
      if (preElement.classList.contains('mermaid-processed')) continue;
      preElement.classList.add('mermaid-processed');

      try {
        const id = `mermaid-${Math.random().toString(36).substring(2, 9)}`;
        console.log('[Mermaid] Rendering code block with id:', id);
        const { svg } = await mermaid.render(id, source);

        // Replace the pre/code with rendered SVG
        const diagramContainer = document.createElement('div');
        diagramContainer.className = 'mermaid-rendered';
        diagramContainer.innerHTML = svg;
        preElement.replaceWith(diagramContainer);
        console.log('[Mermaid] Code block render success');
      } catch (err) {
        console.error('[Mermaid] Code block render error:', err);
        // Keep original code block but add error message
        const errorDiv = document.createElement('div');
        errorDiv.className = 'text-red-500 text-sm mt-2';
        errorDiv.textContent = `Diagram error: ${err instanceof Error ? err.message : 'Unknown error'}`;
        preElement.parentNode?.insertBefore(errorDiv, preElement.nextSibling);
      }
    }
  }

  // Track content for triggering re-renders
  let _contentRendered = $state(false);

  // Re-render mermaid when exiting edit mode
  $effect(() => {
    if (!isEditing && browser) {
      console.log('[Mermaid] Effect - exiting edit mode, re-rendering');
      setTimeout(renderMermaidDiagrams, 300);
    }
  });

  // Render mermaid when content changes (including initial load)
  $effect(() => {
    // Track the content to trigger re-render when it changes
    const _contentEn = data.fragment.content_en;
    const _contentJa = data.fragment.content_ja;

    if (browser && !isEditing) {
      console.log('[Mermaid] Effect - content changed, scheduling render');
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        setTimeout(renderMermaidDiagrams, 100);
        _contentRendered = true;
      });
    }
  });

  let showDeleteConfirm = $state(false);
  let activeTab = $state<'en' | 'ja'>('en');

  // Re-render mermaid when switching language tabs
  $effect(() => {
    // Track activeTab to trigger re-render
    const _tab = activeTab;
    if (browser && !isEditing) {
      console.log('[Mermaid] Effect - tab changed to', _tab);
      // Wait for DOM to update after tab switch
      tick().then(() => {
        setTimeout(renderMermaidDiagrams, 100);
      });
    }
  });

  // Form state - initialized from data, updated by effects
  let name = $state('');
  let contentEn = $state('');
  let contentJa = $state('');
  let description = $state('');
  let category = $state('');
  let tagsInput = $state('');

  // Initialize form state from data
  // Convert markdown to HTML for rich editor
  $effect(() => {
    name = data.fragment.name;
    // Parse markdown to HTML for the rich editor
    contentEn = renderMarkdown(data.fragment.content_en || '');
    contentJa = renderMarkdown(data.fragment.content_ja || '');
    description = data.fragment.description || '';
    category = data.fragment.category || '';
    tagsInput = (data.fragment.tags || []).join(', ');
  });

  function resetForm() {
    name = data.fragment.name;
    contentEn = renderMarkdown(data.fragment.content_en || '');
    contentJa = renderMarkdown(data.fragment.content_ja || '');
    description = data.fragment.description || '';
    category = data.fragment.category || '';
    tagsInput = (data.fragment.tags || []).join(', ');
    isEditing = false;
  }

  function formatTags(): string {
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    return JSON.stringify(tags);
  }

  /**
   * Base64 encode content for safe transmission through WAF.
   * InfoSec: Prevents Cloudflare WAF from blocking HTML content.
   */
  function encodeContent(content: string): string {
    if (!content) return '';
    try {
      return btoa(unescape(encodeURIComponent(content)));
    } catch {
      // Fallback for content that can't be encoded
      return content;
    }
  }
</script>

<svelte:head>
  <title>{data.fragment.name} | Fragments | Hanawa CMS</title>
  <!-- Noto Sans JP for Mermaid diagram rendering (matches CF Browser Rendering font) -->
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap"
    rel="stylesheet"
  />
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
        <span class="font-mono text-sm bg-gray-100 px-2 py-0.5 rounded">{data.fragment.slug}</span>
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
          onclick={() => {
            isEditing = true;
            useRichEditor = true; // Ensure rich editor is on by default
          }}
          class="inline-flex items-center px-4 py-2 bg-esolia-navy text-white rounded-lg hover:bg-esolia-navy/90 transition-colors"
        >
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
    <div class="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg">
      Fragment updated successfully.
    </div>
  {:else if form?.saveForm?.message}
    <div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg">
      Error: {form.saveForm.message}
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
            <label for="category" class="block text-sm font-medium text-gray-700">Category</label>
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
                class:bg-green-100={data.fragment.status === 'active'}
                class:text-green-800={data.fragment.status === 'active'}
                class:bg-yellow-100={data.fragment.status === 'draft'}
                class:text-yellow-800={data.fragment.status === 'draft'}
                class:bg-gray-100={data.fragment.status === 'deprecated'}
                class:text-gray-800={data.fragment.status === 'deprecated'}
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

    <!-- R2 Export Status (shown in view mode for fragments with Mermaid) -->
    {#if !isEditing && hasInlineMermaid() && exportedDiagrams().length > 0}
      <div class="bg-white rounded-lg shadow mt-6 p-6">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Image size={20} weight="duotone" class="text-emerald-600" />
          R2 Export Status
        </h2>
        <div class="space-y-3">
          {#each exportedDiagrams() as { id: _id, meta }}
            <div
              class="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-lg"
            >
              <div class="flex items-center gap-3">
                <span
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800"
                >
                  Exported
                </span>
                <code class="font-mono text-sm text-gray-700">{meta.path}</code>
              </div>
              <div class="text-sm text-gray-600">
                {#if meta.uploadedAt}
                  <span title="Export timestamp from custom metadata">
                    {new Date(meta.uploadedAt).toLocaleString()}
                  </span>
                {:else if meta.uploaded}
                  <span title="R2 object upload time">
                    {new Date(meta.uploaded).toLocaleString()}
                  </span>
                {:else}
                  <span class="text-gray-400">Unknown date</span>
                {/if}
                {#if meta.size}
                  <span class="ml-2 text-gray-400">({(meta.size / 1024).toFixed(1)} KB)</span>
                {/if}
              </div>
            </div>
            <!-- SVG Preview from R2 -->
            {#if meta.path}
              {@const svgId = meta.path.replace('diagrams/', '').replace('.svg', '')}
              <div
                class="border border-gray-200 rounded-lg p-4 bg-white overflow-auto max-h-[500px]"
              >
                <img
                  src="/api/diagrams/{svgId}"
                  alt="Exported SVG: {meta.path}"
                  class="max-w-full h-auto mx-auto"
                  loading="lazy"
                />
              </div>
            {/if}
          {/each}
        </div>
      </div>
    {:else if !isEditing && hasInlineMermaid() && !metaLoading}
      <!-- Has Mermaid but nothing exported yet -->
      <div class="bg-white rounded-lg shadow mt-6 p-6">
        <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
          <Warning size={20} weight="duotone" class="text-amber-500" />
          R2 Export Status
        </h2>
        <div class="p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <p class="text-amber-800 text-sm">
            This fragment contains Mermaid diagrams that have not been exported to R2. Edit the
            fragment and use the export button to save SVG versions for PDF generation.
          </p>
        </div>
      </div>
    {/if}

    <!-- Diagram Preview (for SVG diagrams stored in R2) -->
    {#if isDiagramFragment}
      <div class="bg-white rounded-lg shadow mt-6 p-6">
        <div class="flex items-center justify-between mb-4">
          <h2 class="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Image size={20} weight="duotone" class="text-esolia-orange" />
            Diagram Preview
          </h2>
          <!-- Dynamic badge based on actual status -->
          {#if diagramSvg}
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800"
            >
              SVG from R2
            </span>
          {:else if mermaidSvg || hasDiagramSource}
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
            >
              Mermaid Source
            </span>
          {:else if hasInlineMermaid()}
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800"
            >
              Inline Mermaid
            </span>
          {:else if diagramError === 'not-in-r2'}
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800"
            >
              No R2 SVG
            </span>
          {:else}
            <span
              class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600"
            >
              Checking...
            </span>
          {/if}
        </div>

        {#if diagramLoading || mermaidRendering}
          <div class="flex items-center justify-center py-12 text-gray-500">
            <svg class="animate-spin h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24">
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
            Loading diagram...
          </div>
        {:else if mermaidSvg}
          <!-- Rendered Mermaid diagram from diagram_source -->
          <div class="border border-gray-200 rounded-lg p-4 bg-white overflow-auto max-h-[600px]">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized Mermaid SVG from internal renderer -->
            {@html mermaidSvg}
          </div>
        {:else if mermaidError}
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p class="font-medium">Mermaid render error</p>
            <p class="text-sm mt-1">{mermaidError}</p>
          </div>
        {:else if diagramError === 'not-in-r2' && hasInlineMermaid()}
          <!-- Inline Mermaid - no R2 SVG needed -->
          <div class="bg-purple-50 border border-purple-200 rounded-lg p-4 text-purple-800">
            <p class="font-medium flex items-center gap-2">
              <ChartBar size={20} weight="duotone" />
              Inline Mermaid Diagram
            </p>
            <p class="text-sm mt-2">
              This fragment contains Mermaid code that renders in the content area below. The
              diagram is defined inline, not stored as SVG in R2.
            </p>
          </div>
        {:else if diagramError === 'not-in-r2'}
          <!-- No R2 SVG and no inline Mermaid - likely draw.io not synced -->
          <div class="bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-800">
            <p class="font-medium flex items-center gap-2">
              <Warning size={20} weight="duotone" />
              No SVG in R2 Storage
            </p>
            <p class="text-sm mt-2">
              Expected path: <code class="font-mono bg-amber-100 px-1 rounded"
                >diagrams/{data.fragment.id}.svg</code
              >
            </p>
            <p class="text-sm mt-1">
              If this is a draw.io diagram, run the sync script to export it to R2.
            </p>
          </div>
        {:else if diagramError}
          <div class="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            <p class="font-medium">Could not load diagram preview</p>
            <p class="text-sm mt-1">{diagramError}</p>
          </div>
        {:else if diagramSvg}
          <div class="border border-gray-200 rounded-lg p-4 bg-white overflow-auto max-h-[600px]">
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- Trusted SVG from R2 storage -->
            {@html diagramSvg}
          </div>
        {:else}
          <div class="bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-500 text-center">
            No diagram preview available
          </div>
        {/if}
      </div>
    {/if}

    <!-- Content Tabs -->
    <div class="bg-white rounded-lg shadow mt-6">
      <div class="border-b border-gray-200">
        <nav class="flex -mb-px">
          <button
            type="button"
            class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
            class:border-esolia-navy={activeTab === 'en'}
            class:text-esolia-navy={activeTab === 'en'}
            class:border-transparent={activeTab !== 'en'}
            class:text-gray-500={activeTab !== 'en'}
            class:hover:text-gray-700={activeTab !== 'en'}
            onclick={() => (activeTab = 'en')}
          >
            English
            {#if !contentEn && !data.fragment.content_en}
              <span class="ml-1 text-xs text-gray-400">(empty)</span>
            {/if}
          </button>
          <button
            type="button"
            class="px-6 py-3 text-sm font-medium border-b-2 transition-colors"
            class:border-esolia-navy={activeTab === 'ja'}
            class:text-esolia-navy={activeTab === 'ja'}
            class:border-transparent={activeTab !== 'ja'}
            class:text-gray-500={activeTab !== 'ja'}
            class:hover:text-gray-700={activeTab !== 'ja'}
            onclick={() => (activeTab = 'ja')}
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
        <!-- Hidden inputs for form submission (base64 encoded to bypass WAF) -->
        <input type="hidden" name="content_en" value={encodeContent(contentEn)} />
        <input type="hidden" name="content_ja" value={encodeContent(contentJa)} />
        <input type="hidden" name="content_encoding" value="base64" />

        {#if activeTab === 'en'}
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
            >
              <!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized CMS content via sanitizeHtml -->
              {@html renderContent(data.fragment.content_en)}
            </div>
          {:else}
            <p class="text-gray-500 italic">No English content yet.</p>
          {/if}
        {:else if isEditing}
          {#if useRichEditor && browser}
            <div class="min-h-[300px]">
              <HanawaEditor bind:content={contentJa} placeholder="日本語のコンテンツを入力..." />
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
          >
            <!-- eslint-disable-next-line svelte/no-at-html-tags -- Sanitized CMS content via sanitizeHtml -->
            {@html renderContent(data.fragment.content_ja)}
          </div>
        {:else}
          <p class="text-gray-500 italic">No Japanese content yet.</p>
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
        Are you sure you want to delete "{data.fragment.name}"? This action cannot be undone.
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
        console.log('Preview version:', versionId);
      }}
      onRestore={(versionId) => {
        // TODO: Implement restore
        console.log('Restore version:', versionId);
      }}
      onCompare={(versionIdA, versionIdB) => {
        // TODO: Implement compare
        console.log('Compare versions:', versionIdA, versionIdB);
      }}
      onLabel={(versionId) => {
        // TODO: Implement label
        console.log('Label version:', versionId);
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

<!--
  MediaLibrary Component
  Grid view of assets with upload, filtering, and selection

  InfoSec: File type validation happens server-side (OWASP A04)
-->
<script lang="ts">
  import { onMount } from 'svelte';

  interface Asset {
    id: string;
    site_id: string | null;
    filename: string;
    path: string;
    mime_type: string | null;
    size: number | null;
    alt_text: string | null;
    alt_text_ja: string | null;
    caption: string | null;
    folder: string;
    tags: string[];
    created_at: string;
    updated_at: string;
    url?: string;
  }

  interface Props {
    siteId?: string;
    selectable?: boolean;
    multiple?: boolean;
    acceptTypes?: string[];
    onselect?: (assets: Asset[]) => void;
  }

  let {
    siteId,
    selectable = false,
    multiple = false,
    acceptTypes = ['image/*'],
    onselect,
  }: Props = $props();

  let assets = $state<Asset[]>([]);
  let folders = $state<string[]>([]);
  let selectedIds = $state<Set<string>>(new Set());
  let currentFolder = $state('/');
  let searchQuery = $state('');
  let mimeTypeFilter = $state('');
  let loading = $state(true);
  let uploading = $state(false);
  let uploadProgress = $state(0);
  let error = $state<string | null>(null);
  let dragOver = $state(false);
  let total = $state(0);
  let offset = $state(0);
  const limit = 50;

  // File input reference
  let fileInput: HTMLInputElement;

  async function loadAssets() {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams();
      if (siteId) params.set('siteId', siteId);
      if (currentFolder !== '/') params.set('folder', currentFolder);
      if (mimeTypeFilter) params.set('mimeType', mimeTypeFilter);
      if (searchQuery) params.set('search', searchQuery);
      params.set('limit', String(limit));
      params.set('offset', String(offset));

      const response = await fetch(`/api/media?${params}`);
      if (!response.ok) throw new Error('Failed to load assets');

      const data = (await response.json()) as { assets: typeof assets; total: number };
      assets = data.assets;
      total = data.total;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load assets';
    } finally {
      loading = false;
    }
  }

  async function loadFolders() {
    try {
      const params = new URLSearchParams();
      if (siteId) params.set('siteId', siteId);

      const response = await fetch(`/api/media/folders?${params}`);
      if (!response.ok) return;

      const data = (await response.json()) as { folders: typeof folders };
      folders = data.folders;
    } catch {
      // Ignore folder load errors
    }
  }

  async function uploadFiles(files: FileList | File[]) {
    uploading = true;
    uploadProgress = 0;
    error = null;

    const fileArray = Array.from(files);
    let completed = 0;

    for (const file of fileArray) {
      try {
        const formData = new FormData();
        formData.append('file', file);
        if (siteId) formData.append('siteId', siteId);
        formData.append('folder', currentFolder);

        const response = await fetch('/api/media', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          const errorData = (await response.json().catch(() => ({}))) as { message?: string };
          throw new Error(errorData.message || 'Upload failed');
        }

        completed++;
        uploadProgress = Math.round((completed / fileArray.length) * 100);
      } catch (err) {
        error = err instanceof Error ? err.message : 'Upload failed';
        break;
      }
    }

    uploading = false;
    uploadProgress = 0;

    // Reload assets after upload
    await loadAssets();
    await loadFolders();
  }

  function handleFileSelect(event: Event) {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      uploadFiles(input.files);
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    dragOver = false;

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      uploadFiles(event.dataTransfer.files);
    }
  }

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    dragOver = true;
  }

  function handleDragLeave() {
    dragOver = false;
  }

  function toggleSelect(asset: Asset) {
    if (!selectable) return;

    const newSelected = new Set(selectedIds);

    if (multiple) {
      if (newSelected.has(asset.id)) {
        newSelected.delete(asset.id);
      } else {
        newSelected.add(asset.id);
      }
    } else {
      newSelected.clear();
      newSelected.add(asset.id);
    }

    selectedIds = newSelected;

    if (onselect) {
      const selectedAssets = assets.filter((a) => newSelected.has(a.id));
      onselect(selectedAssets);
    }
  }

  async function deleteAsset(id: string) {
    if (!confirm('Delete this asset? This cannot be undone.')) return;

    try {
      const response = await fetch(`/api/media/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Delete failed');

      await loadAssets();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Delete failed';
    }
  }

  function formatFileSize(bytes: number | null): string {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function getFileIcon(mimeType: string | null): string {
    if (!mimeType) return '📁';
    if (mimeType.startsWith('image/')) return '🖼️';
    if (mimeType.startsWith('video/')) return '🎬';
    if (mimeType.startsWith('audio/')) return '🎵';
    if (mimeType === 'application/pdf') return '📄';
    if (mimeType === 'text/csv') return '📊';
    if (mimeType === 'application/json') return '📋';
    return '📁';
  }

  function isImage(mimeType: string | null): boolean {
    return mimeType?.startsWith('image/') ?? false;
  }

  // Load on mount and when filters change
  onMount(() => {
    loadAssets();
    loadFolders();
  });

  // Reactive loading when filters change
  $effect(() => {
    // Dependencies: currentFolder, searchQuery, mimeTypeFilter
    const _ = [currentFolder, searchQuery, mimeTypeFilter];
    offset = 0;
    loadAssets();
  });
</script>

<div
  class="media-library"
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  role="application"
  aria-label="Media Library"
>
  <!-- Upload Area -->
  <div class="upload-area" class:drag-over={dragOver}>
    <input
      bind:this={fileInput}
      type="file"
      accept={acceptTypes.join(',')}
      multiple
      onchange={handleFileSelect}
      class="hidden"
    />

    {#if uploading}
      <div class="upload-progress">
        <div class="progress-bar" style="width: {uploadProgress}%"></div>
        <span>Uploading... {uploadProgress}%</span>
      </div>
    {:else}
      <button type="button" onclick={() => fileInput.click()} class="upload-button">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
          />
        </svg>
        <span>Upload Files</span>
      </button>
      <p class="upload-hint">or drag and drop files here</p>
    {/if}
  </div>

  <!-- Filters -->
  <div class="filters">
    <div class="filter-row">
      <select bind:value={currentFolder} class="folder-select">
        <option value="/">All Folders</option>
        {#each folders as folder}
          <option value={folder}>{folder}</option>
        {/each}
      </select>

      <select bind:value={mimeTypeFilter} class="type-select">
        <option value="">All Types</option>
        <option value="image/">Images</option>
        <option value="application/pdf">PDFs</option>
        <option value="text/">Text</option>
      </select>

      <input
        type="search"
        bind:value={searchQuery}
        placeholder="Search files..."
        class="search-input"
      />
    </div>

    {#if total > 0}
      <p class="results-count">{total} assets</p>
    {/if}
  </div>

  <!-- Error Message -->
  {#if error}
    <div class="error-message" role="alert">
      <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span>{error}</span>
      <button type="button" onclick={() => (error = null)}>Dismiss</button>
    </div>
  {/if}

  <!-- Assets Grid -->
  {#if loading}
    <div class="loading-state">
      <svg class="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
        ></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
        ></path>
      </svg>
      <span>Loading assets...</span>
    </div>
  {:else if assets.length === 0}
    <div class="empty-state">
      <svg class="w-16 h-16 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
      <h3>No assets found</h3>
      <p>Upload files or adjust your filters</p>
    </div>
  {:else}
    <div class="assets-grid">
      {#each assets as asset (asset.id)}
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="asset-card"
          class:selected={selectedIds.has(asset.id)}
          class:selectable
          onclick={() => toggleSelect(asset)}
          onkeydown={(e) => e.key === 'Enter' && toggleSelect(asset)}
          role={selectable ? 'button' : undefined}
          tabindex={selectable ? 0 : undefined}
          aria-label={selectable ? asset.filename : undefined}
        >
          <div class="asset-preview">
            {#if isImage(asset.mime_type) && asset.url}
              <img src={asset.url} alt={asset.alt_text || asset.filename} loading="lazy" />
            {:else}
              <span class="file-icon">{getFileIcon(asset.mime_type)}</span>
            {/if}

            {#if selectedIds.has(asset.id)}
              <div class="selected-badge">
                <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fill-rule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clip-rule="evenodd"
                  />
                </svg>
              </div>
            {/if}
          </div>

          <div class="asset-info">
            <p class="asset-name" title={asset.filename}>{asset.filename}</p>
            <div class="asset-meta">
              <span>{formatFileSize(asset.size)}</span>
              {#if !selectable}
                <button
                  type="button"
                  class="delete-button"
                  onclick={(e) => {
                    e.stopPropagation();
                    deleteAsset(asset.id);
                  }}
                  aria-label="Delete {asset.filename}"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      stroke-width="2"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>

    <!-- Pagination -->
    {#if total > limit}
      <div class="pagination">
        <button
          type="button"
          disabled={offset === 0}
          onclick={() => {
            offset = Math.max(0, offset - limit);
            loadAssets();
          }}
        >
          Previous
        </button>
        <span>Page {Math.floor(offset / limit) + 1} of {Math.ceil(total / limit)}</span>
        <button
          type="button"
          disabled={offset + limit >= total}
          onclick={() => {
            offset = offset + limit;
            loadAssets();
          }}
        >
          Next
        </button>
      </div>
    {/if}
  {/if}
</div>

<style>
  .media-library {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .upload-area {
    border: 2px dashed #d1d5db;
    border-radius: 0.5rem;
    padding: 2rem;
    text-align: center;
    transition: all 0.2s;
    background: #f9fafb;
  }

  .upload-area.drag-over {
    border-color: #2d2f63;
    background: #eef2ff;
  }

  .upload-button {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #2d2f63;
    color: white;
    border: none;
    border-radius: 0.5rem;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .upload-button:hover {
    background: #3d3f73;
  }

  .upload-hint {
    margin-top: 0.5rem;
    color: #6b7280;
    font-size: 0.875rem;
  }

  .upload-progress {
    position: relative;
    height: 2rem;
    background: #e5e7eb;
    border-radius: 0.25rem;
    overflow: hidden;
  }

  .progress-bar {
    position: absolute;
    inset: 0;
    background: #2d2f63;
    transition: width 0.3s;
  }

  .upload-progress span {
    position: relative;
    z-index: 1;
    line-height: 2rem;
    color: white;
    font-weight: 500;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
  }

  .filter-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .folder-select,
  .type-select,
  .search-input {
    padding: 0.5rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .search-input {
    min-width: 200px;
  }

  .results-count {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .error-message {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 0.375rem;
    color: #dc2626;
  }

  .error-message button {
    margin-left: auto;
    padding: 0.25rem 0.5rem;
    background: none;
    border: none;
    color: #dc2626;
    cursor: pointer;
    font-size: 0.75rem;
  }

  .loading-state,
  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    color: #6b7280;
    text-align: center;
  }

  .loading-state svg,
  .empty-state svg {
    color: #d1d5db;
  }

  .empty-state h3 {
    margin-top: 1rem;
    font-size: 1.125rem;
    font-weight: 500;
    color: #374151;
  }

  .empty-state p {
    margin-top: 0.5rem;
  }

  .assets-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
    gap: 1rem;
  }

  .asset-card {
    background: white;
    border: 1px solid #e5e7eb;
    border-radius: 0.5rem;
    overflow: hidden;
    cursor: default;
    transition: all 0.2s;
    text-align: left;
  }

  .asset-card.selectable {
    cursor: pointer;
  }

  .asset-card.selectable:hover {
    border-color: #2d2f63;
  }

  .asset-card.selected {
    border-color: #2d2f63;
    box-shadow: 0 0 0 2px rgba(45, 47, 99, 0.2);
  }

  .asset-preview {
    position: relative;
    aspect-ratio: 1;
    background: #f3f4f6;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .asset-preview img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .file-icon {
    font-size: 2.5rem;
  }

  .selected-badge {
    position: absolute;
    top: 0.5rem;
    right: 0.5rem;
    width: 1.5rem;
    height: 1.5rem;
    background: #2d2f63;
    color: white;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .asset-info {
    padding: 0.75rem;
  }

  .asset-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .asset-meta {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: #9ca3af;
  }

  .delete-button {
    padding: 0.25rem;
    background: none;
    border: none;
    color: #9ca3af;
    cursor: pointer;
    border-radius: 0.25rem;
    transition: all 0.2s;
  }

  .delete-button:hover {
    color: #dc2626;
    background: #fef2f2;
  }

  .pagination {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 1rem;
  }

  .pagination button {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .pagination button:hover:not(:disabled) {
    border-color: #2d2f63;
    color: #2d2f63;
  }

  .pagination button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .pagination span {
    color: #6b7280;
    font-size: 0.875rem;
  }

  .hidden {
    display: none;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .animate-spin {
    animation: spin 1s linear infinite;
  }
</style>

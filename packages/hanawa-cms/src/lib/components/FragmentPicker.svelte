<!--
  FragmentPicker Component
  Modal for selecting fragments to embed in editor

  Usage:
  <FragmentPicker bind:open onselect={handleSelect} />
-->
<script lang="ts">
  import PuzzlePiece from 'phosphor-svelte/lib/PuzzlePiece';
  import MagnifyingGlass from 'phosphor-svelte/lib/MagnifyingGlass';
  import FolderOpen from 'phosphor-svelte/lib/FolderOpen';
  import Check from 'phosphor-svelte/lib/Check';
  import X from 'phosphor-svelte/lib/X';
  import Translate from 'phosphor-svelte/lib/Translate';

  interface Fragment {
    id: string;
    name: string;
    category: string;
    is_bilingual: number;
  }

  interface Props {
    open?: boolean;
    lang?: string;
    onselect?: (fragmentId: string, lang: string) => void;
    onclose?: () => void;
  }

  let { open = $bindable(false), lang = 'en', onselect, onclose }: Props = $props();

  let _fragments = $state<Fragment[]>([]);
  let grouped = $state<Record<string, Fragment[]>>({});
  let loading = $state(true);
  let error = $state<string | null>(null);
  let searchQuery = $state('');
  let selectedCategory = $state<string | null>(null);
  let selectedFragment = $state<Fragment | null>(null);
  // eslint-disable-next-line svelte/valid-compile -- Intentionally captures initial lang value
  let selectedLang = $state(lang);
  let searchInput = $state<HTMLInputElement | null>(null);

  // Fetch fragments when opened
  $effect(() => {
    if (open) {
      fetchFragments();
      selectedLang = lang;
      // Focus search after mount
      setTimeout(() => searchInput?.focus(), 100);
    }
  });

  async function fetchFragments(search?: string) {
    loading = true;
    error = null;

    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);

      const response = await fetch(`/api/fragments?${params}`);
      if (!response.ok) throw new Error('Failed to fetch fragments');

      const data = (await response.json()) as {
        fragments: Fragment[];
        grouped: Record<string, Fragment[]>;
      };
      _fragments = data.fragments;
      grouped = data.grouped;
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load fragments';
    } finally {
      loading = false;
    }
  }

  // Filter fragments based on search and category
  const filteredGroups = $derived(() => {
    const query = searchQuery.toLowerCase();
    const result: Record<string, Fragment[]> = {};

    for (const [category, frags] of Object.entries(grouped)) {
      if (selectedCategory && category !== selectedCategory) continue;

      const filtered = frags.filter(
        (f) => f.id.toLowerCase().includes(query) || f.name.toLowerCase().includes(query)
      );

      if (filtered.length > 0) {
        result[category] = filtered;
      }
    }

    return result;
  });

  const categories = $derived(Object.keys(grouped).sort());

  function handleSelect(fragment: Fragment) {
    selectedFragment = fragment;
  }

  function handleInsert() {
    if (selectedFragment && onselect) {
      onselect(selectedFragment.id, selectedLang);
    }
    handleClose();
  }

  function handleClose() {
    open = false;
    selectedFragment = null;
    searchQuery = '';
    selectedCategory = null;
    if (onclose) onclose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
    if (event.key === 'Enter' && selectedFragment) {
      handleInsert();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }

  // Format category name for display
  function formatCategory(cat: string): string {
    return cat.charAt(0).toUpperCase() + cat.slice(1).replace(/-/g, ' ');
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    onkeydown={handleKeydown}
    role="dialog"
    aria-modal="true"
    aria-labelledby="picker-title"
    tabindex="-1"
  >
    <div class="modal-content">
      <div class="modal-header">
        <div class="flex items-center gap-2">
          <PuzzlePiece size={24} weight="duotone" class="text-esolia-orange" />
          <h2 id="picker-title">Select Fragment</h2>
        </div>
        <button type="button" class="close-button" onclick={handleClose} aria-label="Close dialog">
          <X size={24} />
        </button>
      </div>

      <!-- Search and Filter Bar -->
      <div class="search-bar">
        <div class="search-input-wrapper">
          <MagnifyingGlass size={20} class="search-icon" />
          <input
            bind:this={searchInput}
            bind:value={searchQuery}
            type="text"
            placeholder="Search fragments..."
            class="search-input"
          />
        </div>

        <!-- Category Filter -->
        <div class="category-filter">
          <button
            type="button"
            class="category-chip {selectedCategory === null ? 'selected' : ''}"
            onclick={() => (selectedCategory = null)}
          >
            All
          </button>
          {#each categories as category}
            <button
              type="button"
              class="category-chip {selectedCategory === category ? 'selected' : ''}"
              onclick={() => (selectedCategory = category)}
            >
              {formatCategory(category)}
            </button>
          {/each}
        </div>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="loading">Loading fragments...</div>
        {:else if error}
          <div class="error">{error}</div>
        {:else if Object.keys(filteredGroups()).length === 0}
          <div class="empty">
            <FolderOpen size={48} class="text-gray-300" />
            <p>No fragments found</p>
          </div>
        {:else}
          {#each Object.entries(filteredGroups()) as [category, frags]}
            <div class="category-section">
              <h3 class="category-title">
                <FolderOpen size={16} weight="duotone" />
                {formatCategory(category)}
                <span class="count">({frags.length})</span>
              </h3>
              <div class="fragment-list">
                {#each frags as fragment}
                  <button
                    type="button"
                    class="fragment-item {selectedFragment?.id === fragment.id ? 'selected' : ''}"
                    onclick={() => handleSelect(fragment)}
                    ondblclick={handleInsert}
                  >
                    <div class="fragment-info">
                      <span class="fragment-name">{fragment.name}</span>
                      <code class="fragment-id">{fragment.id}</code>
                    </div>
                    <div class="fragment-meta">
                      {#if fragment.is_bilingual}
                        <span class="bilingual-badge" title="Bilingual content">
                          <Translate size={14} />
                          EN/JA
                        </span>
                      {/if}
                      {#if selectedFragment?.id === fragment.id}
                        <Check size={18} class="text-green-600" weight="bold" />
                      {/if}
                    </div>
                  </button>
                {/each}
              </div>
            </div>
          {/each}
        {/if}
      </div>

      <div class="modal-footer">
        <!-- Language selector -->
        <div class="lang-selector">
          <span class="lang-label">Language:</span>
          <select bind:value={selectedLang} class="lang-select">
            <option value="en">English</option>
            <option value="ja">Japanese</option>
          </select>
        </div>

        <div class="footer-actions">
          <button type="button" class="cancel-button" onclick={handleClose}>Cancel</button>
          <button
            type="button"
            class="insert-button"
            disabled={!selectedFragment}
            onclick={handleInsert}
          >
            Insert Fragment
          </button>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 50;
    padding: 1rem;
  }

  .modal-content {
    background: white;
    border-radius: 0.75rem;
    box-shadow:
      0 20px 25px -5px rgba(0, 0, 0, 0.1),
      0 10px 10px -5px rgba(0, 0, 0, 0.04);
    width: 100%;
    max-width: 48rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
  }

  .modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #e5e7eb;
  }

  .modal-header h2 {
    font-size: 1.125rem;
    font-weight: 600;
    color: #111827;
  }

  .close-button {
    padding: 0.25rem;
    background: none;
    border: none;
    color: #6b7280;
    cursor: pointer;
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  .close-button:hover {
    color: #111827;
    background: #f3f4f6;
  }

  .search-bar {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid #f3f4f6;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .search-input-wrapper {
    position: relative;
    display: flex;
    align-items: center;
  }

  .search-input {
    width: 100%;
    padding: 0.625rem 0.75rem 0.625rem 2.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: #2d2f63;
    box-shadow: 0 0 0 3px rgba(45, 47, 99, 0.1);
  }

  .category-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .category-chip {
    padding: 0.25rem 0.75rem;
    font-size: 0.75rem;
    font-weight: 500;
    border: 1px solid #e5e7eb;
    border-radius: 9999px;
    background: white;
    color: #6b7280;
    cursor: pointer;
    transition: all 0.2s;
  }

  .category-chip:hover {
    border-color: #d1d5db;
    background: #f9fafb;
  }

  .category-chip.selected {
    border-color: #2d2f63;
    background: #2d2f63;
    color: white;
  }

  .modal-body {
    flex: 1;
    overflow-y: auto;
    padding: 1rem 1.5rem;
  }

  .loading,
  .error,
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
    color: #6b7280;
    text-align: center;
    gap: 0.5rem;
  }

  .error {
    color: #dc2626;
  }

  .category-section {
    margin-bottom: 1.5rem;
  }

  .category-section:last-child {
    margin-bottom: 0;
  }

  .category-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    color: #6b7280;
    margin-bottom: 0.5rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #f3f4f6;
  }

  .category-title .count {
    font-weight: 400;
    color: #9ca3af;
  }

  .fragment-list {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }

  .fragment-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    padding: 0.75rem 1rem;
    background: #f9fafb;
    border: 1px solid transparent;
    border-radius: 0.5rem;
    text-align: left;
    cursor: pointer;
    transition: all 0.15s;
  }

  .fragment-item:hover {
    background: #f3f4f6;
    border-color: #e5e7eb;
  }

  .fragment-item.selected {
    background: #fef3c7;
    border-color: #f59e0b;
  }

  .fragment-info {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    min-width: 0;
  }

  .fragment-name {
    font-size: 0.875rem;
    font-weight: 500;
    color: #111827;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .fragment-id {
    font-size: 0.75rem;
    color: #6b7280;
    background: #e5e7eb;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    width: fit-content;
  }

  .fragment-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-shrink: 0;
  }

  .bilingual-badge {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.625rem;
    font-weight: 600;
    color: #0369a1;
    background: #e0f2fe;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    text-transform: uppercase;
  }

  .modal-footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 0 0 0.75rem 0.75rem;
  }

  .lang-selector {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .lang-label {
    font-size: 0.875rem;
    color: #6b7280;
  }

  .lang-select {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    background: white;
    cursor: pointer;
  }

  .footer-actions {
    display: flex;
    gap: 0.75rem;
  }

  .cancel-button {
    padding: 0.5rem 1rem;
    background: white;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    color: #374151;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .cancel-button:hover {
    background: #f3f4f6;
  }

  .insert-button {
    padding: 0.5rem 1.5rem;
    background: #2d2f63;
    border: none;
    border-radius: 0.375rem;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .insert-button:hover:not(:disabled) {
    background: #3d3f73;
  }

  .insert-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
</style>

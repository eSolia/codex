<!--
  MediaPicker Component
  Modal for selecting media to insert into editor

  Usage:
  <MediaPicker bind:open onselect={handleSelect} />
-->
<script lang="ts">
  import MediaLibrary from './MediaLibrary.svelte';

  interface Asset {
    id: string;
    filename: string;
    path: string;
    mime_type: string | null;
    size: number | null;
    alt_text: string | null;
    alt_text_ja: string | null;
    url?: string;
  }

  interface Props {
    open?: boolean;
    siteId?: string;
    acceptTypes?: string[];
    onselect?: (asset: Asset) => void;
    onclose?: () => void;
  }

  let {
    open = $bindable(false),
    siteId,
    acceptTypes = ['image/*'],
    onselect,
    onclose,
  }: Props = $props();

  let selectedAsset = $state<Asset | null>(null);

  function handleSelect(assets: Asset[]) {
    selectedAsset = assets[0] || null;
  }

  function handleInsert() {
    if (selectedAsset && onselect) {
      onselect(selectedAsset);
    }
    handleClose();
  }

  function handleClose() {
    open = false;
    selectedAsset = null;
    if (onclose) onclose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      handleClose();
    }
  }

  function handleBackdropClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div
    class="modal-backdrop"
    onclick={handleBackdropClick}
    role="dialog"
    aria-modal="true"
    aria-labelledby="picker-title"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="picker-title">Select Media</h2>
        <button type="button" class="close-button" onclick={handleClose}>
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      <div class="modal-body">
        <MediaLibrary {siteId} {acceptTypes} selectable onselect={handleSelect} />
      </div>

      <div class="modal-footer">
        <button type="button" class="cancel-button" onclick={handleClose}> Cancel </button>
        <button
          type="button"
          class="insert-button"
          disabled={!selectedAsset}
          onclick={handleInsert}
        >
          Insert
        </button>
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
    max-width: 56rem;
    max-height: 90vh;
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

  .modal-body {
    flex: 1;
    overflow: auto;
    padding: 1.5rem;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 0.75rem;
    padding: 1rem 1.5rem;
    border-top: 1px solid #e5e7eb;
    background: #f9fafb;
    border-radius: 0 0 0.75rem 0.75rem;
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

<!--
  CreatePreviewDialog Component
  Dialog for creating shareable preview URLs

  Usage:
  <CreatePreviewDialog bind:open documentId="doc-123" oncreate={handleCreate} />
-->
<script lang="ts">
  interface Preview {
    id: string;
    access_token: string;
    name: string | null;
    expires_at: number;
  }

  interface Props {
    open?: boolean;
    documentId: string;
    oncreate?: (preview: Preview) => void;
    onclose?: () => void;
  }

  let { open = $bindable(false), documentId, oncreate, onclose }: Props = $props();

  let name = $state('');
  let expiresIn = $state('7d');
  let usePassword = $state(false);
  let password = $state('');
  let useEmailRestriction = $state(false);
  let allowedEmails = $state('');
  let maxViews = $state<number | null>(null);

  let loading = $state(false);
  let error = $state<string | null>(null);
  let created = $state<Preview | null>(null);
  let copied = $state(false);

  function getPreviewUrl(preview: Preview): string {
    // In production, this would be the preview domain
    // For now, use the internal preview route
    return `${window.location.origin}/preview?token=${preview.access_token}`;
  }

  async function createPreview() {
    loading = true;
    error = null;

    try {
      const response = await fetch('/api/previews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentId,
          name: name || undefined,
          expiresIn,
          password: usePassword ? password : undefined,
          allowedEmails: useEmailRestriction
            ? allowedEmails.split(',').map((e) => e.trim().toLowerCase())
            : undefined,
          maxViews: maxViews || undefined,
        }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => ({}))) as { message?: string };
        throw new Error(data.message || 'Failed to create preview');
      }

      created = await response.json();

      if (oncreate && created) {
        oncreate(created);
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to create preview';
    } finally {
      loading = false;
    }
  }

  async function copyLink() {
    if (!created) return;

    try {
      await navigator.clipboard.writeText(getPreviewUrl(created));
      copied = true;
      setTimeout(() => (copied = false), 2000);
    } catch {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = getPreviewUrl(created);
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      copied = true;
      setTimeout(() => (copied = false), 2000);
    }
  }

  function handleClose() {
    open = false;
    // Reset state
    name = '';
    expiresIn = '7d';
    usePassword = false;
    password = '';
    useEmailRestriction = false;
    allowedEmails = '';
    maxViews = null;
    created = null;
    error = null;
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

  function formatExpiry(expiresAt: number): string {
    return new Date(expiresAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
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
    aria-labelledby="dialog-title"
    tabindex="-1"
  >
    <div class="modal-content">
      <div class="modal-header">
        <h2 id="dialog-title">
          {created ? 'Preview Created' : 'Create Preview'}
        </h2>
        <button type="button" class="close-button" onclick={handleClose} aria-label="Close dialog">
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
        {#if created}
          <!-- Success State -->
          <div class="success-state">
            <div class="success-icon">
              <svg
                class="w-12 h-12 text-green-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  stroke-width="2"
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>

            <p class="success-message">Your preview link is ready to share</p>

            <div class="link-container">
              <input type="text" readonly value={getPreviewUrl(created)} class="link-input" />
              <button type="button" class="copy-button" onclick={copyLink}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div class="preview-details">
              {#if created.name}
                <p><strong>Name:</strong> {created.name}</p>
              {/if}
              <p><strong>Expires:</strong> {formatExpiry(created.expires_at)}</p>
              {#if usePassword}
                <p><strong>Password:</strong> {password}</p>
              {/if}
            </div>
          </div>
        {:else}
          <!-- Create Form -->
          <form
            onsubmit={(e) => {
              e.preventDefault();
              createPreview();
            }}
          >
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
              </div>
            {/if}

            <div class="form-group">
              <label for="name">Name (optional)</label>
              <input
                id="name"
                type="text"
                bind:value={name}
                placeholder="e.g., Review for stakeholders"
              />
            </div>

            <div class="form-group">
              <label for="expiresIn">Expires in</label>
              <select id="expiresIn" bind:value={expiresIn}>
                <option value="1h">1 hour</option>
                <option value="24h">24 hours</option>
                <option value="7d">7 days</option>
                <option value="30d">30 days</option>
              </select>
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={usePassword} />
                <span>Password protect</span>
              </label>
              {#if usePassword}
                <input
                  type="text"
                  bind:value={password}
                  placeholder="Enter password"
                  class="mt-2"
                />
              {/if}
            </div>

            <div class="form-group checkbox">
              <label>
                <input type="checkbox" bind:checked={useEmailRestriction} />
                <span>Restrict to specific emails</span>
              </label>
              {#if useEmailRestriction}
                <input
                  type="text"
                  bind:value={allowedEmails}
                  placeholder="email@example.com, another@example.com"
                  class="mt-2"
                />
                <p class="help-text">Comma-separated list of allowed emails</p>
              {/if}
            </div>

            <div class="form-group">
              <label for="maxViews">Max views (optional)</label>
              <input
                id="maxViews"
                type="number"
                min="1"
                bind:value={maxViews}
                placeholder="Unlimited"
              />
            </div>

            <button type="submit" class="submit-button" disabled={loading}>
              {loading ? 'Creating...' : 'Create Preview'}
            </button>
          </form>
        {/if}
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
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 28rem;
    max-height: 90vh;
    overflow: auto;
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
    padding: 1.5rem;
  }

  .form-group {
    margin-bottom: 1rem;
  }

  .form-group label {
    display: block;
    font-size: 0.875rem;
    font-weight: 500;
    color: #374151;
    margin-bottom: 0.25rem;
  }

  .form-group.checkbox label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .form-group input[type='text'],
  .form-group input[type='number'],
  .form-group select {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .form-group input:focus,
  .form-group select:focus {
    outline: none;
    border-color: #2d2f63;
    box-shadow: 0 0 0 2px rgba(45, 47, 99, 0.1);
  }

  .help-text {
    font-size: 0.75rem;
    color: #6b7280;
    margin-top: 0.25rem;
  }

  .mt-2 {
    margin-top: 0.5rem;
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
    margin-bottom: 1rem;
    font-size: 0.875rem;
  }

  .submit-button {
    width: 100%;
    padding: 0.75rem 1rem;
    background: #2d2f63;
    border: none;
    border-radius: 0.375rem;
    color: white;
    font-weight: 500;
    cursor: pointer;
    transition: background 0.2s;
  }

  .submit-button:hover:not(:disabled) {
    background: #3d3f73;
  }

  .submit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .success-state {
    text-align: center;
  }

  .success-icon {
    margin-bottom: 1rem;
  }

  .success-message {
    color: #374151;
    margin-bottom: 1rem;
  }

  .link-container {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
  }

  .link-input {
    flex: 1;
    padding: 0.5rem 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    background: #f9fafb;
  }

  .copy-button {
    padding: 0.5rem 1rem;
    background: #2d2f63;
    border: none;
    border-radius: 0.375rem;
    color: white;
    font-weight: 500;
    cursor: pointer;
    white-space: nowrap;
    transition: background 0.2s;
  }

  .copy-button:hover {
    background: #3d3f73;
  }

  .preview-details {
    text-align: left;
    padding: 1rem;
    background: #f9fafb;
    border-radius: 0.375rem;
    font-size: 0.875rem;
  }

  .preview-details p {
    margin: 0.25rem 0;
    color: #4b5563;
  }
</style>

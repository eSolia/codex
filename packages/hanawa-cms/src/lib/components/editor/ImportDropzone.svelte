<script lang="ts">
  /**
   * ImportDropzone — Drag-and-drop markdown file import.
   * Accepts .md files, parses frontmatter + body, and emits structured result.
   */
  import { importMarkdownFile, type ImportResult } from '$lib/import-markdown';

  let {
    onimport,
  }: {
    onimport: (result: ImportResult) => void;
  } = $props();

  let isDragOver = $state(false);
  let error = $state('');
  let importing = $state(false);

  function isMarkdownFile(file: File): boolean {
    return file.name.endsWith('.md') || file.type === 'text/markdown';
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    const file = files[0]!;
    if (!isMarkdownFile(file)) {
      error = 'Only .md (Markdown) files are supported.';
      return;
    }

    error = '';
    importing = true;
    try {
      const result = await importMarkdownFile(file);
      onimport(result);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to parse file.';
    } finally {
      importing = false;
    }
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    isDragOver = false;
    handleFiles(e.dataTransfer?.files ?? null);
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave() {
    isDragOver = false;
  }

  let fileInput: HTMLInputElement | undefined = $state();
</script>

<div
  role="button"
  tabindex="0"
  class="relative rounded-lg border-2 border-dashed transition-colors p-6 text-center cursor-pointer {isDragOver
    ? 'border-esolia-orange bg-esolia-orange/5'
    : 'border-gray-300 hover:border-gray-400 bg-gray-50'}"
  ondrop={handleDrop}
  ondragover={handleDragOver}
  ondragleave={handleDragLeave}
  onclick={() => fileInput?.click()}
  onkeydown={(e) => {
    if (e.key === 'Enter' || e.key === ' ') fileInput?.click();
  }}
>
  <input
    bind:this={fileInput}
    type="file"
    accept=".md,text/markdown"
    class="hidden"
    onchange={(e) => handleFiles((e.target as HTMLInputElement).files)}
  />

  {#if importing}
    <div class="flex items-center justify-center gap-2 text-sm text-gray-600">
      <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
        ></circle>
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        ></path>
      </svg>
      Parsing markdown...
    </div>
  {:else}
    <div class="space-y-1">
      <svg
        class="mx-auto h-8 w-8 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="1.5"
          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
        />
      </svg>
      <p class="text-sm text-gray-600">
        <span class="font-medium text-esolia-navy">Drop a .md file</span> or click to browse
      </p>
      <p class="text-xs text-gray-400">Frontmatter will auto-fill the form below</p>
    </div>
  {/if}

  {#if error}
    <p class="mt-2 text-sm text-red-600">{error}</p>
  {/if}
</div>

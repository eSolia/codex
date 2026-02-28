<script lang="ts">
  /**
   * Hanawa Editor Component
   * Rich text editor with security-aware features
   *
   * InfoSec: Privacy mode, sensitivity classification, audit logging
   */
  import { onMount, onDestroy } from 'svelte';
  import type { Editor } from '@tiptap/core';
  import { createEditor, destroyEditor, getEditorMarkdown } from '$lib/editor/editor';
  import EditorToolbar from './EditorToolbar.svelte';
  import SaveIndicator from './SaveIndicator.svelte';
  import MediaPicker from '../MediaPicker.svelte';
  import FragmentPicker from '../FragmentPicker.svelte';

  // Props using Svelte 5 runes
  let {
    content = $bindable(''),
    contentType = 'html' as 'html' | 'markdown',
    editable = true,
    placeholder = 'Start writing...',
    privacyMode = false,
    sensitivity = 'normal' as 'normal' | 'confidential' | 'embargoed',
    autosave = false,
    autosaveDelay = 2000,
    onchange,
    onsave,
  }: {
    content?: string;
    contentType?: 'html' | 'markdown';
    editable?: boolean;
    placeholder?: string;
    privacyMode?: boolean;
    sensitivity?: 'normal' | 'confidential' | 'embargoed';
    autosave?: boolean;
    autosaveDelay?: number;
    onchange?: (content: string) => void;
    onsave?: () => Promise<void> | void;
  } = $props();

  let editorElement: HTMLDivElement;
  let editor: Editor | null = $state(null);
  let isFocused = $state(false);
  let wordCount = $state(0);
  let charCount = $state(0);
  let mediaPickerOpen = $state(false);
  let fragmentPickerOpen = $state(false);

  // Save state
  type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'unsaved';
  let saveStatus = $state<SaveStatus>('idle');
  let lastSaved = $state<Date | null>(null);
  let saveError = $state<string | null>(null);
  let autosaveTimeout: ReturnType<typeof setTimeout> | null = null;
  let initialContent = '';

  // Sensitivity styling
  const sensitivityStyles = {
    normal: '',
    confidential: 'ring-2 ring-yellow-400',
    embargoed: 'ring-2 ring-red-400',
  };

  const sensitivityLabels = {
    normal: null,
    confidential: '⚠️ Confidential',
    embargoed: '🔒 Embargoed',
  };

  /**
   * Get the current content from the editor in the appropriate format.
   * In markdown mode, returns markdown; otherwise returns HTML.
   */
  function getEditorContent(): string {
    if (!editor) return '';
    if (contentType === 'markdown') {
      return getEditorMarkdown(editor);
    }
    return editor.getHTML();
  }

  onMount(() => {
    initialContent = content;
    editor = createEditor({
      element: editorElement,
      content,
      contentType,
      placeholder,
      privacyMode,
      editable,
      onUpdate: ({ text }) => {
        const currentContent = getEditorContent();
        content = currentContent;
        wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        charCount = text.length;
        if (onchange) onchange(currentContent);

        // Track unsaved changes
        if (currentContent !== initialContent && saveStatus !== 'saving') {
          saveStatus = 'unsaved';

          // Autosave logic
          if (autosave && onsave) {
            if (autosaveTimeout) clearTimeout(autosaveTimeout);
            autosaveTimeout = setTimeout(() => {
              triggerSave();
            }, autosaveDelay);
          }
        }
      },
      onFocus: () => {
        isFocused = true;
      },
      onBlur: () => {
        isFocused = false;
      },
    });

    // Listen for fragment picker events from slash commands
    document.addEventListener('hanawa:openFragmentPicker', handleFragmentPickerEvent);
  });

  onDestroy(() => {
    if (autosaveTimeout) clearTimeout(autosaveTimeout);
    document.removeEventListener('hanawa:openFragmentPicker', handleFragmentPickerEvent);
    destroyEditor(editor);
  });

  // Save function
  async function triggerSave() {
    if (!onsave || saveStatus === 'saving') return;

    saveStatus = 'saving';
    saveError = null;

    try {
      await onsave();
      saveStatus = 'saved';
      lastSaved = new Date();
      initialContent = content; // Reset baseline
    } catch (e) {
      saveStatus = 'error';
      saveError = e instanceof Error ? e.message : 'Save failed';
    }
  }

  // Keyboard shortcut for save
  function handleKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === 's') {
      event.preventDefault();
      triggerSave();
    }
  }

  // Calculate reading time (avg 200 words per minute)
  let readingTime = $derived(Math.max(1, Math.ceil(wordCount / 200)));

  // Handle image insertion from media picker
  function handleImageSelect(asset: {
    id: string;
    filename: string;
    path: string;
    mime_type: string | null;
    size: number | null;
    alt_text: string | null;
    alt_text_ja: string | null;
    url?: string;
  }) {
    if (editor && asset.url) {
      editor
        .chain()
        .focus()
        .setImage({
          src: asset.url,
          alt: asset.alt_text || asset.filename,
        })
        .run();
    }
    mediaPickerOpen = false;
  }

  function openMediaPicker() {
    mediaPickerOpen = true;
  }

  function openFragmentPicker() {
    fragmentPickerOpen = true;
  }

  // Handle fragment selection from picker
  function handleFragmentSelect(fragmentId: string, lang: string) {
    if (editor && !editor.isDestroyed) {
      editor.chain().focus().insertFragment(fragmentId, lang).run();
    }
    fragmentPickerOpen = false;
  }

  // Listen for custom event from slash commands
  function handleFragmentPickerEvent(event: Event) {
    const customEvent = event as CustomEvent;
    // The event carries the editor, but we already have access to it
    if (customEvent.detail?.editor === editor) {
      openFragmentPicker();
    }
  }

  // Reactive: Update editor content when prop changes externally
  // Tiptap 3: setContent emits updates by default — use emitUpdate: false to prevent loops
  $effect(() => {
    if (editor && !editor.isDestroyed) {
      const currentContent = getEditorContent();
      if (currentContent !== content) {
        if (contentType === 'markdown') {
          editor.commands.setContent(content, { emitUpdate: false, contentType: 'markdown' });
        } else {
          editor.commands.setContent(content, { emitUpdate: false });
        }
      }
    }
  });

  // Reactive: Update privacy mode
  $effect(() => {
    if (editor && !editor.isDestroyed) {
      // Re-configure privacy mask extension
      editor.extensionManager.extensions
        .filter((ext) => ext.name === 'privacyMask')
        .forEach((ext) => {
          ext.options.privacyMode = privacyMode;
        });
      // Force re-render
      editor.view.updateState(editor.view.state);
    }
  });
</script>

<!-- Noto Sans JP: Mermaid uses this font to calculate node box widths.
     Must match CF Browser Rendering (Noto Sans CJK JP) so PDF diagrams don't clip text. -->
<svelte:head>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
  <link
    href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;600;700&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<div
  class="hanawa-editor-container bg-white rounded-lg shadow-sm border border-gray-200 {sensitivityStyles[
    sensitivity
  ]}"
  role="application"
  aria-label="Rich text editor"
>
  <!-- Sensitivity Banner -->
  {#if sensitivityLabels[sensitivity]}
    <div
      class="px-4 py-2 text-sm font-medium border-b {sensitivity === 'embargoed'
        ? 'bg-red-50 text-red-800 border-red-200'
        : 'bg-yellow-50 text-yellow-800 border-yellow-200'}"
    >
      {sensitivityLabels[sensitivity]}
      <span class="text-xs opacity-75 ml-2">
        {sensitivity === 'embargoed'
          ? 'No preview links until embargo lifts'
          : 'Preview requires approval'}
      </span>
    </div>
  {/if}

  <!-- Toolbar -->
  {#if editor && editable}
    <EditorToolbar {editor} {openMediaPicker} {openFragmentPicker} />
  {/if}

  <!-- Editor Content -->
  <div
    bind:this={editorElement}
    class="editor-content {isFocused ? 'ring-2 ring-esolia-navy ring-inset' : ''}"
    onkeydown={handleKeydown}
    role="textbox"
    aria-label="Rich text editor"
    tabindex="0"
  ></div>

  <!-- Footer Stats -->
  <div
    class="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500"
  >
    <div class="flex items-center gap-4">
      <span>{wordCount} words</span>
      <span>{charCount} chars</span>
      <span class="text-gray-400">~{readingTime} min read</span>
    </div>
    <div class="flex items-center gap-3">
      {#if privacyMode}
        <span class="text-purple-600">🔒 Privacy</span>
      {/if}
      {#if editable}
        <SaveIndicator status={saveStatus} {lastSaved} error={saveError} />
        <span class="text-gray-400 hidden sm:inline">⌘S save</span>
      {:else}
        <span class="text-gray-400">Read only</span>
      {/if}
    </div>
  </div>
</div>

<!-- Media Picker Modal -->
<MediaPicker bind:open={mediaPickerOpen} acceptTypes={['image/*']} onselect={handleImageSelect} />

<!-- Fragment Picker Modal -->
<FragmentPicker bind:open={fragmentPickerOpen} onselect={handleFragmentSelect} />

<style>
  .editor-content :global(.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: #9ca3af;
    pointer-events: none;
    height: 0;
  }

  /* Privacy mode styles */
  .editor-content :global(.privacy-mode-active) {
    filter: blur(4px);
    transition: filter 0.2s;
  }

  .editor-content :global(.privacy-mode-active:hover) {
    filter: blur(0);
  }

  /* Callout styles */
  .editor-content :global(.callout-info) {
    border-color: #3b82f6;
    background-color: #eff6ff;
  }

  .editor-content :global(.callout-warning) {
    border-color: #f59e0b;
    background-color: #fffbeb;
  }

  .editor-content :global(.callout-danger) {
    border-color: #ef4444;
    background-color: #fef2f2;
  }

  .editor-content :global(.callout-success) {
    border-color: #22c55e;
    background-color: #f0fdf4;
  }

  /* Fragment reference */
  .editor-content :global(.fragment-reference) {
    cursor: pointer;
  }

  .editor-content :global(.fragment-reference:hover) {
    background-color: #f9fafb;
  }

  /* Image styles */
  .editor-content :global(img) {
    max-width: 100%;
    height: auto;
    border-radius: 0.375rem;
    margin: 1rem 0;
  }
</style>

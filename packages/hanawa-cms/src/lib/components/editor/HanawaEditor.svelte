<script lang="ts">
  /**
   * Hanawa Editor Component
   * Rich text editor with security-aware features
   *
   * InfoSec: Privacy mode, sensitivity classification, audit logging
   */
  import { onMount, onDestroy } from "svelte";
  import type { Editor } from "@tiptap/core";
  import { createEditor, destroyEditor } from "$lib/editor/editor";
  import EditorToolbar from "./EditorToolbar.svelte";

  // Props using Svelte 5 runes
  let {
    content = $bindable(""),
    editable = true,
    placeholder = "Start writing...",
    privacyMode = false,
    sensitivity = "normal" as "normal" | "confidential" | "embargoed",
    onchange,
    onsave,
  }: {
    content?: string;
    editable?: boolean;
    placeholder?: string;
    privacyMode?: boolean;
    sensitivity?: "normal" | "confidential" | "embargoed";
    onchange?: (html: string) => void;
    onsave?: () => void;
  } = $props();

  let editorElement: HTMLDivElement;
  let editor: Editor | null = $state(null);
  let isFocused = $state(false);
  let wordCount = $state(0);
  let charCount = $state(0);

  // Sensitivity styling
  const sensitivityStyles = {
    normal: "",
    confidential: "ring-2 ring-yellow-400",
    embargoed: "ring-2 ring-red-400",
  };

  const sensitivityLabels = {
    normal: null,
    confidential: "⚠️ Confidential",
    embargoed: "🔒 Embargoed",
  };

  onMount(() => {
    editor = createEditor({
      element: editorElement,
      content,
      placeholder,
      privacyMode,
      editable,
      onUpdate: ({ html, text }) => {
        content = html;
        wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
        charCount = text.length;
        if (onchange) onchange(html);
      },
      onFocus: () => {
        isFocused = true;
      },
      onBlur: () => {
        isFocused = false;
      },
    });
  });

  onDestroy(() => {
    destroyEditor(editor);
  });

  // Keyboard shortcut for save
  function handleKeydown(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key === "s") {
      event.preventDefault();
      if (onsave) onsave();
    }
  }

  // Reactive: Update editor content when prop changes externally
  $effect(() => {
    if (editor && !editor.isDestroyed && editor.getHTML() !== content) {
      editor.commands.setContent(content);
    }
  });

  // Reactive: Update privacy mode
  $effect(() => {
    if (editor && !editor.isDestroyed) {
      // Re-configure privacy mask extension
      editor.extensionManager.extensions
        .filter((ext) => ext.name === "privacyMask")
        .forEach((ext) => {
          ext.options.privacyMode = privacyMode;
        });
      // Force re-render
      editor.view.updateState(editor.view.state);
    }
  });
</script>

<div
  class="hanawa-editor-container bg-white rounded-lg shadow-sm border border-gray-200 {sensitivityStyles[sensitivity]}"
  role="application"
  aria-label="Rich text editor"
>
  <!-- Sensitivity Banner -->
  {#if sensitivityLabels[sensitivity]}
    <div
      class="px-4 py-2 text-sm font-medium border-b {sensitivity === 'embargoed' ? 'bg-red-50 text-red-800 border-red-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200'}"
    >
      {sensitivityLabels[sensitivity]}
      <span class="text-xs opacity-75 ml-2">
        {sensitivity === "embargoed"
          ? "No preview links until embargo lifts"
          : "Preview requires approval"}
      </span>
    </div>
  {/if}

  <!-- Toolbar -->
  {#if editor && editable}
    <EditorToolbar {editor} />
  {/if}

  <!-- Editor Content -->
  <div
    bind:this={editorElement}
    class="editor-content {isFocused ? 'ring-2 ring-esolia-navy ring-inset' : ''}"
    onkeydown={handleKeydown}
  ></div>

  <!-- Footer Stats -->
  <div
    class="px-4 py-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500"
  >
    <div class="flex items-center gap-4">
      <span>{wordCount} words</span>
      <span>{charCount} characters</span>
    </div>
    <div class="flex items-center gap-2">
      {#if privacyMode}
        <span class="text-purple-600">🔒 Privacy Mode</span>
      {/if}
      {#if editable}
        <span class="text-gray-400">Ctrl+S to save</span>
      {:else}
        <span class="text-gray-400">Read only</span>
      {/if}
    </div>
  </div>
</div>

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
</style>

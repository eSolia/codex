<!--
  Hanawa Editor - Main Component
  Named after Hanawa Hokiichi (塙保己一, 1746–1821)
-->
<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import { Editor } from '@tiptap/core';
  import { createEditor, type EditorConfig } from './editor';
  import { markdownToHTML, htmlToMarkdown } from './markdown';
  import EditorToolbar from './EditorToolbar.svelte';
  import EditorBubbleMenu from './EditorBubbleMenu.svelte';

  // Props
  export let content: string = '';
  export let format: 'html' | 'markdown' = 'html';
  export let placeholder: string = 'Type "/" for commands, or start writing...';
  export let privacyMode: boolean = false;
  export let editable: boolean = true;
  export let autofocus: boolean = false;
  export let showToolbar: boolean = true;
  export let showBubbleMenu: boolean = true;
  export let minHeight: string = '300px';
  export let maxHeight: string | undefined = undefined;

  // State
  let editor: Editor | null = null;
  let editorElement: HTMLElement;
  let isFocused = false;

  const dispatch = createEventDispatcher<{
    change: { html: string; markdown: string; json: object };
    focus: void;
    blur: void;
    ready: Editor;
  }>();

  function getHTMLContent(value: string): string {
    if (format === 'markdown') {
      return markdownToHTML(value);
    }
    return value;
  }

  onMount(() => {
    const config: EditorConfig = {
      content: getHTMLContent(content),
      placeholder,
      privacyMode,
      editable,
      onUpdate: (html, json) => {
        const markdown = htmlToMarkdown(html);
        dispatch('change', { html, markdown, json });

        if (format === 'markdown') {
          content = markdown;
        } else {
          content = html;
        }
      },
      onCreate: (ed) => {
        dispatch('ready', ed);
      },
      onBlur: () => {
        isFocused = false;
        dispatch('blur');
      },
    };

    editor = createEditor(config);

    if (editorElement) {
      editorElement.appendChild(editor.view.dom);
    }

    if (autofocus) {
      setTimeout(() => editor?.commands.focus('end'), 0);
    }
  });

  onDestroy(() => {
    editor?.destroy();
  });

  // Reactivity
  $: if (editor && content !== undefined) {
    const currentHTML = editor.getHTML();
    const newHTML = getHTMLContent(content);

    if (currentHTML !== newHTML) {
      editor.commands.setContent(newHTML, false);
    }
  }

  $: if (editor) {
    editor.view.dom.setAttribute('data-privacy-mode', privacyMode ? 'true' : 'false');
  }

  $: if (editor) {
    editor.setEditable(editable);
  }

  function handleFocus() {
    isFocused = true;
    dispatch('focus');
  }

  // Public API
  export function focus() {
    editor?.commands.focus();
  }

  export function blur() {
    editor?.commands.blur();
  }

  export function getHTML(): string {
    return editor?.getHTML() || '';
  }

  export function getMarkdown(): string {
    return htmlToMarkdown(editor?.getHTML() || '');
  }

  export function getJSON(): object {
    return editor?.getJSON() || {};
  }

  export function setContent(newContent: string, newFormat: 'html' | 'markdown' = format) {
    if (!editor) return;
    const html = newFormat === 'markdown' ? markdownToHTML(newContent) : newContent;
    editor.commands.setContent(html);
  }

  export function insertContent(content: string) {
    editor?.commands.insertContent(content);
  }

  export function clearContent() {
    editor?.commands.clearContent();
  }

  export function getEditor(): Editor | null {
    return editor;
  }
</script>

<div
  class="hanawa-editor-container"
  class:focused={isFocused}
  class:readonly={!editable}
  style:--editor-min-height={minHeight}
  style:--editor-max-height={maxHeight}
>
  {#if showToolbar && editor && editable}
    <EditorToolbar {editor} />
  {/if}

  <div
    class="editor-content"
    bind:this={editorElement}
    on:focus={handleFocus}
    on:click={() => editor?.commands.focus()}
    role="textbox"
    tabindex="0"
  >
    <!-- Editor mounts here -->
  </div>

  {#if showBubbleMenu && editor && editable}
    <EditorBubbleMenu {editor} />
  {/if}
</div>

<style>
  .hanawa-editor-container {
    display: flex;
    flex-direction: column;
    border: 1px solid rgb(209 213 219);
    border-radius: 0.5rem;
    background: white;
    overflow: hidden;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .hanawa-editor-container.focused {
    border-color: rgb(59 130 246);
    box-shadow: 0 0 0 3px rgb(59 130 246 / 0.1);
  }

  .hanawa-editor-container.readonly {
    background: rgb(249 250 251);
  }

  .editor-content {
    flex: 1;
    min-height: var(--editor-min-height, 300px);
    max-height: var(--editor-max-height, none);
    overflow-y: auto;
    padding: 1rem 1.25rem;
  }

  .editor-content :global(.ProseMirror) {
    outline: none;
    min-height: 100%;
  }

  .editor-content :global(.ProseMirror.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: rgb(156 163 175);
    pointer-events: none;
    height: 0;
  }
</style>

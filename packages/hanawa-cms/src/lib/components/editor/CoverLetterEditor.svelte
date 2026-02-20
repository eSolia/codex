<script lang="ts">
  /**
   * Cover Letter Editor Component
   * Simplified Tiptap editor for proposal cover letters with AI assistance
   *
   * InfoSec: HTML sanitized before storage (OWASP A03)
   */
  import { onMount, onDestroy } from 'svelte';
  import { deserialize } from '$app/forms';
  import { Editor } from '@tiptap/core';
  import StarterKit from '@tiptap/starter-kit';
  import Link from '@tiptap/extension-link';
  import TextStyle from 'phosphor-svelte/lib/TextB';
  import TextItalic from 'phosphor-svelte/lib/TextItalic';
  import LinkIcon from 'phosphor-svelte/lib/Link';
  import Translate from 'phosphor-svelte/lib/Translate';
  import Sparkle from 'phosphor-svelte/lib/Sparkle';
  import CaretDown from 'phosphor-svelte/lib/CaretDown';
  import ClipboardText from 'phosphor-svelte/lib/ClipboardText';

  interface Boilerplate {
    id: string;
    name: string;
    content_en: string | null;
    content_ja: string | null;
  }

  let {
    content = $bindable(''),
    language = 'en',
    placeholder = '',
    boilerplates = [],
    onTranslate,
    disabled = false,
  }: {
    content?: string;
    language: 'en' | 'ja';
    placeholder?: string;
    boilerplates?: Boilerplate[];
    onTranslate?: (translated: string) => void;
    disabled?: boolean;
  } = $props();

  let editorElement: HTMLDivElement;
  let editor: Editor | null = $state(null);
  let isTranslating = $state(false);
  let isPolishing = $state(false);
  let showBoilerplateMenu = $state(false);

  // Track active states
  let isActive = $state({
    bold: false,
    italic: false,
    link: false,
  });

  // Track whether the last content change came from the editor itself
  let updatingFromEditor = false;

  onMount(() => {
    editor = new Editor({
      element: editorElement,
      extensions: [
        StarterKit.configure({
          // Disable features not needed for cover letters
          heading: false,
          codeBlock: false,
          blockquote: false,
          horizontalRule: false,
          code: false,
        }),
        Link.configure({
          openOnClick: false,
          // InfoSec: Validate URLs (OWASP A03)
          validate: (href) => /^https?:\/\//.test(href),
        }),
      ],
      content: content || '',
      editable: !disabled,
      onUpdate: ({ editor: e }) => {
        updatingFromEditor = true;
        content = e.getHTML();
        updatingFromEditor = false;
      },
      onSelectionUpdate: ({ editor: e }) => {
        updateActiveStates(e);
      },
      onTransaction: ({ editor: e }) => {
        updateActiveStates(e);
      },
    });
  });

  onDestroy(() => {
    editor?.destroy();
  });

  // Sync external content changes (e.g. translation) into the Tiptap editor
  $effect(() => {
    if (editor && !updatingFromEditor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '');
    }
  });

  function updateActiveStates(e: Editor) {
    isActive = {
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      link: e.isActive('link'),
    };
  }

  function addLink() {
    const url = prompt(language === 'ja' ? 'URLを入力:' : 'Enter URL:');
    if (url) {
      // InfoSec: Validate URL before adding (OWASP A03)
      if (!/^https?:\/\//.test(url)) {
        alert(
          language === 'ja'
            ? 'http:// または https:// で始まるURLのみ使用可能です'
            : 'Only http:// and https:// URLs are allowed'
        );
        return;
      }
      editor?.chain().focus().setLink({ href: url }).run();
    }
  }

  function insertBoilerplate(bp: Boilerplate) {
    const boilerplateContent = language === 'ja' ? bp.content_ja : bp.content_en;
    if (boilerplateContent && editor) {
      // Insert at cursor position (copies content, fully editable)
      editor.chain().focus().insertContent(boilerplateContent).run();
    }
    showBoilerplateMenu = false;
  }

  async function handleTranslate() {
    if (!editor || isTranslating) return;
    isTranslating = true;

    const text = editor.getHTML();
    const formData = new FormData();
    formData.set('text', text);
    formData.set('source_locale', language);

    try {
      const response = await fetch('?/aiTranslate', {
        method: 'POST',
        body: formData,
      });

      const result = deserialize(await response.text());

      if (result.type === 'success') {
        const data = result.data as { translated?: string; error?: string };
        if (data?.translated && onTranslate) {
          onTranslate(data.translated);
        } else if (data?.error) {
          alert(data.error);
        }
      } else if (result.type === 'failure') {
        const data = result.data as { error?: string };
        alert(data?.error || (language === 'ja' ? '翻訳に失敗しました' : 'Translation failed'));
      }
    } catch (err) {
      console.error('Translation error:', err);
      alert(language === 'ja' ? '翻訳に失敗しました' : 'Translation failed');
    } finally {
      isTranslating = false;
    }
  }

  async function handlePolish() {
    if (!editor || isPolishing) return;
    isPolishing = true;

    const text = editor.getHTML();
    const formData = new FormData();
    formData.set('text', text);

    try {
      const response = await fetch('?/aiPolish', {
        method: 'POST',
        body: formData,
      });

      const result = deserialize(await response.text());

      if (result.type === 'success') {
        const data = result.data as { polished?: string; error?: string };
        if (data?.polished) {
          editor.commands.setContent(data.polished);
        } else if (data?.error) {
          alert(data.error);
        }
      } else if (result.type === 'failure') {
        const data = result.data as { error?: string };
        alert(data?.error || (language === 'ja' ? '改善に失敗しました' : 'Polish failed'));
      }
    } catch (err) {
      console.error('Polish error:', err);
      alert(language === 'ja' ? '編集に失敗しました' : 'Polish failed');
    } finally {
      isPolishing = false;
    }
  }

  // Close boilerplate menu when clicking outside
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (showBoilerplateMenu && !target.closest('.boilerplate-menu')) {
      showBoilerplateMenu = false;
    }
  }

  // Labels based on language
  const labels = $derived({
    bold: language === 'ja' ? '太字' : 'Bold',
    italic: language === 'ja' ? '斜体' : 'Italic',
    link: language === 'ja' ? 'リンク' : 'Link',
    boilerplate: language === 'ja' ? '定型文' : 'Boilerplate',
    translate: language === 'ja' ? '英語に翻訳' : 'Translate to Japanese',
    polish: language === 'ja' ? '文章を改善' : 'Polish writing',
    translating: language === 'ja' ? '翻訳中...' : 'Translating...',
    polishing: language === 'ja' ? '改善中...' : 'Polishing...',
  });
</script>

<svelte:window onclick={handleClickOutside} />

<div class="cover-letter-editor border rounded-lg bg-white">
  <!-- Toolbar -->
  <div class="flex items-center gap-1 p-2 border-b bg-gray-50 flex-wrap">
    <!-- Text formatting -->
    <button
      type="button"
      onclick={() => editor?.chain().focus().toggleBold().run()}
      {disabled}
      title={labels.bold}
      class="p-1.5 rounded hover:bg-gray-200 transition-colors {isActive.bold
        ? 'bg-gray-200 text-esolia-navy'
        : 'text-gray-600'}"
    >
      <TextStyle size={18} weight={isActive.bold ? 'bold' : 'regular'} />
    </button>

    <button
      type="button"
      onclick={() => editor?.chain().focus().toggleItalic().run()}
      {disabled}
      title={labels.italic}
      class="p-1.5 rounded hover:bg-gray-200 transition-colors {isActive.italic
        ? 'bg-gray-200 text-esolia-navy'
        : 'text-gray-600'}"
    >
      <TextItalic size={18} weight={isActive.italic ? 'bold' : 'regular'} />
    </button>

    <button
      type="button"
      onclick={addLink}
      {disabled}
      title={labels.link}
      class="p-1.5 rounded hover:bg-gray-200 transition-colors {isActive.link
        ? 'bg-gray-200 text-esolia-navy'
        : 'text-gray-600'}"
    >
      <LinkIcon size={18} weight={isActive.link ? 'bold' : 'regular'} />
    </button>

    <div class="w-px h-5 bg-gray-300 mx-1"></div>

    <!-- Boilerplate dropdown -->
    {#if boilerplates.length > 0}
      <div class="relative boilerplate-menu">
        <button
          type="button"
          onclick={() => (showBoilerplateMenu = !showBoilerplateMenu)}
          {disabled}
          class="flex items-center gap-1 px-2 py-1 text-sm text-gray-600 hover:bg-gray-200 rounded transition-colors"
        >
          <ClipboardText size={16} />
          {labels.boilerplate}
          <CaretDown size={12} />
        </button>

        {#if showBoilerplateMenu}
          <div
            class="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-lg border z-50 max-h-64 overflow-y-auto"
          >
            {#each boilerplates as bp (bp.id)}
              {@const hasContent = language === 'ja' ? bp.content_ja : bp.content_en}
              <button
                type="button"
                onclick={() => insertBoilerplate(bp)}
                disabled={!hasContent}
                class="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span class="font-medium text-gray-900">{bp.name}</span>
                {#if !hasContent}
                  <span class="text-xs text-gray-400 ml-2">
                    ({language === 'ja' ? '日本語なし' : 'No English'})
                  </span>
                {/if}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <!-- AI buttons on the right -->
    <div class="ml-auto flex items-center gap-1">
      <button
        type="button"
        onclick={handleTranslate}
        disabled={disabled || isTranslating || !content}
        title={labels.translate}
        class="flex items-center gap-1 px-2 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Translate size={16} />
        {isTranslating ? labels.translating : labels.translate}
      </button>

      <button
        type="button"
        onclick={handlePolish}
        disabled={disabled || isPolishing || !content}
        title={labels.polish}
        class="flex items-center gap-1 px-2 py-1 text-sm text-purple-600 hover:bg-purple-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkle size={16} />
        {isPolishing ? labels.polishing : labels.polish}
      </button>
    </div>
  </div>

  <!-- Editor content -->
  <div
    bind:this={editorElement}
    class="prose prose-sm max-w-none p-4 min-h-[150px] focus-within:ring-2 focus-within:ring-esolia-navy/20"
    data-placeholder={placeholder}
  ></div>
</div>

<style>
  /* Placeholder styling */
  .cover-letter-editor :global(.ProseMirror) {
    outline: none;
    min-height: 120px;
  }

  .cover-letter-editor :global(.ProseMirror p.is-editor-empty:first-child::before) {
    content: attr(data-placeholder);
    float: left;
    color: #9ca3af;
    pointer-events: none;
    height: 0;
  }

  /* Link styling */
  .cover-letter-editor :global(.ProseMirror a) {
    color: #2d2f63;
    text-decoration: underline;
  }
</style>

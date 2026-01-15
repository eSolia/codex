<script lang="ts">
  /**
   * Editor Toolbar Component
   * Formatting controls for the Hanawa editor
   *
   * InfoSec: No external script injection vectors
   */
  import type { Editor } from '@tiptap/core';

  let { editor, openMediaPicker }: { editor: Editor; openMediaPicker?: () => void } = $props();

  // Track active states reactively
  let isActive = $state({
    bold: false,
    italic: false,
    underline: false,
    strike: false,
    code: false,
    bulletList: false,
    orderedList: false,
    taskList: false,
    blockquote: false,
    codeBlock: false,
    heading1: false,
    heading2: false,
    heading3: false,
    link: false,
  });

  // Update active states on editor changes
  $effect(() => {
    if (!editor) return;

    const updateActive = () => {
      isActive = {
        bold: editor.isActive('bold'),
        italic: editor.isActive('italic'),
        underline: editor.isActive('underline'),
        strike: editor.isActive('strike'),
        code: editor.isActive('code'),
        bulletList: editor.isActive('bulletList'),
        orderedList: editor.isActive('orderedList'),
        taskList: editor.isActive('taskList'),
        blockquote: editor.isActive('blockquote'),
        codeBlock: editor.isActive('codeBlock'),
        heading1: editor.isActive('heading', { level: 1 }),
        heading2: editor.isActive('heading', { level: 2 }),
        heading3: editor.isActive('heading', { level: 3 }),
        link: editor.isActive('link'),
      };
    };

    editor.on('selectionUpdate', updateActive);
    editor.on('transaction', updateActive);
    updateActive();

    return () => {
      editor.off('selectionUpdate', updateActive);
      editor.off('transaction', updateActive);
    };
  });

  function addLink() {
    const url = prompt('Enter URL:');
    if (url) {
      // InfoSec: Validate URL before adding (OWASP A03)
      if (!/^https?:\/\//.test(url)) {
        alert('Only http:// and https:// URLs are allowed');
        return;
      }
      editor.chain().focus().setLink({ href: url }).run();
    }
  }

  function insertCallout(type: 'info' | 'warning' | 'danger' | 'success') {
    editor.chain().focus().setCallout(type).run();
  }

  function insertStatus() {
    editor.chain().focus().setStatusBadge('pending-review').run();
  }

  function insertFragment() {
    const fragmentId = prompt('Enter fragment ID (e.g., products/m365):');
    if (fragmentId) {
      const lang = prompt('Language (en/ja):', 'en') || 'en';
      editor.chain().focus().insertFragment(fragmentId, lang).run();
    }
  }

  function insertMermaid() {
    editor.chain().focus().insertMermaid().run();
  }

  function insertPageBreak() {
    // Insert a page break marker that the PDF renderer recognizes
    editor.chain().focus().insertContent('<p><!-- pagebreak --></p>').run();
  }

  // Button component helper
  function buttonClass(active: boolean): string {
    return `p-2 rounded hover:bg-gray-100 ${active ? 'bg-gray-200 text-esolia-navy' : 'text-gray-600'}`;
  }
</script>

<div class="editor-toolbar border-b border-gray-200 px-2 py-1 flex flex-wrap items-center gap-1">
  <!-- Text Formatting -->
  <div class="flex items-center border-r border-gray-200 pr-2 mr-2">
    <button
      type="button"
      class={buttonClass(isActive.bold)}
      onclick={() => editor.chain().focus().toggleBold().run()}
      title="Bold (Ctrl+B)"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"
        />
      </svg>
    </button>
    <button
      type="button"
      class={buttonClass(isActive.italic)}
      onclick={() => editor.chain().focus().toggleItalic().run()}
      title="Italic (Ctrl+I)"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z" />
      </svg>
    </button>
    <button
      type="button"
      class={buttonClass(isActive.underline)}
      onclick={() => editor.chain().focus().toggleUnderline().run()}
      title="Underline (Ctrl+U)"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M12 17c3.31 0 6-2.69 6-6V3h-2.5v8c0 1.93-1.57 3.5-3.5 3.5S8.5 12.93 8.5 11V3H6v8c0 3.31 2.69 6 6 6zm-7 2v2h14v-2H5z"
        />
      </svg>
    </button>
    <button
      type="button"
      class={buttonClass(isActive.strike)}
      onclick={() => editor.chain().focus().toggleStrike().run()}
      title="Strikethrough"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M10 19h4v-3h-4v3zM5 4v3h5v3h4V7h5V4H5zM3 14h18v-2H3v2z" />
      </svg>
    </button>
    <button
      type="button"
      class={buttonClass(isActive.code)}
      onclick={() => editor.chain().focus().toggleCode().run()}
      title="Inline Code"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M9.4 16.6L4.8 12l4.6-4.6L8 6l-6 6 6 6 1.4-1.4zm5.2 0l4.6-4.6-4.6-4.6L16 6l6 6-6 6-1.4-1.4z"
        />
      </svg>
    </button>
  </div>

  <!-- Headings -->
  <div class="flex items-center border-r border-gray-200 pr-2 mr-2">
    <button
      type="button"
      class={buttonClass(isActive.heading1)}
      onclick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      title="Heading 1"
    >
      <span class="text-xs font-bold">H1</span>
    </button>
    <button
      type="button"
      class={buttonClass(isActive.heading2)}
      onclick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      title="Heading 2"
    >
      <span class="text-xs font-bold">H2</span>
    </button>
    <button
      type="button"
      class={buttonClass(isActive.heading3)}
      onclick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      title="Heading 3"
    >
      <span class="text-xs font-bold">H3</span>
    </button>
  </div>

  <!-- Lists -->
  <div class="flex items-center border-r border-gray-200 pr-2 mr-2">
    <button
      type="button"
      class={buttonClass(isActive.bulletList)}
      onclick={() => editor.chain().focus().toggleBulletList().run()}
      title="Bullet List"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M4 10.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5zm0-6c-.83 0-1.5.67-1.5 1.5S3.17 7.5 4 7.5 5.5 6.83 5.5 6 4.83 4.5 4 4.5zm0 12c-.83 0-1.5.68-1.5 1.5s.68 1.5 1.5 1.5 1.5-.68 1.5-1.5-.67-1.5-1.5-1.5zM7 19h14v-2H7v2zm0-6h14v-2H7v2zm0-8v2h14V5H7z"
        />
      </svg>
    </button>
    <button
      type="button"
      class={buttonClass(isActive.orderedList)}
      onclick={() => editor.chain().focus().toggleOrderedList().run()}
      title="Numbered List"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M2 17h2v.5H3v1h1v.5H2v1h3v-4H2v1zm1-9h1V4H2v1h1v3zm-1 3h1.8L2 13.1v.9h3v-1H3.2L5 10.9V10H2v1zm5-6v2h14V5H7zm0 14h14v-2H7v2zm0-6h14v-2H7v2z"
        />
      </svg>
    </button>
    <button
      type="button"
      class={buttonClass(isActive.taskList)}
      onclick={() => editor.chain().focus().toggleTaskList().run()}
      title="Task List"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM17.99 9l-1.41-1.42-6.59 6.59-2.58-2.57-1.42 1.41 4 3.99z"
        />
      </svg>
    </button>
  </div>

  <!-- Block Elements -->
  <div class="flex items-center border-r border-gray-200 pr-2 mr-2">
    <button
      type="button"
      class={buttonClass(isActive.blockquote)}
      onclick={() => editor.chain().focus().toggleBlockquote().run()}
      title="Quote"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M6 17h3l2-4V7H5v6h3zm8 0h3l2-4V7h-6v6h3z" />
      </svg>
    </button>
    <button
      type="button"
      class={buttonClass(isActive.codeBlock)}
      onclick={() => editor.chain().focus().toggleCodeBlock().run()}
      title="Code Block"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M20 3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H4V5h16v14zM6 17h12v-2H6v2zm0-4h12v-2H6v2zm0-4h12V7H6v2z"
        />
      </svg>
    </button>
    <button type="button" class={buttonClass(isActive.link)} onclick={addLink} title="Add Link">
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path
          d="M3.9 12c0-1.71 1.39-3.1 3.1-3.1h4V7H7c-2.76 0-5 2.24-5 5s2.24 5 5 5h4v-1.9H7c-1.71 0-3.1-1.39-3.1-3.1zM8 13h8v-2H8v2zm9-6h-4v1.9h4c1.71 0 3.1 1.39 3.1 3.1s-1.39 3.1-3.1 3.1h-4V17h4c2.76 0 5-2.24 5-5s-2.24-5-5-5z"
        />
      </svg>
    </button>
    {#if openMediaPicker}
      <button
        type="button"
        class="p-2 rounded hover:bg-gray-100 text-gray-600"
        onclick={openMediaPicker}
        title="Insert Image"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path
            d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"
          />
        </svg>
      </button>
    {/if}
  </div>

  <!-- Custom Hanawa Extensions -->
  <div class="flex items-center gap-1">
    <div class="relative group">
      <button
        type="button"
        class="p-2 rounded hover:bg-gray-100 text-gray-600"
        title="Insert Callout"
      >
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
          <path
            d="M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"
          />
        </svg>
      </button>
      <div
        class="absolute top-full left-0 mt-1 bg-white border rounded shadow-lg hidden group-hover:block z-10"
      >
        <button
          type="button"
          class="block w-full px-4 py-2 text-left text-sm hover:bg-blue-50 text-blue-700"
          onclick={() => insertCallout('info')}
        >
          ℹ️ Info
        </button>
        <button
          type="button"
          class="block w-full px-4 py-2 text-left text-sm hover:bg-yellow-50 text-yellow-700"
          onclick={() => insertCallout('warning')}
        >
          ⚠️ Warning
        </button>
        <button
          type="button"
          class="block w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-700"
          onclick={() => insertCallout('danger')}
        >
          🚨 Danger
        </button>
        <button
          type="button"
          class="block w-full px-4 py-2 text-left text-sm hover:bg-green-50 text-green-700"
          onclick={() => insertCallout('success')}
        >
          ✅ Success
        </button>
      </div>
    </div>

    <button
      type="button"
      class="p-2 rounded hover:bg-gray-100 text-gray-600"
      onclick={insertStatus}
      title="Insert Status Badge"
    >
      <span class="text-xs">📊</span>
    </button>

    <button
      type="button"
      class="p-2 rounded hover:bg-gray-100 text-gray-600"
      onclick={() => editor.chain().focus().togglePrivacyMask('pii').run()}
      title="Privacy Mask (Ctrl+Shift+P)"
    >
      <span class="text-xs">🔒</span>
    </button>

    <button
      type="button"
      class="p-2 rounded hover:bg-gray-100 text-esolia-orange"
      onclick={insertFragment}
      title="Insert Fragment"
    >
      <span class="text-xs">📦</span>
    </button>

    <button
      type="button"
      class="p-2 rounded hover:bg-gray-100 text-gray-600"
      onclick={insertMermaid}
      title="Insert Mermaid Diagram (Ctrl+Shift+M)"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z" opacity="0.3" />
        <path
          d="M7 7v2h2V7H7zm10 0v2h2V7h-2zM7 17v2h2v-2H7zm10 0v2h2v-2h-2zM12 10v4M8 12h8"
          stroke="currentColor"
          stroke-width="1.5"
          fill="none"
        />
      </svg>
    </button>

    <button
      type="button"
      class="p-2 rounded hover:bg-gray-100 text-gray-600"
      onclick={insertPageBreak}
      title="Insert Page Break (PDF only)"
    >
      <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
        <path d="M4 4h16v6H4zm0 10h16v6H4z" opacity="0.3" />
        <path d="M2 11h20v2H2z" />
      </svg>
    </button>
  </div>
</div>

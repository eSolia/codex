<!--
  Hanawa Editor Toolbar
  Formatting controls for the editor
-->
<script lang="ts">
  import type { Editor } from '@tiptap/core';

  export let editor: Editor;

  // Track active states
  $: isActive = editor ? {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    code: editor.isActive('code'),
    h1: editor.isActive('heading', { level: 1 }),
    h2: editor.isActive('heading', { level: 2 }),
    h3: editor.isActive('heading', { level: 3 }),
    bulletList: editor.isActive('bulletList'),
    orderedList: editor.isActive('orderedList'),
    taskList: editor.isActive('taskList'),
    blockquote: editor.isActive('blockquote'),
    link: editor.isActive('link'),
  } : {};

  // Force reactivity on selection changes
  let updateKey = 0;
  $: {
    editor?.on('selectionUpdate', () => updateKey++);
    editor?.on('transaction', () => updateKey++);
  }

  // Actions
  function toggleBold() { editor.chain().focus().toggleBold().run(); }
  function toggleItalic() { editor.chain().focus().toggleItalic().run(); }
  function toggleUnderline() { editor.chain().focus().toggleUnderline().run(); }
  function toggleStrike() { editor.chain().focus().toggleStrike().run(); }
  function toggleCode() { editor.chain().focus().toggleCode().run(); }
  function setHeading(level: 1 | 2 | 3) { editor.chain().focus().toggleHeading({ level }).run(); }
  function toggleBulletList() { editor.chain().focus().toggleBulletList().run(); }
  function toggleOrderedList() { editor.chain().focus().toggleOrderedList().run(); }
  function toggleTaskList() { editor.chain().focus().toggleTaskList().run(); }
  function toggleBlockquote() { editor.chain().focus().toggleBlockquote().run(); }
  function setHorizontalRule() { editor.chain().focus().setHorizontalRule().run(); }
  
  function insertLink() {
    const url = window.prompt('Enter URL:');
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }
  
  function insertImage() {
    const url = window.prompt('Enter image URL:');
    if (url) editor.chain().focus().setImage({ src: url }).run();
  }
  
  function insertTable() {
    editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
  }
  
  function insertCallout(type: 'info' | 'warning' | 'danger' | 'success') {
    editor.chain().focus().setCallout({ type }).run();
  }
  
  function togglePrivacyMask() {
    editor.chain().focus().togglePrivacyMask().run();
  }
  
  function insertTableOfContents() {
    editor.chain().focus().insertTableOfContents().run();
  }

  // Dropdown state
  let showHeadingMenu = false;
  let showCalloutMenu = false;

  function closeMenus() {
    showHeadingMenu = false;
    showCalloutMenu = false;
  }
</script>

<svelte:window on:click={closeMenus} />

<div class="editor-toolbar" role="toolbar" aria-label="Text formatting">
  <!-- Text formatting -->
  <div class="toolbar-group">
    <button class="toolbar-btn" class:active={isActive.bold} on:click={toggleBold} title="Bold (Ctrl+B)">
      <strong>B</strong>
    </button>
    <button class="toolbar-btn" class:active={isActive.italic} on:click={toggleItalic} title="Italic (Ctrl+I)">
      <em>I</em>
    </button>
    <button class="toolbar-btn" class:active={isActive.underline} on:click={toggleUnderline} title="Underline (Ctrl+U)">
      <u>U</u>
    </button>
    <button class="toolbar-btn" class:active={isActive.strike} on:click={toggleStrike} title="Strikethrough">
      <s>S</s>
    </button>
    <button class="toolbar-btn" class:active={isActive.code} on:click={toggleCode} title="Inline code">
      {'</>'}
    </button>
  </div>

  <div class="toolbar-divider" />

  <!-- Headings -->
  <div class="toolbar-group">
    <div class="toolbar-dropdown">
      <button
        class="toolbar-btn"
        class:active={isActive.h1 || isActive.h2 || isActive.h3}
        on:click|stopPropagation={() => showHeadingMenu = !showHeadingMenu}
        title="Headings"
      >
        H ▾
      </button>

      {#if showHeadingMenu}
        <div class="dropdown-menu">
          <button class="dropdown-item" class:active={isActive.h1} on:click={() => { setHeading(1); closeMenus(); }}>
            Heading 1
          </button>
          <button class="dropdown-item" class:active={isActive.h2} on:click={() => { setHeading(2); closeMenus(); }}>
            Heading 2
          </button>
          <button class="dropdown-item" class:active={isActive.h3} on:click={() => { setHeading(3); closeMenus(); }}>
            Heading 3
          </button>
        </div>
      {/if}
    </div>
  </div>

  <div class="toolbar-divider" />

  <!-- Lists -->
  <div class="toolbar-group">
    <button class="toolbar-btn" class:active={isActive.bulletList} on:click={toggleBulletList} title="Bullet list">
      •
    </button>
    <button class="toolbar-btn" class:active={isActive.orderedList} on:click={toggleOrderedList} title="Numbered list">
      1.
    </button>
    <button class="toolbar-btn" class:active={isActive.taskList} on:click={toggleTaskList} title="Task list">
      ☑
    </button>
  </div>

  <div class="toolbar-divider" />

  <!-- Blocks -->
  <div class="toolbar-group">
    <button class="toolbar-btn" class:active={isActive.blockquote} on:click={toggleBlockquote} title="Quote">
      ❝
    </button>
    <button class="toolbar-btn" on:click={setHorizontalRule} title="Horizontal rule">
      —
    </button>
  </div>

  <div class="toolbar-divider" />

  <!-- Insert -->
  <div class="toolbar-group">
    <button class="toolbar-btn" class:active={isActive.link} on:click={insertLink} title="Insert link">
      🔗
    </button>
    <button class="toolbar-btn" on:click={insertImage} title="Insert image">
      🖼
    </button>
    <button class="toolbar-btn" on:click={insertTable} title="Insert table">
      📊
    </button>
  </div>

  <div class="toolbar-divider" />

  <!-- Compliance -->
  <div class="toolbar-group">
    <div class="toolbar-dropdown">
      <button
        class="toolbar-btn"
        on:click|stopPropagation={() => showCalloutMenu = !showCalloutMenu}
        title="Insert callout"
      >
        💬 ▾
      </button>

      {#if showCalloutMenu}
        <div class="dropdown-menu">
          <button class="dropdown-item" on:click={() => { insertCallout('info'); closeMenus(); }}>
            ℹ️ Info
          </button>
          <button class="dropdown-item" on:click={() => { insertCallout('warning'); closeMenus(); }}>
            ⚠️ Warning
          </button>
          <button class="dropdown-item" on:click={() => { insertCallout('danger'); closeMenus(); }}>
            🚨 Danger
          </button>
          <button class="dropdown-item" on:click={() => { insertCallout('success'); closeMenus(); }}>
            ✅ Success
          </button>
        </div>
      {/if}
    </div>

    <button class="toolbar-btn" on:click={togglePrivacyMask} title="Privacy mask (Ctrl+Shift+P)">
      🔒
    </button>

    <button class="toolbar-btn" on:click={insertTableOfContents} title="Table of contents">
      📑
    </button>
  </div>
</div>

<style>
  .editor-toolbar {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid rgb(229 231 235);
    background: rgb(249 250 251);
    flex-wrap: wrap;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }

  .toolbar-divider {
    width: 1px;
    height: 1.5rem;
    background: rgb(209 213 219);
    margin: 0 0.375rem;
  }

  .toolbar-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 2rem;
    height: 2rem;
    padding: 0 0.375rem;
    border: none;
    background: transparent;
    border-radius: 0.25rem;
    color: rgb(75 85 99);
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.15s, color 0.15s;
  }

  .toolbar-btn:hover {
    background: rgb(229 231 235);
    color: rgb(17 24 39);
  }

  .toolbar-btn.active {
    background: rgb(219 234 254);
    color: rgb(37 99 235);
  }

  .toolbar-dropdown {
    position: relative;
  }

  .dropdown-menu {
    position: absolute;
    top: 100%;
    left: 0;
    margin-top: 0.25rem;
    background: white;
    border: 1px solid rgb(229 231 235);
    border-radius: 0.375rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
    min-width: 120px;
    z-index: 50;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 0.75rem;
    border: none;
    background: transparent;
    cursor: pointer;
    font-size: 0.875rem;
    text-align: left;
  }

  .dropdown-item:hover {
    background: rgb(243 244 246);
  }

  .dropdown-item.active {
    background: rgb(219 234 254);
    color: rgb(37 99 235);
  }
</style>

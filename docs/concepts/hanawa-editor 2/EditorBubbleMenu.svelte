<!--
  Hanawa Editor Bubble Menu
  Floating menu for text selection
-->
<script lang="ts">
  import type { Editor } from '@tiptap/core';

  export let editor: Editor;

  $: isActive = editor ? {
    bold: editor.isActive('bold'),
    italic: editor.isActive('italic'),
    underline: editor.isActive('underline'),
    strike: editor.isActive('strike'),
    code: editor.isActive('code'),
    link: editor.isActive('link'),
    highlight: editor.isActive('highlight'),
    privacyMask: editor.isActive('privacyMask'),
  } : {};

  function toggleBold() { editor.chain().focus().toggleBold().run(); }
  function toggleItalic() { editor.chain().focus().toggleItalic().run(); }
  function toggleUnderline() { editor.chain().focus().toggleUnderline().run(); }
  function toggleStrike() { editor.chain().focus().toggleStrike().run(); }
  function toggleCode() { editor.chain().focus().toggleCode().run(); }
  function toggleHighlight() { editor.chain().focus().toggleHighlight().run(); }
  function togglePrivacyMask() { editor.chain().focus().togglePrivacyMask().run(); }
  
  function toggleLink() {
    if (isActive.link) {
      editor.chain().focus().unsetLink().run();
    } else {
      const url = window.prompt('Enter URL:');
      if (url) editor.chain().focus().setLink({ href: url }).run();
    }
  }

  $: shouldShow = editor && !editor.state.selection.empty && editor.isEditable;
</script>

{#if editor}
  <div class="bubble-menu" class:visible={shouldShow}>
    <button class="bubble-btn" class:active={isActive.bold} on:click={toggleBold} title="Bold">
      <strong>B</strong>
    </button>
    <button class="bubble-btn" class:active={isActive.italic} on:click={toggleItalic} title="Italic">
      <em>I</em>
    </button>
    <button class="bubble-btn" class:active={isActive.underline} on:click={toggleUnderline} title="Underline">
      <u>U</u>
    </button>
    <button class="bubble-btn" class:active={isActive.strike} on:click={toggleStrike} title="Strikethrough">
      <s>S</s>
    </button>
    
    <div class="bubble-divider" />
    
    <button class="bubble-btn" class:active={isActive.code} on:click={toggleCode} title="Code">
      {'</>'}
    </button>
    <button class="bubble-btn" class:active={isActive.highlight} on:click={toggleHighlight} title="Highlight">
      🖍
    </button>
    
    <div class="bubble-divider" />
    
    <button class="bubble-btn" class:active={isActive.link} on:click={toggleLink} title="Link">
      🔗
    </button>
    <button class="bubble-btn" class:active={isActive.privacyMask} on:click={togglePrivacyMask} title="Privacy Mask">
      🔒
    </button>
  </div>
{/if}

<style>
  .bubble-menu {
    display: none;
    align-items: center;
    gap: 0.125rem;
    padding: 0.375rem;
    background: white;
    border: 1px solid rgb(209 213 219);
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
  }

  .bubble-menu.visible {
    display: flex;
  }

  .bubble-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border: none;
    background: transparent;
    border-radius: 0.25rem;
    color: rgb(75 85 99);
    cursor: pointer;
    font-size: 0.75rem;
  }

  .bubble-btn:hover {
    background: rgb(243 244 246);
  }

  .bubble-btn.active {
    background: rgb(219 234 254);
    color: rgb(37 99 235);
  }

  .bubble-divider {
    width: 1px;
    height: 1.25rem;
    background: rgb(229 231 235);
    margin: 0 0.25rem;
  }
</style>

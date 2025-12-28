<script lang="ts">
  /**
   * Comment Editor Component
   * InfoSec: Secure comment input with @mention support
   */

  interface Props {
    placeholder?: string;
    initialContent?: string;
    submitLabel?: string;
    cancelLabel?: string;
    showCancel?: boolean;
    autoFocus?: boolean;
    disabled?: boolean;
    mentionSuggestions?: { email: string; name?: string }[];
    onSubmit?: (content: string) => void | Promise<void>;
    onCancel?: () => void;
  }

  let {
    placeholder = 'Write a comment...',
    initialContent = '',
    submitLabel = 'Comment',
    cancelLabel = 'Cancel',
    showCancel = false,
    autoFocus = false,
    disabled = false,
    mentionSuggestions = [],
    onSubmit,
    onCancel,
  }: Props = $props();

  let content = $state(initialContent);
  let textarea: HTMLTextAreaElement;
  let showMentionMenu = $state(false);
  let mentionQuery = $state('');
  let mentionStartPos = $state(0);
  let submitting = $state(false);

  let filteredSuggestions = $derived(
    mentionSuggestions
      .filter((s) =>
        (s.name?.toLowerCase() || s.email.toLowerCase()).includes(mentionQuery.toLowerCase())
      )
      .slice(0, 5)
  );

  let isValid = $derived(content.trim().length > 0);

  async function handleSubmit() {
    if (!isValid || submitting || disabled) return;

    submitting = true;
    try {
      await onSubmit?.(content.trim());
      content = '';
    } finally {
      submitting = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    // Submit on Cmd/Ctrl+Enter
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
      return;
    }

    // Handle mention menu
    if (showMentionMenu) {
      if (e.key === 'Escape') {
        showMentionMenu = false;
        return;
      }
      if (e.key === 'Tab' || e.key === 'Enter') {
        if (filteredSuggestions.length > 0) {
          e.preventDefault();
          insertMention(filteredSuggestions[0]);
        }
        return;
      }
    }
  }

  function handleInput() {
    const cursorPos = textarea.selectionStart;
    const textBefore = content.slice(0, cursorPos);
    const mentionMatch = textBefore.match(/@(\S*)$/);

    if (mentionMatch) {
      showMentionMenu = true;
      mentionQuery = mentionMatch[1];
      mentionStartPos = cursorPos - mentionMatch[0].length;
    } else {
      showMentionMenu = false;
    }
  }

  function insertMention(user: { email: string; name?: string }) {
    const before = content.slice(0, mentionStartPos);
    const after = content.slice(textarea.selectionStart);
    content = `${before}@${user.email} ${after}`;
    showMentionMenu = false;

    // Reset cursor after mention
    setTimeout(() => {
      const newPos = mentionStartPos + user.email.length + 2;
      textarea.setSelectionRange(newPos, newPos);
      textarea.focus();
    }, 0);
  }

  function autoResize() {
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }
</script>

<div class="comment-editor">
  <div class="relative">
    <textarea
      bind:this={textarea}
      bind:value={content}
      oninput={() => {
        handleInput();
        autoResize();
      }}
      onkeydown={handleKeydown}
      {placeholder}
      {disabled}
      rows="2"
      class="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none
             focus:ring-2 focus:ring-esolia-navy focus:border-transparent
             disabled:bg-gray-50 disabled:text-gray-500"
      class:focus={autoFocus}
    ></textarea>

    <!-- Mention suggestions dropdown -->
    {#if showMentionMenu && filteredSuggestions.length > 0}
      <div
        class="absolute left-0 bottom-full mb-1 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
      >
        <ul class="py-1">
          {#each filteredSuggestions as suggestion (suggestion.email)}
            <li>
              <button
                type="button"
                onclick={() => insertMention(suggestion)}
                class="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <div
                  class="w-6 h-6 rounded-full bg-esolia-navy text-white flex items-center justify-center text-xs font-medium"
                >
                  {(suggestion.name || suggestion.email).charAt(0).toUpperCase()}
                </div>
                <div>
                  {#if suggestion.name}
                    <div class="font-medium text-gray-900">{suggestion.name}</div>
                    <div class="text-xs text-gray-500">{suggestion.email}</div>
                  {:else}
                    <div class="font-medium text-gray-900">{suggestion.email}</div>
                  {/if}
                </div>
              </button>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </div>

  <!-- Actions -->
  <div class="mt-2 flex items-center justify-between">
    <p class="text-xs text-gray-400">Tip: Use @ to mention, Cmd+Enter to submit</p>

    <div class="flex gap-2">
      {#if showCancel}
        <button
          type="button"
          onclick={onCancel}
          {disabled}
          class="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 disabled:opacity-50"
        >
          {cancelLabel}
        </button>
      {/if}

      <button
        type="button"
        onclick={handleSubmit}
        disabled={!isValid || submitting || disabled}
        class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white
               bg-esolia-navy rounded-md hover:bg-esolia-navy/90
               disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {#if submitting}
          <svg class="animate-spin h-3.5 w-3.5" fill="none" viewBox="0 0 24 24">
            <circle
              class="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              stroke-width="4"
            />
            <path
              class="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        {:else}
          <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        {/if}
        {submitLabel}
      </button>
    </div>
  </div>
</div>

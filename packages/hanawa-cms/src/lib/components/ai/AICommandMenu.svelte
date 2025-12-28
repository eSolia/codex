<script lang="ts">
  /**
   * AI Command Menu Component
   * InfoSec: Quick access to AI writing actions via Cmd+J
   */

  type AIAction =
    | "continue"
    | "expand"
    | "improve"
    | "simplify"
    | "fix_grammar"
    | "translate"
    | "custom";

  interface ActionItem {
    id: AIAction;
    label: string;
    description: string;
    shortcut?: string;
  }

  interface Props {
    visible: boolean;
    position?: { x: number; y: number };
    hasSelection?: boolean;
    currentLocale?: "en" | "ja";
    onAction: (action: AIAction, customPrompt?: string) => void;
    onClose: () => void;
  }

  let {
    visible,
    position = { x: 0, y: 0 },
    hasSelection = false,
    currentLocale = "en",
    onAction,
    onClose,
  }: Props = $props();

  let customPrompt = $state("");
  let showCustomInput = $state(false);

  const actions: ActionItem[] = [
    {
      id: "continue",
      label: "Continue writing",
      description: "Generate 2-3 paragraphs continuing from current position",
      shortcut: "C",
    },
    {
      id: "expand",
      label: "Expand",
      description: "Add more detail and examples to selected text",
      shortcut: "E",
    },
    {
      id: "improve",
      label: "Improve writing",
      description: "Enhance clarity and professionalism",
      shortcut: "I",
    },
    {
      id: "simplify",
      label: "Simplify",
      description: "Use shorter sentences and simpler words",
      shortcut: "S",
    },
    {
      id: "fix_grammar",
      label: "Fix grammar",
      description: "Correct grammar, spelling, and punctuation",
      shortcut: "G",
    },
    {
      id: "translate",
      label: currentLocale === "en" ? "Translate to Japanese" : "Translate to English",
      description: "Translate selected text",
      shortcut: "T",
    },
    {
      id: "custom",
      label: "Custom prompt",
      description: "Enter your own instructions",
      shortcut: "/",
    },
  ];

  function handleAction(action: AIAction) {
    if (action === "custom") {
      showCustomInput = true;
      return;
    }
    onAction(action);
  }

  function handleCustomSubmit() {
    if (customPrompt.trim()) {
      onAction("custom", customPrompt.trim());
      customPrompt = "";
      showCustomInput = false;
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!visible) return;

    if (event.key === "Escape") {
      if (showCustomInput) {
        showCustomInput = false;
      } else {
        onClose();
      }
      return;
    }

    if (showCustomInput) {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleCustomSubmit();
      }
      return;
    }

    // Shortcut keys
    const key = event.key.toUpperCase();
    const action = actions.find((a) => a.shortcut === key);
    if (action) {
      event.preventDefault();
      handleAction(action.id);
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if visible}
  <!-- Backdrop -->
  <div
    class="fixed inset-0 z-40"
    onclick={onClose}
    onkeydown={(e) => e.key === "Escape" && onClose()}
    role="button"
    tabindex="-1"
  ></div>

  <!-- Menu -->
  <div
    class="fixed z-50 w-72 bg-white rounded-lg shadow-xl border border-gray-200 overflow-hidden"
    style="left: {position.x}px; top: {position.y}px;"
    role="menu"
  >
    {#if showCustomInput}
      <!-- Custom prompt input -->
      <div class="p-3">
        <label class="block text-xs font-medium text-gray-700 mb-1.5">
          Custom instruction
        </label>
        <textarea
          bind:value={customPrompt}
          placeholder="e.g., Rewrite in formal business tone..."
          rows="3"
          class="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg
                 focus:ring-2 focus:ring-esolia-navy focus:border-transparent
                 resize-none"
        ></textarea>
        <div class="flex justify-end gap-2 mt-2">
          <button
            type="button"
            onclick={() => (showCustomInput = false)}
            class="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onclick={handleCustomSubmit}
            disabled={!customPrompt.trim()}
            class="px-3 py-1.5 text-xs font-medium text-white bg-esolia-navy
                   rounded-md hover:bg-esolia-navy/90 disabled:opacity-50"
          >
            Generate
          </button>
        </div>
      </div>
    {:else}
      <!-- Action list -->
      <div class="p-1">
        <div class="px-3 py-2 text-xs font-medium text-gray-500 uppercase">
          AI Assistant
        </div>
        {#each actions as action}
          <button
            type="button"
            onclick={() => handleAction(action.id)}
            class="w-full flex items-center gap-3 px-3 py-2 text-left rounded-md
                   hover:bg-gray-50 transition-colors group"
            role="menuitem"
          >
            <div class="flex-1">
              <div class="text-sm font-medium text-gray-900">
                {action.label}
              </div>
              <div class="text-xs text-gray-500">
                {action.description}
              </div>
            </div>
            {#if action.shortcut}
              <kbd
                class="px-1.5 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-500
                       rounded border border-gray-200 group-hover:bg-white"
              >
                {action.shortcut}
              </kbd>
            {/if}
          </button>
        {/each}
      </div>

      {#if !hasSelection}
        <div class="px-4 py-2 text-xs text-amber-600 bg-amber-50 border-t border-amber-100">
          Tip: Select text for more actions
        </div>
      {/if}
    {/if}
  </div>
{/if}

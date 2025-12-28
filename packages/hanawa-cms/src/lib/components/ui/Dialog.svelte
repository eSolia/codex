<!--
  Dialog Component (bits-ui based)
  Accessible modal dialog with animation

  Usage:
  <Dialog bind:open title="Dialog Title">
    <p>Dialog content here</p>
    {#snippet footer()}
      <Button onclick={() => open = false}>Close</Button>
    {/snippet}
  </Dialog>
-->
<script lang="ts">
  import { Dialog as DialogPrimitive } from 'bits-ui';
  import type { Snippet } from 'svelte';
  import X from 'phosphor-svelte/lib/X';

  interface Props {
    open?: boolean;
    title?: string;
    description?: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    showClose?: boolean;
    children: Snippet;
    footer?: Snippet;
    onOpenChange?: (open: boolean) => void;
  }

  let {
    open = $bindable(false),
    title,
    description,
    size = 'md',
    showClose = true,
    children,
    footer,
    onOpenChange,
  }: Props = $props();

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
  };

  function handleOpenChange(isOpen: boolean) {
    open = isOpen;
    onOpenChange?.(isOpen);
  }
</script>

<DialogPrimitive.Root bind:open onOpenChange={handleOpenChange}>
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      class="fixed inset-0 z-50 bg-black/50 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      class="fixed left-1/2 top-1/2 z-50 w-full {sizeClasses[size]} -translate-x-1/2 -translate-y-1/2 bg-white rounded-xl shadow-xl p-0 max-h-[90vh] overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]"
    >
      {#if title || showClose}
        <div class="flex items-start justify-between p-4 border-b border-gray-100">
          <div>
            {#if title}
              <DialogPrimitive.Title class="text-lg font-semibold text-gray-900">
                {title}
              </DialogPrimitive.Title>
            {/if}
            {#if description}
              <DialogPrimitive.Description class="mt-1 text-sm text-gray-500">
                {description}
              </DialogPrimitive.Description>
            {/if}
          </div>
          {#if showClose}
            <DialogPrimitive.Close
              class="p-1 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            >
              <X size={20} weight="bold" />
              <span class="sr-only">Close</span>
            </DialogPrimitive.Close>
          {/if}
        </div>
      {/if}

      <div class="p-4 overflow-y-auto max-h-[calc(90vh-8rem)]">
        {@render children()}
      </div>

      {#if footer}
        <div class="flex justify-end gap-2 p-4 border-t border-gray-100 bg-gray-50">
          {@render footer()}
        </div>
      {/if}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
</DialogPrimitive.Root>

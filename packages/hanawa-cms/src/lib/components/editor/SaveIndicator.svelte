<script lang="ts">
  /**
   * Save Indicator Component
   * Shows save status: saving, saved, unsaved, error
   *
   * InfoSec: No sensitive data exposure in status messages
   */

  type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'unsaved';

  let {
    status = 'idle' as SaveStatus,
    lastSaved = null as Date | null,
    error = null as string | null,
  }: {
    status?: SaveStatus;
    lastSaved?: Date | null;
    error?: string | null;
  } = $props();

  // Format relative time
  function formatRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);

    if (diffSecs < 10) return 'Just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }

  // Status config
  const statusConfig = {
    idle: {
      icon: '○',
      text: 'Ready',
      class: 'text-gray-400',
    },
    saving: {
      icon: '◐',
      text: 'Saving...',
      class: 'text-blue-500 animate-pulse',
    },
    saved: {
      icon: '●',
      text: 'Saved',
      class: 'text-emerald-500',
    },
    error: {
      icon: '✕',
      text: 'Error',
      class: 'text-red-500',
    },
    unsaved: {
      icon: '◌',
      text: 'Unsaved changes',
      class: 'text-amber-500',
    },
  };

  let config = $derived(statusConfig[status]);

  // Update relative time every 30 seconds
  let displayTime = $state('');
  $effect(() => {
    if (lastSaved) {
      displayTime = formatRelativeTime(lastSaved);
      const interval = setInterval(() => {
        displayTime = formatRelativeTime(lastSaved!);
      }, 30000);
      return () => clearInterval(interval);
    }
  });
</script>

<div class="save-indicator flex items-center gap-2 text-xs {config.class}" title={error || ''}>
  <span class="text-sm">{config.icon}</span>
  <span>{config.text}</span>
  {#if status === 'saved' && lastSaved}
    <span class="text-gray-400">({displayTime})</span>
  {/if}
  {#if status === 'error' && error}
    <span class="text-red-400 truncate max-w-32" title={error}>{error}</span>
  {/if}
</div>

<style>
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  .animate-pulse {
    animation: pulse 1.5s infinite;
  }
</style>

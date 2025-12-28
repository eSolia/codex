<script lang="ts">
  /**
   * Screenshot Shield Component
   * Provides deterrence and forensic tracking for sensitive content
   *
   * InfoSec: Screenshot deterrence, watermarking, audit logging
   * Reference: docs/concepts/cms-content-security.md
   */
  import { onMount, type Snippet } from 'svelte';

  let {
    viewerEmail,
    documentId,
    sensitivity = 'normal',
    children,
  }: {
    viewerEmail: string;
    documentId: string;
    sensitivity?: 'normal' | 'confidential' | 'embargoed';
    children: Snippet;
  } = $props();

  let shieldActive = $state(false);
  let warningMessage = $state('');
  let viewStartTime = $state(Date.now());
  let elapsed = $state(0);

  // Generate fingerprint for forensic watermarking
  const fingerprint = btoa(`${viewerEmail}|${documentId}|${viewStartTime}`).slice(0, 20);

  onMount(() => {
    // Update elapsed time
    const timer = setInterval(() => {
      elapsed = Math.floor((Date.now() - viewStartTime) / 1000);
    }, 1000);

    // Screenshot key detection
    const handleKeydown = (e: KeyboardEvent) => {
      const isScreenshotAttempt =
        (e.metaKey && e.shiftKey && ['3', '4', '5', 's'].includes(e.key)) ||
        e.key === 'PrintScreen';

      if (isScreenshotAttempt && sensitivity !== 'normal') {
        activateShield('Screenshot attempt detected');
        logSecurityEvent('screenshot_attempt');
      }
    };

    // Tab visibility change
    const handleVisibility = () => {
      if (document.hidden && sensitivity === 'embargoed') {
        activateShield('Content hidden—tab not in focus');
        logSecurityEvent('tab_unfocus');
      } else if (!document.hidden) {
        deactivateShield();
      }
    };

    // Window blur
    const handleBlur = () => {
      if (sensitivity === 'embargoed') {
        activateShield('Window lost focus');
        setTimeout(deactivateShield, 2000);
        logSecurityEvent('window_blur');
      }
    };

    // Right-click prevention for confidential+
    const handleContextMenu = (e: MouseEvent) => {
      if (sensitivity !== 'normal') {
        e.preventDefault();
        activateShield('Right-click disabled for security');
        setTimeout(deactivateShield, 1500);
      }
    };

    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('contextmenu', handleContextMenu);

    // Log view start
    logSecurityEvent('view_started');

    return () => {
      clearInterval(timer);
      document.removeEventListener('keydown', handleKeydown);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('contextmenu', handleContextMenu);
      logSecurityEvent('view_ended');
    };
  });

  function activateShield(message: string) {
    shieldActive = true;
    warningMessage = message;
  }

  function deactivateShield() {
    shieldActive = false;
    warningMessage = '';
  }

  async function logSecurityEvent(event: string) {
    try {
      await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          documentId,
          viewerEmail,
          timestamp: Date.now(),
          sensitivity,
        }),
      });
    } catch {
      // Silent fail for audit logging
    }
  }

  function hashCode(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash);
  }
</script>

{#if sensitivity !== 'normal'}
  <div class="shield-container">
    <!-- Visible watermark -->
    <div class="watermark visible" aria-hidden="true">
      {viewerEmail} • CONFIDENTIAL
    </div>

    <!-- Semi-visible pattern watermark -->
    <div class="watermark pattern" aria-hidden="true">
      {#each Array(15) as _, i}
        <span style="left: {i * 7 + 2}%; top: {((i * 11) % 90) + 5}%">
          {fingerprint}
        </span>
      {/each}
    </div>

    <!-- Steganographic dots -->
    <svg class="watermark dots" viewBox="0 0 1000 1000" aria-hidden="true">
      {#each Array(40) as _, i}
        {@const x = (hashCode(fingerprint + i) % 900) + 50}
        {@const y = (hashCode(fingerprint + i + 'y') % 900) + 50}
        <circle cx={x} cy={y} r="1.5" fill="rgba(0,0,0,0.015)" />
      {/each}
    </svg>

    <!-- Content -->
    <div class="content">
      {@render children()}
    </div>

    <!-- Overlay on suspected capture -->
    {#if shieldActive}
      <div class="capture-shield" role="alert">
        <div class="shield-content">
          <svg class="shield-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M12 8v4M12 16h.01" />
          </svg>
          <p class="shield-message">{warningMessage}</p>
          <p class="shield-warning">This viewing session is logged</p>
          <p class="shield-identity">{viewerEmail}</p>
        </div>
      </div>
    {/if}

    <!-- Awareness bar -->
    <div class="awareness-bar">
      <div class="viewer-info">
        <span class="recording-dot" aria-hidden="true"></span>
        Viewing as: <strong>{viewerEmail}</strong>
      </div>
      <div class="session-info">
        Session logged • {Math.floor(elapsed / 60)}:{(elapsed % 60).toString().padStart(2, '0')}
      </div>
    </div>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .shield-container {
    position: relative;
  }

  .watermark {
    position: fixed;
    inset: 0;
    pointer-events: none;
    z-index: 100;
    user-select: none;
  }

  .watermark.visible {
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    color: rgba(0, 0, 0, 0.04);
    transform: rotate(-30deg);
    white-space: nowrap;
    font-family: monospace;
  }

  .watermark.pattern {
    position: fixed;
  }

  .watermark.pattern span {
    position: absolute;
    font-size: 0.6rem;
    color: rgba(0, 0, 0, 0.02);
    font-family: monospace;
    transform: rotate(-45deg);
  }

  .watermark.dots {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
  }

  .content {
    position: relative;
    z-index: 1;
    padding-bottom: 3rem; /* Space for awareness bar */
  }

  .capture-shield {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.95);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: shield-appear 0.1s ease-out;
  }

  @keyframes shield-appear {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .shield-content {
    text-align: center;
    color: white;
  }

  .shield-icon {
    width: 64px;
    height: 64px;
    margin: 0 auto 1rem;
    stroke: #ef4444;
  }

  .shield-message {
    font-size: 1.5rem;
    font-weight: 600;
    margin-bottom: 0.5rem;
  }

  .shield-warning {
    color: #fbbf24;
  }

  .shield-identity {
    margin-top: 1rem;
    font-family: monospace;
    color: #6b7280;
  }

  .awareness-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    background: #1f2937;
    color: white;
    padding: 0.5rem 1rem;
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    z-index: 9998;
  }

  .recording-dot {
    display: inline-block;
    width: 8px;
    height: 8px;
    background: #ef4444;
    border-radius: 50%;
    margin-right: 0.5rem;
    animation: pulse 1.5s infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .viewer-info strong {
    font-weight: 600;
  }

  .session-info {
    color: #9ca3af;
  }
</style>
